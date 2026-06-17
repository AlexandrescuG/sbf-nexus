/**
 * mobile-init.js — вся мобильная логика SBF.
 * Запускается только на ≤767px. Никакого canvas rAF, никакого snap.
 */
const IS_MOBILE = window.matchMedia('(max-width: 767px)').matches;

if (IS_MOBILE) {
  document.body.classList.add('is-mobile');

  /* Отключить snap если успел инициализироваться */
  document.addEventListener('DOMContentLoaded', () => {
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';

    /* ── Фикс-лого: скрывать на team/partners ─────────────── */
    const logoObs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const id = e.target.id;
        if (id === 'm-team')     document.body.classList.toggle('on-team', e.isIntersecting);
        if (id === 'm-partners') document.body.classList.toggle('on-partners', e.isIntersecting);
      });
    }, { threshold: 0.3 });

    ['m-team', 'm-partners'].forEach(id => {
      const el = document.getElementById(id);
      if (el) logoObs.observe(el);
    });

    /* ── Lead modal кнопки ─────────────────────────────────── */
    document.querySelectorAll('[data-open-modal]').forEach(btn => {
      btn.addEventListener('click', () => window.leadModal?.open());
    });

    /* ── Мобильный логотип → форма ─────────────────────────── */
    const mobileLogo = document.getElementById('mobile-fixed-logo');
    if (mobileLogo) {
      mobileLogo.style.cursor = 'pointer';
      mobileLogo.addEventListener('click', () => window.leadModal?.open());
    }

    /* ── Команда: заполнить грид из manifest ──────────────── */
    const ROLES = [
      { role: 'Quant-стратегия',       bio: 'Разработка количественных моделей и backtesting торговых систем' },
      { role: 'Архитектура риска',      bio: 'Построение риск-моделей и систем управления капиталом для клиентских портфелей' },
      { role: 'Макро-аналитика',        bio: 'Анализ глобальных макроэкономических тенденций и центробанковской политики' },
      { role: 'Операционная торговля',  bio: 'Исполнение торговых решений и операционное сопровождение счетов' },
      { role: 'Управление портфелями',  bio: 'Балансировка активов и стратегий доверительного управления' },
      { role: 'Технологическая платформа', bio: 'Инфраструктура и техническая интеграция с брокерами' },
    ];

    const teamGrid = document.getElementById('m-team-grid');
    if (teamGrid) {
      fetch('assets/team/manifest.json')
        .then(r => r.json())
        .catch(() => [])
        .then(manifest => {
          ROLES.forEach((item, i) => {
            const card = document.createElement('div');
            card.className = 'm-team-card';
            const imgFile = manifest[i] || '';
            const imgSrc  = imgFile ? `assets/team/${encodeURIComponent(imgFile)}` : '';
            card.innerHTML = `
              ${imgSrc ? `<img src="${imgSrc}" alt="" class="m-team-photo" loading="lazy">` : '<div class="m-team-photo m-team-photo--empty"></div>'}
              <p class="m-team-role">${item.role}</p>
              <p class="m-team-bio">${item.bio}</p>`;
            teamGrid.appendChild(card);
          });
        });
    }

    /* ── Память рынков: carousel + свечи ─────────────────── */
    const cases       = document.querySelectorAll('.m-case');
    const dots        = document.querySelectorAll('.m-dot');
    const carousel    = document.getElementById('m-cases');
    let activeIdx     = 0;
    let autoplayTimer = null;
    const rendered    = new Set();

    function showCase(idx) {
      cases.forEach((c, i) => c.classList.toggle('active', i === idx));
      dots.forEach((d, i)  => d.classList.toggle('active',  i === idx));
      activeIdx = idx;
      renderChart(idx);
    }

    function startAutoplay() {
      if (autoplayTimer) return;
      autoplayTimer = setInterval(() => showCase((activeIdx + 1) % cases.length), 5000);
    }
    function stopAutoplay() {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }

    dots.forEach((d, i) => d.addEventListener('click', () => { stopAutoplay(); showCase(i); }));

    /* Свайп */
    let touchStartX = 0;
    carousel?.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    carousel?.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) < 50) return;
      stopAutoplay();
      const next = dx < 0
        ? (activeIdx + 1) % cases.length
        : (activeIdx - 1 + cases.length) % cases.length;
      showCase(next);
    });

    /* Запуск autoplay когда блок виден */
    const marketsEl = document.getElementById('m-markets');
    if (marketsEl) {
      new IntersectionObserver((entries) => {
        entries.forEach(e => {
          if (e.isIntersecting) { startAutoplay(); renderChart(activeIdx); }
          else stopAutoplay();
        });
      }, { threshold: 0.3 }).observe(marketsEl);
    }

    /* Рендер свечей — один раз на кейс */
    async function renderChart(idx) {
      if (rendered.has(idx)) return;
      const canvas = cases[idx]?.querySelector('.m-case-chart');
      if (!canvas) return;
      const csvUrl = canvas.dataset.csv;
      if (!csvUrl) return;
      try {
        const text = await fetch(csvUrl).then(r => r.text());
        const rows = text.trim().split('\n').slice(1);
        const candles = rows.map(r => {
          const c = r.split(',');
          return { o: +c[1], h: +c[2], l: +c[3], c: +c[4] };
        }).filter(c => !isNaN(c.c));
        drawCandles(canvas, candles);
        rendered.add(idx);
      } catch (err) {
        console.warn('[m-chart] failed', idx, err);
      }
    }

    function drawCandles(canvas, candles) {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w   = canvas.offsetWidth  * dpr;
      const h   = canvas.offsetHeight * dpr;
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const pad = 12 * dpr;
      const cW  = w - pad * 2;
      const cH  = h - pad * 2;
      const vis = candles.slice(-120);
      const cndW = cW / vis.length;
      const maxP = Math.max(...vis.map(c => c.h));
      const minP = Math.min(...vis.map(c => c.l));
      const rng  = maxP - minP || 1;
      const yFor = p => pad + cH - ((p - minP) / rng) * cH;

      ctx.fillStyle = 'rgba(20,16,12,0.95)';
      ctx.fillRect(0, 0, w, h);

      vis.forEach((c, i) => {
        const x  = pad + i * cndW + cndW / 2;
        const up = c.c >= c.o;
        ctx.strokeStyle = up ? '#26a69a' : '#ef5350';
        ctx.fillStyle   = up ? '#26a69a' : '#ef5350';
        ctx.lineWidth   = 1 * dpr;
        ctx.beginPath(); ctx.moveTo(x, yFor(c.h)); ctx.lineTo(x, yFor(c.l)); ctx.stroke();
        const bTop = yFor(Math.max(c.o, c.c));
        const bH   = Math.max(Math.abs(yFor(c.o) - yFor(c.c)), 1 * dpr);
        ctx.fillRect(x - cndW * 0.35, bTop, cndW * 0.7, bH);
      });
    }

    /* ── Финал: Leaflet карта Кишинёва ────────────────────── */
    const SBF_COORDS = [47.0177661, 28.830598];

    function initMobileContactMap() {
      const el = document.getElementById('m-contact-map');
      if (!el || el.dataset.inited || typeof L === 'undefined') return;
      el.dataset.inited = '1';

      const map = L.map('m-contact-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false,
        doubleClickZoom: false, touchZoom: false, keyboard: false,
        center: SBF_COORDS, zoom: 2,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
      }).addTo(map);

      const icon = L.divIcon({
        className: 'sbf-logo-marker',
        html: '<img src="assets/logo/logo.svg" alt="SBF" />',
        iconSize: [52, 52], iconAnchor: [26, 26],
      });
      L.marker(SBF_COORDS, { icon, interactive: false }).addTo(map);
    }

    const contactEl = document.getElementById('m-contact');
    if (contactEl) {
      new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) initMobileContactMap(); });
      }, { threshold: 0.1 }).observe(contactEl);
    }
  });
}

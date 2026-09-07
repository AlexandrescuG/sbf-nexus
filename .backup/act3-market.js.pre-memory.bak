/**
 * act3-market.js — Stop 4: Память рынков (carousel).
 * 6 статичных слайдов с canvas-графиками + autoplay 5s.
 * Dots/arrows управляют вручную (autoplay отключается при клике).
 * Wheel внутри carousel → data-no-snap, snap-движок перехватывает.
 */

const CHARTS = [
  {
    file   : 'assets/data/EURUSD_gap_may2026.csv',
    cur    : '',
    caseId : 'eurusd',
    maxBars: 380,
    overlay: { type: 'gap', gapLow: 1.1605, gapHigh: 1.1644 },
  },
  {
    file   : 'assets/data/NatGas_NG_2023.csv',
    cur    : '$',
    caseId : 'ng',
  },
  {
    file   : 'assets/data/XAUUSD_triangle_breakout_may2026.csv',
    cur    : '$',
    caseId : 'gold-tri',
    maxBars: 224,
    overlay: { type: 'hline', level: 4440 },
  },
  {
    file   : 'assets/data/XAUUSD_bollinger_squeeze_pool.csv',
    cur    : '$',
    caseId : 'gold-bol',
    maxBars: 400,
    overlay: { type: 'band', low: 4670, high: 4730 },
  },
  {
    file   : 'assets/data/USDJPY_intervention_may2026.csv',
    cur    : '',
    caseId : 'jpy',
    maxBars: 200,
    overlay: { type: 'hline', level: 160.0 },
  },
  {
    file   : 'assets/data/Copper_channel_breakout_2026.csv',
    cur    : '$',
    caseId : 'copper',
    maxBars: 346,
  },
];

/* ── CSV парсер ─────────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const hdr   = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const v = line.split(',');
    const r = {};
    hdr.forEach((h, i) => { r[h] = v[i]?.trim(); });
    return {
      open : parseFloat(r.Open  || r.open),
      high : parseFloat(r.High  || r.high),
      low  : parseFloat(r.Low   || r.low),
      close: parseFloat(r.Close || r.close),
    };
  }).filter(d => !isNaN(d.open));
}

/* ── Оверлей паттерна (золотая разметка) ─────────────────── */
function drawPatternOverlay(ctx, overlay, yS, P, w) {
  if (!overlay) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(201,162,39,0.80)';
  ctx.lineWidth   = 1.5;

  const hline = level => {
    const y = yS(level);
    ctx.beginPath();
    ctx.moveTo(P.l, y);
    ctx.lineTo(w - P.r, y);
    ctx.stroke();
  };

  if (overlay.type === 'hline') {
    ctx.setLineDash([5, 4]);
    hline(overlay.level);
  } else if (overlay.type === 'gap') {
    const y1 = yS(overlay.gapLow);
    const y2 = yS(overlay.gapHigh);
    /* Закрашиваем зону гэпа */
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(201,162,39,0.07)';
    ctx.fillRect(P.l, Math.min(y1, y2), w - P.l - P.r, Math.abs(y1 - y2));
    /* Границы гэпа */
    ctx.setLineDash([5, 4]);
    hline(overlay.gapLow);
    hline(overlay.gapHigh);
  } else if (overlay.type === 'band') {
    const y1 = yS(overlay.low);
    const y2 = yS(overlay.high);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(201,162,39,0.07)';
    ctx.fillRect(P.l, Math.min(y1, y2), w - P.l - P.r, Math.abs(y1 - y2));
    ctx.setLineDash([5, 4]);
    hline(overlay.low);
    hline(overlay.high);
  }

  ctx.setLineDash([]);
  ctx.restore();
}

/* ── Статичный рендер свечей на canvas ──────────────────── */
function drawStatic(canvas, data, cfg) {
  const overlay = cfg?.overlay;
  const maxBars = cfg?.maxBars || 80;

  const dpr  = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = canvas.offsetWidth  || 600;
  const cssH = canvas.offsetHeight || 500;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = cssW, h = cssH;
  const N = Math.min(data.length, maxBars);
  const slice = data.slice(-N);
  const n = slice.length;

  const maxV = Math.max(...slice.map(d => d.high));
  const minV = Math.min(...slice.map(d => d.low));
  const pad  = (maxV - minV) * 0.08;
  const vTop = maxV + pad, vBot = minV - pad, vSpan = vTop - vBot || 1;

  const P    = { t: h * 0.06, r: w * 0.03, b: h * 0.06, l: w * 0.03 };
  const cW   = w - P.l - P.r;
  const cH   = h - P.t - P.b;
  const yS   = v => P.t + (1 - (v - vBot) / vSpan) * cH;
  const slotW = cW / n;
  const bodyW = Math.max(1, slotW * 0.62);

  /* Фон */
  ctx.fillStyle = 'rgba(8, 6, 14, 0.90)';
  ctx.fillRect(0, 0, w, h);

  /* Сетка */
  ctx.strokeStyle = 'rgba(201,162,39,0.07)';
  ctx.lineWidth   = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = P.t + (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(w - P.r, y); ctx.stroke();
  }

  /* Оверлей паттерна (рисуется ДО свечей, чтобы свечи были сверху) */
  drawPatternOverlay(ctx, overlay, yS, P, w);

  /* Свечи */
  slice.forEach((d, i) => {
    const cx     = P.l + (i + 0.5) * slotW;
    const isBull = d.close >= d.open;
    const col    = isBull ? 'rgba(76,175,80,0.85)' : 'rgba(229,115,115,0.85)';
    const oY   = yS(d.open), cY = yS(d.close);
    const hY   = yS(d.high), lY = yS(d.low);
    const bTop = Math.min(oY, cY);
    const bH   = Math.max(1, Math.abs(oY - cY));

    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, hY); ctx.lineTo(cx, lY); ctx.stroke();
    ctx.fillStyle = col;
    ctx.fillRect(cx - bodyW / 2, bTop, bodyW, bH);
  });

  /* Золотой оверлей по краям */
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0,   'rgba(201,162,39,0.20)');
  g.addColorStop(0.1, 'rgba(201,162,39,0)');
  g.addColorStop(0.9, 'rgba(201,162,39,0)');
  g.addColorStop(1,   'rgba(201,162,39,0.20)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

/* ── Carousel logic ─────────────────────────────────────── */
function initCarousel() {
  const section = document.getElementById('act-market');
  if (!section) return;

  const slides  = Array.from(section.querySelectorAll('.market-slide'));
  const dots    = Array.from(section.querySelectorAll('.market-dots .dot'));
  const overlay = section.querySelector('#market-overlay');
  const total   = slides.length;

  let current  = 0;
  let autoplay = null;
  let userTook = false;

  function goTo(idx) {
    slides[current].classList.remove('active');
    dots[current]?.classList.remove('active');
    current = (idx + total) % total;
    slides[current].classList.add('active');
    dots[current]?.classList.add('active');
  }

  function startAutoplay() {
    if (autoplay) return;
    autoplay = setInterval(() => {
      if (!userTook) goTo(current + 1);
    }, 5000);
  }

  function stopAutoplay() {
    if (autoplay) { clearInterval(autoplay); autoplay = null; }
  }

  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      userTook = true;
      stopAutoplay();
      goTo(parseInt(dot.dataset.idx, 10));
    });
  });

  /* Делегируем клики на стрелки через секцию — работает для всех слайдов */
  section.addEventListener('click', e => {
    if (e.target.closest('.market-arrow-left')) {
      userTook = true; stopAutoplay(); goTo(current - 1);
    } else if (e.target.closest('.market-arrow-right')) {
      userTook = true; stopAutoplay(); goTo(current + 1);
    }
  });

  /* Свайп по carousel на телефоне */
  const carousel = section.querySelector('.market-carousel');
  if (carousel) {
    let tsX = 0;
    carousel.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', e => {
      const dx = tsX - e.changedTouches[0].clientX;
      if (Math.abs(dx) < 40) return;
      userTook = true; stopAutoplay();
      goTo(dx > 0 ? current + 1 : current - 1);
    }, { passive: true });
  }

  section.addEventListener('snap-enter', () => {
    userTook = false;
    goTo(0);
    startAutoplay();
    if (overlay) gsap.fromTo(overlay, { opacity: 0, y: -16 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' });
  });

  section.addEventListener('snap-leave', () => {
    stopAutoplay();
    userTook = false;
    if (overlay) gsap.to(overlay, { opacity: 0, duration: 0.3 });
  });
}

/* ── Загрузка данных + рендер ───────────────────────────── */
async function initMarketDesktop() {
  /* Рисуем статичные графики на слайдах */
  for (const cfg of CHARTS) {
    try {
      const text   = await fetch(cfg.file).then(r => r.text());
      const data   = parseCSV(text);
      const slide  = document.querySelector(`.market-slide[data-case="${cfg.caseId}"]`);
      const canvas = slide?.querySelector('.market-slide-chart');
      if (canvas && data.length) {
        requestAnimationFrame(() => drawStatic(canvas, data, cfg));
      }
    } catch (e) {
      console.warn('[market] chart load failed:', cfg.caseId, e);
    }
  }

  initCarousel();

  /* На мобиле snap-enter не стреляет — запускаем carousel через IO */
  if (window.matchMedia('(max-width: 1023px)').matches) {
    const section = document.getElementById('act-market');
    if (section) {
      new IntersectionObserver(entries => {
        const e = entries[0];
        section.dispatchEvent(new CustomEvent(e.isIntersecting ? 'snap-enter' : 'snap-leave'));
      }, { threshold: 0.3 }).observe(section);
    }
  }
}

/* Lazy-init: fetch CSV только когда пользователь приближается к секции */
(function lazyInitMarket() {
  const section = document.getElementById('act-market');
  if (!section) { document.fonts.ready.then(initMarketDesktop); return; }
  let inited = false;
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting && !inited) {
        inited = true;
        obs.disconnect();
        document.fonts.ready.then(initMarketDesktop);
      }
    });
  }, { rootMargin: '500px' });
  obs.observe(section);
})();

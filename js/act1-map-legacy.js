/**
 * act1-map-legacy.js — Hero-карта: маркеры финансовых центров.
 * Hover: название города + год основания биржи.
 * Click: попап с полной информацией (inst · scale · paradox).
 * Только десктоп (≥1024px). Мобильная карта — mobile-init.js.
 */

/* ── Попап-модал (создаётся один раз) ───────────────────── */
function buildCityPopup() {
  if (document.getElementById('city-popup-overlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'city-popup-overlay';
  overlay.innerHTML = `
    <div id="city-popup" role="dialog" aria-modal="true" data-no-snap>
      <button id="city-popup-close" aria-label="Закрыть">×</button>
      <div class="city-popup-region" id="city-popup-region"></div>
      <h2 class="city-popup-name" id="city-popup-name"></h2>
      <div class="city-popup-inst" id="city-popup-inst"></div>
      <div class="city-popup-divider"></div>
      <p class="city-popup-scale" id="city-popup-scale"></p>
      <div class="city-popup-paradox-block">
        <p class="city-popup-paradox-label">ПАРАДОКС</p>
        <p class="city-popup-paradox-text" id="city-popup-paradox"></p>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  function close() {
    overlay.classList.remove('open');
    document.getElementById('city-popup').classList.remove('open');
    if (window.snapNav) window.snapNav.locked = false;
  }

  document.getElementById('city-popup-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

function openCityPopup(city) {
  const overlay = document.getElementById('city-popup-overlay');
  const popup   = document.getElementById('city-popup');
  if (!overlay) return;

  const regions = {
    na: 'Северная Америка', sa: 'Южная Америка', eu: 'Европа',
    me: 'Ближний Восток', as: 'Азия', af: 'Африка', oc: 'Океания',
  };

  document.getElementById('city-popup-region').textContent  = regions[city.region] || '';
  document.getElementById('city-popup-name').textContent    = city.name;
  document.getElementById('city-popup-inst').textContent    = city.inst;
  document.getElementById('city-popup-scale').textContent   = city.scale;
  document.getElementById('city-popup-paradox').textContent = city.paradox;

  if (window.snapNav) window.snapNav.locked = true;
  overlay.classList.add('open');
  requestAnimationFrame(() => popup.classList.add('open'));
}

/* ── Карта ───────────────────────────────────────────────── */
function initMap() {
  const container = document.getElementById('world-map');
  if (!container) return;
  if (!container.offsetHeight) container.style.height = window.innerHeight + 'px';

  buildCityPopup();

  const map = L.map('world-map', {
    center: [28, 18], zoom: 3,
    zoomControl: false, attributionControl: false,
    scrollWheelZoom: false, dragging: false,
    keyboard: false, doubleClickZoom: false,
    minZoom: 3, maxZoom: 6,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
    maxZoom: 6, subdomains: 'abcd',
  }).addTo(map);

  /* Анимация пульса маркера */
  const style = document.createElement('style');
  style.textContent = `
    @keyframes mapPulse {
      0%   { box-shadow: 0 0 0 0 rgba(201,162,39,0.6); }
      70%  { box-shadow: 0 0 0 8px rgba(201,162,39,0); }
      100% { box-shadow: 0 0 0 0 rgba(201,162,39,0); }
    }
  `;
  document.head.appendChild(style);

  const cities = window._sbfCities || [];
  cities.forEach(c => {
    const w    = c.weight || 1;
    const size = Math.round(5 + w * 1.5);
    const bg   = c.home ? '#E6C257' : '#C9A227';

    const icon = L.divIcon({
      className: '',
      html: `<div style="
        width:${size}px; height:${size}px;
        background:${bg}; border-radius:50%;
        box-shadow:0 0 0 0 rgba(201,162,39,0.5);
        animation:mapPulse ${1.5 + w * 0.2}s infinite;
        opacity:${0.5 + w * 0.1};
        cursor:pointer;
      "></div>`,
      iconSize:   [size, size],
      iconAnchor: [size / 2, size / 2],
    });

    /* Тултип: название + год */
    const yearLine = c.founded
      ? `<span class="map-tip-year">${c.inst} · ${c.founded}</span>`
      : `<span class="map-tip-year">${c.inst}</span>`;

    const tipHtml = `<strong class="map-tip-city">${c.name}</strong>${yearLine}`;

    const marker = L.marker([c.lat, c.lng], { icon })
      .bindTooltip(tipHtml, {
        className: 'map-tooltip',
        permanent: false,
        direction: 'right',
        offset: [size / 2 + 4, 0],
      })
      .addTo(map);

    /* Попап по клику */
    marker.on('click', () => openCityPopup(c));
  });

  window._sbfMap = map;
  setTimeout(() => map.invalidateSize(), 100);

  /* Тикер GSAP */
  function initTicker() {
    const track = document.getElementById('ticker-track');
    if (!track || !window.gsap) return;
    const w = track.scrollWidth / 2;
    gsap.to(track, { x: -w, duration: 45, ease: 'none', repeat: -1 });
  }
  initTicker();
}

if (document.readyState === 'complete') initMap();
else window.addEventListener('load', initMap);

window.addEventListener('scroll', () => {
  const nav = document.getElementById('site-nav');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 80);
}, { passive: true });

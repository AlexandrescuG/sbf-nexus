/**
 * act-approach.js — Stop 3: Подход + золотой XAU/USD 4H.
 * Snap-enter: fade-in копи + график. GoldTape — автономный rAF.
 */

/* ── GoldTape ──────────────────────────────────────────── */
class GoldTape {
  constructor(canvas, candles, cssW, cssH) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.data   = candles;
    this.cssW   = cssW; this.cssH = cssH;
    this.position    = candles.length * 0.3;
    this.cps         = 0.5;
    this.visibleCount = window.matchMedia('(max-width: 767px)').matches ? 80 : 120;
    this.last        = performance.now();
    this._active     = true;
    this._tick = this._tick.bind(this);
    requestAnimationFrame(this._tick);
  }

  resize(cssW, cssH, dpr) {
    this.cssW = cssW; this.cssH = cssH;
    this.canvas.width  = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width  = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(1,0,0,1,0,0); ctx.scale(dpr, dpr);
    this.ctx = ctx;
  }

  stop()  { this._active = false; }
  start() { if (!this._active) { this._active = true; this.last = performance.now(); requestAnimationFrame(this._tick); } }

  _tick(now) {
    if (!this._active) return;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (!window._sbfReducedMotion)
      this.position = (this.position + this.cps * dt) % this.data.length;
    this._render();
    requestAnimationFrame(this._tick);
  }

  _render() {
    const { ctx, data, visibleCount, position } = this;
    const w = this.cssW, h = this.cssH;
    if (!w || !h) return;
    const slotW    = w / visibleCount;
    const bodyW    = slotW * 0.7;
    const startIdx = Math.floor(position);
    const offset   = (position - startIdx) * slotW;
    const visible  = [];
    for (let i = 0; i <= visibleCount + 1; i++)
      visible.push(data[(startIdx + i) % data.length]);
    const minP = Math.min(...visible.map(c => c.low));
    const maxP = Math.max(...visible.map(c => c.high));
    const range = maxP - minP || 1;
    const padT = h * 0.10, padB = h * 0.10;
    const yS = p => padT + (1 - (p - minP) / range) * (h - padT - padB);
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i <= visibleCount + 1; i++) {
      const c = data[(startIdx + i) % data.length];
      const x = i * slotW - offset;
      const fadeL = Math.min(1, x / (slotW * 8));
      const fadeR = Math.min(1, (w - x) / (slotW * 8));
      ctx.globalAlpha = Math.max(0, Math.min(fadeL, fadeR));
      const isBull = c.close >= c.open;
      const color  = isBull ? '#26a69a' : '#ef5350';
      const yO = yS(c.open), yC = yS(c.close);
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yS(c.high)); ctx.lineTo(x, yS(c.low)); ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x - bodyW/2, Math.min(yO,yC), bodyW, Math.max(1, Math.abs(yC-yO)));
    }
    ctx.globalAlpha = 1;
  }
}

/* ── initApproach ──────────────────────────────────────── */
async function initApproach() {
  const stage = document.getElementById('approach-stage');
  const copy  = document.getElementById('approach-copy');
  const wrap  = document.getElementById('approach-chart');
  if (!stage || !wrap) return;

  let data;
  try {
    const txt = await fetch('assets/data/XAUUSD_4H_uptrend.csv').then(r => r.text());
    data = txt.trim().split('\n').slice(1).map(l => {
      const [, o, h, lo, c] = l.split(',');
      return { open: +o, high: +h, low: +lo, close: +c };
    }).filter(d => !isNaN(d.open));
  } catch (e) {
    console.warn('[approach] CSV load failed', e);
    return;
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cv  = document.createElement('canvas');
  wrap.appendChild(cv);

  const getSize = () => {
    const r = wrap.getBoundingClientRect();
    return { w: r.width || wrap.offsetWidth, h: r.height || wrap.offsetHeight };
  };
  const { w: initW, h: initH } = getSize();
  cv.width  = Math.round(initW * dpr);
  cv.height = Math.round(initH * dpr);
  cv.style.width  = initW + 'px';
  cv.style.height = initH + 'px';
  cv.getContext('2d').scale(dpr, dpr);

  const tape = new GoldTape(cv, data, initW, initH);

  window.addEventListener('resize', () => {
    const { w, h } = getSize();
    if (w && h) tape.resize(w, h, dpr);
  });

  /* Десктоп: snap-enter / snap-leave */
  const logoWrap = document.getElementById('sbf-logo');
  tape.start(); /* GoldTape всегда идёт в фоне */

  const section = document.getElementById('act-approach');

  section?.addEventListener('snap-enter', () => {
    gsap.fromTo(copy,
      { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }
    );
    gsap.to(wrap, { opacity: 1, duration: 0.7, delay: 0.15 });
  });

  section?.addEventListener('snap-leave', () => {
    gsap.to([copy, wrap], { opacity: 0, duration: 0.3 });
  });
}

document.fonts.ready.then(initApproach);

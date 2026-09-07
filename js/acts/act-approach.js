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
    /* Линза: окружность в CSS-пикселях канваса. Ставит initApproach по
       положению .approach-lens; пока не задана — второго прохода нет. */
    this.lens        = null;
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

    if (this.lens) this._renderLens(visible, startIdx, slotW, bodyW, offset, yS, minP, maxP);
  }

  /* ── Линза ──────────────────────────────────────────────────────────────
     Второй проход по тем же свечам, но внутри окружности знака и с
     разметкой. Лента движется, знак стоит — закономерности «проявляются»
     ровно в момент прохождения через него. Это и есть обещание сайта,
     показанное на существующих данных: снаружи шум, внутри структура. */
  _renderLens(visible, startIdx, slotW, bodyW, offset, yS, minP, maxP) {
    const { ctx, data } = this;
    const { x: lx, y: ly, r: lr } = this.lens;
    if (!lr) return;

    ctx.save();
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.clip();

    /* Фон линзы — чуть светлее, чтобы разметка читалась */
    ctx.fillStyle = 'rgba(251, 246, 239, 0.55)';
    ctx.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);

    /* Уровни: максимум и минимум окна — то, на что смотрит аналитик первым */
    const yHi = yS(maxP), yLo = yS(minP);
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(154, 123, 30, 0.75)'; ctx.lineWidth = 1;
    [yHi, yLo].forEach(y => { ctx.beginPath(); ctx.moveTo(lx - lr, y); ctx.lineTo(lx + lr, y); ctx.stroke(); });
    ctx.setLineDash([]);

    /* Скользящая по 20 свечам */
    const N = 20;
    ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 1.6;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < visible.length; i++) {
      let sum = 0, n = 0;
      for (let k = 0; k < N; k++) {
        const c = data[(startIdx + i - k + data.length) % data.length];
        if (c) { sum += c.close; n++; }
      }
      const x = i * slotW - offset, y = yS(sum / n);
      if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();

    /* Свечи внутри — те же, но в полную силу и чуть шире */
    for (let i = 0; i < visible.length; i++) {
      const c = visible[i];
      const x = i * slotW - offset;
      if (x < lx - lr - slotW || x > lx + lr + slotW) continue;
      const isBull = c.close >= c.open;
      const color  = isBull ? '#1f8f83' : '#d94a45';
      const yO = yS(c.open), yC = yS(c.close);
      ctx.strokeStyle = color; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x, yS(c.high)); ctx.lineTo(x, yS(c.low)); ctx.stroke();
      ctx.fillStyle = color;
      ctx.fillRect(x - bodyW * 0.55, Math.min(yO, yC), bodyW * 1.1, Math.max(1.5, Math.abs(yC - yO)));
    }

    /* Паттерн: самая высокая свеча в окне линзы — точка, где структура
       становится видимой. Подсвечиваем, пока она внутри кольца. */
    let best = -1, bestHigh = -Infinity;
    for (let i = 0; i < visible.length; i++) {
      const x = i * slotW - offset;
      if (Math.abs(x - lx) > lr) continue;
      if (visible[i].high > bestHigh) { bestHigh = visible[i].high; best = i; }
    }
    if (best >= 0) {
      const x = best * slotW - offset, y = yS(bestHigh);
      ctx.fillStyle = '#E6C257';
      ctx.beginPath(); ctx.arc(x, y - 6, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(230, 194, 87, 0.8)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y - 6, 7, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();

    /* Оправа: тонкое кольцо по границе клипа */
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(lx, ly, lr, 0, Math.PI * 2); ctx.stroke();
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

  /* Линза = окружность знака в координатах канваса. Считаем по фактическому
     прямоугольнику .approach-lens: так CSS остаётся единственным местом,
     где задан размер и положение знака. */
  const lensEl = wrap.querySelector('.approach-lens');
  const placeLens = () => {
    if (!lensEl) return;
    const a = cv.getBoundingClientRect(), b = lensEl.getBoundingClientRect();
    if (!a.width || !b.width) return;
    /* Кольцо .mark-fill рисуется с inset -34%: радиус клипа = радиус кольца */
    tape.lens = { x: b.left + b.width / 2 - a.left, y: b.top + b.height / 2 - a.top,
                  r: b.width * 0.5 * 1.68 * 0.92 };
  };
  placeLens();

  window.addEventListener('resize', () => {
    const { w, h } = getSize();
    if (w && h) tape.resize(w, h, dpr);
    placeLens();
  });
  /* Шрифты и фейд секции меняют размеры уже после первого кадра */
  setTimeout(placeLens, 900);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeLens);

  /* Десктоп: snap-enter / snap-leave */
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

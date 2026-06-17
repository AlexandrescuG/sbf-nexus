/**
 * ThreadLayer — Фаза 2.
 * Нити: толщина/яркость/число прядей масштабируются по city.weight (1–5).
 * Кишинёв (home:true) — особый цвет нити.
 */
import { CITIES } from './data/cities.js';

export class ThreadLayer {
  constructor(engine) {
    this.engine = engine;
    this.time   = 0;
    this._seeds = CITIES.map((_, i) => i * 1.37 + 0.42);
    this._wobbleAmp   = 28;
    this._wobbleSpeed = 0.36;
    this._cityPts     = null;
    this._mapListened = false;
    /* Финальная анимация: 0 = все нити, 1 = только домашняя (Кишинёв) */
    this._fadeExceptHome = 0;
    this._homeBoost      = 1; // множитель яркости домашней нити
  }

  /* Плавно гасит все нити кроме городa с home:true (Кишинёва) */
  fadeAllExceptCity(dur = 1.0) {
    gsap.to(this, { _fadeExceptHome: 1, _homeBoost: 2.2, duration: dur, ease: 'power2.inOut' });
  }

  /* Восстанавливает все нити */
  restoreAll(dur = 0.6) {
    gsap.to(this, { _fadeExceptHome: 0, _homeBoost: 1, duration: dur, ease: 'power2.inOut' });
  }

  _tryBind() {
    if (this._mapListened || !window._sbfMap) return;
    window._sbfMap.on('moveend zoomend resize', () => { this._cityPts = null; });
    this._mapListened = true;
  }

  _recompute() {
    const map = window._sbfMap;
    if (!map) return false;
    this._tryBind();
    this._cityPts = CITIES.map(c => {
      const pt = map.latLngToContainerPoint([c.lat, c.lng]);
      return { x: pt.x, y: pt.y };
    });
    return true;
  }

  resize() { this._cityPts = null; }
  update(dt) { this.time += dt; }

  draw(ctx) {
    if (!this._cityPts && !this._recompute()) return;

    const scrollY = window.scrollY || 0;
    const vh      = this.engine.H;
    if (scrollY >= vh) return;
    const fadeT = Math.max(0, 1 - scrollY / (vh * 0.55));
    if (fadeT <= 0.01) return;

    const { cx, cy } = this.engine;
    const isMobile   = this.engine.W < 768;

    ctx.save();
    ctx.lineCap = 'round';

    CITIES.forEach((c, i) => {
      /* На мобиле показываем только города с весом ≥ 3 */
      if (isMobile && (c.weight || 1) < 3) return;
      const pt = this._cityPts[i];
      const tx = pt.x;
      const ty = pt.y - scrollY;

      const w       = c.weight || 1;
      /* Финальная анимация — гасим не-домашние нити */
      const threadVis = c.home
        ? this._homeBoost
        : (1 - this._fadeExceptHome);
      if (threadVis <= 0.01) return;
      const alpha   = (0.10 + w * 0.045) * fadeT * threadVis;
      const lineW   = (0.6 + w * 0.7) * (c.home ? this._homeBoost : 1);
      const strands = w >= 5 ? 3 : w >= 4 ? 2 : 1;

      // Перпендикуляр для воббла и смещения прядей
      const dx  = tx - cx, dy = ty - cy;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const px  = -dy / len, py = dx / len;

      // Базовая контрольная точка (воббл)
      const wobble  = this._wobbleAmp * Math.sin(this.time * this._wobbleSpeed + this._seeds[i]);
      const baseCpx = (cx + tx) / 2 + px * wobble;
      const baseCpy = (cy + ty) / 2 + py * wobble;

      // Цвет: дом (Кишинёв) — чуть ярче и теплее
      const r = c.home ? 220 : 201;
      const g = c.home ? 170 : 162;
      const b = c.home ?  50 :  39;

      const grad = ctx.createLinearGradient(cx, cy, tx, ty);
      grad.addColorStop(0,    `rgba(${r},${g},${b},${(alpha * 0.45).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(230,194,87,${(alpha * 1.0 ).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(230,194,87,${(alpha * 1.0 ).toFixed(3)})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},${(alpha * 0.2 ).toFixed(3)})`);

      ctx.lineWidth   = lineW;
      ctx.strokeStyle = grad;

      for (let k = 0; k < strands; k++) {
        const off  = (k - (strands - 1) / 2) * 3; // смещение пряди ±3px
        const cpx  = baseCpx + px * off;
        const cpy  = baseCpy + py * off;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(cpx, cpy, tx, ty);
        ctx.stroke();
      }
    });

    ctx.restore();
  }
}

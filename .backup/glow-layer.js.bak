/**
 * GlowLayer — Фаза 1.
 * Рисует радиальное золотое свечение + лёгкий bloom за логотипом.
 * Подключается к CoreEngine как layer: { update(dt), draw(ctx), resize(W,H) }
 */
export class GlowLayer {
  constructor(engine) {
    this.engine   = engine;
    this.time     = 0;
    // Мерцание: медленный синус
    this._flickerBase  = 0.68; // базовая непрозрачность внутреннего кольца
    this._flickerAmp   = 0.14; // амплитуда мерцания
    this._flickerSpeed = 0.55; // рад/с
  }

  resize(W, H) {
    /* ничего, cx/cy берём из engine */
  }

  update(dt) {
    this.time += dt;
  }

  draw(ctx) {
    const { cx, cy, W, H } = this.engine;

    const flicker = this._flickerBase +
      Math.sin(this.time * this._flickerSpeed) * this._flickerAmp;

    /* ── Широкая тёплая корона ───────────────────────────── */
    const coronaR = Math.min(W, H) * 0.22;
    const corona  = ctx.createRadialGradient(cx, cy, 1, cx, cy, coronaR);
    corona.addColorStop(0.00, `rgba(230, 194, 87, ${(flicker * 0.85).toFixed(3)})`);
    corona.addColorStop(0.08, `rgba(201, 162, 39, ${(flicker * 0.55).toFixed(3)})`);
    corona.addColorStop(0.20, `rgba(201, 162, 39, ${(flicker * 0.25).toFixed(3)})`);
    corona.addColorStop(0.42, `rgba(201, 162, 39, ${(flicker * 0.08).toFixed(3)})`);
    corona.addColorStop(0.70, 'rgba(201, 162, 39, 0.02)');
    corona.addColorStop(1.00, 'rgba(201, 162, 39, 0.00)');

    ctx.beginPath();
    ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
    ctx.fillStyle = corona;
    ctx.fill();

    /* ── Bloom: inner bright core (additive) ─────────────── */
    const saved = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    const bloomR = 52;
    const bloom  = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
    bloom.addColorStop(0.00, `rgba(255, 240, 160, ${(flicker * 0.30).toFixed(3)})`);
    bloom.addColorStop(0.40, `rgba(230, 194, 87,  ${(flicker * 0.12).toFixed(3)})`);
    bloom.addColorStop(1.00, 'rgba(201, 162, 39, 0.00)');

    ctx.beginPath();
    ctx.arc(cx, cy, bloomR, 0, Math.PI * 2);
    ctx.fillStyle = bloom;
    ctx.fill();

    ctx.globalCompositeOperation = saved;
  }
}

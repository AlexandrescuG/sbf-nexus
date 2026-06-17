/**
 * SignalLayer — одноразовые нити «паттерн → лого».
 * Вызывается из act3-market при достижении threadAnchor.
 * Рисуется на CoreEngine canvas, поверх chart-wrap-ов (z-index поднимает CoreEngine).
 */

function qBez(t, x0, y0, x1, y1, x2, y2) {
  const u = 1 - t;
  return { x: u*u*x0 + 2*u*t*x1 + t*t*x2, y: u*u*y0 + 2*u*t*y1 + t*t*y2 };
}

export class SignalLayer {
  constructor(engine) {
    this.engine   = engine;
    this._signals = [];
  }

  addSignal(sx, sy) {
    this._signals.push({ sx, sy, t: 0, dur: 1.8 });
  }

  update(dt) {
    for (const s of this._signals) s.t = Math.min(s.t + dt, s.dur);
    this._signals = this._signals.filter(s => s.t < s.dur);
  }

  draw(ctx) {
    if (!this._signals.length) return;
    const { cx, cy } = this.engine;
    const savedOp = ctx.globalCompositeOperation;

    for (const s of this._signals) {
      const p    = s.t / s.dur;
      const fade = p < 0.1 ? p / 0.1 : p > 0.82 ? (1 - p) / 0.18 : 1;
      if (fade < 0.01) continue;

      /* Контрольная точка — лёгкий изгиб */
      const mx  = (s.sx + cx) / 2, my = (s.sy + cy) / 2;
      const dx  = cx - s.sx,       dy = cy - s.sy;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const cpx = mx - (dy / len) * len * 0.12;
      const cpy = my + (dx / len) * len * 0.12;

      /* Пунктирная нить */
      ctx.save();
      ctx.globalAlpha  = fade * 0.55;
      ctx.strokeStyle  = '#C9A227';
      ctx.lineWidth    = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.quadraticCurveTo(cpx, cpy, cx, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      /* Пульс-сгусток (additive) */
      const pos    = qBez(p, s.sx, s.sy, cpx, cpy, cx, cy);
      const bright = (1 - Math.pow(2 * p - 1, 2)) * fade;
      const r      = 16;

      ctx.globalCompositeOperation = 'lighter';
      const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
      grd.addColorStop(0,    `rgba(255,248,180,${(bright * 0.95).toFixed(3)})`);
      grd.addColorStop(0.35, `rgba(230,194,87, ${(bright * 0.55).toFixed(3)})`);
      grd.addColorStop(1,    'rgba(201,162,39, 0)');
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.globalCompositeOperation = savedOp;
    }
  }
}

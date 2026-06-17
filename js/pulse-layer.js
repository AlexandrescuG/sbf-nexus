/**
 * PulseLayer — Фаза 3.
 * Пульс: яркий сгусток бежит по нити core→город (quadratic bezier, additive blend).
 * GhostFlash: текст из FLASH_POOL всплывает у середины нити, на затухании запускает пульс.
 * Object pool — без мусора каждый кадр.
 */
import { CITIES     } from './data/cities.js';
import { FLASH_POOL } from './data/flash-pool.js';

/* Те же параметры нити что в ThreadLayer — контрольные точки совпадут */
const WOBBLE_AMP   = 30;
const WOBBLE_SPEED = 0.36;
const SEEDS        = CITIES.map((_, i) => i * 1.37 + 0.42);

/* ── Математика ─────────────────────────────────────────── */
function quadBezier(t, x0, y0, x1, y1, x2, y2) {
  const u = 1 - t;
  return { x: u*u*x0 + 2*u*t*x1 + t*t*x2,
           y: u*u*y0 + 2*u*t*y1 + t*t*y2 };
}

function ctrlPt(cx, cy, tx, ty, time, seed) {
  const mx = (cx+tx)/2, my = (cy+ty)/2;
  const dx = tx-cx, dy = ty-cy;
  const len = Math.sqrt(dx*dx + dy*dy) || 1;
  const w = WOBBLE_AMP * Math.sin(time * WOBBLE_SPEED + seed);
  return { x: mx + (-dy/len)*w, y: my + (dx/len)*w };
}

/* ── Object pool: Pulse ─────────────────────────────────── */
class Pulse {
  constructor() { this.active = false; this.forced = false; }

  spawn(idx, forced = false) {
    this.active    = true;
    this.idx       = idx;
    this.elapsed   = 0;
    this.duration  = 0.8 + Math.random() * 0.4; // 0.8–1.2 с
    this.forced    = forced; // forced-пульс игнорирует fadeT и scrollY-клип
  }

  advance(dt) {
    if (!this.active) return;
    this.elapsed += dt;
    if (this.elapsed >= this.duration) this.active = false;
  }

  get t() {
    /* ease-in-out: разгон от центра, торможение у города */
    const raw = Math.min(1, this.elapsed / this.duration);
    return raw < 0.5
      ? 2 * raw * raw
      : 1 - Math.pow(-2 * raw + 2, 2) / 2;
  }
}

/* ── Object pool: GhostFlash ────────────────────────────── */
class GhostFlash {
  constructor() { this.active = false; }

  spawn(idx, text) {
    this.active   = true;
    this.idx      = idx;
    this.text     = text;
    this.phase    = 'in';  // 'in' | 'hold' | 'out'
    this.timer    = 0;
    this.holdDur  = 0.5 + Math.random() * 0.2;
    this.opacity  = 0;
    this.onDone   = null; // колбэк по завершению
  }

  advance(dt) {
    if (!this.active) return false;
    this.timer += dt;
    if (this.phase === 'in') {
      this.opacity = Math.min(1, this.timer / 0.3);
      if (this.timer >= 0.3) { this.phase = 'hold'; this.timer = 0; }
    } else if (this.phase === 'hold') {
      this.opacity = 1;
      if (this.timer >= this.holdDur) { this.phase = 'out'; this.timer = 0; }
    } else {
      this.opacity = Math.max(0, 1 - this.timer / 0.4);
      if (this.timer >= 0.4) {
        this.active = false;
        return true; // сигнал «завершено» → спауним пульс
      }
    }
    return false;
  }
}

/* Взвешенный выбор города: вес 5 выбирается в 5× чаще вес 1 */
function weightedRandom() {
  const total = CITIES.reduce((s, c) => s + (c.weight || 1), 0);
  let r = Math.random() * total;
  for (let i = 0; i < CITIES.length; i++) {
    r -= (CITIES[i].weight || 1);
    if (r <= 0) return i;
  }
  return CITIES.length - 1;
}

/* ── PulseLayer ─────────────────────────────────────────── */
export class PulseLayer {
  constructor(engine) {
    this.engine = engine;
    this.time   = 0;

    /* Пулы: 12 пульсов (38 городов — нужно больше), 1 вспышка */
    this._pulses    = Array.from({ length: 12 }, () => new Pulse());
    this._flash     = new GhostFlash();
    this._flashCd   = 0.8 + Math.random() * 0.7;

    this._cityPts   = null;
    this._mapBound  = false;
  }

  /* ── Позиции городов ──────────────────────────────────── */
  _tryBind() {
    if (this._mapBound || !window._sbfMap) return;
    window._sbfMap.on('moveend zoomend resize', () => { this._cityPts = null; });
    this._mapBound = true;
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

  /* ── Спаун ────────────────────────────────────────────── */
  _spawnPulse(idx, forced = false) {
    const p = this._pulses.find(p => !p.active);
    if (p) p.spawn(idx, forced);
  }

  /* Публичный API: вызывается из CoreEngine при обнаружении паттерна */
  firePulse() {
    if (!this._cityPts) this._recompute();
    this._spawnPulse(weightedRandom(), true);
  }

  /* ── Update ───────────────────────────────────────────── */
  update(dt) {
    this.time += dt;
    if (!this._cityPts) this._recompute();

    for (const p of this._pulses) p.advance(dt);

    /* GhostFlash */
    if (this._flash.active) {
      const done = this._flash.advance(dt);
      if (done) this._spawnPulse(this._flash.idx);
    } else {
      this._flashCd -= dt;
      if (this._flashCd <= 0 && this._cityPts) {
        const idx  = weightedRandom(); // топ-хабы мигают чаще
        const text = FLASH_POOL[Math.floor(Math.random() * FLASH_POOL.length)];
        this._flash.spawn(idx, text);
        this._flashCd = 2.5 + Math.random() * 1.5;
      }
    }
  }

  /* ── Draw ─────────────────────────────────────────────── */
  draw(ctx) {
    if (!this._cityPts) return;

    const scrollY   = window.scrollY || 0;
    const vh        = this.engine.H;
    const hasForced = this._pulses.some(p => p.active && p.forced);

    /* Обычный выход за пределы Act 1 — но forced-пульсы рисуются всегда */
    if (scrollY >= vh && !hasForced) return;
    const fadeT = Math.max(0, 1 - scrollY / (vh * 0.55));
    if (fadeT <= 0.01 && !hasForced) return;

    const { cx, cy } = this.engine;

    /* ── Пульсы (additive blend): направление город → центр ── */
    const saved = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';

    for (const p of this._pulses) {
      if (!p.active) continue;

      const { x: tx, y: rawTy } = this._cityPts[p.idx];
      /* forced: используем позиции как при scrollY=0 (canvas fixed, вьюпорт) */
      const ty  = rawTy - (p.forced ? 0 : scrollY);
      const cp  = ctrlPt(cx, cy, tx, ty, this.time, SEEDS[p.idx]);

      /* t=0 → город, t=1 → центр (реверс: 1-p.t) */
      const pos = quadBezier(1 - p.t, cx, cy, cp.x, cp.y, tx, ty);

      const eff   = p.forced ? 1 : fadeT;
      const bright = (1 - Math.pow(2 * p.t - 1, 2)) * eff;
      const r      = 14;

      const grd = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r);
      grd.addColorStop(0,    `rgba(255,248,180,${(bright * 0.95).toFixed(3)})`);
      grd.addColorStop(0.35, `rgba(230,194,87, ${(bright * 0.55).toFixed(3)})`);
      grd.addColorStop(1,    'rgba(201,162,39, 0)');

      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    ctx.globalCompositeOperation = saved;

    /* ── GhostFlash (текст у середины нити) ────────────── */
    const f = this._flash;
    if (f.active && f.opacity > 0.01) {
      const { x: tx, y: rawTy } = this._cityPts[f.idx];
      const ty  = rawTy - scrollY;
      const cp  = ctrlPt(cx, cy, tx, ty, this.time, SEEDS[f.idx]);
      const mid = quadBezier(0.5, cx, cy, cp.x, cp.y, tx, ty);

      ctx.save();
      ctx.globalAlpha  = f.opacity * 0.85 * fadeT;
      ctx.font         = '700 11px Montserrat, sans-serif';
      ctx.fillStyle    = '#E6C257';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      /* Тонкая тёмная обводка — читаемость на любом фоне */
      ctx.strokeStyle = 'rgba(43,43,51,0.5)';
      ctx.lineWidth   = 3;
      ctx.lineJoin    = 'round';
      ctx.strokeText(f.text, mid.x, mid.y);
      ctx.fillText(f.text, mid.x, mid.y);
      ctx.restore();
    }
  }
}

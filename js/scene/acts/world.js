/* world.js — акт 1: мир шумит, знак принимает.

   То же, что делал js/hero-map.js на первом экране старого сайта, но внутри
   сцены и без собственного цикла кадра: сцена сама зовёт render().

   Отличие от книги. Раньше карта была фоном одной секции: она появлялась
   вместе с ней и вместе с ней исчезала. Здесь карта — начало пути камеры.
   Пока камера идёт по акту, мир отступает: карта гаснет, нити становятся
   короче, знак набирает кольцо. К концу акта на экране остаётся собранный
   знак — с ним камера и уходит в акт 2.

   Точки на карту ставятся только по готовым координатам из ленты
   (hero-feed.json, ярусы calendar и headline). Угадывать место по словам
   заголовка нельзя: именно так Intel однажды оказался во Франкфурте.
*/

import { createProjection, drawGeo, graticule } from '../geo.js';

const GOLD = '201, 162, 39';
const SLOTS = 5;

export const world = {
  id: 'world',
  role: 'intake',
  note: 'карта мира и нити событий',

  proj: null, path: null, land: null, grid: null,
  pool: [], slots: [], labels: null, host: null,
  time: 0, fit: null,

  enter() { this.ensureLabels(); },

  leave() {
    if (this.labels) this.labels.style.opacity = 0;
  },

  /* Подписи — обычный DOM поверх холста, а не текст внутри картинки:
     их выделяют, читают скринридером и переводят через i18n. Живут в слое
     сцены, потому что принадлежат миру, а не колонке текста. */
  ensureLabels() {
    if (this.labels) return;
    const layer = document.querySelector('.scene-layer');
    if (!layer) return;
    const box = document.createElement('div');
    box.className = 'scene-labels';
    layer.appendChild(box);
    this.labels = box;
    /* На телефоне нитей меньше: подписей там всё равно нет (узкий экран),
       а каждая нить — это 18 отрезков кривой в кадре. */
    const n = window.innerWidth < 900 ? 3 : SLOTS;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'scene-lbl';
      box.appendChild(el);
      this.slots.push({ el: el, item: null, phase: 'wait', time: 0, wait: i * 0.7,
                        grow: 0, alpha: 0, ph: Math.random() * 6.28 });
    }
  },

  load() {
    if (this.loading) return;
    this.loading = true;
    /* Карта мира — из vendor/, а не с CDN: на первом экране внешняя
       зависимость означала бы пустой мир при недоступности unpkg.
       Проекция — своя (js/scene/geo.js): d3 весил 273 КБ ради трёх функций. */
    if (window.topojson) {
      fetch('vendor/countries-110m.json').then(r => r.json()).then(topo => {
        this.land = window.topojson.feature(topo, topo.objects.countries);
        this.grid = graticule(20);
      }).catch(() => console.warn('[scene] карта мира не загрузилась'));
    }
    const take = (items) => {
      this.pool = (items || []).filter(o => o && typeof o.lon === 'number');
    };
    if (window.SBF_GEO_POINTS) take(window.SBF_GEO_POINTS);
    document.addEventListener('sbf:geofeed', e => take(e.detail));
    fetch('/hero-feed.json', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => {
        take((d.items || []).map(o => ({ ...o, ll: [o.lon, o.lat] })));
        window.SBF_GEO_POINTS = window.SBF_GEO_POINTS || this.pool;
        /* В ленте, кроме точек, лежат котировки и бриф дня. Отдаём их
           целиком: строка котировок берёт их отсюда, а не ходит за файлом
           второй раз. */
        window.SBF_FEED_META = d;
        document.dispatchEvent(new CustomEvent('sbf:feedmeta', { detail: d }));
      })
      .catch(() => console.warn('[scene] лента недоступна — мир без событий'));
  },

  measure(view) {
    if (!this.land) return;
    const k = view.w + 'x' + view.h;
    if (this.fit === k) return;
    this.fit = k;
    /* Карта занимает весь кадр и уходит за края: мир не помещается в экран,
       и это честно — камера смотрит на его часть. Поворот на 22° к востоку
       ставит в середину Европу и Африку, как было на старом первом экране. */
    this.proj = createProjection(
      [-view.w * 0.05, -view.h * 0.10, view.w * 1.05, view.h * 1.12], 22);

    /* Материки рисуются один раз в отдельный холст, дальше кадр только
       накладывает картинку. Прямая отрисовка geoPath по 110m-контурам
       съедала 10 мс из 16 — весь бюджет кадра на статичную подложку, по
       которой ничего не меняется, кроме прозрачности. */
    const off = this.off || (this.off = document.createElement('canvas'));
    off.width = view.w; off.height = view.h;
    const g = off.getContext('2d');
    g.clearRect(0, 0, view.w, view.h);
    g.lineJoin = 'round';
    g.beginPath(); drawGeo(g, this.grid, this.proj);
    g.strokeStyle = 'rgba(120, 92, 44, 0.16)'; g.lineWidth = 0.6; g.stroke();
    g.beginPath(); drawGeo(g, this.land, this.proj);
    g.fillStyle = 'rgba(176, 133, 66, 0.14)'; g.fill();
    g.strokeStyle = 'rgba(160, 118, 48, 0.86)'; g.lineWidth = 0.8; g.stroke();
  },

  render(ctx, view, cam, mark) {
    this.load();
    this.ensureLabels();
    this.measure(view);
    if (!this.proj) return;

    this.time += view.dt;
    const g = mark.geometry(view);
    /* Чем дальше камера по акту, тем тише мир: карта уходит, остаётся знак */
    const away = ease(cam.t);
    const w = cam.w * (1 - away * 0.85);

    ctx.save();
    ctx.translate(0, -away * view.h * 0.06);          /* мир слегка отступает */

    if (w > 0.02 && this.off) {
      ctx.globalAlpha = 0.4 * w;
      ctx.drawImage(this.off, 0, 0);
      ctx.globalAlpha = 1;
    }

    this.slots.forEach(s => this.step(s, view.dt));
    this.slots.forEach(s => this.drawThread(ctx, s, g, w, view));
    ctx.restore();

    /* Колонка текста читается, пока камера идёт по акту, и подпись, легшая
       на заголовок, — это брак того же рода, что общий логотип поверх
       текста в первой версии сайта. Прямоугольник колонки берём раз в
       кадр и прячем те подписи, которые в него попадают. */
    if (!this.col) this.col = document.querySelector('.act[data-act="world"] .act-col');
    /* Прямоугольник колонки читаем не каждый кадр, а пять раз в секунду:
       getBoundingClientRect во время прокрутки заставляет браузер считать
       раскладку, и на телефоне это выходило дороже самой отрисовки.
       Подпись за 200 мс никуда не уедет — она и живёт-то секундами. */
    this.keepAt = (this.keepAt || 0) - view.dt;
    if (this.col && this.keepAt <= 0) {
      this.keep = this.col.getBoundingClientRect();
      this.keepAt = 0.2;
    }
    const keep = view.mobile ? null : this.keep;
    /* Занятые места кадра: сначала знак, потом каждая поставленная подпись.
       Без этого две новости из соседних городов ложились одна на другую, а
       третья — прямо на кольцо. На старой карте это правило было, при
       переносе в сцену его сначала потеряли. */
    const taken = [{ left: g.cx - g.r, right: g.cx + g.r,
                     top: g.cy - g.r, bottom: g.cy + g.r }];
    if (keep) taken.push(keep);
    this.slots.forEach(s => this.placeLabel(s, w, view, taken));
    if (this.labels) this.labels.style.opacity = w > 0.05 ? 1 : 0;

    /* Кольцо знака наполняется дошедшими нитями — «принимает» здесь не
       метафора, а счётчик: сколько событий уже собрано. */
    mark.setRole('intake');
  },

  /* ── Жизнь одной нити ──────────────────────────────────── */
  step(s, dt) {
    if (!this.pool.length) return;
    s.time += dt;
    if (!s.item) {
      if (s.time < s.wait) return;
      const taken = this.slots.map(o => o.item && o.item.id);
      let pick = null;
      for (let n = 0; n < 12 && !pick; n++) {
        const c = this.pool[Math.floor(Math.random() * this.pool.length)];
        if (c && taken.indexOf(c.id) === -1) pick = c;
      }
      if (!pick) { s.wait = s.time + 1; return; }
      s.item = pick; s.time = 0; s.phase = 'appear'; s.grow = 0; s.alpha = 0;
      this.renderLabel(s);
      return;
    }
    if (s.phase === 'appear') {
      s.alpha = Math.min(1, s.time / 0.5);
      if (s.time > 0.5) { s.phase = 'grow'; s.time = 0; }
    } else if (s.phase === 'grow') {
      s.grow = Math.min(1, s.time / 1.1);
      if (s.grow >= 1) { s.phase = 'hold'; s.time = 0; }
    } else if (s.phase === 'hold') {
      if (s.time > 1.6) { s.phase = 'pull'; s.time = 0; }
    } else if (s.phase === 'pull') {
      const u = Math.min(1, s.time / 1.2);
      s.grow = 1 - u; s.alpha = 1 - u;
      if (u >= 1) {
        document.dispatchEvent(new CustomEvent('sbf:thread'));
        s.item = null; s.phase = 'wait'; s.time = 0; s.wait = 0.2 + Math.random();
        s.alpha = 0; s.grow = 0;
      }
    }
  },

  drawThread(ctx, s, g, w, view) {
    if (!s.item || !this.proj || w < 0.02) return;
    const ll = s.item.ll || [s.item.lon, s.item.lat];
    const p = this.proj(ll[0], ll[1]);
    if (!p || !isFinite(p[0])) return;
    s.px = p[0]; s.py = p[1];

    const a = s.alpha * w;
    /* Точка события */
    ctx.beginPath();
    ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(' + GOLD + ',' + (0.85 * a) + ')';
    ctx.fill();

    /* Нить к знаку: провисает, как настоящая, и тянется по мере роста */
    const len = Math.hypot(g.cx - p[0], g.cy - p[1]) || 1;
    const nx = -(g.cy - p[1]) / len, ny = (g.cx - p[0]) / len;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const v = (i / steps) * s.grow;
      const x = p[0] + (g.cx - p[0]) * v, y = p[1] + (g.cy - p[1]) * v;
      const sag = Math.sin(Math.PI * v) * len * 0.06 * Math.sin(this.time * 0.6 + s.ph);
      ctx.lineTo(x + nx * sag, y + ny * sag);
    }
    ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.45 * a) + ')';
    ctx.lineWidth = 1.1;
    ctx.stroke();
  },

  renderLabel(s) {
    if (!s.el || !s.item) return;
    const lang = (window.i18n && window.i18n.getLang && window.i18n.getLang()) || 'ru';
    const t = s.item.title;
    const tag = s.item.tag;
    const title = (t && typeof t === 'object' ? (t[lang] || t.en || t.ru) : t) || '';
    const place = (tag && typeof tag === 'object' ? (tag[lang] || tag.en || tag.ru) : tag) || '';
    s.el.innerHTML = '<b>' + esc(cut(title, 42)) + '</b><i>' + esc(place) +
                     (s.item.source ? ' · ' + esc(s.item.source) : '') + '</i>';
  },

  placeLabel(s, w, view, taken) {
    if (!s.el) return;
    if (!s.item || s.px == null || w < 0.05 || view.w < 620) {
      s.el.style.opacity = 0;
      return;
    }
    const right = s.px < view.w * 0.62;
    /* Прямоугольник подписи: примерно 22ch на три строки, считаем от точки
       в ту сторону, куда она будет выложена. */
    const lw = 200, lh = 48, pad = 10;
    const box = {
      left: (right ? s.px : s.px - lw) - pad,
      right: (right ? s.px + lw : s.px) + pad,
      top: s.py - lh / 2 - pad,
      bottom: s.py + lh / 2 + pad,
    };
    /* Пересеклась с чем-то уже занятым — молчим. Пустое место честнее
       двух подписей одна на другой. */
    for (let i = 0; i < taken.length; i++) {
      const t = taken[i];
      if (box.right > t.left && box.left < t.right &&
          box.bottom > t.top && box.top < t.bottom) {
        s.el.style.opacity = 0;
        return;
      }
    }
    taken.push(box);
    s.el.style.opacity = s.alpha * w;
    s.el.style.transform = 'translate(' + Math.round(s.px + (right ? 12 : -12)) +
                           'px,' + Math.round(s.py - 10) + 'px)' +
                           (right ? '' : ' translateX(-100%)');
    s.el.style.textAlign = right ? 'left' : 'right';
  },
};

function ease(x) { return x * x * (3 - 2 * x); }
function cut(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

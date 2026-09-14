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
/* Шесть — столько же, сколько на живом сайте (js/hero-map.js, active = 6).
   Пятый и шестой не ради шума: часть подписей всегда молчит, потому что
   точка попала под текст, и без запаса в кадре остаётся одна. */
const SLOTS = 6;

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
    this.slotN = n;
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
    g.strokeStyle = 'rgba(120, 92, 44, 0.20)'; g.lineWidth = 0.6; g.stroke();
    g.beginPath(); drawGeo(g, this.land, this.proj);
    g.fillStyle = 'rgba(176, 133, 66, 0.10)'; g.fill();
    g.strokeStyle = 'rgba(160, 118, 48, 0.62)'; g.lineWidth = 0.9; g.stroke();
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

    /* Карта была вдвое бледнее, чем на живом сайте: 0.4 от испечённой
       подложки давали еле различимый контур. Мир должен быть виден — это
       первое, что говорит экран. */
    if (w > 0.02 && this.off) {
      ctx.globalAlpha = 0.92 * w;
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
    /* Занятые места кадра читаем не каждый кадр, а пять раз в секунду:
       getBoundingClientRect во время прокрутки заставляет браузер считать
       раскладку, и на телефоне это выходило дороже самой отрисовки.
       Подпись за 200 мс никуда не уедет — она и живёт-то секундами. */
    this.keepAt = (this.keepAt || 0) - view.dt;
    if (this.col && this.keepAt <= 0) {
      this.keep = textBoxes(this.col);
      this.keepAt = 0.2;
    }
    /* Занятые места кадра: сначала знак, потом строки текста, потом каждая
       поставленная подпись. Без этого две новости из соседних городов
       ложились одна на другую, а третья — прямо на кольцо.

       Знак занимает круг, а не квадрат. Разница не косметическая: квадрат
       вокруг кольца радиусом 240 px забирает лишние 30 тысяч пикселей по
       углам — как раз там, куда подписи и просились.

       Текст занимает строки, а не колонку. Прямоугольник всей колонки
       перекрывал 44% ширины экрана сверху донизу, и для точки, попавшей
       в эту полосу, свободного места не оставалось ни справа, ни слева:
       подпись гасла всегда, независимо от того, сколько положений она
       перебирала. При этом сами строки короче колонки — «шум.» кончается
       на четверти её ширины, — и справа от них лежит пустая карта. */
    const taken = [{ cx: g.cx, cy: g.cy, r: g.r }];
    if (!view.mobile && this.keep) {
      for (let i = 0; i < this.keep.length; i++) taken.push(this.keep[i]);
    }
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
      s.item = pick; s.time = 0; s.phase = 'appear';
      s.grow = 0; s.alpha = 0; s.bloom = 0; s.u = 1;
      s.ph = Math.random() * 6.28;
      s.amp = 0.09 + Math.random() * 0.07;
      this.renderLabel(s);
      return;
    }
    /* Четыре состояния, и каждое означает своё:
         appear — событие произошло, точка расцветает на своём месте;
         grow   — знак дотягивается до него нитью;
         hold   — событие держится, его можно прочитать;
         pull   — знак втягивает его в себя, и точка едет по нити внутрь.
       Именно из-за pull это выглядит как щупальце, а не как гаснущая
       линия: в прошлой версии на этой фазе просто падала прозрачность,
       и втягивания не читалось вовсе. */
    if (s.phase === 'appear') {
      const b = Math.min(1, s.time / 0.55);
      s.bloom = easeOut(b); s.alpha = s.bloom; s.grow = 0;
      if (b >= 1) { s.phase = 'grow'; s.time = 0; }
    } else if (s.phase === 'grow') {
      const gr = Math.min(1, s.time / 0.95);
      s.grow = easeOut(gr); s.bloom = 1; s.alpha = 1;
      if (gr >= 1) { s.phase = 'hold'; s.time = 0; }
    } else if (s.phase === 'hold') {
      s.grow = 1; s.bloom = 1; s.alpha = 1;
      if (s.time > 1.4) { s.phase = 'pull'; s.time = 0; }
    } else if (s.phase === 'pull') {
      const p = Math.min(1, s.time / 1.5);
      s.u = 1 - easeIn(p);          /* положение события на нити: 1 → 0 */
      s.grow = s.u; s.bloom = 1;
      /* Гаснет только у самого ядра, а не всю дорогу: иначе точка исчезает
         на полпути и втягивание опять не видно. */
      s.alpha = Math.min(1, s.u * 3.4);
      if (p >= 1) {
        /* Нить дошла: знак отзывается, кольцо набирает ещё одно событие */
        document.dispatchEvent(new CustomEvent('sbf:thread'));
        this.intake = (this.intake || 0) + 1;
        s.item = null; s.phase = 'wait'; s.time = 0;
        s.wait = 0.2 + Math.random() * 0.8;
        s.alpha = 0; s.grow = 0; s.bloom = 0; s.u = 1;
      }
    }
  },

  /* Точка на нити. v = 0 у знака, v = 1 у события.

     Нить не прямая: она провисает и колышется, а при втягивании слабина
     уходит — как настоящая снасть под натяжением. Это и есть тот эффект,
     который владелец назвал «щупальца, которые затягивают в центр»:
     формула перенесена из js/hero-map.js один в один, потому что сама
     механика там уже выверена. */
  pointAt(s, g, v) {
    const dx = s.px - g.cx, dy = s.py - g.cy;
    const bx = g.cx + dx * v, by = g.cy + dy * v;
    const nx = -dy / s.len, ny = dx / s.len;
    /* При втягивании нить натягивается: слабина падает с 1 до 0.35 */
    const slack = s.phase === 'pull' ? 0.35 + 0.65 * s.u : 1;
    /* Волна гаснет к обоим концам, поэтому нить не «отрывается» от точек */
    const env = Math.sin(Math.PI * Math.min(1, v / Math.max(0.05, s.reach || 1)));
    const o = env * slack * s.len *
      (s.amp * Math.sin(v * 2.2 + this.time * 0.5 + s.ph) +
       s.amp * 0.35 * Math.sin(v * 5.1 - this.time * 0.8 + s.ph * 2.1));
    return [bx + nx * o, by + ny * o];
  },

  drawThread(ctx, s, g, w, view) {
    if (!s.item || !this.proj || w < 0.02) return;
    const ll = s.item.ll || [s.item.lon, s.item.lat];
    const p = this.proj(ll[0], ll[1]);
    if (!p || !isFinite(p[0])) return;
    s.px = p[0]; s.py = p[1];
    s.len = Math.hypot(p[0] - g.cx, p[1] - g.cy) || 1;
    s.amp = s.amp || 0.09;

    /* Докуда дотянулась нить: при росте — сколько выросла, при втягивании —
       где сейчас событие. */
    s.reach = s.phase === 'pull' ? s.u : s.grow;
    if (s.reach <= 0.01) return;

    const a = s.alpha * w;

    /* Нить рисуется отрезками с затуханием от ядра к концу: у знака она
       яркая и толстая, у события тонкая. Так видно направление — тянет
       именно центр, а не событие уходит само. */
    /* Каждый отрезок нити — своя обводка со своим цветом и толщиной, то
       есть смена состояния холста тридцать четыре раза на нить. В
       упрощённом режиме отрезков вдвое меньше: провис и затухание
       читаются и так, а цена падает вдвое. Флаг ставит линейка кадра
       (stage.js), когда треть кадров не укладывается в частоту экрана. */
    const N = view.simple ? 16 : 34;
    const pts = [];
    for (let i = 0; i <= N; i++) pts.push(this.pointAt(s, g, (i / N) * s.reach));
    for (let i = 1; i <= N; i++) {
      const f = i / N;
      ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.92 * (1 - f * 0.62) * a).toFixed(3) + ')';
      ctx.lineWidth = (2.6 * (1 - f * 0.7) + 0.7) * (s.phase === 'pull' ? 1.15 : 1);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }

    /* Само событие: при втягивании оно едет по нити внутрь, а не гаснет
       на месте. Живой сайт делает именно это, и именно это читается как
       «мир отдаёт событие знаку». */
    const head = s.phase === 'pull' ? pts[N] : [s.px, s.py];
    s.mx = head[0]; s.my = head[1];
    const live = s.phase === 'pull' ? s.u : 1;
    const bloom = s.bloom == null ? 1 : s.bloom;

    const R = (34 + 8) * bloom;
    const grad = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], R);
    grad.addColorStop(0, 'rgba(226,178,62,' + (0.42 * bloom * live * w).toFixed(3) + ')');
    grad.addColorStop(0.45, 'rgba(201,162,39,' + (0.14 * bloom * live * w).toFixed(3) + ')');
    grad.addColorStop(1, 'rgba(201,162,39,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(head[0], head[1], R, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(140,96,16,' + (0.92 * live * w).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(head[0], head[1], (2.6 + 2.4 * bloom) * (0.55 + 0.45 * live),
            0, Math.PI * 2);
    ctx.fill();

    /* Пока событие стоит на месте — вокруг него дышит кольцо. При втягивании
       кольца нет: оно осталось бы висеть там, откуда точка уже уехала. */
    if (s.phase !== 'pull') {
      const ring = s.phase === 'appear' ? bloom : 1;
      ctx.strokeStyle = 'rgba(154,123,30,' + (0.42 * ring * w).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(head[0], head[1],
              (9 + 3 * Math.sin(this.time * 1.7 + s.ph)) + 3 + 26 * (1 - ring),
              0, Math.PI * 2);
      ctx.stroke();
    }
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
    /* Размер меряем один раз на событие, а не берём числом: короткому
       заголовку не нужны 200 px, и лишние сто пикселей — это ещё одно
       место, где подпись «не помещается» на ровном месте. */
    s.el.style.opacity = 0;
    s.lw = Math.min(220, s.el.offsetWidth || 200);
    s.lh = s.el.offsetHeight || 40;
  },

  placeLabel(s, w, view, taken) {
    if (!s.el) return;
    if (!s.item || s.mx == null || w < 0.05 || view.w < 620) {
      s.why = !s.item ? 'нет события' : s.mx == null ? 'нить ещё не выросла'
            : w < 0.05 ? 'акт не в кадре' : 'узкий экран';
      s.el.style.opacity = 0;
      return;
    }
    const px = s.mx, py = s.my;      /* подпись едет вместе с точкой */
    const lw = s.lw || 200, lh = s.lh || 44, pad = 8;

    /* Подпись ищет себе место, а не молчит при первой же помехе.

       Раньше правило было одно: если прямоугольник подписи задел колонку
       текста, знак или другую подпись — гасим. На живом сайте подписей
       видно две-три постоянно, у меня по одной и с провалами: точка чаще
       всего оказывалась в занятой полосе. Теперь перебираем шесть
       положений вокруг точки — справа, слева, выше, ниже — и молчим,
       только если не подошло ни одно. Пустое место всё ещё честнее
       наложения, просто теперь оно действительно последнее средство. */
    const spots = [
      { dx:  14, dy: -10, side: 'right' },
      { dx: -14, dy: -10, side: 'left'  },
      { dx:  14, dy:  22, side: 'right' },
      { dx: -14, dy:  22, side: 'left'  },
      { dx:  14, dy: -42, side: 'right' },
      { dx: -14, dy: -42, side: 'left'  },
    ];

    let why = '';
    for (let n = 0; n < spots.length; n++) {
      const sp = spots[n];
      const x = px + sp.dx, y = py + sp.dy;
      const box = {
        left: (sp.side === 'right' ? x : x - lw) - pad,
        right: (sp.side === 'right' ? x + lw : x) + pad,
        top: y - lh / 2 - pad,
        bottom: y + lh / 2 + pad,
      };
      /* За краем кадра подпись не читается — это тоже занято */
      if (box.left < 4 || box.right > view.w - 4 ||
          box.top < 60 || box.bottom > view.h - 60) { why = 'за краем'; continue; }

      let hit = 0;
      for (let i = 0; i < taken.length && !hit; i++) {
        if (overlaps(box, taken[i])) hit = i + 1;
      }
      if (hit) {
        const nText = (!view.mobile && this.keep) ? this.keep.length : 0;
        why = hit === 1 ? 'знак' : hit <= 1 + nText ? 'строка текста' : 'другая подпись';
        continue;
      }

      taken.push(box);
      s.why = '';
      s.el.style.opacity = s.alpha * w;
      s.el.style.transform = 'translate(' + Math.round(x) + 'px,' +
                             Math.round(y) + 'px)' +
                             (sp.side === 'right' ? '' : ' translateX(-100%)');
      s.el.style.textAlign = sp.side === 'right' ? 'left' : 'right';
      return;
    }
    s.why = why || 'места нет';
    s.el.style.opacity = 0;
  },
};

/* Пересечение подписи с занятым местом. Занятое бывает двух видов:
   прямоугольник (строка текста, другая подпись) и круг (знак). */
function overlaps(box, t) {
  if (t.r != null) {
    const x = Math.max(box.left, Math.min(t.cx, box.right));
    const y = Math.max(box.top, Math.min(t.cy, box.bottom));
    return (x - t.cx) * (x - t.cx) + (y - t.cy) * (y - t.cy) < t.r * t.r;
  }
  return box.right > t.left && box.left < t.right &&
         box.bottom > t.top && box.top < t.bottom;
}

/* Строки текста колонки, а не её габарит.

   Диапазон по текстовому узлу отдаёт прямоугольник каждой строки в
   отдельности — той ширины, какая у строки на самом деле. Элементы с
   рамкой или заливкой (карточка «Старт без риска») занимают место
   целиком: там пусто не на глаз, а по рисунку.

   Читается это пять раз в секунду вместе с прежним габаритом колонки,
   то есть дороже не стало: раньше был один getBoundingClientRect,
   теперь один обход десятка узлов на том же такте. */
function textBoxes(root) {
  const out = [];
  const pad = 6;
  const walk = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const push = (r) => {
    if (r.width < 4 || r.height < 4) return;
    out.push({ left: r.left - pad, right: r.right + pad,
               top: r.top - pad, bottom: r.bottom + pad });
  };
  let el = root;
  while (el) {
    const st = getComputedStyle(el);
    const solid = st.borderTopWidth !== '0px' || st.borderLeftWidth !== '0px' ||
                  (st.backgroundColor && st.backgroundColor !== 'rgba(0, 0, 0, 0)');
    if (solid && el !== root) {
      push(el.getBoundingClientRect());
      /* Внутрь закрашенного блока заглядывать незачем */
      el = skip(walk, el);
      continue;
    }
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType !== 3 || !n.nodeValue.trim()) continue;
      const rng = document.createRange();
      rng.selectNodeContents(n);
      const rects = rng.getClientRects();
      for (let i = 0; i < rects.length; i++) push(rects[i]);
    }
    el = walk.nextNode();
  }
  return out;
}

/* Пропустить поддерево: TreeWalker не умеет «дальше, но не внутрь» */
function skip(walk, el) {
  let n = walk.nextNode();
  while (n && el.contains(n)) n = walk.nextNode();
  return n;
}

function ease(x) { return x * x * (3 - 2 * x); }
/* Нить растёт быстро и мягко тормозит, а втягивается наоборот — сначала
   нехотя, потом рывком. Из-за этой разницы движение и читается как усилие,
   а не как равномерная анимация. */
function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
function easeIn(x) { return x * x * x; }
function cut(s, n) {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

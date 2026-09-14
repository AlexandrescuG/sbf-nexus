/* memory.js — акт 6: память рынков.

   Утверждение экрана простое: движение оставляет след, и след можно
   посмотреть. Поэтому здесь не иллюстрация «графика вообще», а настоящие
   случаи из assets/data/*.csv — те же файлы, что лежат в кейсах живого
   сайта, с теми же уровнями паттернов.

   ── Почему на телефоне у каждого кейса свой холст ──────────────────────

   Первая мобильная версия рисовала ОДИН график — тот, чей текст сейчас
   против середины экрана, — на общем холсте сцены, беря координаты у
   прокручивающейся карточки. Владелец на записи экрана показал участок
   18–21 с и сказал: «графики выглядят будто рывками именно из-за
   дизайна». Он прав, и дело не в кадрах.

   На покадровой раскладке видно, что происходит: под золотом график есть,
   под EUR/USD на его месте пустой провал; прокрутил — график из первой
   карточки исчез и возник во второй. То есть картинка не едет вместе с
   текстом, а телепортируется между карточками, и четыре из пяти мест
   всегда пустые. Разрыв, а не низкий FPS.

   Вдобавок к этому — и это уже про кадры — картинка принципиально не
   могла ехать синхронно с текстом: текст двигает компоновщик браузера,
   а холст перерисовывали мы, каждый кадр, по координатам, которые
   каждый кадр же и считывали через getBoundingClientRect у едущего
   элемента.

   Теперь у каждой карточки свой маленький холст в обычном потоке
   документа. Он рисуется ОДИН раз, когда карточка подъезжает к экрану, и
   дальше прокручивается браузером вместе с текстом — как картинка. Ни
   провалов, ни телепортаций, ни работы в кадре. Так же устроен живой
   сайт (js/acts/act-market-mobile.js), и по той же причине.

   На десктопе всё остаётся как было: один большой график справа от
   колонки и кольцо-окно на нём. Там карточек нет и прыгать нечему.
*/

import { t } from '../labels.js';

/* Порядок совпадает с порядком <li> в разметке акта: связь «третий абзац
   — третий случай» держится на этом и проверяется в браузере.
   Уровни паттернов — те же, что в js/acts/act3-market.js. */
const CASES = [
  { file: 'XAUUSD_triangle_breakout_may2026.csv', key: 'market.gold_tri',
    bars: 224, mark: { type: 'hline', level: 4440 } },
  { file: 'EURUSD_gap_may2026.csv', key: 'market.eurusd',
    bars: 380, mark: { type: 'band', low: 1.1605, high: 1.1644 } },
  /* У меди уровня нет — паттерн здесь не цена, а два события. Текст кейса
     называет их прямо: «ложные пробои 10 апреля и 11 мая». Ставим на эти
     даты вертикальные метки: это не придуманная разметка, а то же самое,
     что уже написано рядом словами. */
  { file: 'Copper_channel_breakout_2026.csv', key: 'market.copper',
    bars: 346, mark: { type: 'dates', at: ['2026-04-10', '2026-05-11'] } },
  { file: 'USDJPY_intervention_may2026.csv', key: 'market.jpy',
    bars: 200, mark: { type: 'hline', level: 160.0 } },
  { file: 'XAUUSD_bollinger_squeeze_pool.csv', key: 'market.gold_bol',
    bars: 400, mark: { type: 'band', low: 4670, high: 4730 } },
];

export const memory = {
  id: 'memory',
  role: 'process',
  role_note: 'память рынков, кейсы OHLC',
  note: 'память рынков, кейсы OHLC',

  data: {},
  bounds: {},

  load(i, then) {
    const c = CASES[i];
    if (!c) return;
    if (this.data[i] !== undefined) {
      if (this.data[i] && then) then();
      return;
    }
    this.data[i] = null;                       /* грузится */
    fetch('assets/data/' + c.file)
      .then(r => r.text())
      .then(txt => {
        this.data[i] = parse(txt);
        if (this.data[i] && then) then();
      })
      .catch(() => { this.data[i] = null; });
  },

  /* ── Раскладка одного случая ──────────────────────────────
     Считается один раз на пару «случай + ширина поля» и запоминается: до
     этого здесь стоял Math.min(...rows) прямо в кадре — шестьсот
     аргументов в вызов шестьдесят раз в секунду. */
  frame(idx, rows, pw) {
    /* Сколько свечей влезает: при ширине тела меньше двух пикселей это уже
       не свечи, а штриховка. Живой сайт берёт от 200 до 400 баров на кейс. */
    const N = Math.min(rows.length, CASES[idx].bars || 240,
                       Math.max(20, Math.floor(pw / 2.4)));
    const key = idx + ':' + N;
    if (!this.bounds[key]) {
      let lo = Infinity, hi = -Infinity;
      for (let i = rows.length - N; i < rows.length; i++) {
        if (rows[i].l < lo) lo = rows[i].l;
        if (rows[i].h > hi) hi = rows[i].h;
      }
      /* Уровень паттерна обязан попасть в кадр: иначе разметка, ради
         которой кейс и показывают, оказывается за краем. */
      const m = CASES[idx].mark;
      if (m && m.type !== 'dates') {
        const vs = m.type === 'hline' ? [m.level] : [m.low, m.high];
        vs.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; });
      }
      const pad = (hi - lo) * 0.08 || 1;
      this.bounds[key] = { lo: lo - pad, hi: hi + pad };
    }
    const B = this.bounds[key];
    return { N: N, from: rows.length - N, lo: B.lo, span: (B.hi - B.lo) || 1 };
  },

  /* ── Отрисовка случая в прямоугольник ─────────────────────
     Одна и та же для большого холста сцены и для маленького холста внутри
     карточки: разница только в прямоугольнике и в том, есть ли кольцо. */
  plot(ctx, idx, rows, R, opt) {
    const o = opt || {};
    const a = o.alpha == null ? 1 : o.alpha;
    const f = this.frame(idx, rows, R.w);
    const yOf = v => R.y + (1 - (v - f.lo) / f.span) * R.h;
    const slot = R.w / f.N;
    const bodyW = Math.max(1, slot * 0.62);
    const x1 = R.x + R.w;
    const m = CASES[idx].mark;

    /* Сетка: четыре линии, по ним же читается шкала */
    ctx.strokeStyle = 'rgba(154,123,30,' + (0.12 * a).toFixed(3) + ')';
    ctx.lineWidth = 0.6;
    for (let i = 0; i <= 4; i++) {
      const y = R.y + (i / 4) * R.h;
      ctx.beginPath(); ctx.moveTo(R.x, y); ctx.lineTo(x1, y); ctx.stroke();
    }

    /* Разметка паттерна — под свечами, чтобы свечи оставались сверху */
    if (m && m.type === 'dates') {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(154,123,30,' + (0.7 * a).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      m.at.forEach(day => {
        let k = -1;
        for (let i = 0; i < f.N; i++) {
          if (rows[f.from + i].d === day) { k = i; break; }
        }
        if (k < 0) return;
        const x = R.x + (k + 0.5) * slot;
        ctx.beginPath(); ctx.moveTo(x, R.y); ctx.lineTo(x, R.y + R.h); ctx.stroke();
      });
      ctx.setLineDash([]);
    } else if (m) {
      if (m.type === 'band') {
        const p = yOf(m.high), q = yOf(m.low);
        ctx.fillStyle = 'rgba(201,162,39,' + (0.10 * a).toFixed(3) + ')';
        ctx.fillRect(R.x, Math.min(p, q), R.w, Math.abs(q - p));
      }
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(154,123,30,' + (0.8 * a).toFixed(3) + ')';
      ctx.lineWidth = 1.3;
      (m.type === 'hline' ? [m.level] : [m.low, m.high]).forEach(v => {
        const y = yOf(v);
        ctx.beginPath(); ctx.moveTo(R.x, y); ctx.lineTo(x1, y); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    if (o.lens) {
      /* Кольцо-окно: снаружи случай виден целиком и бледно, внутри — в
         полную силу. Это не линза разбора, как в акте «линза», а окно:
         то, что в нём, — то, что рассматривают сейчас. */
      candles(ctx, rows, f, R.x, slot, bodyW, yOf, a * 0.36, false);
      ctx.save();
      ctx.beginPath();
      ctx.arc(o.lens.cx, o.lens.cy, o.lens.r * 0.985, 0, Math.PI * 2);
      ctx.clip();
      /* Подложка окна плотнее, чем у линзы: под ней лежит глиф знака, и при
         0.45 он спорил со свечами за внимание. */
      ctx.fillStyle = 'rgba(255,253,249,' + (0.66 * a).toFixed(3) + ')';
      ctx.fillRect(o.lens.cx - o.lens.r, o.lens.cy - o.lens.r,
                   o.lens.r * 2, o.lens.r * 2);
      candles(ctx, rows, f, R.x, slot, bodyW, yOf, a, true);
      ctx.restore();
    } else {
      candles(ctx, rows, f, R.x, slot, bodyW, yOf, a, true);
    }

    /* Точка паттерна у правого края: связывает слово «паттерн» из текста
       с местом на графике. */
    if (m && m.type !== 'dates') {
      const v = m.type === 'hline' ? m.level : (m.low + m.high) / 2;
      const mx = x1 - 14, my = yOf(v);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFFDF9';
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,39,0.95)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#C9A227';
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    return { f: f, slot: slot, yOf: yOf };
  },

  /* ── Телефон: свой холст в каждой карточке ────────────────
     Ставится один раз. Рисуем, когда карточка подъезжает к экрану, и
     больше не трогаем: дальше её двигает браузер. */
  mount(view) {
    if (this.mounted === view.mobile) return;
    this.mounted = view.mobile;
    if (!this.items) this.findItems();
    if (!this.items) return;
    if (!view.mobile) {                       /* вернулись на десктоп */
      this.items.forEach(li => {
        const box = li.querySelector('.case-chart');
        if (box) box.innerHTML = '';
      });
      this.io && this.io.disconnect();
      this.io = null;
      return;
    }
    this.io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const i = this.items.indexOf(e.target);
        if (i < 0) return;
        this.io.unobserve(e.target);
        this.load(i, () => this.paintCard(i));
        if (this.data[i]) this.paintCard(i);
      });
    }, { rootMargin: '200px 0px' });
    this.items.forEach(li => this.io.observe(li));
    /* Перерисовать при повороте экрана: холст привязан к ширине карточки.
       Именно к ширине — поэтому на resize от адресной строки Safari (там
       меняется только высота) перерисовывать нечего. Смена языка приходит
       своим событием и ширину не проверяет: текст под графиком другой. */
    if (!this.onResize) {
      this.repaint = () => {
        clearTimeout(this.rt);
        this.rt = setTimeout(() => {
          if (this.mounted) this.items.forEach((_, i) => this.paintCard(i));
        }, 250);
      };
      this.onResize = () => {
        if (window.innerWidth === this.seenW) return;
        this.seenW = window.innerWidth;
        this.repaint();
      };
      this.seenW = window.innerWidth;
      window.addEventListener('resize', this.onResize);
      document.addEventListener('sbf:langchange', this.repaint);
    }
  },

  paintCard(i) {
    const rows = this.data[i];
    const li = this.items && this.items[i];
    if (!rows || !li) return;
    const box = li.querySelector('.case-chart');
    if (!box) return;
    const w = box.clientWidth, h = box.clientHeight;
    if (w < 80 || h < 60) return;

    let cv = box.querySelector('canvas');
    if (!cv) { cv = document.createElement('canvas'); box.appendChild(cv); }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const axis = 46, pad = 14;
    const R = { x: 2, y: 2, w: w - axis - 2, h: h - pad - 2 };
    const out = this.plot(ctx, i, rows, R, { alpha: 1 });

    /* Шкала и даты — обычным текстом внутри карточки, а не на холсте:
       подписи сцены везде DOM, их выделяют и читают скринридером. Здесь
       у этого есть и второй смысл — они едут вместе с карточкой сами. */
    const f = out.f;
    const marks = [];
    for (let k = 0; k <= 4; k++) {
      marks.push({ cls: 'case-ax', v: price(f.lo + f.span * (1 - k / 4)),
                   top: R.y + (k / 4) * R.h - 5, right: 4 });
    }
    [0, f.N - 1].forEach((k, j) => {
      const d = rows[f.from + k];
      if (!d || !d.d) return;
      marks.push({ cls: 'case-dt', v: d.d, top: h - 12,
                   left: j ? null : 2, right: j ? axis + 2 : null });
    });
    box.querySelectorAll('.case-ax, .case-dt').forEach(el => el.remove());
    marks.forEach(m => {
      const el = document.createElement('span');
      el.className = m.cls;
      el.textContent = m.v;
      el.style.top = Math.round(m.top) + 'px';
      if (m.left != null) el.style.left = m.left + 'px';
      if (m.right != null) el.style.right = m.right + 'px';
      box.appendChild(el);
    });
  },

  findItems() {
    const host = document.querySelector('.act[data-act="memory"] .act-cases');
    this.items = host ? Array.from(host.children) : null;
    return this.items;
  },

  /* Какой случай читают прямо сейчас — нужно только на десктопе, где
     график один. Длину абзацев задаёт текст, а не арифметика: третий кейс
     вдвое длиннее второго, и floor(cam.t * 5) показывал четвёртый, пока
     читали третий. Спрашиваем саму разметку. */
  pick(view) {
    this.pickAt = (this.pickAt || 0) - view.dt;
    if (this.items && this.pickAt > 0) return this.cur;
    this.pickAt = 0.15;
    if (!this.items) this.findItems();
    if (!this.items || !this.items.length) return this.cur || { idx: 0 };
    const eye = view.h / 2;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.items.length; i++) {
      const r = this.items[i].getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - eye);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (!this.cur || this.cur.idx !== best) {
      this.items.forEach((el, i) => el.classList.toggle('is-live', i === best));
    }
    this.cur = { idx: best };
    return this.cur;
  },

  render(ctx, view, cam, mark, labels) {
    const w = cam.w;
    if (w < 0.02) return;
    this.mount(view);
    /* На телефоне сцена в этом акте не рисует НИЧЕГО: у каждой карточки
       свой холст, и он уже нарисован. Это и есть та работа, которой здесь
       больше нет — раньше на каждый кадр прокрутки перерисовывался холст
       во весь экран. */
    if (view.mobile) return;

    const g = mark.geometry(view);
    const idx = this.pick(view).idx;
    const n = CASES.length;
    this.load(idx);
    this.load(idx + 1);                        /* следующий — заранее */
    const rows = this.data[idx];
    if (!rows) return;

    const axis = 56;
    const R = {
      x: g.corridor.cx - g.corridor.halfW - 16,
      y: view.h * 0.17,
      w: view.w - axis - 10 - (g.corridor.cx - g.corridor.halfW - 16),
      h: view.h * 0.63,
    };
    if (R.w < 80 || R.h < 60) return;

    ctx.save();
    const out = this.plot(ctx, idx, rows, R, {
      alpha: w, lens: { cx: g.cx, cy: g.cy, r: g.r },
    });

    /* Счётчик случаев — рисками по кольцу. Пятая заполнена — акт пройден;
       это честнее подписи «5 с». */
    ctx.globalAlpha = w;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 / n) * i;
      const r0 = g.r * 1.06, r1 = g.r * (i <= idx ? 1.14 : 1.10);
      ctx.beginPath();
      ctx.moveTo(g.cx + Math.cos(a) * r0, g.cy + Math.sin(a) * r0);
      ctx.lineTo(g.cx + Math.cos(a) * r1, g.cy + Math.sin(a) * r1);
      ctx.strokeStyle = i <= idx ? 'rgba(201,162,39,0.95)' : 'rgba(201,162,39,0.22)';
      ctx.lineWidth = i <= idx ? 3 : 2;
      ctx.stroke();
    }
    ctx.restore();

    if (!labels) return;
    const f = out.f, x1 = R.x + R.w;
    for (let i = 0; i <= 4; i++) {
      labels.put('mem-y' + i, price(f.lo + f.span * (1 - i / 4)),
                 x1 + 8, R.y + (i / 4) * R.h - 7,
                 { alpha: w * 0.8, avoid: false });
    }
    /* Даты держим внутри поля: крайняя левая вылезала за край экрана и
       обрезалась до «26-06-01» — дата, которой не бывает. */
    [0, f.N >> 1, f.N - 1].forEach((k, j) => {
      const d = rows[f.from + k];
      const x = R.x + (k + 0.5) * out.slot;
      labels.put('mem-x' + j, d ? d.d : '',
                 Math.max(R.x + 42, Math.min(x1 - 42, x)), R.y + R.h + 6,
                 { align: 'center', alpha: w * 0.7, avoid: false });
    });
    labels.put('mem-title', t(CASES[idx].key + '.title', ''),
               g.cx, g.cy - g.r - 34, { align: 'center', alpha: w, tone: 'key' });
    labels.put('mem-meta', t(CASES[idx].key + '.meta', ''),
               g.cx, g.cy - g.r - 16, { align: 'center', alpha: w });
    labels.put('mem-count', (idx + 1) + ' / ' + n,
               g.cx, g.cy + g.r + 16, { align: 'center', alpha: w, avoid: false });
  },

  enter() {}, leave() {},
};

/* Свечи двумя пачками одного цвета: смена состояния холста на каждой свече
   стоит дороже самой свечи. */
function candles(ctx, rows, f, x0, slot, bodyW, yOf, alpha, bright) {
  if (alpha < 0.02) return;
  ctx.globalAlpha = alpha;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = ctx.fillStyle = pass
      ? (bright ? '#d8433f' : '#ef5350')
      : (bright ? '#1f8e83' : '#26a69a');
    ctx.lineWidth = bright ? 1.1 : 0.9;
    for (let i = 0; i < f.N; i++) {
      const d = rows[f.from + i];
      if (!d || (d.c >= d.o) === !!pass) continue;
      const x = x0 + (i + 0.5) * slot;
      ctx.beginPath();
      ctx.moveTo(x, yOf(d.h)); ctx.lineTo(x, yOf(d.l)); ctx.stroke();
      const a = yOf(d.o), b = yOf(d.c);
      ctx.fillRect(x - bodyW / 2, Math.min(a, b), bodyW,
                   Math.max(1, Math.abs(b - a)));
    }
  }
  ctx.globalAlpha = 1;
}

function parse(txt) {
  const lines = txt.trim().split('\n');
  const head = lines[0].split(',').map(s => s.trim());
  const at = (names) => {
    for (const n of names) { const k = head.indexOf(n); if (k >= 0) return k; }
    return -1;
  };
  const io = at(['Open', 'open']), ih = at(['High', 'high']);
  const il = at(['Low', 'low']), ic = at(['Close', 'close']);
  const id = at(['DateTime', 'Date', 'datetime', 'date']);
  const rows = [];
  for (let n = 1; n < lines.length; n++) {
    const v = lines[n].split(',');
    const o = +v[io], h = +v[ih], l = +v[il], c = +v[ic];
    if (isNaN(o) || isNaN(c)) continue;
    rows.push({ o: o, h: isNaN(h) ? Math.max(o, c) : h,
                l: isNaN(l) ? Math.min(o, c) : l, c: c,
                d: id >= 0 ? (v[id] || '').trim().slice(0, 10) : '' });
  }
  return rows.length ? rows : null;
}

/* Цена на шкале: 1.16293 у валют, 4440.2 у золота — один формат на всех
   давал либо мусор из нулей, либо потерю знаков. Правило взято из
   js/acts/act3-market.js, чтобы шкала на обоих каркасах читалась
   одинаково. */
function price(v) {
  const a = Math.abs(v);
  return a < 20 ? v.toFixed(4) : (a < 500 ? v.toFixed(2) : v.toFixed(1));
}

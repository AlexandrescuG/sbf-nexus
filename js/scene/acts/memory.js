/* memory.js — акт 6: память рынков.

   Утверждение экрана простое: движение оставляет след, и след можно
   посмотреть. Поэтому здесь не иллюстрация «графика вообще», а настоящие
   случаи из assets/data/*.csv — те же файлы, что лежат в кейсах живого
   сайта, с теми же уровнями паттернов.

   Первая версия рисовала одну бледную линию по ценам закрытия — без
   шкалы, без дат, без разметки. Владелец назвал это плейсхолдером и был
   прав: линия без единого числа рядом не отличается от случайной кривой,
   а текст рядом при этом говорит «апекс на ~$4,440» и «уровень 160.09».
   Число в тексте, которое нечем подтвердить на картинке, — это не
   иллюстрация, а обещание.

   Что изменилось: свечи вместо линии, ценовая шкала справа, даты снизу,
   разметка паттерна (уровень, зона гэпа, полоса) — ровно та же, что на
   живом сайте (js/acts/act3-market.js). Кольцо осталось окном: снаружи
   случай виден целиком и бледно, внутри — в полную силу.

   И главное: случай выбирается не по доле акта, а по тому, какой абзац
   сейчас читают. Раньше в колонке лежали пять кейсов подряд, а сцена
   показывала третий — текст и картинка расходились, и понять, к чему
   относится линия, было нельзя. Теперь на экране тот случай, чей текст
   стоит против середины окна, и он же подсвечен в колонке.
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
     что уже написано рядом словами. На живом сайте у меди разметки нет
     вовсе, и кейс читается слабее остальных. */
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
  note: 'память рынков, кейсы OHLC',

  data: {},

  load(i) {
    const c = CASES[i];
    if (!c || this.data[i] !== undefined) return;
    this.data[i] = null;                       /* грузится */
    fetch('assets/data/' + c.file)
      .then(r => r.text())
      .then(txt => {
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
          const o = +v[io], h = +v[ih], l = +v[il], c2 = +v[ic];
          if (isNaN(o) || isNaN(c2)) continue;
          rows.push({ o: o, h: isNaN(h) ? Math.max(o, c2) : h,
                      l: isNaN(l) ? Math.min(o, c2) : l, c: c2,
                      d: id >= 0 ? (v[id] || '').trim().slice(0, 10) : '' });
        }
        this.data[i] = rows.length ? rows : null;
      })
      .catch(() => { this.data[i] = null; });
  },

  /* Какой случай читают прямо сейчас.

     Раньше индекс считался как floor(cam.t * 5) — доля акта. Но длину
     абзацев задаёт текст, а не арифметика: третий кейс вдвое длиннее
     второго, и на экране оказывался четвёртый, пока читали третий.
     Спрашиваем саму разметку: чей прямоугольник ближе к середине окна.
     Заодно подсвечиваем этот <li> — связь текста и картинки должна быть
     видна, а не подразумеваться. */
  pick(view) {
    this.pickAt = (this.pickAt || 0) - view.dt;
    if (this.items && this.pickAt > 0) return this.cur;
    this.pickAt = 0.15;
    if (!this.items) {
      const host = document.querySelector('.act[data-act="memory"] .act-cases');
      this.items = host ? Array.from(host.children) : [];
    }
    if (!this.items.length) return this.cur || { idx: 0, t: 0.5 };
    const eye = view.h / 2;
    let best = 0, bestD = Infinity, t = 0.5;
    for (let i = 0; i < this.items.length; i++) {
      const r = this.items[i].getBoundingClientRect();
      const d = Math.abs((r.top + r.bottom) / 2 - eye);
      if (d < bestD) {
        bestD = d; best = i;
        t = Math.max(0, Math.min(1, (eye - r.top) / (r.height || 1)));
      }
    }
    if (!this.cur || this.cur.idx !== best) {
      this.items.forEach((el, i) => el.classList.toggle('is-live', i === best));
    }
    this.cur = { idx: best, t: t };
    return this.cur;
  },

  render(ctx, view, cam, mark, labels) {
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);
    const cur = this.pick(view);
    const idx = cur.idx;
    const n = CASES.length;
    this.load(idx);
    this.load(idx + 1);                        /* следующий — заранее */
    const rows = this.data[idx];
    if (!rows) return;

    /* ── Поле графика ──────────────────────────────────────
       На десктопе — справа от колонки текста, с полосой под ценовую шкалу.

       На телефоне колонка занимает всю ширину, и график, нарисованный на
       полэкрана, ложился прямо на абзацы: нельзя было читать ни текст, ни
       свечи. Там поле берётся из самой разметки — пустое место внутри
       кейса (.case-chart), которое вёрстка под него и оставила. Картинка
       оказывается ровно там, где о ней написано. */
    let px0, px1, py0, py1, axis;
    if (view.mobile) {
      const box = this.items && this.items[idx] &&
                  this.items[idx].querySelector('.case-chart');
      if (!box) return;
      const r = box.getBoundingClientRect();
      if (r.bottom < 0 || r.top > view.h || r.height < 40) return;
      axis = 46;
      px0 = r.left + 2; px1 = r.right - axis;
      py0 = r.top + 2; py1 = r.bottom - 14;
    } else {
      axis = 56;
      px0 = g.corridor.cx - g.corridor.halfW - 16;
      px1 = view.w - axis - 10;
      py0 = view.h * 0.17;
      py1 = view.h * 0.80;
    }
    const pw = px1 - px0, ph = py1 - py0;
    if (pw < 80 || ph < 60) return;

    /* Сколько свечей влезает: при ширине тела меньше двух пикселей это уже
       не свечи, а штриховка. Живой сайт берёт от 200 до 400 баров на кейс;
       здесь полоса уже, поэтому берём хвост нужной длины. */
    const N = Math.min(rows.length, CASES[idx].bars || 240,
                       Math.floor(pw / 2.4));
    const from = rows.length - N;

    /* Границы окна считаются один раз на случай и запоминаются: до этого
       здесь стоял Math.min(...rows) прямо в кадре — шестьсот аргументов в
       вызов шестьдесят раз в секунду. */
    if (!this.bounds) this.bounds = {};
    const bkey = idx + ':' + N;
    if (!this.bounds[bkey]) {
      let lo = Infinity, hi = -Infinity;
      for (let i = from; i < rows.length; i++) {
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
      this.bounds[bkey] = { lo: lo - pad, hi: hi + pad };
    }
    const B = this.bounds[bkey];
    const span = (B.hi - B.lo) || 1;
    const yOf = v => py0 + (1 - (v - B.lo) / span) * ph;
    const slot = pw / N;
    const bodyW = Math.max(1, slot * 0.62);

    ctx.save();

    /* Сетка: четыре линии, по ним же читается шкала */
    ctx.strokeStyle = 'rgba(154,123,30,' + (0.12 * w).toFixed(3) + ')';
    ctx.lineWidth = 0.6;
    for (let i = 0; i <= 4; i++) {
      const y = py0 + (i / 4) * ph;
      ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.stroke();
    }

    /* Разметка паттерна: уровень или зона. Рисуется под свечами, чтобы
       свечи оставались сверху, — как на живом сайте. */
    const m = CASES[idx].mark;
    if (m && m.type === 'dates') {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(154,123,30,' + (0.7 * w).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      m.at.forEach(day => {
        let k = -1;
        for (let i = 0; i < N; i++) {
          if (rows[from + i].d === day) { k = i; break; }
        }
        if (k < 0) return;
        const x = px0 + (k + 0.5) * slot;
        ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py1); ctx.stroke();
      });
      ctx.setLineDash([]);
    } else if (m) {
      if (m.type === 'band') {
        const a = yOf(m.high), b = yOf(m.low);
        ctx.fillStyle = 'rgba(201,162,39,' + (0.10 * w).toFixed(3) + ')';
        ctx.fillRect(px0, Math.min(a, b), pw, Math.abs(b - a));
      }
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = 'rgba(154,123,30,' + (0.8 * w).toFixed(3) + ')';
      ctx.lineWidth = 1.3;
      (m.type === 'hline' ? [m.level] : [m.low, m.high]).forEach(v => {
        const y = yOf(v);
        ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px1, y); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    /* Свечи. Двумя пачками одного цвета: смена состояния холста на каждой
       свече стоит дороже самой свечи. */
    /* ── Окно памяти ───────────────────────────────────────
       На десктопе кольцо лежит на графике и работает окном: снаружи
       случай виден целиком и бледно, внутри — в полную силу. Кольцо здесь
       не линза разбора, как в акте «линза», а именно окно: то, что в нём,
       — то, что рассматривают сейчас.

       На телефоне кольцо стоит над колонкой, а график — внутри кейса, и
       пересечься им негде: там свечи рисуются сразу в полную силу. */
    if (view.mobile) {
      this.candles(ctx, rows, from, N, px0, slot, bodyW, yOf, w, true);
    } else {
      this.candles(ctx, rows, from, N, px0, slot, bodyW, yOf, w * 0.36, false);
      ctx.save();
      ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r * 0.985, 0, Math.PI * 2); ctx.clip();
      /* Подложка окна плотнее, чем у линзы: под ней лежит глиф знака, и при
         0.45 он спорил со свечами за внимание — внутри окна главное всё-таки
         случай, а не знак. */
      ctx.fillStyle = 'rgba(255,253,249,' + (0.66 * w).toFixed(3) + ')';
      ctx.fillRect(g.cx - g.r, g.cy - g.r, g.r * 2, g.r * 2);
      this.candles(ctx, rows, from, N, px0, slot, bodyW, yOf, w, true);
      ctx.restore();
    }

    /* Точка паттерна у правого края: связывает слово «паттерн» из текста
       с местом на графике. */
    if (m && m.type !== 'dates') {
      const v = m.type === 'hline' ? m.level : (m.low + m.high) / 2;
      const mx = px1 - 14, my = yOf(v);
      ctx.globalAlpha = w;
      ctx.fillStyle = '#FFFDF9';
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,162,39,0.95)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(mx, my, 8, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#C9A227';
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

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

    /* ── Подписи ───────────────────────────────────────────
       Шкала и даты — обычный DOM, как все подписи сцены: их выделяют,
       читают скринридером и увеличивают вместе со шрифтом браузера.
       Без них график читается как узор — нельзя понять ни уровня цены,
       ни масштаба движения. */
    if (labels) {
      for (let i = 0; i <= 4; i++) {
        labels.put('mem-y' + i, price(B.hi - (i / 4) * span),
                   px1 + 8, py0 + (i / 4) * ph - 7,
                   { alpha: w * 0.8, avoid: false });
      }
      /* Даты держим внутри поля: крайняя левая вылезала за край экрана и
         обрезалась до «26-06-01» — дата, которой не бывает. */
      const days = view.mobile ? [0, N - 1] : [0, N >> 1, N - 1];
      labels.put('mem-x2', '', 0, 0, { alpha: 0, avoid: false });
      days.forEach((k, j) => {
        const d = rows[from + k];
        const x = px0 + (k + 0.5) * slot;
        labels.put('mem-x' + j, d ? d.d : '',
                   Math.max(px0 + 42, Math.min(px1 - 42, x)), py1 + 6,
                   { align: 'center', alpha: w * 0.7, avoid: false });
      });
      /* Название случая над кольцом — только на десктопе: на телефоне
         график стоит внутри своего кейса, и заголовок написан прямо над
         ним обычным текстом. Повторять его подписью — эхо, а не подпись. */
      const cap = view.mobile ? 0 : w;
      labels.put('mem-title', t(CASES[idx].key + '.title', ''),
                 g.cx, g.cy - g.r - 34, { align: 'center', alpha: cap, tone: 'key' });
      labels.put('mem-meta', t(CASES[idx].key + '.meta', ''),
                 g.cx, g.cy - g.r - 16, { align: 'center', alpha: cap });
      /* Счётчик «второй из пяти» отвечает на вопрос «сколько ещё крутить».
         На десктопе он под кольцом, на телефоне кольцо стоит над колонкой
         и счётчик ложился поверх свечей — там он уходит под график. */
      labels.put('mem-count', (idx + 1) + ' / ' + n,
                 view.mobile ? px0 + pw / 2 : g.cx,
                 view.mobile ? py1 + 6 : g.cy + g.r + 16,
                 { align: 'center', alpha: w, avoid: false });
    }
  },

  candles(ctx, rows, from, N, px0, slot, bodyW, yOf, alpha, bright) {
    if (alpha < 0.02) return;
    ctx.globalAlpha = alpha;
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = ctx.fillStyle = pass
        ? (bright ? '#d8433f' : '#ef5350')
        : (bright ? '#1f8e83' : '#26a69a');
      ctx.lineWidth = bright ? 1.1 : 0.9;
      for (let i = 0; i < N; i++) {
        const d = rows[from + i];
        if (!d || (d.c >= d.o) === !!pass) continue;
        const x = px0 + (i + 0.5) * slot;
        ctx.beginPath();
        ctx.moveTo(x, yOf(d.h)); ctx.lineTo(x, yOf(d.l)); ctx.stroke();
        const a = yOf(d.o), b = yOf(d.c);
        ctx.fillRect(x - bodyW / 2, Math.min(a, b), bodyW,
                     Math.max(1, Math.abs(b - a)));
      }
    }
    ctx.globalAlpha = 1;
  },

  enter() {}, leave() {},
};

/* Цена на шкале: 1.16293 у валют, 4440.2 у золота — один формат на всех
   давал либо мусор из нулей, либо потерю знаков. Правило взято из
   js/acts/act3-market.js, чтобы шкала на обоих каркасах читалась
   одинаково. */
function price(v) {
  const a = Math.abs(v);
  return a < 20 ? v.toFixed(4) : (a < 500 ? v.toFixed(2) : v.toFixed(1));
}

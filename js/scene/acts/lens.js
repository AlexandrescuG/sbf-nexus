/* lens.js — акт 3: лента свечей идёт сквозь знак.

   Здесь знак работает: снаружи кольца — поток как есть, внутри — тот же
   поток с разметкой. Это буквальное изображение того, что продаёт сайт, и
   потому единственный акт, где движение обязано быть.

   Главное отличие от прежней версии (js/acts/act-approach.js): время здесь
   — это прокрутка. Лента едет ровно настолько, насколько прокручен акт, а
   разметка появляется по мере движения камеры, а не по таймеру:

     0.00 … 0.20   только свечи — шум, как он есть
     0.20 … 0.45   границы диапазона: где рынок разворачивался
     0.45 … 0.70   скользящая по 20 свечам: куда он смещается
     0.70 … 1.00   точка паттерна: то, ради чего всё остальное

   Остановился на середине — картинка стоит и её можно рассмотреть. Пошёл
   назад — разметка снимается в обратном порядке. Ничего не происходит
   «само», и в этом смысл: закономерность не появляется по таймеру, её
   находят, вглядываясь.

   Данные — настоящие: assets/data/XAUUSD_4H_uptrend.csv, тот же файл, по
   которому собран промо-GIF (tools/gif/). Выдуманных свечей на сайте, где
   продают анализ рынка, быть не может.
*/

import { t } from '../labels.js';

/* Сколько свечей в кадре.

   Было 19 — и это оказалось главной причиной, по которой график в гобелене
   проигрывал живому сайту («графики на основном тоже смотрятся куда
   приятнее»). Дело даже не в самом числе: ширина слота считалась по всей
   ширине окна, а лента потом обрезалась коридором знака, и до экрана
   доезжало восемь свечей шириной по сорок пикселей. Получались не свечи,
   а столбики диаграммы.

   На живом сайте (js/acts/act-approach.js) их 120 на десктопе и 80 на
   телефоне, и именно поэтому там читается график, а не схема. Здесь чуть
   меньше, потому что лента занимает не весь экран, а полосу справа от
   колонки, — но плотность та же. */
const VISIBLE = 92;
const VISIBLE_MOBILE = 48;
const SPAN = 260;               /* сколько свечей проезжает акт целиком */

export const lens = {
  id: 'lens',
  role: 'process',
  note: 'лента свечей и линза',

  rows: null, scale: null, loading: false,

  load() {
    if (this.loading) return;
    this.loading = true;
    fetch('assets/data/XAUUSD_4H_uptrend.csv')
      .then(r => r.text())
      .then(txt => {
        const lines = txt.trim().split('\n');
        const head = lines[0].split(',').map(s => s.trim());
        this.rows = lines.slice(1).map(l => {
          const v = l.split(','), o = {};
          head.forEach((h, i) => o[h] = v[i]);
          return { o: +o.Open, h: +o.High, l: +o.Low, c: +o.Close };
        }).filter(d => !isNaN(d.o));
        this.scale = true;
      })
      .catch(() => console.warn('[scene] свечи не загрузились'));
  },

  render(ctx, view, cam, mark, labels) {
    this.load();
    if (!this.rows || !this.scale) return;
    const w = cam.w;
    if (w < 0.02) return;

    const g = mark.geometry(view);
    /* Лента живёт справа от колонки текста, а не через весь экран.
       Через весь экран она шла сквозь абзацы: свечи оказывались между
       строк, и читать было нечем. Правило то же, что у знака, — коридор;
       граница берётся из тех же переменных, а не подбирается на глаз.
       На телефоне колонка занимает всю ширину, и лента идёт под ней.

       Ширина слота считается по этой полосе, а не по всему окну. Прежняя
       версия делила ширину окна, а потом обрезала половину ленты
       коридором — половина свечей рисовалась в никуда, а оставшиеся были
       вдвое шире, чем задумано. */
    const x0 = view.mobile ? 0 : g.corridor.cx - g.corridor.halfW - 24;
    const tw = view.w - x0;
    /* В упрощённом режиме свечей вдвое меньше. Лента остаётся лентой, а
       каждая свеча — это обводка и заливка, то есть работа, которую
       видно только вблизи. Флаг ставит линейка кадра (stage.js). */
    const vis = Math.round((view.mobile ? VISIBLE_MOBILE : VISIBLE) *
                           (view.simple ? 0.5 : 1));
    const slot = tw / vis;
    const bodyW = Math.max(1.5, slot * 0.66);

    /* Прокрутка = время. Ни таймера, ни автопрокрутки ленты. */
    const pos = cam.t * SPAN;
    const start = Math.floor(pos), off = (pos - start) * slot;

    /* Шкала — по видимому окну, как на живом сайте: график должен занимать
       кадр целиком независимо от того, на каком участке цены он сейчас.
       Постоянный масштаб, стоявший здесь раньше, на спокойном участке
       давал ленту-полоску в четверть высоты.

       Чтобы окно не «дышало» на каждом кадре, границы догоняют цель
       плавно — то же сглаживание, что было у середины. */
    let lo = Infinity, hi = -Infinity;
    for (let i = -1; i <= vis + 1; i++) {
      const c = this.rows[(start + i) % this.rows.length];
      if (!c) continue;
      if (c.l < lo) lo = c.l;
      if (c.h > hi) hi = c.h;
    }
    const k = Math.min(1, view.dt * 5);
    this.lo = this.lo == null ? lo : this.lo + (lo - this.lo) * k;
    this.hi = this.hi == null ? hi : this.hi + (hi - this.hi) * k;
    const padT = view.h * 0.16, padB = view.h * 0.18;
    const range = (this.hi - this.lo) || 1;
    const yOf = p => padT + (1 - (p - this.lo) / range) * (view.h - padT - padB);

    ctx.save();

    if (!view.mobile) {
      ctx.beginPath();
      ctx.rect(x0, 0, tw, view.h);
      ctx.clip();
    }

    /* Снаружи кольца — приглушённо: это фон, шум.

       Свечи рисуются двумя пачками — сначала все растущие, потом все
       падающие. Разница не в числе операций, а в числе смен состояния
       холста: при отрисовке по одной каждая свеча меняла fillStyle,
       strokeStyle и globalAlpha, и сотня свечей означала три сотни смен
       состояния в кадре. На слабом телефоне это стоило дороже самой
       заливки: работа внутри кадра оставалась двумя миллисекундами, а
       кадров дольше 25 мс стало вчетверо больше. */
    /* Снаружи кольца лента на телефоне сильно бледнее.
     *
     * На широком экране «под текстом» — правда: колонка слева, лента
     * справа. На узком колонка занимает всю ширину, и то же 0.34
     * означало «сквозь буквы»: свечи пересекали абзац, и щуп
     * scene-overlap намерил 4.4% плотного рисунка внутри рамки колонки
     * при пороге 2.
     *
     * Сначала ленту обрезали по верхнему краю колонки — и стало хуже:
     * колонка едет вместе с прокруткой, а обрезка считалась один раз,
     * так что лента легла ровно на заголовок. Плотность работает без
     * привязки к чужой раскладке: лента остаётся на месте и читается
     * как фактура, а разобранный поток видно там, где ему и место, —
     * внутри кольца. */
    ctx.globalAlpha = w * (view.mobile ? 0.13 : 0.34);
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = ctx.fillStyle = pass ? '#ef5350' : '#26a69a';
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= vis + 1; i++) {
        const c = this.rows[(start + i) % this.rows.length];
        if (!c || (c.c >= c.o) === !!pass) continue;
        candle(ctx, c, x0 + i * slot - off, yOf, bodyW);
      }
    }
    ctx.globalAlpha = 1;

    /* Края полосы растворяются, а не обрываются вертикальной линией —
       иначе видно границу клипа и график выглядит вырезанным из другого
       экрана. Раньше это делалось прозрачностью каждой свечи, то есть
       ценой смены состояния холста на каждой; теперь — двумя градиентами
       цветом фона поверх готовой ленты. Цвет берётся у сцены (view.bg),
       а не переписывается сюда числом. */
    const soft = slot * 7;
    fade(ctx, x0, soft, view.bg, 1, view.h);
    fade(ctx, view.w, -soft, view.bg, 1, view.h);

    /* Внутри кольца — тот же поток, но разобранный */
    ctx.globalAlpha = w;
    ctx.save();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); ctx.clip();
    /* Подложка линзы едва светлее фона: при 0.72 круг читался как дырка в
       графике, а он должен читаться как стекло над ним. */
    ctx.fillStyle = 'rgba(255, 253, 249, 0.42)';
    ctx.fillRect(g.cx - g.r, g.cy - g.r, g.r * 2, g.r * 2);

    /* Что попало в кольцо — по нему и считаем уровни: границы всего отрезка
       почти всегда оказываются за краем круга, и разметки было бы не видно */
    let rhi = -Infinity, rlo = Infinity;
    for (let i = -1; i <= vis + 1; i++) {
      const x = x0 + i * slot - off;
      if (Math.abs(x - g.cx) > g.r * 0.92) continue;
      const c = this.rows[(start + i) % this.rows.length];
      if (c.h > rhi) rhi = c.h;
      if (c.l < rlo) rlo = c.l;
    }

    const step = (a, b) => Math.max(0, Math.min(1, (cam.t - a) / (b - a)));

    /* Уровни */
    const lv = step(0.20, 0.45);
    if (lv > 0 && isFinite(rhi)) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(154, 123, 30, ' + (0.75 * lv) + ')';
      ctx.lineWidth = 1.4;
      [yOf(rhi), yOf(rlo)].forEach(y => {
        ctx.beginPath();
        ctx.moveTo(g.cx - g.r, y);
        ctx.lineTo(g.cx - g.r + g.r * 2 * lv, y);
        ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    /* Скользящая по 20 свечам */
    const sma = step(0.45, 0.70);
    if (sma > 0) {
      ctx.strokeStyle = 'rgba(201, 162, 39, ' + (0.9 * sma) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const last = -1 + (vis + 2) * sma;
      for (let i = -1; i <= last; i++) {
        let sum = 0;
        for (let k = 0; k < 20; k++) {
          sum += this.rows[((start + i - k) % this.rows.length + this.rows.length)
                            % this.rows.length].c;
        }
        const x = x0 + i * slot - off, y = yOf(sum / 20);
        i === -1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    /* Свечи внутри кольца — ярче, и заодно ищем вершину для точки паттерна.
       Перебираем только те, что попадают в круг: остальные всё равно
       отсечены клипом, а свечей теперь под сотню. */
    let topX = null, topV = -Infinity;
    const from = Math.max(-1, Math.floor((g.cx - g.r - x0 + off) / slot) - 1);
    const to = Math.min(vis + 1, Math.ceil((g.cx + g.r - x0 + off) / slot) + 1);
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = ctx.fillStyle = pass ? '#d8433f' : '#1f8e83';
      ctx.lineWidth = 1.6;
      for (let i = from; i <= to; i++) {
        const c = this.rows[((start + i) % this.rows.length + this.rows.length)
                            % this.rows.length];
        if (!c || (c.c >= c.o) === !!pass) continue;
        const x = x0 + i * slot - off;
        if (Math.abs(x - g.cx) <= g.r && c.h > topV) { topV = c.h; topX = x; }
        candle(ctx, c, x, yOf, bodyW);
      }
    }

    /* Точка паттерна — то, ради чего вся разметка */
    const pat = step(0.70, 0.92);
    if (pat > 0 && topX !== null) {
      const y = yOf(topV);
      ctx.fillStyle = 'rgba(230, 194, 87, ' + pat + ')';
      ctx.beginPath(); ctx.arc(topX, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(230, 194, 87, ' + (0.9 * pat) + ')';
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(topX, y, 6 + 8 * pat, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();

    /* ── Легенда ───────────────────────────────────────────
       Разметка называет себя сама. Раньше «уровни · скользящая · паттерн»
       стояли столбиком справа от кольца — то есть поверх свечей, и
       читатель всё равно должен был догадываться, какая линия какая.
       Живой сайт решает это строкой внизу графика с образцами линий, и
       это правильнее: образец рядом со словом отвечает на вопрос сразу.

       Каждый пункт появляется вместе со своей линией и гаснет вместе с
       ней — этого на живом сайте нет, и это единственное, что здесь
       добавлено: в гобелене разметка проявляется по мере движения, и
       легенда обязана идти за ней. */
    /* На телефоне легенды нет.
     *
     * Она называет три линии разметки — а разметка там внутри кольца
     * размером с ладонь, и читать по ней нечего: лента снаружи идёт
     * фактурой. Строка же из трёх пунктов с образцами занимает всю
     * ширину и неизбежно ложится на текст: смещение её не спасает,
     * свободного места в колонке нет.
     *
     * Нарисованное остаётся названным — подпись «снаружи шум, внутри
     * уровни, средняя, паттерн» стоит в самой колонке (approach.lens_cap),
     * и на узком экране она и есть легенда. */
    if (labels && !view.mobile) {
      const lvA = step(0.20, 0.45) * w, smA = step(0.45, 0.70) * w,
            paA = step(0.70, 0.92) * w;
      /* Не у самого низа кадра: там висит кнопка «Связаться», и легенда
         подлезала под неё. Отступ считается от высоты окна, а не от края
         ленты, — строка должна стоять на одном месте, пока лента едет. */
      const y = view.h - (view.mobile ? 62 : 96);
      const gap = view.mobile ? 96 : 132;
      const cxRow = x0 + tw / 2 - gap;
      const items = [
        { a: lvA, key: 'approach.lg_level', def: 'уровень', kind: 'dash' },
        { a: smA, key: 'approach.lg_sma', def: 'SMA 20', kind: 'line' },
        { a: paA, key: 'approach.lg_pat', def: 'паттерн', kind: 'dot' },
      ];
      ctx.save();
      items.forEach((it, i) => {
        const x = cxRow + i * gap;
        if (it.a > 0.02) swatch(ctx, it.kind, x, y, it.a);
        /* На телефоне легенда обязана сторониться текста: колонка там во
           всю ширину, и строка «уровень · SMA 20 · паттерн» ложилась
           прямо на пункт списка. На широком экране сторониться нечего —
           под графиком пусто, и запрет на смещение держит строку на
           одном месте, пока лента едет. */
        labels.put('lens-lg-' + i, t(it.key, it.def), x + 26, y - 7,
                   { alpha: it.a, avoid: !!view.mobile,
                     tone: it.kind === 'dot' ? 'key' : 'plain' });
      });
      ctx.restore();
      /* Что это за инструмент и какие данные — тоже вопрос без ответа,
         если не написать. Строка стоит под лентой, а не в колонке: она
         относится к графику. */
      labels.put('lens-src',
                 'XAU/USD · H4 · ' + t('approach.chart_head', 'исторические данные'),
                 x0 + tw / 2, y + 16, { align: 'center', alpha: w, avoid: false });
    }
  },

  enter() {}, leave() {},
};

/* Растворение края полосы: градиент цветом фона от края внутрь */
function fade(ctx, x, dx, bg, alpha, h) {
  const g = ctx.createLinearGradient(x, 0, x + dx, 0);
  g.addColorStop(0, bg);
  g.addColorStop(1, bg.replace('rgb(', 'rgba(').replace(')', ',0)'));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(Math.min(x, x + dx), 0, Math.abs(dx), h);
  ctx.restore();
}

/* Образец линии в легенде: штрих, сплошная, точка */
function swatch(ctx, kind, x, y, a) {
  ctx.globalAlpha = a;
  if (kind === 'dot') {
    ctx.fillStyle = '#E6C257';
    ctx.beginPath(); ctx.arc(x + 8, y, 4, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.strokeStyle = kind === 'dash' ? 'rgba(154,123,30,0.9)' : '#C9A227';
    ctx.lineWidth = kind === 'dash' ? 1.4 : 2;
    ctx.setLineDash(kind === 'dash' ? [4, 4] : []);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

/* Одна свеча. Цвет и толщину задаёт вызывающий: свечи идут пачками одного
   цвета, и менять состояние холста на каждой — это и была та цена, из-за
   которой сотня свечей стоила дороже, чем весь остальной кадр. */
function candle(ctx, c, x, yOf, bodyW) {
  ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
  const yo = yOf(c.o), yc = yOf(c.c);
  ctx.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW,
               Math.max(1.5, Math.abs(yc - yo)));
}

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

const VISIBLE = 26;             /* свечей в кадре */
const SPAN = 96;                /* сколько свечей проезжает акт целиком */

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
        /* Шкала считается один раз по всему отрезку, а не по видимому окну:
           иначе масштаб «дышит» на каждом кадре и лента выглядит нечестно. */
        const seg = this.rows.slice(0, SPAN + VISIBLE);
        const lo = Math.min(...seg.map(d => d.l));
        const hi = Math.max(...seg.map(d => d.h));
        this.scale = { lo: lo, hi: hi, range: (hi - lo) || 1 };
      })
      .catch(() => console.warn('[scene] свечи не загрузились'));
  },

  render(ctx, view, cam, mark) {
    this.load();
    if (!this.rows || !this.scale) return;
    const w = cam.w;
    if (w < 0.02) return;

    const g = mark.geometry(view);
    const slot = view.w / VISIBLE;
    const bodyW = slot * 0.58;

    /* Прокрутка = время. Ни таймера, ни автопрокрутки ленты. */
    const pos = cam.t * SPAN;
    const start = Math.floor(pos), off = (pos - start) * slot;

    /* Вертикаль ленты привязана к кольцу, а не к экрану.
       Сначала шкала была растянута на весь кадр — и на растущем участке
       лента уходила выше линзы: знак «обрабатывал» пустоту, а свечи шли
       мимо. Теперь масштаб постоянный (столько-то пикселей на пункт цены),
       а середина видимого окна держится на высоте центра кольца. Лента
       дышит вверх-вниз, но всегда проходит сквозь знак. */
    const k = (view.h * 0.42) / this.scale.range;
    let sum = 0, n = 0;
    for (let i = 0; i <= VISIBLE; i++) {
      const c = this.rows[(start + i) % this.rows.length];
      if (c) { sum += (c.h + c.l) / 2; n++; }
    }
    const mid = n ? sum / n : this.scale.lo + this.scale.range / 2;
    /* Центр догоняем плавно: иначе на каждом кадре лента подпрыгивает */
    this.mid = this.mid == null ? mid : this.mid + (mid - this.mid) *
               Math.min(1, view.dt * 4);
    const yOf = p => g.cy - (p - this.mid) * k;

    ctx.save();
    ctx.globalAlpha = w;

    /* Снаружи кольца — приглушённо: это фон, шум */
    ctx.globalAlpha = w * 0.34;
    for (let i = -1; i <= VISIBLE + 1; i++) {
      const c = this.rows[(start + i) % this.rows.length];
      candle(ctx, c, i * slot - off, yOf, bodyW, false);
    }

    /* Внутри кольца — тот же поток, но разобранный */
    ctx.globalAlpha = w;
    ctx.save();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255, 253, 249, 0.72)';
    ctx.fillRect(g.cx - g.r, g.cy - g.r, g.r * 2, g.r * 2);

    /* Что попало в кольцо — по нему и считаем уровни: границы всего отрезка
       почти всегда оказываются за краем круга, и разметки было бы не видно */
    let hi = -Infinity, lo = Infinity;
    for (let i = -1; i <= VISIBLE + 1; i++) {
      const x = i * slot - off;
      if (Math.abs(x - g.cx) > g.r * 0.92) continue;
      const c = this.rows[(start + i) % this.rows.length];
      if (c.h > hi) hi = c.h;
      if (c.l < lo) lo = c.l;
    }

    const step = (a, b) => Math.max(0, Math.min(1, (cam.t - a) / (b - a)));

    /* Уровни */
    const lv = step(0.20, 0.45);
    if (lv > 0 && isFinite(hi)) {
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = 'rgba(154, 123, 30, ' + (0.75 * lv) + ')';
      ctx.lineWidth = 1.4;
      [yOf(hi), yOf(lo)].forEach(y => {
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
      const last = -1 + (VISIBLE + 2) * sma;
      for (let i = -1; i <= last; i++) {
        let sum = 0;
        for (let k = 0; k < 20; k++) {
          sum += this.rows[((start + i - k) % this.rows.length + this.rows.length)
                            % this.rows.length].c;
        }
        const x = i * slot - off, y = yOf(sum / 20);
        i === -1 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    /* Свечи внутри кольца — ярче, и заодно ищем вершину для точки паттерна */
    let topX = null, topV = -Infinity;
    for (let i = -1; i <= VISIBLE + 1; i++) {
      const c = this.rows[(start + i) % this.rows.length];
      const x = i * slot - off;
      if (Math.abs(x - g.cx) <= g.r && c.h > topV) { topV = c.h; topX = x; }
      candle(ctx, c, x, yOf, bodyW, true);
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
  },

  enter() {}, leave() {},
};

function candle(ctx, c, x, yOf, bodyW, bright) {
  if (!c) return;
  const up = c.c >= c.o;
  ctx.strokeStyle = ctx.fillStyle = up
    ? (bright ? '#1f8e83' : '#26a69a')
    : (bright ? '#d8433f' : '#ef5350');
  ctx.lineWidth = bright ? 1.6 : 1.2;
  ctx.beginPath(); ctx.moveTo(x, yOf(c.h)); ctx.lineTo(x, yOf(c.l)); ctx.stroke();
  const yo = yOf(c.o), yc = yOf(c.c);
  ctx.fillRect(x - bodyW / 2, Math.min(yo, yc), bodyW,
               Math.max(1.5, Math.abs(yc - yo)));
}

/* memory.js — акт 6: память рынков.

   Утверждение экрана простое: движение оставляет след, и след можно
   посмотреть. Поэтому здесь не иллюстрация «графика вообще», а настоящие
   случаи из assets/data/*.csv — те же файлы, что лежат в кейсах старого
   сайта. Один случай на отрезок акта: прокрутил — сменился.

   Внутри кольца — цена целиком, снаружи — та же линия бледнее. Кольцо
   работает как окно памяти: то, что в нём, разобрано; то, что снаружи, —
   просто прошлое.
*/

const CASES = [
  { file: 'XAUUSD_triangle_breakout_may2026.csv', key: 'market.c1' },
  { file: 'EURUSD_gap_may2026.csv',               key: 'market.c2' },
  { file: 'Copper_channel_breakout_2026.csv',     key: 'market.c3' },
  { file: 'USDJPY_intervention_may2026.csv',      key: 'market.c4' },
  { file: 'NatGas_NG_2023.csv',                   key: 'market.c5' },
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
        const ci = head.indexOf('Close') >= 0 ? head.indexOf('Close')
                                              : head.indexOf('close');
        const rows = lines.slice(1).map(l => +l.split(',')[ci])
                          .filter(v => !isNaN(v));
        this.data[i] = rows.length ? rows : null;
      })
      .catch(() => { this.data[i] = null; });
  },

  render(ctx, view, cam, mark) {
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);

    const n = CASES.length;
    const idx = Math.min(n - 1, Math.floor(cam.t * n));
    const inCase = cam.t * n - idx;
    this.load(idx);
    this.load(idx + 1);                        /* следующий — заранее */
    const rows = this.data[idx];
    if (!rows) return;

    /* Границы случая считаются один раз и запоминаются. До этого здесь
       стояло Math.min(...rows) прямо в кадре — шестьсот аргументов в вызов
       шестьдесят раз в секунду. На ноутбуке незаметно, на телефоне с
       вчетверо более слабым процессором это была половина бюджета кадра. */
    if (!this.bounds) this.bounds = {};
    if (!this.bounds[idx]) {
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i] < lo) lo = rows[i];
        if (rows[i] > hi) hi = rows[i];
      }
      this.bounds[idx] = { lo: lo, hi: hi, range: (hi - lo) || 1 };
    }
    const lo = this.bounds[idx].lo, range = this.bounds[idx].range;
    const x0 = -view.w * 0.05, x1 = view.w * 1.05;
    const yOf = v => g.cy + (0.5 - (v - lo) / range) * view.h * 0.42;
    const xOf = i => x0 + (i / (rows.length - 1)) * (x1 - x0);

    /* Линия целиком — бледная: это прошлое, оно просто было */
    ctx.save();
    ctx.globalAlpha = w * 0.30;
    ctx.beginPath();
    rows.forEach((v, i) => i ? ctx.lineTo(xOf(i), yOf(v)) : ctx.moveTo(xOf(i), yOf(v)));
    ctx.strokeStyle = '#9A7B1E'; ctx.lineWidth = 1.2; ctx.stroke();

    /* В кольце — она же, разобранная: видно, докуда дошло движение */
    ctx.globalAlpha = w;
    ctx.save();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r * 0.985, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(255,253,249,0.72)';
    ctx.fillRect(g.cx - g.r, g.cy - g.r, g.r * 2, g.r * 2);

    /* Линия рисуется ровно настолько, насколько пройден случай: движение
       на экране — это движение камеры, а не таймер. */
    const upto = Math.max(2, Math.floor(rows.length * smooth(inCase)));
    ctx.beginPath();
    for (let i = 0; i < upto; i++) {
      const x = xOf(i), y = yOf(rows[i]);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 2; ctx.stroke();

    /* Точка «здесь» — конец пройденного */
    const lx = xOf(upto - 1), ly = yOf(rows[upto - 1]);
    ctx.beginPath(); ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#E6C257'; ctx.fill();
    ctx.restore();
    ctx.restore();

    /* Счётчик случаев — на кольце, короткими рисками. Пятая риска
       заполнена — акт пройден; это честнее подписи «5 с». */
    ctx.save();
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
  },

  enter() {}, leave() {},
};

function smooth(x) { return x * x * (3 - 2 * x); }

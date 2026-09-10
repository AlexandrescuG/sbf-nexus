/* terminal.js — акты 4–5: платформа и PRO.

   Знак здесь — дверь. Через кольцо видно то, что за ним: живой экран
   платформы. Не декоративный скриншот в рамке, а именно вид сквозь знак —
   поэтому картинка проявляется по кольцу и держится в его границах.

   Порядок экранов повторяет порядок разговора в тексте: терминал → журнал
   → академия. Переключаются они не по таймеру и не по клику, а тем же,
   чем движется всё остальное, — прокруткой: акт разбит на три отрезка.
   Клик остаётся у ссылок в тексте, они ведут в те же разделы.

   Второй акт платформы (PRO) — про три шага опроса. Кольцо здесь считает
   шаги: треть, две трети, полное. Это то же «выдаёт», но с шагами, которые
   человек пройдёт сам.
*/

const SHOTS = [
  { src: 'assets/platform/terminal.png', tab: 'terminal' },
  { src: 'assets/platform/journal.png',  tab: 'journal' },
  { src: 'assets/platform/academy.png',  tab: 'academy' },
];

export const terminal = {
  id: 'terminal',
  role: 'output',
  note: 'терминал платформы и PRO',

  imgs: null,

  load() {
    if (this.imgs) return;
    this.imgs = SHOTS.map(s => {
      const im = new Image();
      im.src = s.src;
      return im;
    });
  },

  render(ctx, view, cam, mark) {
    this.load();
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);

    /* Акт платформы идёт первым, PRO — вторым. Различаем по секции, в
       которой сейчас камера: обе ведут на один и тот же модуль, но
       показывают разное. Читать DOM здесь дешевле, чем плодить акты с
       одинаковым кодом. */
    const pro = document.body.dataset.sceneSection === 'act-platform-2';

    if (pro) { this.renderSteps(ctx, view, cam, g, w); return; }

    /* Какой экран показываем: три отрезка акта — три раздела платформы */
    const seg = Math.min(2, Math.floor(cam.t * 3));
    const inSeg = cam.t * 3 - seg;                 /* 0…1 внутри отрезка */
    const img = this.imgs[seg];
    if (!img || !img.complete || !img.naturalWidth) return;

    ctx.save();
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r * 0.985, 0, Math.PI * 2); ctx.clip();

    /* Кадр платформы вписан в кольцо по ширине: важен верх экрана, где
       график и панель, а не низ со списком сделок. */
    const iw = g.r * 2.3;
    const ih = iw * (img.naturalHeight / img.naturalWidth);
    const x = g.cx - iw / 2, y = g.cy - ih * 0.34;

    /* Проявление по кольцу: картинка открывается сектором, а не
       растворением. Растворение читается как «грузится», сектор — как
       «открывается дверь». */
    const open = smooth(Math.min(1, inSeg / 0.45));
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(g.cx, g.cy);
    ctx.arc(g.cx, g.cy, g.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * open);
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = w;
    ctx.drawImage(img, x, y, iw, ih);
    ctx.restore();

    /* Лёгкая тень по краю кольца — чтобы экран не выглядел наклейкой */
    const vg = ctx.createRadialGradient(g.cx, g.cy, g.r * 0.72, g.cx, g.cy, g.r);
    vg.addColorStop(0, 'rgba(251,246,239,0)');
    vg.addColorStop(1, 'rgba(251,246,239,0.85)');
    ctx.fillStyle = vg;
    ctx.fillRect(g.cx - g.r, g.cy - g.r, g.r * 2, g.r * 2);
    ctx.restore();
  },

  /* PRO: три шага опроса. Кольцо считает шаги — это единственная работа
     знака в этом акте, и другой анимации здесь нет. */
  renderSteps(ctx, view, cam, g, w) {
    const done = Math.min(3, Math.floor(cam.t * 3) + (cam.t * 3 % 1 > 0.5 ? 1 : 0));
    ctx.save();
    ctx.globalAlpha = w;
    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI / 2 + (Math.PI * 2 / 3) * i + 0.05;
      const a1 = a0 + (Math.PI * 2 / 3) - 0.1;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.r * 1.1, a0, a1);
      ctx.strokeStyle = i < done ? 'rgba(201,162,39,0.9)' : 'rgba(201,162,39,0.18)';
      ctx.lineWidth = i < done ? 4 : 2;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    ctx.restore();
  },

  enter() {}, leave() {},
};

function smooth(x) { return x * x * (3 - 2 * x); }

/* stream.js — акт 2: что выходит из шума.

   Продолжение первого акта, а не новая картинка. В акте 1 нити шли снаружи
   внутрь: мир отдавал знаку события. Здесь направление меняется — из знака
   вниз идёт поток того, что из этих событий получилось: бриф, разметка на
   графике, журнал, академия.

   Смысл перехода буквальный: то же движение, развёрнутое наоборот. Поэтому
   между актами нет ни склейки, ни смены фона — меняется направление.

   Что именно выходит, берётся не из головы: подписи потока — это разделы
   платформы, на которые ведёт первый экран.
*/

import { t } from '../labels.js';

const GOLD = '201, 162, 39';
const LINES = 4;                 /* четыре русла: по числу карточек акта */

/* Русла — не абстрактные линии. Их ровно четыре, и каждое названо тем же,
   чем названа карточка рядом в тексте: бриф, разбор актива, библиотека
   паттернов, журнал. Претензия владельца была точной — «непонятно, для чего
   те линии». Линия с именем это схема, без имени — украшение. */
const LANE_KEYS = ['grow.c1.title', 'grow.c2.title', 'grow.c3.title', 'grow.c4.title'];

export const stream = {
  id: 'stream',
  role: 'output',
  note: 'поток «шум → продукт»',
  /* Знак здесь — вторая дверь на платформу; подпись под ним это обещает,
     значит клик обязан работать. Ссылку кладёт сцена (stage.js). */
  link: 'https://lp.sbfconsult.com/?utm_source=sbfconsult_site&utm_medium=logo&utm_campaign=grow_logo',
  linkTrack: 'grow_platform',
  linkLabel: 'Открыть платформу',

  drops: [],

  enter() {
    if (this.drops.length) return;
    /* Телефон: по одной капле на русло вместо трёх. Смысл потока от этого
       не меняется, а работы в кадре втрое меньше. */
    const per = window.innerWidth < 900 ? 1 : 3;
    for (let i = 0; i < LINES * per; i++) {
      this.drops.push({
        lane: i % LINES,
        v: Math.random(),                    /* положение вдоль русла */
        speed: 0.16 + Math.random() * 0.12,
        size: 2 + Math.random() * 1.8,
      });
    }
  },

  render(ctx, view, cam, mark, labels) {
    const g = mark.geometry(view);
    const w = cam.w;
    if (w < 0.02) return;

    /* Русла расходятся от знака вниз веером. Ширина веера растёт вместе с
       прохождением акта: чем дальше камера, тем шире то, что получилось. */
    const spread = (0.18 + cam.t * 0.42) * view.w;
    const top = g.cy + g.r * 0.9;
    const bottom = view.h * 1.05;

    ctx.save();
    for (let l = 0; l < LINES; l++) {
      const k = LINES === 1 ? 0 : (l / (LINES - 1)) * 2 - 1;   /* −1 … +1 */
      const x1 = g.cx + k * spread;
      ctx.beginPath();
      ctx.moveTo(g.cx, top);
      ctx.bezierCurveTo(g.cx, top + (bottom - top) * 0.4,
                        x1, top + (bottom - top) * 0.5,
                        x1, bottom);
      ctx.strokeStyle = 'rgba(' + GOLD + ',' + (0.24 * w) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    /* По руслам идут капли — это и есть «выходит»: непрерывно, а не по
       таймеру. Скорость капли зависит от скорости прокрутки: стоишь —
       поток спокойный, гонишь вниз — поток ускоряется вместе с тобой. */
    const rush = 1 + Math.min(2, cam.speed / 900);
    this.drops.forEach(d => {
      d.v += view.dt * d.speed * rush;
      if (d.v > 1) d.v -= 1;
      const k = LINES === 1 ? 0 : (d.lane / (LINES - 1)) * 2 - 1;
      const x1 = g.cx + k * spread;
      const p = bez(d.v, g.cx, top, g.cx, top + (bottom - top) * 0.4,
                    x1, top + (bottom - top) * 0.5, x1, bottom);
      ctx.beginPath();
      ctx.arc(p[0], p[1], d.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(' + GOLD + ',' + (0.7 * w * (1 - d.v * 0.45)) + ')';
      ctx.fill();
    });
    ctx.restore();

    /* Подписи русел — там, где русло уходит за нижний край. Появляются
       вместе с веером, а не сразу: пока веер узкий, они налезали бы друг
       на друга. На телефоне русла сходятся почти в точку — подписей нет. */
    if (labels && !view.mobile) {
      const show = Math.max(0, Math.min(1, (cam.t - 0.15) / 0.3)) * w;
      for (let l = 0; l < LINES; l++) {
        const k = LINES === 1 ? 0 : (l / (LINES - 1)) * 2 - 1;
        labels.put('stream-' + l, t(LANE_KEYS[l], ''),
                   g.cx + k * spread, bottom - view.h * 0.16,
                   { align: 'center', alpha: show, tone: 'key' });
      }
    }
  },

  leave() {},
};

function bez(t, x0, y0, x1, y1, x2, y2, x3, y3) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * x0 + b * x1 + c * x2 + d * x3,
          a * y0 + b * y1 + c * y2 + d * y3];
}

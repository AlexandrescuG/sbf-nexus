/* macro.js — акт «на чём стоит рынок».

   Семь живых рядов FRED вокруг знака: ставка, цены, безработица, спред
   доходностей, ожидаемая инфляция, нефть, доллар. Знак здесь принимает —
   это и есть сырьё, из которого потом получается всё остальное.

   Что кодируется и что НЕ кодируется. Спица рисуется у каждого ряда,
   и единственное, что она говорит, — направление последнего шага:
   вверх, вниз или без изменения. Длину спицы по величине шага не
   масштабируем: ряды в разных единицах — проценты, доллары, пункты
   индекса, — и общая шкала сравнивала бы несравнимое. Цветом «хорошо
   или плохо» тоже не красим: рост нефти хорош одному клиенту и плох
   другому, а рекомендаций мы не даём.

   Числа и названия живут в колонке текста (fundamentals.js), а не здесь:
   их читают, выделяют и копируют, а холст ничего из этого не умеет.
   Задача этого файла — показать, что рядов семь и что они шевелятся.
*/

import { t } from '../labels.js';

/* Порядок спиц — порядок строк в колонке. Совпадение обязательное:
   иначе третья спица сверху и третья строка списка — разные ряды, и
   картинка начинает врать тихо. */
const START = -Math.PI / 2;

export const macro = {
  id: 'macro',
  role: 'intake',
  note: 'макро-ряды: ставка, цены, занятость, доходности',

  /* Сколько спиц зажглось. Растёт по ходу акта: ряды приходят по одному,
     а не возникают пачкой. */
  lit: 0,

  rows() {
    const meta = window.SBF_FEED_META;
    return (meta && meta.macro) || [];
  },

  render(ctx, view, cam, mark, labels) {
    const w = cam.w;
    if (w < 0.02) return;
    const rows = this.rows();
    if (!rows.length) return;
    const g = mark.geometry(view);

    /* Доля акта — сколько рядов уже показано. Отдельная переменная, а не
       прямое cam.t: на границе актов доля скачет, и спицы мигали бы. */
    const target = Math.min(1, Math.max(0, cam.t / 0.55));
    this.lit += (target - this.lit) * Math.min(1, view.dt * 3);

    const n = rows.length;
    const r0 = g.r * 1.12;
    const r1 = g.r * 1.42;

    ctx.save();
    ctx.globalAlpha = w;
    ctx.lineCap = 'round';

    for (let i = 0; i < n; i++) {
      const m = rows[i];
      /* Каждая спица зажигается своей долей пути, а не все разом. */
      const on = Math.max(0, Math.min(1, this.lit * n - i));
      if (on <= 0.01) continue;
      const a = START + Math.PI * 2 * (i / n);
      const ca = Math.cos(a), sa = Math.sin(a);
      ctx.globalAlpha = w * on;
      ctx.strokeStyle = 'rgba(201,162,39,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(g.cx + ca * r0, g.cy + sa * r0);
      ctx.lineTo(g.cx + ca * r1, g.cy + sa * r1);
      ctx.stroke();

      /* Наконечник — направление шага. Ряд без дельты (первое значение
         в серии) получает точку: «шага нет» и «шаг нулевой» — разные
         вещи, и рисовать их одинаково нельзя. */
      const d = m.delta;
      const ex = g.cx + ca * r1, ey = g.cy + sa * r1;
      ctx.fillStyle = '#C9A227';
      if (d == null) {
        ctx.beginPath(); ctx.arc(ex, ey, 2, 0, Math.PI * 2); ctx.fill();
      } else if (d === 0) {
        ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ex - sa * 5, ey + ca * 5);
        ctx.lineTo(ex + sa * 5, ey - ca * 5);
        ctx.stroke();
      } else {
        const s = d > 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(ex + ca * 7 * s, ey + sa * 7 * s);
        ctx.lineTo(ex - sa * 4.5, ey + ca * 4.5);
        ctx.lineTo(ex + sa * 4.5, ey - ca * 4.5);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    /* Подпись одна на весь веер: что это вообще за спицы. Семь подписей
       по кругу повторили бы список из колонки и наехали бы друг на друга
       на узком экране. */
    /* Подпись называет СТРЕЛКИ, а не акт. Сначала здесь стояло
       «основания» — то же слово, что в надзаголовке колонки прямо под
       кольцом: на телефоне выходило два одинаковых слова подряд, и
       подпись, вместо того чтобы объяснять рисунок, повторяла соседа. */
    if (labels && this.lit > 0.15) {
      labels.put('macro-cap', t('macro.delta', 'шаг к прошлому значению'),
                 g.cx, g.cy + r1 + 22,
                 { align: 'center', alpha: w * Math.min(1, this.lit * 2) });
    }
  },

  enter() { this.lit = 0; },
  leave() {},
};

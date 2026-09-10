/* ladder.js — акты 7–9: лестница услуг.

   Три уровня, и между ними меняется ровно одно: чью работу делает знак.

     Обучение              — работает клиент, мы даём материал
     Сопровождение счёта   — работаем вместе
     Доверительное управление — работаем мы

   Кольцо делится на две дуги: «вы» и «мы». Пропорция и есть содержание
   услуги, поэтому здесь ничего не двигается просто так — движется граница
   ответственности. По прокрутке она переезжает от одного края к другому,
   и это буквально то, что происходит с клиентом, когда он поднимается
   по лестнице.
*/

/* Доля нашей работы на каждом уровне. Числа не выдуманы: так описаны
   услуги в тексте — материал, совместная работа, управление. */
import { t } from '../labels.js';

const OURS = [0.15, 0.5, 0.9];

export const ladder = {
  id: 'ladder',
  role: 'process',
  note: 'лестница услуг, кольцо «вы / мы»',

  share: OURS[0],

  render(ctx, view, cam, mark, labels) {
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);

    /* Какой уровень — определяет секция, а не доля акта: три раздела
       услуг идут одним модулем, но это три разных обещания. */
    const id = document.body.dataset.sceneSection || '';
    const lvl = id.endsWith('3') ? 2 : (id.endsWith('2') ? 1 : 0);
    const target = OURS[lvl];
    /* Граница переезжает плавно: скачок читался бы как переключение
       вкладки, а это не вкладки, а движение вверх по лестнице. */
    this.share += (target - this.share) * Math.min(1, view.dt * 2.4);

    const r = g.r * 1.08;
    const start = -Math.PI / 2;
    const split = start + Math.PI * 2 * (1 - this.share);

    ctx.save();
    ctx.globalAlpha = w;
    ctx.lineWidth = 5;
    ctx.lineCap = 'butt';

    /* «Вы» — светлая дуга */
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, r, start, split);
    ctx.strokeStyle = 'rgba(154,123,30,0.28)';
    ctx.stroke();

    /* «Мы» — золото */
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, r, split, start + Math.PI * 2);
    ctx.strokeStyle = '#C9A227';
    ctx.stroke();

    /* Засечка на границе: видно, где проходит раздел ответственности */
    const bx = g.cx + Math.cos(split) * r, by = g.cy + Math.sin(split) * r;
    ctx.beginPath();
    ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FBF6EF';
    ctx.fill();
    ctx.strokeStyle = '#C9A227';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Ступени слева от кольца — три засечки, пройденные заполнены */
    for (let i = 0; i < 3; i++) {
      const y = g.cy + g.r * 1.45 + i * 12;
      ctx.beginPath();
      ctx.moveTo(g.cx - 26 - i * 10, y);
      ctx.lineTo(g.cx + 26 + i * 10, y);
      ctx.strokeStyle = i <= lvl ? 'rgba(201,162,39,0.85)' : 'rgba(201,162,39,0.20)';
      ctx.lineWidth = i <= lvl ? 3 : 2;
      ctx.stroke();
    }
    ctx.restore();

    /* Две дуги без подписей — просто кольцо двух оттенков. С подписями это
       ответ на единственный вопрос уровня: чья это работа. Подписи стоят у
       середины своей дуги и переезжают вместе с границей. */
    if (labels) {
      const midYou = start + Math.PI * (1 - this.share);
      const midWe = split + Math.PI * this.share;
      const at = (a, k) => [g.cx + Math.cos(a) * (r + 26),
                            g.cy + Math.sin(a) * (r + 26)];
      const py = at(midYou), pw2 = at(midWe);
      labels.put('lad-you', t('mark.you', 'вы'), py[0], py[1],
                 { align: 'center', alpha: w * (1 - this.share) * 1.4 });
      labels.put('lad-we', t('mark.we', 'мы'), pw2[0], pw2[1],
                 { align: 'center', alpha: w * this.share * 1.4, tone: 'key' });
    }
  },

  enter() {}, leave() {},
};

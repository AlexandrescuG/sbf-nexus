/* globe.js — акт 10: финал.

   Путь заканчивается там же, где начался, — на карте мира, но с другой
   стороны. В первом акте мир отдавал события знаку. Здесь знак отдаёт нити
   обратно: четыре наших адреса, и они настоящие.

   Глобус на three.js сюда не тянется. 590 КБ ради последнего экрана — это
   плата за то, что увидит меньшинство дошедших; на сцене финал рисуется
   тем же холстом, что и весь остальной путь. Отдельный WebGL-глобус
   остаётся в старом каркасе (js/globe3d.js) и, если понадобится, будет
   подниматься лениво — решение отложено до этапа 7.

   Координаты офисов — те же, что в globe3d.js. Проекция здесь другая
   (ортографическая, шар), поэтому справочник координат один, а способов
   их показать два: это не расхождение, это разные карты.
*/

const OFFICES = [
  { lon:  8.42, lat: 47.28, key: 'ch' },   /* Обфельден */
  { lon: -9.14, lat: 38.72, key: 'pt' },   /* Лиссабон  */
  { lon: 28.86, lat: 47.01, key: 'md' },   /* Кишинёв   */
  { lon: 55.27, lat: 25.20, key: 'ae' },   /* Дубай     */
];

export const globe = {
  id: 'globe',
  role: 'output',
  note: 'глобус, нити к филиалам, форма',

  spin: 0,

  render(ctx, view, cam, mark) {
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);

    /* Шар вращается сам, но медленно и только пока акт на экране: это
       единственное движение в финале, и оно означает «мы работаем, пока
       вы читаете», а не «здесь красиво». */
    this.spin += view.dt * 0.12;
    const R = g.r * 0.92;

    ctx.save();
    ctx.globalAlpha = w;

    /* Сетка шара: параллели и меридианы, ортографическая проекция */
    ctx.strokeStyle = 'rgba(154,123,30,0.22)';
    ctx.lineWidth = 0.8;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let first = true;
      for (let lon = -180; lon <= 180; lon += 6) {
        const p = project(lon, lat, this.spin, g.cx, g.cy, R);
        if (!p) { first = true; continue; }
        first ? (ctx.moveTo(p[0], p[1]), first = false) : ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }
    for (let lon = 0; lon < 360; lon += 30) {
      ctx.beginPath();
      let first = true;
      for (let lat = -90; lat <= 90; lat += 4) {
        const p = project(lon, lat, this.spin, g.cx, g.cy, R);
        if (!p) { first = true; continue; }
        first ? (ctx.moveTo(p[0], p[1]), first = false) : ctx.lineTo(p[0], p[1]);
      }
      ctx.stroke();
    }

    /* Обод шара */
    ctx.beginPath(); ctx.arc(g.cx, g.cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,162,39,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();

    /* Офисы: нить от знака к точке и сама точка. Появляются по одному по
       мере прохождения акта — четыре адреса, четыре шага. */
    OFFICES.forEach((o, i) => {
      const on = Math.max(0, Math.min(1, cam.t * 4 - i));
      if (on <= 0) return;
      const p = project(o.lon, o.lat, this.spin, g.cx, g.cy, R);
      if (!p) return;
      ctx.beginPath();
      ctx.moveTo(g.cx, g.cy);
      ctx.lineTo(g.cx + (p[0] - g.cx) * on, g.cy + (p[1] - g.cy) * on);
      ctx.strokeStyle = 'rgba(201,162,39,' + (0.45 * on) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
      if (on > 0.9) {
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.6, 0, Math.PI * 2);
        ctx.fillStyle = '#FFE9A8'; ctx.fill();
        ctx.strokeStyle = 'rgba(201,162,39,0.8)'; ctx.lineWidth = 1.4; ctx.stroke();
      }
    });
    ctx.restore();
  },

  enter() {}, leave() {},
};

/* Ортографическая проекция: точки на обратной стороне не рисуются вовсе —
   шар непрозрачный, и просвечивающие сквозь него точки читались бы как
   ошибка. */
function project(lon, lat, spin, cx, cy, R) {
  const la = lat * Math.PI / 180;
  const lo = (lon * Math.PI / 180) + spin;
  const x = Math.cos(la) * Math.sin(lo);
  const y = Math.sin(la);
  const z = Math.cos(la) * Math.cos(lo);
  if (z < 0) return null;
  return [cx + x * R, cy - y * R];
}

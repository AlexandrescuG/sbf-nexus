/* globe.js — акт 10: финал.

   Путь заканчивается там же, где начался, — на карте мира, но с другой
   стороны. В первом акте мир отдавал события знаку. Здесь знак отдаёт нити
   обратно: четыре наших адреса, и они настоящие.

   Первая версия этого акта была каркасом из меридианов — владелец назвал её
   «буквально плейсхолдер вместо глобуса», и был прав: сетка без материков
   не глобус, а чертёж глобуса. Здесь та же карта мира, что на первом
   экране (vendor/countries-110m.json), в ортографической проекции.

   Как это укладывается в бюджет кадра. Первая попытка была печь шар в
   отдельный холст на каждые 3° поворота и показывать готовые картинки.
   Кадр от этого действительно дешевел, но вращение шло ступеньками — по
   3° рывками, и в момент выпечки страница спотыкалась. Владелец описал это
   точно: «движется не плавно и прерывисто».

   Сейчас шар рисуется живьём каждый кадр, но по упрощённой геометрии:
   контуры прорежены один раз при загрузке до пары тысяч точек. На экране
   диаметром 400 px разницы не видно — точки чаще, чем пиксели, — а
   проекция двух тысяч точек стоит доли миллисекунды. Ступенек нет,
   потому что нет и шага: угол непрерывный.

   three.js сюда по-прежнему не тянется: 590 КБ ради последнего экрана —
   плата за то, что увидит меньшинство дошедших.
*/

import { t } from '../labels.js';

const OFFICES = [
  { lon:  8.42, lat: 47.28, key: 'contact.ch' },   /* Обфельден */
  { lon: -9.14, lat: 38.72, key: 'contact.pt' },   /* Лиссабон  */
  { lon: 28.86, lat: 47.01, key: 'contact.md' },   /* Кишинёв   */
  { lon: 55.27, lat: 25.20, key: 'contact.ae' },   /* Дубай     */
];

const RAD = Math.PI / 180;

export const globe = {
  id: 'globe',
  role: 'output',
  note: 'глобус, нити к филиалам, форма',

  spin: 0,
  rings: null,     /* прорежённые контуры материков */

  load() {
    if (this.loading) return;
    this.loading = true;
    if (!window.topojson) return;
    fetch('vendor/countries-110m.json').then(r => r.json()).then(topo => {
      const geo = window.topojson.feature(topo, topo.objects.countries);
      this.rings = simplify(geo);
    }).catch(() => console.warn('[scene] глобус без материков: карта не загрузилась'));
  },

  render(ctx, view, cam, mark, labels) {
    this.load();
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);
    /* В оригинале шар — почти во весь экран, и это правильно: финал
       про масштаб. Кольцо знака остаётся его ободом. */
    const R = Math.round(Math.min(g.r * 2.6, view.h * 0.44));

    /* Вращение непрерывное: угол — обычное число, а не индекс кадра.
       Медленно и только пока акт на экране: это единственное движение в
       финале, и оно означает «мы работаем, пока вы читаете». */
    this.spin += view.dt * (view.mobile ? 0.06 : 0.09);
    const spin = this.spin;
    const cx = g.cx, cy = g.cy;

    ctx.save();
    ctx.globalAlpha = w;

    /* Тело шара */
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,10,16,0.92)'; ctx.fill();

    /* Сетка */
    ctx.strokeStyle = 'rgba(201,162,39,0.22)';
    ctx.lineWidth = 0.7;
    const dLat = view.mobile ? 8 : 4, dLon = view.mobile ? 10 : 6;
    for (let lat = -60; lat <= 60; lat += 30) ring(ctx, cx, cy, R, spin, lat, null, dLon);
    for (let lon = 0; lon < 360; lon += 30) ring(ctx, cx, cy, R, spin, null, lon, dLat);

    /* Материки по прорежённым контурам */
    if (this.rings) {
      ctx.beginPath();
      for (let n = 0; n < this.rings.length; n++) {
        const r = this.rings[n];
        let started = false;
        for (let i = 0; i < r.length; i += 2) {
          const la = r[i + 1] * RAD, lo = r[i] * RAD + spin;
          const cla = Math.cos(la);
          /* Точка на обратной стороне — контур рвём: шар непрозрачный, и
             линия, протянутая через него, читается как ошибка. */
          if (cla * Math.cos(lo) < 0) { started = false; continue; }
          const x = cx + cla * Math.sin(lo) * R, y = cy - Math.sin(la) * R;
          started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true);
        }
      }
      ctx.fillStyle = 'rgba(201,162,39,0.78)'; ctx.fill();
      ctx.strokeStyle = 'rgba(230,194,87,0.55)'; ctx.lineWidth = 0.7; ctx.stroke();
    }

    /* Обод */
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(201,162,39,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();

    /* Офисы: нить от знака к точке, точка и название. Появляются по одному
       по мере прохождения акта — четыре адреса, четыре шага. */
    OFFICES.forEach((o, i) => {
      const on = Math.max(0, Math.min(1, cam.t * 4 - i));
      if (on <= 0) return;
      const p = project(o.lon, o.lat, spin, g.cx, g.cy, R);
      if (!p) return;                       /* офис на обратной стороне */
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
        if (labels) {
          /* Подпись уходит от центра шара, чтобы не легла на него */
          const out = p[0] >= g.cx;
          labels.put('globe-' + i, t(o.key, ''),
                     p[0] + (out ? 10 : -10), p[1] - 8,
                     { align: out ? 'left' : 'right', alpha: w * on });
        }
      }
    });
    ctx.restore();

    if (labels) {
      labels.put('globe-cap', t('contact.mark_cap', ''),
                 g.cx, g.cy + R + 22, { align: 'center', alpha: w });
    }
  },

  enter() {}, leave() {},
};

/* Ортографическая проекция: точки на обратной стороне не рисуются вовсе —
   шар непрозрачный, и просвечивающие сквозь него точки читались бы как
   ошибка. */
function project(lon, lat, spin, cx, cy, R) {
  const la = lat * Math.PI / 180;
  const lo = (lon * Math.PI / 180) + spin;
  const z = Math.cos(la) * Math.cos(lo);
  if (z < 0) return null;
  return [cx + Math.cos(la) * Math.sin(lo) * R, cy - Math.sin(la) * R];
}

/* Прорежение контуров: один раз при загрузке.

   Берём каждую k-ю точку так, чтобы всего осталось около двух тысяч, и
   выбрасываем совсем мелкие кольца. На шаре диаметром 400 px исходные
   контуры дают несколько точек на пиксель — это работа впустую. */
function simplify(geo) {
  const out = [];
  /* Прорежение по расстоянию, а не «каждая k-я точка».
     Первая версия брала каждую пятую-восьмую — и материки рассыпались на
     осколки: у мелких контуров оставалось три-четыре точки, и вместо
     береговой линии получались треугольники. Здесь точка сохраняется,
     только если ушла от предыдущей дальше порога, поэтому длинные ровные
     участки прореживаются сильно, а изрезанные — почти нет. */
  const MIN = 0.55;                       /* градусов между точками */
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates]
                : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      for (const r of poly) {
        if (r.length < 4) continue;       /* точка-остров: на шаре не видна */
        const pts = [r[0][0], r[0][1]];
        let lx = r[0][0], ly = r[0][1];
        for (let i = 1; i < r.length; i++) {
          const x = r[i][0], y = r[i][1];
          if (Math.abs(x - lx) + Math.abs(y - ly) < MIN) continue;
          pts.push(x, y); lx = x; ly = y;
        }
        pts.push(r[0][0], r[0][1]);       /* замыкаем кольцо */
        if (pts.length >= 10) out.push(Float64Array.from(pts));
      }
    }
  }
  return out;
}

/* Параллель (задана lat) или меридиан (задан lon) */
function ring(c, cx, cy, R, spin, lat, lon, step) {
  c.beginPath();
  let started = false;
  const from = lat == null ? -90 : -180;
  const to = lat == null ? 90 : 180;
  step = step || (lat == null ? 4 : 6);
  for (let v = from; v <= to; v += step) {
    const p = lat == null ? project(lon, v, spin, cx, cy, R)
                          : project(v, lat, spin, cx, cy, R);
    if (!p) { started = false; continue; }
    started ? c.lineTo(p[0], p[1]) : (c.moveTo(p[0], p[1]), started = true);
  }
  c.stroke();
}

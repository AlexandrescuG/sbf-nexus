/* globe.js — акт 10: финал.

   Путь заканчивается там же, где начался, — на карте мира, но с другой
   стороны. В первом акте мир отдавал события знаку. Здесь знак отдаёт нити
   обратно: четыре наших адреса, и они настоящие.

   Первая версия этого акта была каркасом из меридианов — владелец назвал её
   «буквально плейсхолдер вместо глобуса», и был прав: сетка без материков
   не глобус, а чертёж глобуса. Здесь та же карта мира, что на первом
   экране (vendor/countries-110m.json), в ортографической проекции.

   Как это укладывается в бюджет кадра. Проекция всех контуров на каждый
   кадр — это тысячи точек шестьдесят раз в секунду. Поэтому шар печётся в
   отдельный холст с шагом поворота 3°: за оборот получается 120 картинок,
   каждая рисуется один раз и дальше берётся готовой. Памяти это стоит
   немного (кадр размером с кольцо), а кадр становится одной операцией
   drawImage.

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

const STEP = 3 * Math.PI / 180;      /* шаг кэша поворота */

export const globe = {
  id: 'globe',
  role: 'output',
  note: 'глобус, нити к филиалам, форма',

  spin: 0,
  land: null,
  cache: new Map(),
  cacheR: 0,

  load() {
    if (this.loading) return;
    this.loading = true;
    if (!window.topojson) return;
    fetch('vendor/countries-110m.json').then(r => r.json()).then(topo => {
      this.land = window.topojson.feature(topo, topo.objects.countries);
      this.cache.clear();
    }).catch(() => console.warn('[scene] глобус без материков: карта не загрузилась'));
  },

  /* Один кадр шара при данном повороте. Рисуется в свой холст размером с
     кольцо и живёт в кэше до смены размера окна.

     На телефоне выпечка обходится дороже всего: процессор вчетверо слабее,
     а контуров столько же. Поэтому там шаг поворота вдвое крупнее (кадров
     вдвое меньше) и мелкие острова пропускаются — на 390 px они всё равно
     в один пиксель. Замер до правки: 47 пропущенных кадров из 314. */
  bake(step, R, mobile) {
    const size = Math.ceil(R * 2) + 4;
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const spin = step * STEP;

    /* Океан — чуть светлее фона: шар должен читаться как тело, а не как
       дырка в странице. */
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fillStyle = 'rgba(12,10,16,0.92)'; c.fill();

    /* Сетка */
    c.strokeStyle = 'rgba(201,162,39,0.22)';
    c.lineWidth = 0.7;
    for (let lat = -60; lat <= 60; lat += 30) ring(c, cx, cy, R, spin, lat, null);
    for (let lon = 0; lon < 360; lon += 30) ring(c, cx, cy, R, spin, null, lon);

    /* Материки */
    if (this.land) {
      c.beginPath();
      for (const f of this.land.features) {
        const g = f.geometry;
        if (!g) continue;
        const polys = g.type === 'Polygon' ? [g.coordinates]
                    : g.type === 'MultiPolygon' ? g.coordinates : [];
        for (const poly of polys) {
          for (const r of poly) {
            /* Мелкие острова на телефоне не рисуем: в кадре это точка, а
               времени они стоят как материк. */
            if (mobile && r.length < 12) continue;
            let started = false;
            for (let i = 0; i < r.length; i++) {
              const p = project(r[i][0], r[i][1], spin, cx, cy, R);
              /* Точка на обратной стороне — контур рвём: шар непрозрачный,
                 и линия, протянутая через него, читается как ошибка. */
              if (!p) { started = false; continue; }
              started ? c.lineTo(p[0], p[1]) : (c.moveTo(p[0], p[1]), started = true);
            }
          }
        }
      }
      c.fillStyle = 'rgba(201,162,39,0.78)'; c.fill();
      c.strokeStyle = 'rgba(230,194,87,0.55)'; c.lineWidth = 0.7; c.stroke();
    }

    /* Обод */
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(201,162,39,0.55)'; c.lineWidth = 1.4; c.stroke();
    return cv;
  },

  render(ctx, view, cam, mark, labels) {
    this.load();
    const w = cam.w;
    if (w < 0.02) return;
    const g = mark.geometry(view);
    /* В оригинале шар — почти во весь экран, и это правильно: финал
       про масштаб. Кольцо знака остаётся его ободом. */
    const R = Math.round(Math.min(g.r * 2.6, view.h * 0.44));

    /* Размер окна поменялся — печёное больше не подходит */
    if (this.cacheR !== R) { this.cache.clear(); this.cacheR = R; }

    /* Шар вращается сам, но медленно и только пока акт на экране: это
       единственное движение в финале, и оно означает «мы работаем, пока вы
       читаете», а не «здесь красиво». */
    this.spin += view.dt * (view.mobile ? 0.05 : 0.10);
    /* Шаг поворота: 12° на телефоне против 3° на десктопе. Каждый шаг — это
       одна выпечка шара, а она стоит на слабом процессоре около 8 мс. Реже
       шаг — реже выпечка; ступенек при этом не видно, потому что там же
       вдвое медленнее вращение. */
    const grain = view.mobile ? 4 : 1;
    const slots = 120 / grain;
    const key = ((Math.round(this.spin / (STEP * grain)) % slots) + slots) % slots;
    let img = this.cache.get(key);
    if (!img) { img = this.bake(key * grain, R, view.mobile); this.cache.set(key, img); }

    ctx.save();
    ctx.globalAlpha = w;
    ctx.drawImage(img, g.cx - img.width / 2, g.cy - img.height / 2);

    /* Офисы: нить от знака к точке, точка и название. Появляются по одному
       по мере прохождения акта — четыре адреса, четыре шага. */
    const spin = key * grain * STEP;
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

/* Параллель (задана lat) или меридиан (задан lon) */
function ring(c, cx, cy, R, spin, lat, lon) {
  c.beginPath();
  let started = false;
  const from = lat == null ? -90 : -180;
  const to = lat == null ? 90 : 180;
  const step = lat == null ? 4 : 6;
  for (let v = from; v <= to; v += step) {
    const p = lat == null ? project(lon, v, spin, cx, cy, R)
                          : project(v, lat, spin, cx, cy, R);
    if (!p) { started = false; continue; }
    started ? c.lineTo(p[0], p[1]) : (c.moveTo(p[0], p[1]), started = true);
  }
  c.stroke();
}

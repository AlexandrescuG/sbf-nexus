/* geo.js — проекция карты мира без d3.

   d3.min.js весит 273 КБ — больше трети всего, что страница тянет до
   первого экрана. Использовалось из него ровно три вещи: проекция
   Natural Earth 1, обход геометрии и сетка меридианов. Всё три уместились
   здесь в сотню строк.

   Формула проекции — та же, что в d3-geo (Natural Earth 1, Патерсон и
   Дженни, 2011). Это не «своя похожая проекция»: коэффициенты взяты как
   есть, чтобы карта не разъехалась с той, что была на старом сайте.

   Границы по вертикали считаем один раз численно, а не берём из таблицы:
   так не соврать при переносе.
*/

/* Сырая проекция: радианы → безразмерные координаты */
function raw(lambda, phi) {
  const p2 = phi * phi, p4 = p2 * p2;
  return [
    lambda * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 +
             p4 * (0.003971 * p2 - 0.001529 * p4))),
    phi * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 +
           0.028874 * p2 - 0.005916 * p4))),
  ];
}

const RAD = Math.PI / 180;
const XMAX = raw(Math.PI, 0)[0];
const YMAX = raw(0, Math.PI / 2)[1];

/* Проекция, вписанная в прямоугольник. rotate — сдвиг по долготе, как
   .rotate([-22, 0]) у d3: карта повёрнута так, чтобы Европа и Африка были
   в середине кадра, а Тихий океан резался по краям. */
export function createProjection(box, rotate) {
  const [x0, y0, x1, y1] = box;
  const shift = (rotate || 0);
  const kx = (x1 - x0) / (XMAX * 2);
  const ky = (y1 - y0) / (YMAX * 2);
  const k = Math.min(kx, ky);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;

  function project(lon, lat) {
    let l = lon + shift;
    while (l > 180) l -= 360;
    while (l < -180) l += 360;
    const p = raw(l * RAD, lat * RAD);
    return [cx + p[0] * k, cy - p[1] * k];
  }
  project.scale = k;
  project.width = XMAX * 2 * k;
  return project;
}

/* Рисование геометрии GeoJSON. Разрыв на антимеридиане ловим по скачку:
   если соседние точки уехали друг от друга больше чем на полкарты, значит
   контур перескочил через край — начинаем новый путь, иначе через весь
   экран протянется горизонтальная полоса. */
export function drawGeo(ctx, geo, project, jumpLimit) {
  const limit = jumpLimit || project.width * 0.5;
  const feats = geo.type === 'FeatureCollection' ? geo.features : [geo];
  for (const f of feats) {
    const g = f.geometry || f;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates]
                : g.type === 'MultiPolygon' ? g.coordinates
                : g.type === 'LineString' ? [[g.coordinates]]
                : g.type === 'MultiLineString' ? [g.coordinates]
                : [];
    for (const poly of polys) {
      for (const ring of poly) {
        let prev = null, started = false;
        for (let i = 0; i < ring.length; i++) {
          const p = project(ring[i][0], ring[i][1]);
          if (prev && Math.abs(p[0] - prev[0]) > limit) started = false;
          if (!started) { ctx.moveTo(p[0], p[1]); started = true; }
          else ctx.lineTo(p[0], p[1]);
          prev = p;
        }
      }
    }
  }
}

/* Сетка меридианов и параллелей — замена d3.geoGraticule10() */
export function graticule(step) {
  const s = step || 10;
  const lines = [];
  for (let lon = -180; lon <= 180; lon += s) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += 2) pts.push([lon, lat]);
    lines.push(pts);
  }
  for (let lat = -80; lat <= 80; lat += s) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += 2) pts.push([lon, lat]);
    lines.push(pts);
  }
  return { type: 'MultiLineString', coordinates: lines };
}

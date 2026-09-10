/* camera.js — прокрутка в состояние камеры.

   Единственный, кто читает scrollY. Акты сами прокрутку не слушают: в старом
   каркасе её слушали и scroll-director, и hero-map, и act-approach, и каждый
   считал «свою» видимость по-своему — расхождения вылезали именно на стыках.

   Отрезки пути берутся из разметки: каждый акт — это секция `.act` со своим
   `data-act`, и длина отрезка равна высоте секции. То есть длину акта задаёт
   объём текста в нём, а не число в коде (ограничитель 3 плана).

   Состояние на выходе:
     act    — id текущего акта
     t      — доля пройденного внутри него, 0…1
     dir    — направление последнего движения, +1 / −1
     speed  — px/с, сглаженная; по ней акты решают, «спокойно» или «резко»
     blend  — [{act, t, w}] — кто сейчас рисуется и с каким весом.
              В зоне перехода соседи живут одновременно, поэтому склейки
              не видно: это и есть отличие гобелена от книги.
*/

const OVERLAP = 0.15;   /* доля акта, на которой соседи сосуществуют */

export function createCamera() {
  let spans = [];       /* [{id, el, top, height}] */
  let last = { y: window.scrollY || 0, time: performance.now() };
  let speed = 0, dir = 1;

  function measure() {
    spans = Array.from(document.querySelectorAll('.act')).map(function (el) {
      const r = el.getBoundingClientRect();
      const top = r.top + window.scrollY;
      return { id: el.dataset.act || el.id, el: el, top: top, height: r.height };
    }).sort(function (a, b) { return a.top - b.top; });
  }

  /* Прогресс считаем по центру окна, а не по его верху: у первого и
     последнего акта иначе половина пути отрезается краями документа. */
  function state() {
    if (!spans.length) return { act: null, t: 0, dir: dir, speed: 0, blend: [] };
    const eye = window.scrollY + window.innerHeight / 2;
    let cur = spans[0], idx = 0;
    for (let i = 0; i < spans.length; i++) {
      if (eye >= spans[i].top) { cur = spans[i]; idx = i; }
    }
    const t = clamp((eye - cur.top) / (cur.height || 1), 0, 1);

    const blend = [{ act: cur.id, t: t, w: 1 }];
    if (t > 1 - OVERLAP && spans[idx + 1]) {
      const w = (t - (1 - OVERLAP)) / OVERLAP;          /* 0 → 1 */
      blend[0].w = 1 - w * 0.5;                          /* уходящий гаснет не до нуля */
      blend.push({ act: spans[idx + 1].id, t: 0, w: w });
    } else if (t < OVERLAP && spans[idx - 1]) {
      const w = (OVERLAP - t) / OVERLAP;
      blend[0].w = 1 - w * 0.5;
      blend.push({ act: spans[idx - 1].id, t: 1, w: w });
    }
    /* Секция и акт — разные вещи: два раздела платформы идут одним актом,
       но показывают разное. Отдаём и то, и другое. */
    return { act: cur.id, section: cur.el ? cur.el.id : null,
             t: t, index: idx, dir: dir, speed: speed, blend: blend };
  }

  function tick(now) {
    const y = window.scrollY;
    const dt = Math.max(0.001, (now - last.time) / 1000);
    const v = (y - last.y) / dt;
    if (Math.abs(v) > 1) dir = v > 0 ? 1 : -1;
    /* Сглаживание: без него speed скачет от кадра к кадру и любая реакция
       на скорость выглядит дёрганой. */
    speed += (Math.abs(v) - speed) * Math.min(1, dt * 6);
    last = { y: y, time: now };
  }

  function scrollToAct(id, behavior) {
    const s = spans.find(function (o) { return o.id === id; });
    if (s) window.scrollTo({ top: s.top + 1, behavior: behavior || 'smooth' });
  }

  measure();
  window.addEventListener('resize', measure);
  /* Высота секций меняется при смене языка и при подгрузке данных —
     пересчитываем, иначе камера едет по устаревшей карте пути. */
  document.addEventListener('sbf:langchange', function () { setTimeout(measure, 60); });
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(function () { measure(); });
    document.querySelectorAll('.act').forEach(function (el) { ro.observe(el); });
  }

  return { measure: measure, state: state, tick: tick, scrollToAct: scrollToAct,
           get spans() { return spans; } };
}

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

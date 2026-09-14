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

import { vh } from './viewport.js';

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
     последнего акта иначе половина пути отрезается краями документа.

     Камера идёт не по самой прокрутке, а по сглаженному её следу. Причина
     простая: колесо мыши двигает страницу рывками по 100 px, и сцена,
     привязанная к нему напрямую, дёргается вместе с ним. Текст при этом
     остаётся на настоящей прокрутке — он должен стоять там, где его
     поставил браузер, иначе читать невозможно. Отсюда и разделение:
     текст резкий, мир плавный. */
  let eyeSmooth = null;

  function state() {
    if (!spans.length) return { act: null, t: 0, dir: dir, speed: 0, blend: [] };
    /* Середина окна — по устойчивой высоте (viewport.js). Иначе на iOS
       взгляд уезжал на полсотни пикселей каждый раз, когда адресная
       строка сворачивалась: доля акта менялась без единого движения
       пальца, и сцена дёргалась сама по себе. */
    const eye = eyeSmooth == null ? window.scrollY + vh() / 2 : eyeSmooth;
    let cur = spans[0], idx = 0;
    for (let i = 0; i < spans.length; i++) {
      if (eye >= spans[i].top) { cur = spans[i]; idx = i; }
    }
    /* Достижимый отрезок акта, а не весь его отрезок.

       Взгляд — это середина окна, и она не может подняться выше половины
       экрана от начала документа и опуститься ниже половины экрана от его
       конца. У первого акта это значило, что t никогда не был меньше 0.46:
       страница только открылась, никто ещё не прокрутил ни пикселя, а мир
       уже наполовину «отступил» — карта рисовалась в 0.63 силы, и владелец
       справедливо назвал её тусклой. У последнего акта симметрично: t не
       доходил до 1, поэтому из четырёх адресов на глобусе появлялись
       только два — Кишинёв и Дубай не показывались никогда.

       Считаем долю не от высоты секции, а от того куска, куда взгляд
       действительно может попасть. Для средних актов это то же самое. */
    const half = vh() / 2;
    const docH = document.documentElement.scrollHeight;
    let lo = cur.top, hi = cur.top + (cur.height || 1);
    if (idx === 0) lo = Math.max(lo, Math.min(half, hi - 40));
    if (idx === spans.length - 1) hi = Math.min(hi, Math.max(docH - half, lo + 40));
    const t = clamp((eye - lo) / Math.max(1, hi - lo), 0, 1);

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

  /* За сколько секунд камера догоняет прокрутку. 0.2 — компромисс из
     разговора с владельцем: резкость колеса уходит, а связь «кручу —
     двигается» остаётся прямой. При 0.6 сцена заметно отстаёт от текста. */
  const FOLLOW = 0.2;

  function tick(now) {
    const y = window.scrollY;
    const dt = Math.max(0.001, (now - last.time) / 1000);
    const v = (y - last.y) / dt;
    if (Math.abs(v) > 1) dir = v > 0 ? 1 : -1;
    /* Сглаживание: без него speed скачет от кадра к кадру и любая реакция
       на скорость выглядит дёрганой. */
    speed += (Math.abs(v) - speed) * Math.min(1, dt * 6);
    last = { y: y, time: now };

    /* След камеры. Коэффициент считается от dt, а не берётся числом: на
       120-герцовом экране кадры вдвое чаще, и фиксированный шаг дал бы там
       вдвое более резкое движение — та же картинка вела бы себя по-разному
       на разных мониторах. */
    const target = y + vh() / 2;
    if (eyeSmooth == null) eyeSmooth = target;
    else {
      const k = 1 - Math.exp(-dt / FOLLOW);
      eyeSmooth += (target - eyeSmooth) * k;
      /* Прилипание в конце: без него камера бесконечно доезжает последние
         доли пикселя и сцена «дышит», когда страница стоит. */
      if (Math.abs(target - eyeSmooth) < 0.5) eyeSmooth = target;
    }
  }

  function scrollToAct(id, behavior) {
    const s = spans.find(function (o) { return o.id === id; });
    if (s) window.scrollTo({ top: s.top + 1, behavior: behavior || 'smooth' });
  }

  measure();
  /* Пересчитываем карту пути, только если она могла измениться: ширина
     окна или высота документа. Адресная строка Safari шлёт resize на
     каждый жест прокрутки, меняя лишь innerHeight, — а высота актов
     задана в vh от БОЛЬШОГО вьюпорта и от неё не зависит. Без этой
     проверки один свайп по iPhone стоил десятков полных обходов
     getBoundingClientRect по всем актам. См. resize() в stage.js. */
  let seen = { w: 0, doc: 0 };
  window.addEventListener('resize', function () {
    const w = window.innerWidth;
    const doc = document.documentElement.scrollHeight;
    if (w === seen.w && doc === seen.doc) return;
    seen = { w: w, doc: doc };
    measure();
  });
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

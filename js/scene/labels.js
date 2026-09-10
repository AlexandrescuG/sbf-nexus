/* labels.js — подписи к тому, что нарисовано на холсте.

   Претензия владельца была короткой и точной: «многие линии и точки
   появляются без надписей», «непонятно, для чего те линии». Линия без
   имени — это украшение, а сайт не про украшения: если что-то нарисовано,
   оно обязано объясниться одним словом.

   Почему подписи — DOM, а не текст на холсте: их выделяют, читают
   скринридером, переводят через i18n и увеличивают вместе со шрифтом
   браузера. Текст в canvas не умеет ничего из этого.

   Как пользоваться: акт в каждом кадре объявляет, что у него есть и где.
   Кто не объявился — гаснет. Никакого ручного удаления, никаких утечек
   узлов между актами.
*/

export function createLabels(host) {
  const box = document.createElement('div');
  box.className = 'scene-notes';
  host.appendChild(box);

  const pool = new Map();     /* id → {el, seen} */
  let frame = 0;

  function begin() { frame++; rows = []; }

  /* Занятые строки кадра: подписи не должны ложиться друг на друга.
     Проверка грубая, по горизонтальным полосам — этого хватает, потому что
     подписи однострочные, а разъезжаться им нужно именно по вертикали. */
  let rows = [];

  /* opts: align 'center' | 'left' | 'right', tone 'plain' | 'key' */
  function put(id, text, x, y, opts) {
    if (!text) return;
    let rec = pool.get(id);
    if (!rec) {
      const el = document.createElement('div');
      el.className = 'scene-note';
      box.appendChild(el);
      rec = { el: el, text: null };
      pool.set(id, rec);
    }
    rec.seen = frame;
    if (rec.text !== text) { rec.el.textContent = text; rec.text = text; }
    const o = opts || {};

    /* Развод по вертикали: если на этой высоте рядом уже стоит подпись,
       сдвигаем новую вниз. На глобусе Швейцария и Молдова оказывались на
       одной строке и читались как одно слово. */
    if (o.avoid !== false) {
      const W = 150, H = 20;
      for (let n = 0; n < 6; n++) {
        const hit = rows.some(r => Math.abs(r.y - y) < H &&
                                   Math.abs(r.x - x) < W);
        if (!hit) break;
        y += H + 4;
      }
      rows.push({ x: x, y: y });
    }
    if (rec.tone !== (o.tone || 'plain')) {
      rec.tone = o.tone || 'plain';
      rec.el.dataset.tone = rec.tone;
    }

    /* Пишем в стиль, только если значение действительно поменялось.
       Первая версия переписывала transform и opacity каждый кадр у каждой
       подписи, и браузер отвечал на это пересчётом раскладки: на телефоне
       страница просела с 60 кадров до 38 при том, что сама сцена рисовалась
       за две миллисекунды. Дорого обходится не рисование, а разговор с DOM.
       Прозрачность округляем до двадцатых — глазу этого хватает, а записей
       становится в разы меньше. */
    const px = Math.round(x), py = Math.round(y);
    const shift = o.align === 'right' ? ' translateX(-100%)'
                : o.align === 'center' ? ' translateX(-50%)' : '';
    if (rec.px !== px || rec.py !== py || rec.shift !== shift) {
      rec.px = px; rec.py = py; rec.shift = shift;
      rec.el.style.transform = 'translate(' + px + 'px,' + py + 'px)' + shift;
    }
    const a = o.alpha == null ? 1 : Math.round(o.alpha * 20) / 20;
    if (rec.alpha !== a) { rec.alpha = a; rec.el.style.opacity = a; }
  }

  /* Кто не объявился в этом кадре — гаснет. */
  function end() {
    pool.forEach(rec => {
      if (rec.seen !== frame && rec.alpha !== 0) {
        rec.alpha = 0;
        rec.el.style.opacity = 0;
      }
    });
  }

  function clear() {
    pool.forEach(rec => rec.el.style.opacity = 0);
  }

  return { begin: begin, put: put, end: end, clear: clear };
}

/* Короткий доступ к переводу: подписи обязаны говорить на языке страницы */
export function t(key, fallback) {
  const fn = window.i18n && window.i18n.t;
  const v = fn ? fn(key) : '';
  return v && v !== key ? v : (fallback || '');
}

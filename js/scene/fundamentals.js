/* fundamentals.js — три фундаментальных блока из живой ленты.

   Что сюда входит: уровни доверия («что известно и насколько»), панель
   макро-рядов и ближайшие события с прошлой реакцией рынка. Всё три —
   текст в колонке, а не рисунок на холсте: числа надо читать и
   выделять, а холст не умеет ни того, ни другого.

   Общее правило у всех трёх — не выдумывать. Пока лента не пришла, в
   блоке стоит честная строка «готовится», а не пример: на сайте про
   рынок нарисованная цифра хуже пустого места. Это то же правило, по
   которому живёт бегущая строка (ticker.js).

   Язык. Бриф market_intel пишет по-русски, и перевода у него нет. Как и
   в строке «Сегодня», помечаем язык оригинала, а не выдаём русский текст
   за английский. Подписи вокруг текста — свои, из словаря, поэтому
   каркас на всех трёх языках свой, а цитата из брифа — русская с
   пометкой. */

const TIER_KEYS = {
  quotes:            { title: 'know.t_quotes', why: 'know.w_quotes' },
  media:             { title: 'know.t_media',  why: 'know.w_media' },
  social_unverified: { title: 'know.t_social', why: 'know.w_social' },
};

function T(key) {
  const t = (window.i18n && window.i18n.t) ? window.i18n.t(key) : '';
  return t && t !== key ? t : '';
}

function lang() {
  return (window.i18n && window.i18n.getLang && window.i18n.getLang()) || 'ru';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

/* Пометка языка оригинала — ровно та же, что у заголовка брифа. */
function langMark(src) {
  return src && src !== lang() ? ' <em>' + esc(src.toUpperCase()) + '</em>' : '';
}

/* Блок «готовится». Пустой список — это не «нечего показать», это
   «данные ещё не дошли», и написать надо именно это. */
function placeholder(host, key) {
  host.innerHTML = '<li class="act-note">' + esc(T(key)) + '</li>';
}

/* ── Три уровня доверия ──────────────────────────────────── */
function tiers(meta) {
  const host = document.getElementById('know-tiers');
  if (!host) return;
  const list = ((meta && meta.grow) || {}).context || [];
  if (!list.length) { placeholder(host, 'know.empty'); return; }
  host.innerHTML = list.map(function (c) {
    const k = TIER_KEYS[c.confidence];
    /* Уровень, которого нет в словаре, не показываем: подписать его
       наугад значило бы соврать ровно в том месте, ради которого блок и
       сделан. Сборщик ленты такие уровни тоже отбрасывает — здесь
       вторая половина того же правила, на случай, если разойдутся. */
    if (!k) return '';
    return '<li data-tier="' + esc(c.confidence) + '">' +
           '<b>' + esc(T(k.title)) + '</b>' +
           '<i>' + esc(T(k.why)) + '</i>' +
           '<span>' + esc(c.text) + langMark(c.lang) + '</span></li>';
  }).join('') || '<li class="act-note">' + esc(T('know.empty')) + '</li>';
}

/* ── Макро-панель ────────────────────────────────────────── */
function num(v, unit) {
  if (v == null) return '';
  /* Разделитель дробной части — по языку страницы: «3,63» в русском и
     румынском, «3.63» в английском. Своё форматирование здесь было бы
     четвёртым местом, где сайт решает этот вопрос по-своему. */
  const s = Number(v).toLocaleString(lang() === 'en' ? 'en-GB' : 'ru-RU',
                                     { maximumFractionDigits: 2 });
  if (unit === '$') return '$' + s;
  return unit ? s + ' ' + unit : s;
}

/* Дата публикации ряда — по-человечески и на языке страницы. «2026-09-11»
   посреди русского текста читается как машинный вывод, а не как «когда
   это опубликовали». */
function day(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  const L = lang();
  return d.toLocaleDateString(L === 'ru' ? 'ru-RU' : (L === 'ro' ? 'ro-RO' : 'en-GB'),
                              { day: 'numeric', month: 'short' });
}

function macro(meta) {
  const host = document.getElementById('macro-rows');
  if (!host) return;
  const rows = (meta && meta.macro) || [];
  if (!rows.length) { placeholder(host, 'macro.empty'); return; }
  const L = lang();
  host.innerHTML = rows.map(function (m) {
    /* Направление шага — единственное, что мы кодируем знаком. Длину
       или цвет «лучше/хуже» не рисуем: ряды в разных единицах, и общая
       шкала сравнивала бы проценты с долларами. Плюс рост нефти хорош
       одному клиенту и плох другому, а рекомендаций мы не даём. */
    const d = m.delta;
    const dir = d == null ? '' : (d > 0 ? 'up' : (d < 0 ? 'down' : 'flat'));
    const arrow = dir === 'up' ? '↑' : (dir === 'down' ? '↓' : '·');
    const step = d == null ? '' :
      (d === 0 ? esc(T('macro.flat'))
               : arrow + ' ' + esc(num(Math.abs(d), m.unit)) + ' ' +
                 esc(T('macro.delta')));
    const span = m.span && m.span[L] ? ' · ' + esc(m.span[L]) : '';
    /* Шаг печатаем всегда, даже пустым: в сетке из двух колонок он
       держит дату справа. Без него у ряда без дельты дата уезжала в
       левую колонку — тот же ряд выглядел свёрстанным иначе. */
    return '<li data-dir="' + dir + '">' +
           '<b>' + esc((m.label || {})[L] || '') + '</b>' +
           '<u>' + esc(num(m.value, m.unit)) + '</u>' +
           '<i>' + esc((m.why || {})[L] || '') + span + '</i>' +
           '<span class="macro-step">' + step + '</span>' +
           '<span class="macro-date">' + esc(day(m.date)) + '</span>' +
           '</li>';
  }).join('');
}

/* ── Ближайшие события и прошлая реакция ─────────────────── */
function events(meta) {
  const host = document.getElementById('approach-events');
  if (!host) return;
  const ev = (((meta && meta.grow) || {}).brief || {}).events || [];
  if (!ev.length) { placeholder(host, 'macro.empty'); return; }
  const L = lang();
  host.innerHTML = ev.map(function (e) {
    const when = e.ts_utc ? new Date(e.ts_utc) : null;
    const hhmm = when && !isNaN(when)
      ? when.toLocaleTimeString(L === 'en' ? 'en-GB' : 'ru-RU',
                                { hour: '2-digit', minute: '2-digit' }) : '';
    /* Прошлая реакция — только с числом наблюдений. Медиана по четырём
       случаям и по сорока выглядят одинаково, а утверждают разное;
       показать первую без n значило бы выдать её за статистику. */
    const p = e.past;
    const past = p
      ? T('approach.ev_past').replace('{v}', num(p.median_atr_30m, '%'))
                             .replace('{n}', p.n)
      : T('approach.ev_none');
    const fc = (e.forecast != null && e.previous != null)
      ? T('approach.ev_fc').replace('{f}', e.forecast).replace('{p}', e.previous)
      : '';
    return '<li data-impact="' + esc(e.impact || '') + '">' +
           '<b>' + esc((e.title || {})[L] || '') + '</b>' +
           '<u>' + esc((e.country || {})[L] || '') +
           (hhmm ? ' · ' + esc(hhmm) : '') + '</u>' +
           '<i>' + esc(past) + (fc ? ' · ' + esc(fc) : '') + '</i></li>';
  }).join('');
}

export function initFundamentals() {
  function all(meta) { tiers(meta); macro(meta); events(meta); }
  if (window.SBF_FEED_META) all(window.SBF_FEED_META);
  document.addEventListener('sbf:feedmeta', function (e) { all(e.detail); });
  /* Перерисовка на смене языка: подписи вокруг чисел свои, и без этого
     русский каркас остался бы вокруг английских данных. */
  document.addEventListener('sbf:langchange', function () {
    if (window.SBF_FEED_META) all(window.SBF_FEED_META);
  });
}

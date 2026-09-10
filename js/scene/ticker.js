/* ticker.js — строка котировок под первым актом.

   Единственное, что осталось непере­несённым со старого сайта после разбора
   паритета. Здесь она сделана иначе: не своим циклом кадра, а CSS-анимацией.
   Причина простая — в сцене ровно один rAF, и заводить второй ради бегущей
   строки означало бы вернуть ту самую проблему, из-за которой на старом
   каркасе их шесть.

   Данные — те же, что у карты: hero-feed.json, блок quotes. Пока лента не
   пришла, в строке стоит честное «сводка обновляется», а не выдуманные
   цифры: на сайте про рынок нарисованная котировка хуже пустого места.
*/

export function initTicker() {
  const host = document.getElementById('scene-ticker');
  if (!host) return;
  const track = host.querySelector('.ticker-track');
  if (!track) return;

  function render(meta) {
    const q = (meta && meta.quotes) || [];
    if (!q.length) return;
    const cells = q.map(function (o) {
      /* Поля пришли из моста котировок и называются иначе, чем мне
         показалось: цена это bid, изменение — chg_pct. Первая версия
         печатала пустые места вместо цифр, и строка выглядела списком
         тикеров без смысла. */
      const price = typeof o.price === 'number' ? o.price : o.bid;
      const chg = typeof o.chg === 'number' ? o.chg
                : (typeof o.chg_pct === 'number' ? o.chg_pct : null);
      const sign = chg == null ? '' : (chg >= 0 ? '▲' : '▼');
      const cls = chg == null ? '' : (chg >= 0 ? ' up' : ' down');
      return '<span class="tk"><b>' + esc(o.symbol || '') + '</b> ' +
             esc(fmt(price, o.digits)) +
             (chg == null ? '' : ' <i class="' + cls.trim() + '">' + sign + ' ' +
              Math.abs(chg).toFixed(2) + '%</i>') + '</span>';
    });
    /* Список дублируется: строка едет по кругу, и без второй копии на стыке
       была бы пустота. */
    track.innerHTML = cells.join('') + cells.join('');
    /* Длительность от длины содержимого, а не фиксированная: иначе на
       длинной ленте строка разгоняется. */
    requestAnimationFrame(function () {
      const w = track.scrollWidth / 2;
      track.style.animationDuration = Math.max(20, w / 26) + 's';
      host.dataset.live = '1';
    });
  }

  if (window.SBF_FEED_META) render(window.SBF_FEED_META);
  document.addEventListener('sbf:feedmeta', function (e) { render(e.detail); });
  document.addEventListener('sbf:langchange', function () {
    if (window.SBF_FEED_META) { render(window.SBF_FEED_META); today(window.SBF_FEED_META); }
  });
  if (window.SBF_FEED_META) today(window.SBF_FEED_META);
  document.addEventListener('sbf:feedmeta', function (e) { today(e.detail); });
}

/* Строка «Сегодня · дата · заголовок брифа».

   На живом сайте она есть, и это единственное место первого экрана, где
   написано не «мы умеем», а «вот что мы сделали сегодня утром». Без неё
   первый экран — обещание; с ней — работа, которую уже видно. */
function today(meta) {
  const host = document.getElementById('scene-today');
  const t = meta && meta.today;
  if (!host || !t || !t.headline) return;
  const lang = (window.i18n && window.i18n.getLang && window.i18n.getLang()) || 'ru';
  const d = new Date((t.date || '') + 'T00:00:00');
  const when = isNaN(d) ? '' : d.toLocaleDateString(
    lang === 'ru' ? 'ru-RU' : (lang === 'ro' ? 'ro-RO' : 'en-GB'),
    { day: 'numeric', month: 'long' });
  /* В словаре ключ хранится с подстановкой даты — «Сегодня · {d}». Первая
     версия печатала его как есть, и на экране стояло «Today · {d} · 10
     September»: две даты, одна из них фигурная скобка. */
  const tpl = (window.i18n && window.i18n.t) ? window.i18n.t('hero.today') : '';
  const head = tpl && tpl.indexOf('{d}') >= 0
    ? tpl.replace('{d}', when)
    : ((tpl && tpl !== 'hero.today' ? tpl : 'Сегодня') + (when ? ' · ' + when : ''));
  host.innerHTML = '<b>' + esc(head) + '</b> ' + esc(t.headline);
  host.hidden = false;
}

/* Знаков после запятой столько, сколько у инструмента: EURUSD живёт в
   пятом знаке, золото в втором. Число знаков приходит вместе с ценой. */
function fmt(v, digits) {
  if (typeof v !== 'number') return v == null ? '' : String(v);
  if (typeof digits === 'number') return v.toFixed(Math.min(6, digits));
  return v >= 1000 ? v.toFixed(1) : v.toFixed(v >= 10 ? 2 : 4);
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

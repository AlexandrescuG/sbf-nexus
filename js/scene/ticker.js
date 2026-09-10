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
      const chg = typeof o.chg === 'number' ? o.chg : null;
      const sign = chg == null ? '' : (chg >= 0 ? '▲' : '▼');
      const cls = chg == null ? '' : (chg >= 0 ? ' up' : ' down');
      return '<span class="tk"><b>' + esc(o.symbol || '') + '</b> ' +
             esc(fmt(o.price)) +
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
    if (window.SBF_FEED_META) render(window.SBF_FEED_META);
  });
}

function fmt(v) {
  if (typeof v !== 'number') return v == null ? '' : String(v);
  return v >= 1000 ? v.toFixed(1) : v.toFixed(v >= 10 ? 2 : 4);
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * analytics.js — счётчик посещений и цели на кнопках.
 *
 * До этого на сайте не было ничего, что считает людей: UTM в ссылках
 * помечали переход, но считать его было некому. Не видно было ни сколько
 * человек открыли страницу, ни до какого экрана дошли, ни на что нажали —
 * только те, кто дошёл до заявки в CRM.
 *
 * Счётчик — Яндекс.Метрика: бесплатно, есть вебвизор (видно, где люди
 * останавливаются на длинной странице), заказчику привычнее GA4.
 *
 * ВКЛЮЧЕНИЕ: вписать номер счётчика в window.SBF_METRIKA_ID в index.html.
 * Пока номера нет, модуль не грузит ничего и не шлёт запросов — это
 * сознательно: пустой счётчик хуже отсутствующего, он создаёт видимость
 * измерения. В консоль пишем один раз, чтобы это не было тихо.
 *
 * Цели: любой элемент с data-track="имя" шлёт reachGoal('имя') по клику.
 * Плюс автоматически — доскроллы до секций (sbf:section) и отправка
 * заявки (lead:sent).
 */
(function () {
  'use strict';

  var ID = window.SBF_METRIKA_ID;
  if (!ID) {
    console.info('[analytics] счётчик не подключён: задайте window.SBF_METRIKA_ID в index.html');
    /* Заглушка, чтобы вызовы целей ниже не падали и код был один и тот же */
    window.SBF = window.SBF || {};
    window.SBF.track = function () {};
    bindClicks();
    return;
  }

  /* Загрузчик Метрики. Скрипт грузим отложенно: он не участвует в первой
     отрисовке, а на телефоне каждый лишний килобайт в старте — это LCP. */
  (function (m, e, t, r, i, k, a) {
    m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
    m[i].l = 1 * new Date();
    k = e.createElement(t); a = e.getElementsByTagName(t)[0];
    k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
  })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');

  window.ym(ID, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });

  function goal(name, params) {
    try { window.ym(ID, 'reachGoal', name, params || {}); } catch (e) {}
  }

  window.SBF = window.SBF || {};
  window.SBF.track = goal;

  /* Экраны: докуда дошёл человек на длинной странице. Каждую секцию
     считаем один раз за визит, иначе прокрутка туда-обратно накрутит цель. */
  var seen = {};
  document.addEventListener('sbf:section', function (e) {
    var id = e.detail && e.detail.id;
    if (!id || seen[id]) return;
    seen[id] = true;
    goal('screen_' + id.replace(/^act-/, ''));
  });

  document.addEventListener('lead:sent', function () { goal('lead_sent'); });

  bindClicks();

  function bindClicks() {
    document.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-track]');
      if (!el) return;
      (window.SBF.track || function () {})(el.dataset.track);
    });
  }
})();

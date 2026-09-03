/**
 * nav-height.js — публикует реальную высоту шапки в --nav-h.
 *
 * Верхний отступ секций на узких экранах был задан числом (60px), а шапка
 * при переносе бренда на две строки вырастала до 83px — заголовок уезжал
 * под неё. Число не угадать: высота зависит от языка, ширины и того,
 * перенеслась ли строка. Поэтому меряем.
 */
(function () {
  'use strict';

  var nav = document.getElementById('site-nav');
  if (!nav) return;

  function publish() {
    var h = Math.round(nav.getBoundingClientRect().height);
    if (h) document.documentElement.style.setProperty('--nav-h', h + 'px');
  }

  publish();
  window.addEventListener('resize', publish);
  window.addEventListener('load', publish);
  /* Шрифты догружаются позже и меняют высоту строки */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(publish);
  /* Язык переключили — длина бренда и пунктов меню изменилась */
  document.addEventListener('sbf:langchange', publish);
})();

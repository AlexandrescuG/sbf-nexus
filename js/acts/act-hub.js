/**
 * act-hub.js — второй экран, «Что выходит из шума».
 *
 * Задача одна: связать логотип с карточками так, чтобы он читался как
 * источник, а не как фон. Наводишь на карточку — подсвечивается нить,
 * идущая к ней от знака. Сам знак кликабелен и ведёт на платформу
 * (обработчик живёт в main.js), здесь — только подсказка и подсветка.
 */
(function () {
  'use strict';

  var section = document.getElementById('act-grow');
  if (!section) return;

  var cards = section.querySelectorAll('.hub-card[data-thread]');
  var lines = section.querySelectorAll('.thread-line[data-thread]');

  /* Нити рисуем от знака к карточкам по фактическим прямоугольникам.
     Логотип — position: fixed, поэтому его координаты берём из
     getBoundingClientRect и переводим в систему секции. */
  function drawThreads() {
    var svg = section.querySelector('.forecasts-threads');
    var logo = document.getElementById('sbf-logo');
    if (!svg || !logo) return;
    var sr = section.getBoundingClientRect();
    if (!sr.width) return;
    svg.setAttribute('viewBox', '0 0 ' + Math.round(sr.width) + ' ' + Math.round(sr.height));

    var lr = logo.getBoundingClientRect();
    var cx = lr.left + lr.width / 2 - sr.left;
    var cy = lr.top + lr.height / 2 - sr.top;

    cards.forEach(function (card) {
      var line = section.querySelector('.thread-line[data-thread="' + card.dataset.thread + '"]');
      if (!line) return;
      var r = card.getBoundingClientRect();
      line.setAttribute('x1', cx.toFixed(1));
      line.setAttribute('y1', cy.toFixed(1));
      line.setAttribute('x2', (r.left + r.width / 2 - sr.left).toFixed(1));
      line.setAttribute('y2', (r.top + r.height / 2 - sr.top).toFixed(1));
    });
  }

  function highlight(id) {
    lines.forEach(function (l) {
      l.classList.toggle('thread-hot', !!id && l.dataset.thread === id);
    });
  }

  cards.forEach(function (card) {
    var id = card.dataset.thread;
    card.addEventListener('mouseenter', function () { highlight(id); });
    card.addEventListener('mouseleave', function () { highlight(null); });
    /* Клавиатура: карточка — не ссылка, но нить должна отзываться и на фокус */
    card.setAttribute('tabindex', '0');
    card.addEventListener('focus', function () { highlight(id); });
    card.addEventListener('blur',  function () { highlight(null); });
  });

  /* Наведение на сам знак зажигает все четыре нити разом:
     видно, что они выходят именно из него. */
  var logo = document.getElementById('sbf-logo');
  if (logo) {
    logo.addEventListener('mouseenter', function () {
      if (!document.body.classList.contains('act-act-grow-active')) return;
      lines.forEach(function (l) { l.classList.add('thread-hot'); });
    });
    logo.addEventListener('mouseleave', function () { highlight(null); });
  }

  /* Уходим с экрана — гасим, иначе подсветка останется на следующем */
  section.addEventListener('snap-leave', function () { highlight(null); });

  /* Знак переезжает по ролям, окно меняет размер — нити пересчитываем */
  section.addEventListener('snap-enter', function () { setTimeout(drawThreads, 750); });
  window.addEventListener('resize', drawThreads);
  window.addEventListener('load', drawThreads);
  drawThreads();
})();

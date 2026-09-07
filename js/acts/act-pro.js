/**
 * act-pro.js — PRO-оффер: знак выдаёт доступ.
 *
 * Кольцо замыкается по шагам пути пользователя: 01 регистрация → треть,
 * 02 опрос → две трети, 03 «твой путь» → кольцо полное и в центре
 * появляется бейдж PRO·30. Последовательность идёт при появлении знака
 * (~0.8 с на шаг) и повторяется при наведении или тапе на карточку:
 * навёл на 02 — кольцо показывает две трети.
 *
 * Тот же язык, что на услугах: доля = состояние. Только здесь доля растёт
 * по мере пути, а не задана уровнем услуги.
 */
(function () {
  'use strict';

  var sec  = document.getElementById('act-platform-2');
  var mark = sec && sec.querySelector('.pro-issue');
  if (!sec || !mark || !window.SBF || !window.SBF.logo) return;

  var cards = Array.prototype.slice.call(sec.querySelectorAll('.p2-card[data-step]'));
  var STEP_MS = 800;
  var timer = null, played = false;

  function lit(upTo) {
    cards.forEach(function (c) {
      c.classList.toggle('step-lit', parseInt(c.dataset.step, 10) <= upTo);
    });
  }

  function show(step, animate) {
    lit(step);
    SBF.logo.setState(mark, { part: step / 3, animate: animate !== false, pulse: step === 3 });
  }

  /* Полный проход 0 → 1 → 2 → 3 */
  function play() {
    clearTimeout(timer);
    var step = 0;
    lit(0);
    SBF.logo.setState(mark, { part: 0, animate: false });
    (function next() {
      step++;
      show(step);
      if (step < 3) timer = setTimeout(next, STEP_MS);
    })();
  }

  mark.addEventListener('mark:visible', function () {
    if (played) return;
    played = true;
    setTimeout(play, 250);
  });

  /* Наведение / тап на шаг — кольцо показывает его долю */
  cards.forEach(function (c) {
    var step = parseInt(c.dataset.step, 10);
    c.addEventListener('mouseenter', function () { clearTimeout(timer); show(step); });
    c.addEventListener('click', function () { clearTimeout(timer); show(step); });
    c.addEventListener('focus', function () { clearTimeout(timer); show(step); });
    c.setAttribute('tabindex', '0');
  });
  /* Ушли с карточек — возвращаем полный результат */
  sec.querySelector('.p2-steps').addEventListener('mouseleave', function () {
    if (played) show(3);
  });

  window.SBF.pro = { play: play, show: show };
})();

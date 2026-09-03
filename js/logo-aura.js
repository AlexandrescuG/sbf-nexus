/**
 * logo-aura.js — чем знак занят на каждом экране.
 *
 * Роль отвечает на вопрос «где логотип» (js/logo-roles.js), аура — на вопрос
 * «что он делает». Кольцо и подпись живут внутри #sbf-logo, поэтому ездят
 * и масштабируются вместе со знаком, без второго источника координат.
 *
 *   act-grow        раздаёт    кольцо целиком, нити расходятся к продуктам
 *   act-platform-2  выдаёт     кольцо замыкается по кругу — опрос в доступ
 *   act-service-1   держит 1/3 клиент работает сам, мы даём материалы
 *   act-service-2   держит 2/3 сопровождаем счёт, решения за клиентом
 *   act-service-3   держит 3/3 управление на нашей стороне
 *
 * Доли не декоративные: это ровно то, что написано в текстах услуг, но
 * чего в графике до сих пор не было.
 */
(function () {
  'use strict';

  var ring = document.getElementById('logo-ring');
  var hint = document.getElementById('logo-hint');
  if (!ring || !hint) return;

  var fill = ring.querySelector('.ring-fill');
  var R = 46;                       // как в viewBox разметки
  var LEN = 2 * Math.PI * R;

  /* Экран → сколько работы на стороне SBF и что писать под знаком */
  var STATE = {
    'act-grow':       { part: 1,     hint: 'grow.logo_hint'  },
    'act-platform-2': { part: 1,     hint: 'svc.logo_issue'  },
    'act-service-1':  { part: 1 / 3, hint: 'svc.logo_lvl1'   },
    'act-service-2':  { part: 2 / 3, hint: 'svc.logo_lvl2'   },
    'act-service-3':  { part: 1,     hint: 'svc.logo_lvl3'   },
  };

  fill.style.strokeDasharray = LEN.toFixed(1);
  fill.style.strokeDashoffset = LEN.toFixed(1);

  function t(key) {
    return (window.i18n && window.i18n.t) ? window.i18n.t(key) : '';
  }

  var current = null;

  function show(id) {
    var s = STATE[id];
    current = s ? id : null;
    document.body.classList.toggle('logo-busy', !!s);
    if (!s) {
      fill.style.strokeDashoffset = LEN.toFixed(1);
      hint.textContent = '';
      hint.dataset.i18n = '';
      return;
    }
    /* Кольцо дорисовывается от нуля: видно, как знак берёт долю на себя.
       Сброс и новое значение разделяем принудительным пересчётом стилей,
       а не двойным requestAnimationFrame: rAF в фоновой вкладке не
       вызывается вовсе, и состояние молча застревало бы на нуле. */
    fill.style.transition = 'none';
    fill.style.strokeDashoffset = LEN.toFixed(1);
    ring.classList.toggle('ring-full', s.part >= 1);
    void fill.getBoundingClientRect();
    fill.style.transition = '';
    fill.style.strokeDashoffset = (LEN * (1 - s.part)).toFixed(1);
    hint.dataset.i18n = s.hint;      /* чтобы i18n перерисовал при смене языка */
    hint.textContent = t(s.hint);
  }

  document.querySelectorAll('.snap-stop').forEach(function (sec) {
    sec.addEventListener('snap-enter', function () { show(sec.id); });
  });

  /* Язык переключили — подпись под знаком обновляем вместе со всем остальным */
  document.addEventListener('sbf:langchange', function () {
    if (current && STATE[current]) hint.textContent = t(STATE[current].hint);
  });

  var active = document.querySelector('.snap-stop.snap-active-stop');
  if (active) show(active.id);

  window.SBF_LOGO_AURA = { show: show };
})();

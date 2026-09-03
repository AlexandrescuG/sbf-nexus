/**
 * logo-roles.js — единственный владелец положения логотипа #sbf-logo.
 *
 * Логотип на сайте один и тот же объект от первого экрана до последнего:
 * один размер, одна пульсация, один клик. Меняется не он, а его роль.
 *
 *   source  · Карта      — стоит над Кишинёвом, нити новостей сходятся в него
 *   filter  · Сценарии   — в центре, за карточками: шум прошёл сквозь него,
 *                          остались факты
 *   entry   · Платформа  — уходит в угол и становится кнопкой входа
 *   sun     · Контакты   — улетает в правый верх и светит над картой
 *                          (эта роль живёт в act5-contact.js, мы её не трогаем)
 *   dock    · остальные  — угол, приглушённый, но кликабельный
 *
 * Почему один модуль, а не по обработчику в каждом акте: раньше положение
 * логотипа правили четыре файла вразнобой, и в act2-grow.js пришлось завести
 * «сброс на случай если GSAP из другого акта залип». Порядок событий у
 * snap-navigator — сначала snap-leave прошлой секции, потом snap-enter новой,
 * поэтому достаточно одного обработчика на вход: он всегда последний.
 */
(function () {
  'use strict';

  var wrap = document.getElementById('sbf-logo');
  var img  = document.getElementById('sbf-logo-img');
  if (!wrap || !img || !window.gsap) return;

  var DUR = 0.7;
  var EASE = 'power2.inOut';

  /* Акт → роль. Всё, чего нет в списке, получает dock. */
  var ROLES = {
    'act-map':        'source',
    'act-grow':       'filter',
    'act-platform-1': 'entry',
    /* Ниже — экраны, у которых композиция построена вокруг пустого центра
       (в CSS у них так и написано: grid-area logo). Знак возвращается туда. */
    'act-platform-2': 'hold',
    'act-service-1':  'hold',
    'act-service-2':  'hold',
    'act-service-3':  'hold',
    'act-contact':    'sun',
  };

  var current = null;

  function centre() {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  /* Точка Кишинёва на карте первого экрана. Её считает hero-map.js при
     каждом fit(); пока карта не построена — держим логотип в центре. */
  function sourcePoint() {
    var c = window.SBF_HERO_CORE;
    if (!c || !c.x) return null;
    var mid = centre();
    return { x: c.x - mid.x, y: c.y - mid.y };
  }

  /* Угол-«док». Слева внизу: справа живут точки snap-навигации. */
  function dockPoint() {
    var mid = centre();
    var pad = window.innerWidth < 900 ? 56 : 84;
    return { x: pad - mid.x, y: mid.y - pad };
  }

  var STATES = {
    source: function () {
      var p = sourcePoint();
      /* Карта ещё не готова — не дёргаем логотип, вернёмся по событию */
      if (!p) return null;
      return { x: p.x, y: p.y, width: 92, opacity: 1 };
    },
    filter: function () {
      return { x: 0, y: 0, width: 120, opacity: 0.9 };
    },
    hold: function () {
      return { x: 0, y: 0, width: 118, opacity: 1 };
    },
    entry: function () {
      var p = dockPoint();
      return { x: p.x, y: p.y, width: 88, opacity: 1 };
    },
    dock: function () {
      var p = dockPoint();
      return { x: p.x, y: p.y, width: 56, opacity: 0.55 };
    },
  };

  function apply(role, instant) {
    if (role === 'sun') return;          /* финал ведёт act5-contact.js */
    var s = (STATES[role] || STATES.dock)();
    if (!s) return;

    wrap.classList.toggle('logo-entry', role === 'entry');
    wrap.classList.toggle('logo-source', role === 'source');

    var d = instant ? 0 : DUR;
    gsap.to(wrap, { x: s.x, y: s.y, opacity: s.opacity, duration: d, ease: EASE, overwrite: 'auto' });
    gsap.to(img,  { width: s.width, duration: d, ease: EASE, overwrite: 'auto' });
  }

  function roleOf(id) { return ROLES[id] || 'dock'; }

  function enter(id, instant) {
    current = roleOf(id);
    apply(current, instant);
  }

  document.querySelectorAll('.snap-stop').forEach(function (sec) {
    sec.addEventListener('snap-enter', function () { enter(sec.id); });
  });

  /* Карта пересобралась (загрузилась или поменялся размер окна) —
     если мы на первом экране, логотип едет за Кишинёвом. */
  document.addEventListener('sbf:herocore', function () {
    if (current === 'source') apply('source', true);
  });

  window.addEventListener('resize', function () {
    if (current && current !== 'sun') apply(current, true);
  });

  /* Стартовое состояние: страница может открыться не на первом экране —
     восстановление позиции лежит в sessionStorage. */
  var active = document.querySelector('.snap-stop.snap-active-stop')
            || document.querySelector('.snap-stop');
  if (active) enter(active.id, true);

  window.SBF_LOGO_ROLES = { apply: apply, roleOf: roleOf };
})();

/**
 * logo-aura.js — чем знак занят.
 *
 * Знаков на странице два вида, и ни один не плавает над содержимым:
 *   · постоянный маленький в шапке (#sbf-logo) — его кольцо показывает роль
 *     той секции, которая сейчас перед глазами;
 *   · крупные внутри секций (.sect-mark) — лежат в потоке, едут вместе со
 *     своей секцией и физически не могут перекрыть текст.
 *
 * Доли кольца не декоративные: на услугах это ровно то, что написано в
 * текстах — «клиент разбирается сам» → «сопровождаем» → «управляем».
 */
(function () {
  'use strict';

  var R = 46;                       // как в viewBox разметки
  var LEN = 2 * Math.PI * R;

  /* Роль → доля кольца. Роли назначает js/logo-roles.js. */
  var PART = {
    'source': 1, 'spread': 1, 'entry': 1, 'issue': 1,
    'hold-1': 1 / 3, 'hold-2': 2 / 3, 'hold-3': 1,
  };

  /* Подпись под крупным знаком: ключ i18n на самом элементе */
  function t(key) {
    return (key && window.i18n && window.i18n.t) ? window.i18n.t(key) : '';
  }

  /* Кольцо дорисовывается от нуля — видно, как знак берёт долю на себя.
     Сброс и новое значение разделяем принудительным пересчётом стилей,
     а не двойным requestAnimationFrame: rAF в фоновой вкладке не
     вызывается вовсе, и доля молча застревала бы на нуле. */
  function fillRing(circle, part, animate) {
    if (!circle) return;
    circle.style.strokeDasharray = LEN.toFixed(1);
    if (animate) {
      circle.style.transition = 'none';
      circle.style.strokeDashoffset = LEN.toFixed(1);
      void circle.getBoundingClientRect();
      circle.style.transition = '';
    }
    circle.style.strokeDashoffset = (LEN * (1 - part)).toFixed(1);
  }

  /* ── Крупные знаки внутри секций ─────────────────────────────────────
     Заполняются один раз при появлении в поле зрения. */
  var marks = Array.prototype.slice.call(document.querySelectorAll('.sect-mark'));
  marks.forEach(function (m) {
    var cap = m.querySelector('.mark-cap');
    if (cap) cap.textContent = t(cap.dataset.i18n);
    fillRing(m.querySelector('.mark-fill'), 0, false);
  });

  if (marks.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var part = PART[e.target.dataset.role];
        fillRing(e.target.querySelector('.mark-fill'), part == null ? 1 : part, true);
        obs.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    marks.forEach(function (m) { obs.observe(m); });
  } else {
    marks.forEach(function (m) {
      var part = PART[m.dataset.role];
      fillRing(m.querySelector('.mark-fill'), part == null ? 1 : part, false);
    });
  }

  /* ── Кольцо у знака в шапке ──────────────────────────────────────────
     Показывает роль текущей секции — знак «занят» тем же, чем занят экран. */
  var headRing = document.getElementById('logo-ring');
  var headFill = headRing && headRing.querySelector('.ring-fill');

  function onSection(id) {
    if (!headFill) return;
    var role = window.SBF_LOGO_ROLES && window.SBF_LOGO_ROLES.roleOf(id);
    var part = role ? PART[role] : null;
    document.body.classList.toggle('logo-busy', part != null);
    headRing.classList.toggle('ring-full', part === 1);
    fillRing(headFill, part == null ? 0 : part, true);
  }

  document.querySelectorAll('.snap-stop').forEach(function (sec) {
    sec.addEventListener('snap-enter', function () { onSection(sec.id); });
  });

  /* Язык переключили — подписи под крупными знаками обновляем */
  document.addEventListener('sbf:langchange', function () {
    marks.forEach(function (m) {
      var cap = m.querySelector('.mark-cap');
      if (cap) cap.textContent = t(cap.dataset.i18n);
    });
  });

  var active = document.querySelector('.snap-stop.snap-active-stop');
  if (active) onSection(active.id);

  window.SBF_LOGO_AURA = { onSection: onSection };
})();

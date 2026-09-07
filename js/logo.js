/**
 * logo.js — единственный владелец поведения знака SBF.
 *
 * ГРАММАТИКА. Сайт рассказывает одну историю: мир генерирует шум, мы
 * распознаём закономерности. Значит у знака одна роль на всём сайте — он
 * процессор, и на каждом экране делает одно из трёх:
 *
 *   intake   принимает — поток входит в знак      (карта: нити новостей)
 *   process  обрабатывает — внутри что-то идёт    (подход: линза; услуги: доля работы)
 *   output   выдаёт — из знака выходит результат  (что выходит из шума; PRO; финал)
 *
 * Роль секции — это не украшение, а ответ на вопрос «что здесь делает знак».
 * Если для новой секции роль не подбирается, знака там быть не должно.
 *
 * ПОЧЕМУ ОДИН МОДУЛЬ. До этого поведение знака жило в четырнадцати файлах:
 * logo-roles.js, logo-aura.js, core-engine.js, glow-layer.js, hero-map.js,
 * main.js, act-approach.js, act-hub.js, act2-grow.js, act5-contact.js и
 * четырёх таблицах стилей. Любая правка требовала помнить все места, и
 * дважды за день это кончалось тем, что знак начинал жить своей жизнью:
 * то ореол оставался без знака, то знак ложился на текст. Здесь — одно
 * место и один вход.
 *
 * API
 *   SBF.logo.roleOf(sectionId)          → 'intake' | 'process' | 'output' | null
 *   SBF.logo.setState(mark, {part, pulse, role})
 *        part  0…1  доля кольца; на услугах это доля работы на стороне SBF
 *        pulse true короткая вспышка (пришла нить, сменился слайд, ушла форма)
 *        role  переопределить роль конкретного знака
 *   SBF.logo.pulse(mark)                короткая вспышка без смены состояния
 *   SBF.logo.marks()                    все знаки на странице
 *
 * Знаки — это .sect-mark внутри секций. Они лежат в потоке и едут вместе
 * с содержимым: общий fixed-знак по центру вьюпорта при обычной прокрутке
 * ложился на текст, это свойство модели, а не настройка отступов.
 */
(function () {
  'use strict';

  var R = 46;                              /* как в viewBox разметки */
  var LEN = 2 * Math.PI * R;

  /* Секция → что знак на ней делает. Доля кольца задаётся отдельно:
     роль отвечает на «что», доля — на «сколько». */
  var SECTIONS = {
    'act-map':        { role: 'intake',  part: 1 },
    'act-grow':       { role: 'output',  part: 1 },
    'act-approach':   { role: 'process', part: 1 },
    'act-platform-1': { role: 'output',  part: 1 },
    'act-platform-2': { role: 'output',  part: 1 },
    'act-market':     { role: 'process', part: 1 },
    /* Услуги — лестница вовлечения: сколько работы на стороне SBF */
    'act-service-1':  { role: 'process', part: 1 / 3 },
    'act-service-2':  { role: 'process', part: 2 / 3 },
    'act-service-3':  { role: 'process', part: 1 },
    'act-contact':    { role: 'output',  part: 1 },
  };

  function roleOf(id) { return (SECTIONS[id] || {}).role || null; }
  function partOf(id) { var s = SECTIONS[id]; return s ? s.part : null; }

  function sectionOf(el) {
    var sec = el.closest ? el.closest('.snap-stop') : null;
    return sec ? sec.id : null;
  }

  function t(key) {
    return (key && window.i18n && window.i18n.t) ? window.i18n.t(key) : '';
  }

  /* Заполнение кольца. Сброс и новое значение разделяем принудительным
     пересчётом стилей, а не двойным requestAnimationFrame: rAF в фоновой
     вкладке не вызывается вовсе, и доля молча застревала бы на нуле. */
  function fill(circle, part, animate) {
    if (!circle) return;
    circle.style.strokeDasharray = LEN.toFixed(1);
    if (animate) {
      circle.style.transition = 'none';
      circle.style.strokeDashoffset = LEN.toFixed(1);
      void circle.getBoundingClientRect();
      circle.style.transition = '';
    }
    circle.style.strokeDashoffset = (LEN * (1 - Math.max(0, Math.min(1, part)))).toFixed(1);
  }

  function setState(mark, opts) {
    if (!mark) return;
    opts = opts || {};
    var id = sectionOf(mark);
    var part = opts.part != null ? opts.part
             : (mark.dataset.part != null ? parseFloat(mark.dataset.part) : partOf(id));
    var role = opts.role || mark.dataset.role || roleOf(id);

    if (role) mark.dataset.role = role;
    if (part != null) {
      mark.dataset.part = part;
      mark.classList.toggle('mark-complete', part >= 1);
      fill(mark.querySelector('.mark-fill'), part, opts.animate !== false);
      /* Вход на платформе: доля кольца проявляет скриншот. Переменную
         ставим на контейнере, чтобы CSS сам считал blur и яркость. */
      var gate = mark.closest('.platform-gate');
      if (gate) {
        animateVar(gate, '--gate', part, opts.animate !== false ? 1100 : 0);
        setTimeout(function () { gate.classList.toggle('gate-open', part >= 1); },
                   opts.animate !== false ? 900 : 0);
      }
    }
    if (opts.pulse) pulse(mark);
  }

  /* Плавно ведём CSS-переменную от текущего значения к цели: у переменных
     нет transition, а картинка должна проявляться синхронно с кольцом. */
  function animateVar(el, name, to, ms) {
    var from = parseFloat(getComputedStyle(el).getPropertyValue(name)) || 0;
    if (!ms) { el.style.setProperty(name, to); return; }
    var t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      el.style.setProperty(name, (from + (to - from) * e).toFixed(3));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  function pulse(mark) {
    if (!mark) return;
    mark.classList.remove('mark-pulse');
    void mark.getBoundingClientRect();
    mark.classList.add('mark-pulse');
  }

  var marks = Array.prototype.slice.call(document.querySelectorAll('.sect-mark'));

  function renderCaptions() {
    marks.forEach(function (m) {
      var cap = m.querySelector('.mark-cap');
      if (cap && cap.dataset.i18n) cap.textContent = t(cap.dataset.i18n);
    });
  }

  /* Стартовое состояние: кольцо пустое, заполняется при появлении знака
     в поле зрения — тогда видно сам процесс, а не готовый результат. */
  marks.forEach(function (m) {
    if (!m.dataset.role) {
      var r = roleOf(sectionOf(m));
      if (r) m.dataset.role = r;
    }
    fill(m.querySelector('.mark-fill'), 0, false);
  });
  renderCaptions();

  if (marks.length && 'IntersectionObserver' in window) {
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        /* Знаки со своим сценарием (data-scripted) заполняет их акт —
           например PRO-оффер ведёт кольцо по шагам. */
        if (!e.target.hasAttribute('data-scripted')) setState(e.target, {});
        e.target.dispatchEvent(new CustomEvent('mark:visible'));
        obs.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    marks.forEach(function (m) { obs.observe(m); });
  } else {
    marks.forEach(function (m) { setState(m, { animate: false }); });
  }

  document.addEventListener('sbf:langchange', renderCaptions);

  window.SBF = window.SBF || {};
  window.SBF.logo = {
    roleOf: roleOf,
    partOf: partOf,
    setState: setState,
    pulse: pulse,
    marks: function () { return marks.slice(); },
    SECTIONS: SECTIONS,
  };

  /* Совместимость: на эти имена ссылались act-hub.js и старые прогоны */
  window.SBF_LOGO_ROLES = { roleOf: roleOf };
})();

/**
 * act-platform.js — четвёртый экран: платформа.
 *
 * Две вещи, которых не хватало, чтобы экран перестал быть картинкой:
 *
 *   1. Вкладки. Терминал, журнал и академия — три разных продукта, а
 *      показывался один статичный скриншот терминала. Снимки сделаны с
 *      живой lp.sbfconsult.com (tools/, Playwright) и лежат в
 *      assets/platform/. Рамка браузера рисуется CSS, без картинок.
 *
 *   2. Лайтбокс с сегодняшним брифом. Это единственное место на сайте,
 *      где продукт показан целиком и без регистрации: картинку рисует
 *      market_intel (brief_image_<дата>.png), путь приходит в hero-feed.json.
 *
 * Механику «ключа» (кольцо проявляет скриншот) ведёт js/logo.js — здесь
 * её не трогаем, только снимаем размытие при переключении вкладок: гейт
 * уже открыт, повторно закрывать его было бы враньём.
 */
(function () {
  'use strict';

  var section = document.getElementById('act-platform-1');
  if (!section) return;

  var tabs   = section.querySelectorAll('.plat-tab');
  var shot   = section.querySelector('.platform-screenshot');
  var url    = section.querySelector('.plat-url');
  var gate   = section.querySelector('.platform-gate');

  var SHOTS = {
    terminal: { src: 'assets/platform/terminal.png', alt: 'SBF Intelligence Terminal' },
    journal:  { src: 'assets/platform/journal.png',  alt: 'SBF — журнал сделок' },
    academy:  { src: 'assets/platform/academy.png',  alt: 'SBF Academy' },
  };

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function (e) {
      e.preventDefault();
      var key = tab.dataset.tab;
      if (!SHOTS[key] || !shot) return;
      tabs.forEach(function (t) { t.classList.toggle('is-active', t === tab); });
      shot.src = SHOTS[key].src;
      shot.alt = SHOTS[key].alt;
      if (url) url.textContent = tab.dataset.url || '';
      /* Вкладку переключили руками — вход уже пройден */
      if (gate) gate.classList.add('gate-open');
    });
  });

  /* ── Лайтбокс брифа ───────────────────────────────────────────────── */
  var box  = document.getElementById('plat-lightbox');
  var img  = document.getElementById('plat-lb-img');
  var cap  = document.getElementById('plat-lb-cap');
  var btn  = section.querySelector('.plat-brief-cta');
  var meta = null;

  function open() {
    if (!box || !meta || !meta.image) return;
    img.src = meta.image;
    var d = meta.image_date || meta.date || '';
    cap.textContent = (window.i18n && window.i18n.t ? window.i18n.t('platform.p1.brief_cap') : '')
                        .replace('{d}', d);
    box.hidden = false;
    document.body.style.overflow = 'hidden';
    if (window.snapNav) window.snapNav.locked = true;
  }

  function close() {
    if (!box) return;
    box.hidden = true;
    document.body.style.overflow = '';
    if (window.snapNav) window.snapNav.locked = false;
  }

  if (btn) {
    /* Пока не знаем, есть ли картинка, кнопку не показываем: кнопка,
       которая ничего не открывает, хуже её отсутствия. */
    btn.hidden = true;
    fetch('/hero-feed.json', { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        meta = (d && d.grow && d.grow.brief) || null;
        if (meta && meta.image) btn.hidden = false;
      })
      .catch(function () {});
    btn.addEventListener('click', open);
  }

  if (box) {
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.closest('.plat-lb-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !box.hidden) close();
    });
  }
})();

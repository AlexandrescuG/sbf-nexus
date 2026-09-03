/**
 * scroll-director.js — обычный скролл вместо поэкранного.
 *
 * Хореография сайта завязана на события `snap-enter` / `snap-leave`, которые
 * рассылал snap-navigator: роли логотипа, кольцо занятости, нити на втором
 * экране, перелёт знака в солнце на финале, показ бегущей строки, класс
 * `body.act-<id>-active`, от которого зависит десяток правил в CSS.
 *
 * Поэтому переход сделан не переписыванием актов, а подменой источника
 * событий: страница скроллится нативно, а этот модуль следит, какая секция
 * сейчас главная, и рассылает ровно те же события в том же порядке
 * (сначала leave прошлой, потом enter новой). Для всех остальных файлов
 * ничего не изменилось.
 *
 * Что осталось у snap-navigator: показ блоков `[data-fade]` через
 * IntersectionObserver. Перехват колеса и клавиш он больше не ставит.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'sbf_snap_idx';
  var stops = Array.prototype.slice.call(document.querySelectorAll('.snap-stop'));
  if (!stops.length) return;

  var current = -1;
  var ticking = false;

  /* Главная секция — та, чей центр ближе к центру экрана. Порог по площади
     не годится: секции разной высоты, и низкая никогда бы не выигрывала. */
  function activeIndex() {
    var mid = window.innerHeight / 2;
    var best = 0, bestDist = Infinity;
    for (var i = 0; i < stops.length; i++) {
      var r = stops[i].getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) continue;
      var d = Math.abs((r.top + r.bottom) / 2 - mid);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    return best;
  }

  function setActive(i) {
    if (i === current) return;
    if (current >= 0 && stops[current]) {
      stops[current].classList.remove('snap-active-stop');
      stops[current].dispatchEvent(new CustomEvent('snap-leave'));
    }
    current = i;
    var el = stops[i];
    el.classList.add('snap-active-stop');
    el.dispatchEvent(new CustomEvent('snap-enter'));

    document.body.className = document.body.className
      .replace(/\bact-\S+-active\b/g, '').trim();
    document.body.classList.add('act-' + el.id + '-active');

    try { sessionStorage.setItem(STORAGE_KEY, i); } catch (e) {}

    document.querySelectorAll('.snap-dot').forEach(function (dot, k) {
      dot.classList.toggle('active', k === i);
    });

    /* Плавающая кнопка: как и раньше, прячем на первом и последнем экране */
    var sticky = document.getElementById('sticky-cta');
    if (sticky) sticky.classList.toggle('visible', i !== 0 && i !== stops.length - 1);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      setActive(activeIndex());
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ── Переходы по ссылкам ──────────────────────────────────────────────
     Раньше их обрабатывал snap-navigator своим express-переходом. */
  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) return false;
    var nav = document.querySelector('.site-nav');
    var pad = nav ? nav.getBoundingClientRect().height : 0;
    window.scrollTo({ top: Math.max(0, el.offsetTop - pad + 1), behavior: 'smooth' });
    return true;
  }

  document.querySelectorAll('.snap-dot').forEach(function (dot, k) {
    dot.addEventListener('click', function () {
      if (stops[k]) goTo(stops[k].id);
    });
  });

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-snap-target], a[href^="#"]');
    if (!el) return;
    var id = el.getAttribute('data-snap-target') ||
             (el.getAttribute('href') || '').slice(1);
    if (!id || !document.getElementById(id)) return;
    e.preventDefault();
    goTo(id);
  });

  /* ── Восстановление позиции ───────────────────────────────────────────
     Inline-скрипт в <head> считал позицию как idx * innerHeight. При
     секциях разной высоты это промах, поэтому там восстановление отключено,
     а здесь мы прыгаем к реальному offsetTop сохранённой секции. */
  var saved = parseInt(sessionStorage.getItem(STORAGE_KEY) || '0', 10);
  if (saved > 0 && saved < stops.length) {
    window.scrollTo(0, stops[saved].offsetTop);
  }
  setActive(activeIndex());
  document.documentElement.style.opacity = '1';

  window.SBF_SCROLL = { goTo: goTo, activeIndex: function () { return current; } };
})();

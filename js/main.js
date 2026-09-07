/**
 * main.js — bootstrap: шапка, бургер, CTA, мелкие хуки.
 *
 * Раньше отсюда стартовали CoreEngine и четыре слоя (glow, thread, pulse,
 * signal) вокруг общего fixed-логотипа #sbf-logo. Общего логотипа больше
 * нет — знак принадлежит секции (js/logo.js), холст #core-canvas скрыт, и
 * движок рисовал в пустоту каждый кадр. Снят вместе со слоями.
 */

/* ── Reduced motion ─────────────────────────────────────── */
window._sbfReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── Mobile detection ───────────────────────────────────── */
const isMobile = window.matchMedia('(max-width: 767px)').matches;
window._sbfMobile = isMobile;

/* ── Forced light color scheme ──────────────────────────── */
document.documentElement.style.colorScheme = 'light';

/* ── Nav: scrolled-class ────────────────────────────────── */
const navEl = document.getElementById('site-nav');
if (navEl) {
  const onScroll = () => navEl.classList.toggle('scrolled', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ── Логотип бренд → первый stop ────────────────────────── */
const brand = document.querySelector('.nav-brand');
if (brand) {
  brand.addEventListener('click', () => window.snapNav?.snapToExpress(0));
  brand.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.snapNav?.snapToExpress(0); }
  });
}

/* ── Scroll-hint: исчезает через 2с ────────────────────── */
const scrollHint = document.querySelector('.scroll-hint');
if (scrollHint) {
  setTimeout(() => {
    gsap.to(scrollHint, { opacity: 0, duration: 0.6, onComplete: () => scrollHint.remove() });
  }, 2000);
}

/* ── Тикер: fade out при уходе со stop 0 ───────────────── */
const tickerBar = document.querySelector('.ticker-bar');
if (tickerBar && !isMobile) {
  document.getElementById('act-map')?.addEventListener('snap-leave', () => {
    gsap.to(tickerBar, { opacity: 0, duration: 0.5, pointerEvents: 'none' });
  });
  document.getElementById('act-map')?.addEventListener('snap-enter', () => {
    gsap.to(tickerBar, { opacity: 1, duration: 0.5, pointerEvents: 'auto' });
  });
}

/* ── Гамбургер-меню (мобиле) ────────────────────────────── */
const menuBtn     = document.getElementById('mobile-menu-btn');
const menuOverlay = document.getElementById('mobile-menu-overlay');
if (menuBtn && menuOverlay) {
  menuBtn.addEventListener('click', () => {
    const open = menuOverlay.classList.toggle('open');
    menuBtn.classList.toggle('open', open);
    menuBtn.setAttribute('aria-expanded', open);
    document.body.style.overflow = open ? 'hidden' : '';
  });
  menuOverlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      menuOverlay.classList.remove('open');
      menuBtn.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });
}

/* ── IntersectionObserver (мобиле) ──────────────────────── */
if (isMobile) {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.18, rootMargin: '-40px 0px' });
  document.querySelectorAll('.section-animate').forEach(el => obs.observe(el));
}

/* ── Sticky CTA ─────────────────────────────────────────── */
const stickyBtn = document.getElementById('sticky-cta');
if (stickyBtn) {
  stickyBtn.addEventListener('click', () => window.leadModal?.open());
}

/* ── CTA hero — открывает модалку (только .cta-primary, не nav-ссылки) ── */
document.querySelectorAll('a.cta-primary[data-snap-target="act-contact"]').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    window.leadModal?.open();
  }, true);
});

/* ── Lazy preload карты глобуса при входе на act-grow ────── */
let globeMapPreloaded = false;

function preloadGlobeMap() {
  if (globeMapPreloaded) return;
  globeMapPreloaded = true;
  const link = document.createElement('link');
  link.rel   = 'preload';
  link.as    = 'image';
  link.type  = 'image/svg+xml';
  link.href  = 'assets/finale/world-map.svg';
  link.onload  = () => console.log('[Globe] Map preloaded');
  link.onerror = () => console.warn('[Globe] Map preload failed');
  document.head.appendChild(link);
}

const act2El = document.getElementById('act-grow');
if (act2El) {
  act2El.addEventListener('snap-enter', preloadGlobeMap, { once: true });
}

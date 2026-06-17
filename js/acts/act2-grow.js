/**
 * act2-grow.js — Stop 2: Сбывшиеся прогнозы.
 * Лого остаётся полноцветным и ярким. Файл нужен только для сброса
 * состояния лого при snap-leave если другой акт залип с GSAP.
 */

if (!window.matchMedia('(max-width: 767px)').matches) {

  function initAct2() {
    const logoWrap = document.getElementById('sbf-logo');
    const logoImg  = document.getElementById('sbf-logo-img');
    const section  = document.getElementById('act-grow');
    if (!section || !logoWrap) return;

    section.addEventListener('snap-leave', () => {
      /* Явный сброс на случай если GSAP из другого акта залип */
      gsap.set(logoWrap, { clearProps: 'transform,opacity' });
      gsap.set(logoWrap, { scale: 1, xPercent: -50, yPercent: -50, opacity: 1 });
      if (logoImg) gsap.set(logoImg, { clearProps: 'opacity' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAct2);
  } else {
    initAct2();
  }

}

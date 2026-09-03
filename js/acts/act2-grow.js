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

    /* Сброс положения логотипа убран: теперь им единолично заведует
       js/logo-roles.js, и «залипнуть» после чужого акта нечему —
       роль назначается на snap-enter, который всегда позже snap-leave. */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAct2);
  } else {
    initAct2();
  }

}

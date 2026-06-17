/**
 * act5-contact.js — Stop 9: финал «Космос + глобус».
 * Лого SBF на snap-enter летит по дуге из центра в правый верхний угол
 * (роль «солнца»). На snap-leave возвращается в центр.
 */

let finaleEnterTl = null;

function initAct5() {
  const section = document.getElementById('act-contact');
  if (!section) return;

  if (window.matchMedia('(max-width: 767px)').matches) {
    section.classList.add('timeline-complete');
    return;
  }

  const logoEl = document.getElementById('sbf-logo');

  section.addEventListener('snap-enter', () => {
    if (finaleEnterTl) finaleEnterTl.kill();

    const sunX    = window.innerWidth - 100;
    const sunY    = 100;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const midX    = (centerX + sunX) / 2;
    const midY    = (centerY + sunY) / 2 - 120;

    finaleEnterTl = gsap.timeline();

    /* Двухступенчатая дуга */
    finaleEnterTl
      .to(logoEl, {
        x: midX - centerX,
        y: midY - centerY,
        duration: 1,
        ease: 'power1.out',
      }, 0)
      .to(logoEl, {
        x: sunX - centerX,
        y: sunY - centerY,
        duration: 1,
        ease: 'power1.in',
      }, 1);

    /* Уменьшение параллельно полёту */
    finaleEnterTl.to('#sbf-logo-img', {
      width: 80,
      duration: 2,
      ease: 'power2.inOut',
    }, 0);

    document.body.classList.add('finale-sun-active');
  });

  section.addEventListener('snap-leave', () => {
    if (finaleEnterTl) finaleEnterTl.kill();

    gsap.to(logoEl, {
      x: 0,
      y: 0,
      duration: 0.8,
      ease: 'power2.out',
    });
    gsap.to('#sbf-logo-img', {
      width: 120,
      duration: 0.8,
      ease: 'power2.out',
    });

    document.body.classList.remove('finale-sun-active');
  });

  section.querySelector('[data-open-modal]')?.addEventListener('click', () => {
    window.leadModal?.open();
  });
}

document.fonts.ready.then(initAct5);

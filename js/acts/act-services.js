/**
 * act-services.js — Stop 5/6/7: corona grid-layout вокруг лого.
 * Snap-enter: блоки появляются со своих сторон (0.7s).
 * Snap-leave: мгновенный сброс в opacity 0.
 */

if (!window.matchMedia('(max-width: 767px)').matches) {

['act-service-1', 'act-service-2', 'act-service-3'].forEach(id => {
  const section = document.getElementById(id);
  if (!section) return;

  const numTop       = section.querySelector('.service-num-top');
  const titleTop     = section.querySelector('.service-title-top');
  const targetLeft   = section.querySelector('.service-target-left');
  const partnersRight= section.querySelector('.service-partners-right');
  const descBottom   = section.querySelector('.service-desc-bottom');

  const blocks = [numTop, titleTop, targetLeft, partnersRight, descBottom].filter(Boolean);

  function showCorona() {
    const tl = gsap.timeline({ defaults: { duration: 0.7, ease: 'power2.out' } });

    if (numTop)        tl.fromTo(numTop,        { y: -24, opacity: 0 }, { y: 0, opacity: 0.45 }, 0);
    if (titleTop)      tl.fromTo(titleTop,      { y: -16, opacity: 0 }, { y: 0, opacity: 1    }, 0.08);
    if (targetLeft)    tl.fromTo(targetLeft,    { x: -30, opacity: 0 }, { x: 0, opacity: 1    }, 0);
    if (partnersRight) tl.fromTo(partnersRight, { x:  30, opacity: 0 }, { x: 0, opacity: 1    }, 0);
    if (descBottom)    tl.fromTo(descBottom,    { y:  20, opacity: 0 }, { y: 0, opacity: 1    }, 0.1);
  }

  function hideCorona() {
    blocks.forEach(b => gsap.set(b, { opacity: 0, x: 0, y: 0 }));
  }

  section.addEventListener('snap-enter', showCorona);
  section.addEventListener('snap-leave',  hideCorona);
});

}

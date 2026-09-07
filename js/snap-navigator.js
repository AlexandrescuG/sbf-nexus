/**
 * snap-navigator.js — показ блоков [data-fade] по мере прокрутки.
 *
 * Раньше файл перехватывал колесо, касания и клавиши и переключал страницу
 * целыми экранами. После перехода на обычную прокрутку от него осталась
 * одна работа: показывать блоки, когда они попадают в поле зрения.
 * Всё остальное — активная секция, события snap-enter/snap-leave, точки
 * навигации, переходы по якорям — делает js/scroll-director.js.
 *
 * Имя файла и класс сохранены: на window.snapNav ссылается lead-modal.js,
 * а на события snap-enter/leave — половина актов. Переименование стоило бы
 * дороже, чем этот комментарий.
 */

/* Браузерная реставрация скролла мешает: при перезагрузке она возвращает
   старый пиксельный offset до того, как страница построена. */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const IS_MOBILE = window.matchMedia('(max-width: 1023px)').matches;
window.IS_MOBILE = IS_MOBILE;

class SnapNavigator {
  constructor() {
    this.stops  = Array.from(document.querySelectorAll('.snap-stop'));
    this.locked = false;      /* lead-modal.js ставит флаг, когда открыта модалка */
    this.setupFadeIn();
  }

  setupFadeIn() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-fade]').forEach(el => el.classList.add('fade-in'));
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('fade-in');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
    document.querySelectorAll('[data-fade]').forEach(el => obs.observe(el));
  }

  /* Совместимость: на эти методы ссылались старые обработчики */
  init() {}
  snapToExpress(index) {
    const el = this.stops[index];
    if (el && window.SBF_SCROLL) window.SBF_SCROLL.goTo(el.id);
  }
}

window.snapNav = new SnapNavigator();
window.snapNav.init();

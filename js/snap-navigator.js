/**
 * snap-navigator.js
 * Перехватывает wheel/touch/keyboard, переключает между snap-stop'ами.
 * Только десктоп (≥768px). На мобиле — нативный скролл + IntersectionObserver.
 */

/* Отключаем браузерную реставрацию scrollY — иначе при перезагрузке
   браузер восстанавливает старый пиксельный offset, а снап-навигатор
   думает что он на индексе 0, страница застревает между секциями */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

const IS_MOBILE = window.matchMedia('(max-width: 1023px)').matches;
window.IS_MOBILE = IS_MOBILE;

const SNAP_STORAGE_KEY = 'sbf_snap_idx';

class SnapNavigator {
  constructor() {
    if (IS_MOBILE) {
      /* На мобиле — нативный скролл, ни одного перехватчика событий */
      document.body.style.overflow          = '';
      document.documentElement.style.overflow = '';
      document.body.style.touchAction       = '';
      this.stops = []; // чтобы window.snapNav.stops не был undefined
      this.setupMobileFadeIn();
      return;
    }

    this.stops        = [];
    this.currentIndex = 0;
    this.isAnimating  = false;
    this.locked       = false;
    this.lockUntil    = 0;
    this.LOCK_MS      = 1000;
    this.WHEEL_THRESHOLD = 15;
    this.wheelAccum   = 0;
    this.wheelResetTimer = null;
    this._tween       = null;
    this._resizeTimer = null;
    this.touchStartY  = 0;
    this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  setupMobileFadeIn() {
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

  init() {
    if (IS_MOBILE) return; // всё сделано в конструкторе

    this.stops = Array.from(document.querySelectorAll('.snap-stop'));
    if (!this.stops.length) return;

    /* Прячем scrollbar, wheel/touch обрабатываем сами */
    document.documentElement.classList.add('snap-active');

    window.addEventListener('wheel',      this._onWheel.bind(this),      { passive: false });
    window.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true  });
    window.addEventListener('touchmove',  this._onTouchMove.bind(this),  { passive: false });
    window.addEventListener('touchend',   this._onTouchEnd.bind(this),   { passive: true  });
    window.addEventListener('keydown',    this._onKey.bind(this));
    window.addEventListener('resize',     this._onResize.bind(this));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', this._onResize.bind(this));
    }

    /* Клики по dot-индикаторам */
    document.querySelectorAll('.snap-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        const idx = parseInt(dot.dataset.idx, 10);
        if (!isNaN(idx)) this.snapToExpress(idx);
      });
    });

    /* Кнопки top-nav */
    document.querySelectorAll('[data-snap-target]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        const id  = el.getAttribute('data-snap-target');
        const idx = this.stops.findIndex(s => s.id === id);
        if (idx >= 0) this.snapToExpress(idx);
      });
    });

    /* Якорные ссылки → express переход */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id  = a.getAttribute('href').slice(1);
        const idx = this.stops.findIndex(s => s.id === id);
        if (idx < 0) return;
        e.preventDefault();
        this.snapToExpress(idx);
      });
    });

    /* Восстанавливаем позицию после перезагрузки.
       Сам скролл уже сделан inline-скриптом в <head> до первого рендера —
       здесь только точная коррекция и запуск snap-enter для нужной секции */
    const saved = parseInt(sessionStorage.getItem(SNAP_STORAGE_KEY) || '0', 10);
    const startIndex = (saved > 0 && saved < this.stops.length) ? saved : 0;
    this.currentIndex = startIndex;
    window.scrollTo(0, this.stops[startIndex].offsetTop);
    this._fireEnter(startIndex);
    this._updateDots(startIndex);
    /* Гарантируем видимость страницы (на случай если head-скрипт скрыл её) */
    document.documentElement.style.opacity = '1';
  }

  /* ── Wheel ──────────────────────────────────────────────── */
  _onWheel(e) {
    /* Разрешаем нативный скролл внутри data-no-snap элементов (попапы, модалки) */
    if (e.target.closest('[data-no-snap]')) return;
    /* Разрешаем нативный скролл когда locked=true (партнёрский модал и т.п.) */
    if (this.locked) return;
    /* Блокируем нативный скролл страницы, иначе page дрейфует */
    e.preventDefault();
    if (this.isAnimating || Date.now() < this.lockUntil) return;

    this.wheelAccum += e.deltaY;
    clearTimeout(this.wheelResetTimer);
    /* 400ms: трекпад Mac шлёт пачки с паузами между ними — надо дать им накопиться */
    this.wheelResetTimer = setTimeout(() => { this.wheelAccum = 0; }, 400);

    if (Math.abs(this.wheelAccum) >= this.WHEEL_THRESHOLD) {
      const dir = this.wheelAccum > 0 ? 1 : -1;
      this.wheelAccum = 0;
      this._go(dir);
    }
  }

  /* ── Touch ──────────────────────────────────────────────── */
  _onTouchStart(e) { this.touchStartY = e.touches[0].clientY; }
  _onTouchMove(e)  { if (!e.target.closest('[data-no-snap]')) e.preventDefault(); }
  _onTouchEnd(e) {
    if (this.locked || this.isAnimating || Date.now() < this.lockUntil) return;
    if (e.target.closest('[data-no-snap]')) return;
    const dy = this.touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(dy) < 50) return;
    this._go(dy > 0 ? 1 : -1);
  }

  /* ── Keyboard ───────────────────────────────────────────── */
  _onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (this.locked || this.isAnimating || Date.now() < this.lockUntil) return;

    switch (e.key) {
      case 'ArrowDown': case 'PageDown': case ' ':
        e.preventDefault(); this._go(1); break;
      case 'ArrowUp': case 'PageUp':
        e.preventDefault(); this._go(-1); break;
      case 'Home':
        e.preventDefault(); this.snapToExpress(0); break;
      case 'End':
        e.preventDefault(); this.snapToExpress(this.stops.length - 1); break;
    }
  }

  /* ── Resize ─────────────────────────────────────────────── */
  _onResize() {
    /* Немедленно убиваем GSAP-анимацию и фиксируем позицию —
       иначе страница прыгает пока тянешь границу окна,
       т.к. offsetTop секций (100vh) меняется, а scrollY остаётся старым */
    if (this._tween) { this._tween.kill(); this._tween = null; }
    this.isAnimating = false;
    window.scrollTo(0, this.stops[this.currentIndex].offsetTop);

    /* Дополнительный сброс после окончания ресайза (на случай фреймовых задержок) */
    clearTimeout(this._resizeTimer);
    this._resizeTimer = setTimeout(() => {
      window.scrollTo(0, this.stops[this.currentIndex].offsetTop);
    }, 100);
  }

  /* ── Navigation ─────────────────────────────────────────── */
  _go(dir) {
    const next = Math.max(0, Math.min(this.stops.length - 1, this.currentIndex + dir));
    if (next === this.currentIndex) return;
    this._snapTo(next, true, false);
  }

  snapToExpress(index) {
    if (this.isAnimating) return;
    this._snapTo(index, true, true);
  }

  _snapTo(index, animate = true, isExpress = false) {
    const from = this.currentIndex;
    this.currentIndex = index;

    /* Сброс предыдущей анимации перехода */
    if (this._tween) { this._tween.kill(); this._tween = null; }

    const targetY = this.stops[index].offsetTop;
    const dur     = this._reducedMotion ? 0.15 : 0.9;

    if (animate) {
      this.isAnimating = true;
      const proxy = { y: window.scrollY };
      this._tween = gsap.to(proxy, {
        y:         targetY,
        duration:  dur,
        ease:      'power3.inOut',
        onUpdate:  () => window.scrollTo(0, proxy.y),
        onComplete: () => {
          this._tween = null;
          this.isAnimating = false;
          if (!isExpress) this.lockUntil = Date.now() + this.LOCK_MS;
          this._fireLeave(from);
          this._fireEnter(index);
          this._updateDots(index);
        },
      });
    } else {
      window.scrollTo(0, targetY);
      this._fireEnter(index);
      this._updateDots(index);
    }
  }

  _fireEnter(index) {
    const el = this.stops[index];
    el.classList.add('snap-active-stop');
    el.dispatchEvent(new CustomEvent('snap-enter'));
    sessionStorage.setItem(SNAP_STORAGE_KEY, index);

    /* Body class для CSS лого-курсора */
    document.body.className = document.body.className
      .replace(/\bact-\S+-active\b/g, '').trim();
    document.body.classList.add(`act-${el.id}-active`);

    /* Sticky CTA: скрыть на stop 0 и stop 8 (контакты) */
    const stickyBtn = document.getElementById('sticky-cta');
    if (stickyBtn) {
      const lastIdx = this.stops.length - 1;
      const hide    = index === 0 || index === lastIdx;
      stickyBtn.classList.toggle('visible', !hide);
    }
  }

  _fireLeave(index) {
    const el = this.stops[index];
    el.classList.remove('snap-active-stop');
    el.dispatchEvent(new CustomEvent('snap-leave'));
  }

  _updateDots(index) {
    document.querySelectorAll('.snap-dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

}

/* Инициализация после DOMContentLoaded */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.snapNav = new SnapNavigator();
    window.snapNav.init();
  });
} else {
  window.snapNav = new SnapNavigator();
  window.snapNav.init();
}

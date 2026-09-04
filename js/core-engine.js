/**
 * CoreEngine — единый canvas (z1), DPR-aware, единый rAF-цикл.
 * Фаза 0: только инициализация + пустой render-loop.
 * Следующие фазы добавят layers: свечение, нити, пульсы, вспышки.
 */
export class CoreEngine {
  constructor() {
    this.canvas  = null;
    this.ctx     = null;
    this.W       = 0;
    this.H       = 0;
    this.dpr     = Math.min(window.devicePixelRatio || 1, window._sbfMobile ? 1.5 : 2);
    this._rafId  = null;
    this._layers = []; // {update(dt), draw(ctx)} — подключаются по фазам
    this._last   = 0;

    /* Центр свечения. Раньше здесь стоял комментарий «обновляются из
       ScrollDirector» — такого модуля в коде давно нет, и координаты
       намертво оставались серединой вьюпорта. Из-за этого корона висела
       золотым пятном посреди экрана независимо от того, где на самом деле
       находится логотип. Теперь центр берётся из самого знака. */
    this.cx = 0;
    this.cy = 0;
    this.logoR = 60;
    this.logoVisible = false;   // половина ширины знака — по ней масштабируется свечение
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'core-canvas';
    Object.assign(this.canvas.style, {
      position:      'fixed',
      inset:         '0',
      pointerEvents: 'none',
      zIndex:        '10',
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this._resize();
    window.addEventListener('resize', () => this._resize());

    // Пауза при скрытой вкладке
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this._stop();
      else                 this._start();
    });

    this._start();
  }

  /** Подключить слой к циклу */
  addLayer(layer) {
    this._layers.push(layer);
  }

  /** Старый API (act2): форс-пульс из PulseLayer */
  firePulse() {
    const pl = this._layers.find(l => typeof l.firePulse === 'function');
    pl?.firePulse();
    this._raiseCanvas(1800);
  }

  /**
   * Новый API (act3): нить от точки (x,y) к логотипу через SignalLayer.
   * Поднимает canvas выше chart-wrap-ов на время анимации.
   */
  fireSignalThread(x, y) {
    const sl = this._layers.find(l => l._signals);
    if (!sl) return;
    sl.addSignal(x, y);
    this._raiseCanvas(2200);
  }

  _raiseCanvas(ms) {
    if (!this.canvas) return;
    this.canvas.style.zIndex = '35';
    clearTimeout(this._zTimer);
    this._zTimer = setTimeout(() => {
      if (!this._pinned) this.canvas.style.zIndex = '10';
    }, ms);
  }

  pinCanvas(z = 35) {
    this._pinned = true;
    clearTimeout(this._zTimer);
    if (this.canvas) this.canvas.style.zIndex = String(z);
  }

  unpinCanvas() {
    this._pinned = false;
    if (this.canvas) this.canvas.style.zIndex = '10';
  }

  _resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.W   = window.innerWidth;
    this.H   = window.innerHeight;
    this.canvas.width  = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);

    // До первого кадра — середина вьюпорта, дальше центр даёт логотип
    this.cx = this.W / 2;
    this.cy = this.H / 2;

    this._layers.forEach(l => l.resize && l.resize(this.W, this.H));
  }

  _start() {
    if (this._rafId) return;
    this._last = performance.now();
    const loop = (now) => {
      const dt = Math.min((now - this._last) / 1000, 0.05); // cap 50ms
      this._last = now;
      this._tick(dt);
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  _stop() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  /* Свечение должно жить там же, где знак: он переезжает по ролям
     (карта → центр → угол), и промах виден сразу. Один
     getBoundingClientRect за кадр — дешевле, чем синхронизировать
     координаты из трёх мест. */
  _followLogo() {
    const el = document.getElementById('sbf-logo');
    const r = el ? el.getBoundingClientRect() : null;
    /* Скрытый элемент отдаёт нулевой прямоугольник. Раньше мы просто
       выходили, и координаты оставались от прошлого кадра — на планшете,
       где знак скрыт с 900px, а движок включается с 768, ореол повисал
       посреди экрана без всякого логотипа. */
    this.logoVisible = !!(r && r.width);
    if (!this.logoVisible) return;
    this.cx = r.left + r.width / 2;
    this.cy = r.top + r.height / 2;
    this.logoR = r.width / 2;
  }

  _tick(dt) {
    this._followLogo();
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    for (const layer of this._layers) {
      layer.update && layer.update(dt);
    }
    for (const layer of this._layers) {
      layer.draw && layer.draw(ctx);
    }
  }
}

/**
 * act-market-memory.js — «Память рынков»: знак помнит рынок.
 *
 * Две работы у одного знака:
 *
 *   1. Внутри силуэта знака течёт свечной поток текущего кейса. Канвас
 *      вырезан по форме логотипа через CSS mask-image — это та самая
 *      заготовка #chart-stream, что годами лежала в styles.css без JS.
 *      Сменился слайд — сменился поток.
 *
 *   2. Кольцо — таймер автоплея: заполняется за 5 секунд и переключает
 *      слайд. Точки и стрелки остаются ручным управлением; их клик
 *      останавливает кольцо, как раньше останавливал setInterval.
 *
 * Данные кейсов берутся из act3-market.js (cfg.data), он же шлёт
 * market:slide при смене слайда и вызывает SBF.marketRing.start/stop.
 */
(function () {
  'use strict';

  var section = document.getElementById('act-market');
  var mark = section && section.querySelector('.market-memory');
  if (!section || !mark || !window.SBF || !window.SBF.logo) return;

  var cv = mark.querySelector('canvas');
  var ctx = cv && cv.getContext('2d');
  if (!ctx) return;

  /* ── Поток свечей внутри силуэта ────────────────────────────────────── */
  var data = [], pos = 0, running = false, last = 0;
  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

  function size() {
    var r = cv.getBoundingClientRect();
    if (!r.width) return;
    W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setCase(caseId) {
    var charts = (window.SBF.market && window.SBF.market.charts) || [];
    var cfg = null;
    for (var i = 0; i < charts.length; i++) if (charts[i].caseId === caseId) cfg = charts[i];
    data = (cfg && cfg.data) ? cfg.data : [];
    pos = 0;
  }

  function frame(now) {
    if (!running) return;
    /* Метка кадра rAF может быть раньше performance.now(), взятого при
       старте — отрицательный шаг уводил индекс в минус, и c.low падал. */
    var dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
    if (!W || !data.length) { requestAnimationFrame(frame); return; }

    var N = 28;                            /* свечей в окне */
    pos = (pos + dt * 6) % data.length;     /* 6 свечей в секунду */
    var start = Math.floor(pos), off = pos - start;
    var slot = W / N, body = slot * 0.6;
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i <= N; i++) {
      var c = data[(start + i) % data.length];
      if (c.low < lo) lo = c.low;
      if (c.high > hi) hi = c.high;
    }
    var rng = hi - lo || 1;
    var yS = function (p) { return H * 0.08 + (1 - (p - lo) / rng) * H * 0.84; };

    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k <= N; k++) {
      var d = data[(start + k) % data.length];
      var x = k * slot - off * slot;
      var bull = d.close >= d.open;
      ctx.strokeStyle = bull ? 'rgba(230,194,87,0.95)' : 'rgba(201,162,39,0.55)';
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yS(d.high)); ctx.lineTo(x, yS(d.low)); ctx.stroke();
      var yo = yS(d.open), yc = yS(d.close);
      ctx.fillRect(x - body / 2, Math.min(yo, yc), body, Math.max(1, Math.abs(yc - yo)));
    }
    requestAnimationFrame(frame);
  }

  function start() { if (running) return; running = true; last = performance.now(); size(); requestAnimationFrame(frame); }
  function stop()  { running = false; }

  /* ── Кольцо-таймер ─────────────────────────────────────────────────── */
  var ringRaf = null, ringT0 = 0, ringMs = 5000, onDone = null;

  function ringFrame(now) {
    if (!ringRaf) return;
    var k = Math.min(1, (now - ringT0) / ringMs);
    window.SBF.logo.setState(mark, { part: k, animate: false });
    if (k >= 1) {
      var cb = onDone;
      window.SBF.logo.pulse(mark);
      ringT0 = now;                       /* следующий круг */
      if (cb) cb();
      ringRaf = requestAnimationFrame(ringFrame);
      return;
    }
    ringRaf = requestAnimationFrame(ringFrame);
  }

  window.SBF.marketRing = {
    start: function (ms, cb) {
      ringMs = ms || 5000; onDone = cb || null;
      ringT0 = performance.now();
      if (!ringRaf) ringRaf = requestAnimationFrame(ringFrame);
      start();
    },
    stop: function () {
      if (ringRaf) cancelAnimationFrame(ringRaf);
      ringRaf = null;
      /* Ручное управление: кольцо замирает полным — «слайд выбран» */
      window.SBF.logo.setState(mark, { part: 1, animate: true });
    },
  };

  /* ── Связь со слайдами ─────────────────────────────────────────────── */
  section.addEventListener('market:slide', function (e) {
    setCase(e.detail.caseId);
    window.SBF.logo.pulse(mark);          /* тик при смене слайда */
  });
  section.addEventListener('snap-leave', stop);
  window.addEventListener('resize', size);

  /* Стартовый кейс: активный слайд */
  var active = section.querySelector('.market-slide.active');
  if (active) setCase(active.dataset.case);
  /* Данные грузятся асинхронно — подтянем, когда появятся */
  var tries = 0;
  (function waitData() {
    if (data.length || tries++ > 40) return;
    if (active) setCase(active.dataset.case);
    if (!data.length) setTimeout(waitData, 250);
  })();
})();

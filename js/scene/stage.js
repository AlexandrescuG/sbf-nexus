/* stage.js — сцена гобелена: один холст, один цикл кадра.

   Правило простое и жёсткое: на всю страницу ровно один requestAnimationFrame.
   В старом каркасе их было шесть — карта, линза, память, услуги, глобус и
   бегущая строка крутили свои циклы, и на ноутбуке это складывалось в
   пропущенные кадры на каждом переходе. Здесь акты не заводят циклов, они
   получают кадр от сцены.

   Что делает сцена:
     · держит холст по размеру окна с учётом DPR;
     · спрашивает камеру, где мы сейчас (js/scene/camera.js);
     · рисует акты из смеси камеры — в зоне перехода соседей двое;
     · рисует знак поверх актов и переключает его роль;
     · останавливается, когда вкладка скрыта или сцена не нужна.

   Бюджет кадра — ограничитель 6 плана. Сцена сама меряет время кадра и,
   если он вылезает за бюджет несколько секунд подряд, понижает качество:
   сначала DPR до 1, затем зовёт акты в упрощённом режиме (view.simple).
   Это лучше, чем «оптимизируем потом»: деградация видна в HUD и предсказуема.
*/

import { createCamera } from './camera.js';
import { createMark } from './mark.js';
import { ACTS } from './acts/registry.js';

const BUDGET_MS = 16;

function boot() {
  const layer = document.querySelector('.scene-layer');
  if (!layer) return;

  const cv = document.createElement('canvas');
  layer.appendChild(cv);
  const ctx = cv.getContext('2d');

  const camera = createCamera();
  const mark = createMark();
  const debug = new URLSearchParams(location.search).has('debug');
  const reduced = window.matchMedia &&
                  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let dpr = Math.min(2, window.devicePixelRatio || 1);
  let view = { w: 0, h: 0, dt: 0, debug: debug, simple: false, reduced: reduced };
  let running = false, raf = null, prev = 0;
  let frameMs = 8, overBudget = 0;
  let current = null;

  function resize() {
    view.w = layer.clientWidth;
    view.h = layer.clientHeight;
    cv.width = Math.round(view.w * dpr);
    cv.height = Math.round(view.h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.measure();
  }

  function frame(now) {
    /* При prefers-reduced-motion непрерывного цикла нет: сцена рисует по
       кадру на движение прокрутки. Пользователь, который просил не
       двигать картинку, не должен получить её движущейся сам по себе. */
    raf = reduced ? null : requestAnimationFrame(frame);
    const t0 = performance.now();
    /* Метка rAF бывает раньше performance.now() — без клампа dt уходит в
       минус, и всё, что считается по времени, идёт назад. */
    view.dt = prev ? Math.max(0, Math.min(0.05, (now - prev) / 1000)) : 0;
    prev = now;

    camera.tick(now);
    const cam = camera.state();
    if (!cam.act) return;

    if (cam.act !== current) {
      const from = ACTS[current], to = ACTS[cam.act];
      if (from && from.leave) from.leave();
      if (to && to.enter) to.enter(cam.t);
      current = cam.act;
      if (to && to.role) mark.setRole(to.role);
      /* Метрика: раньше цель screen_* вешалась на событие секции, теперь —
         на прохождение акта камерой. Смысл тот же, источник один. */
      document.dispatchEvent(new CustomEvent('sbf:act', { detail: cam }));
    }

    ctx.clearRect(0, 0, view.w, view.h);
    for (let i = 0; i < cam.blend.length; i++) {
      const b = cam.blend[i];
      const act = ACTS[b.act];
      if (act && act.render) act.render(ctx, view, b, mark);
    }
    mark.render(ctx, view, cam);

    /* ── Бюджет кадра ───────────────────────────────────── */
    frameMs += (performance.now() - t0 - frameMs) * 0.1;
    if (frameMs > BUDGET_MS) {
      overBudget += view.dt;
      if (overBudget > 2 && dpr > 1) { dpr = 1; resize(); overBudget = 0; }
      else if (overBudget > 4 && !view.simple) { view.simple = true; overBudget = 0; }
    } else {
      overBudget = Math.max(0, overBudget - view.dt);
    }

    window.SBF_SCENE = { act: cam.act, t: cam.t, ms: frameMs,
                         fps: Math.round(1000 / Math.max(frameMs, 1)),
                         simple: view.simple, dpr: dpr };
    if (debug) hud(cam);
  }

  let hudEl = null;
  function hud(cam) {
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.id = 'scene-hud';
      document.body.appendChild(hudEl);
    }
    const act = ACTS[cam.act] || {};
    hudEl.textContent =
      'акт     ' + cam.act + '  (' + (act.note || '') + ')\n' +
      'внутри  ' + cam.t.toFixed(2) + '   роль ' + mark.role + '\n' +
      'смесь   ' + cam.blend.map(function (b) {
        return b.act + ':' + b.w.toFixed(2);
      }).join('  ') + '\n' +
      'кадр    ' + frameMs.toFixed(1) + ' мс   dpr ' + dpr +
      (view.simple ? '   упрощено' : '') + '\n' +
      'скорость ' + Math.round(cam.speed) + ' px/с';
  }

  function start() {
    if (running) return;
    running = true; prev = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function kick() { if (running && !raf) raf = requestAnimationFrame(frame); }

  window.addEventListener('resize', function () { resize(); kick(); });
  document.addEventListener('visibilitychange', function () {
    document.hidden ? stop() : start();
  });
  if (reduced) window.addEventListener('scroll', kick, { passive: true });

  /* Якоря #act-* ведут камеру, а не прыгают: на них ссылаются навигация,
     письма и UTM-ссылки — они обязаны работать. */
  document.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el || !el.classList.contains('act')) return;
    e.preventDefault();
    camera.scrollToAct(el.dataset.act || id, reduced ? 'auto' : 'smooth');
    history.replaceState(null, '', '#' + id);
  });

  resize();
  start();
  window.SBF_STAGE = { camera: camera, mark: mark, acts: ACTS,
                       start: start, stop: stop, resize: resize };
}

document.documentElement.classList.remove('no-js');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

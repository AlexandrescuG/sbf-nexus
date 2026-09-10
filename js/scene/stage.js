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
  let frameMs = 8, overBudget = 0, dimAt = 0, colRect = null;
  let current = null;

  function resize() {
    view.w = layer.clientWidth;
    view.h = layer.clientHeight;
    /* Телефон — не «то же самое, но уже». Там вдвое меньше площади под
       сцену, вчетверо слабее процессор и батарея, которую мы тратим.
       Флаг идёт в акты: каждый сам решает, чем поступиться — числом
       свечей, числом нитей, шагом сетки. */
    view.mobile = view.w < 900;
    dpr = Math.min(view.mobile ? 1.5 : 2, window.devicePixelRatio || 1);
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
    /* Акт может обслуживать несколько секций (два раздела платформы —
       один модуль). Кладём id секции на body: и акту видно, и в вёрстке
       можно зацепиться, и в отладке сразу понятно, где камера. */
    if (cam.section && document.body.dataset.sceneSection !== cam.section) {
      document.body.dataset.sceneSection = cam.section;
    }

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

    /* На узком экране знак закреплён, а колонка едет мимо — встретиться они
       обязаны, это геометрия, а не недосмотр вёрстки. Спор решается в пользу
       текста: пока колонка проходит через кольцо, знак приглушается. На
       десктопе такого не бывает — там у знака свой коридор.

       Прямоугольник колонки читаем пять раз в секунду, а не в каждом кадре:
       getBoundingClientRect во время прокрутки заставляет считать раскладку. */
    view.markDim = 1;
    if (view.mobile) {
      dimAt -= view.dt;
      if (dimAt <= 0) {
        const col = document.querySelector('#' + cam.section + ' .act-col');
        colRect = col ? col.getBoundingClientRect() : null;
        dimAt = 0.2;
      }
      if (colRect) {
        const g = mark.geometry(view);
        const dy = Math.max(0, Math.max(colRect.top - (g.cy + g.r),
                                        (g.cy - g.r) - colRect.bottom));
        view.markDim = Math.max(0.18, Math.min(1, dy / 60));
      }
    }

    ctx.clearRect(0, 0, view.w, view.h);
    /* Знак — в два слоя, между ними акты: глиф снизу, кольцо сверху.
       Так лента свечей идёт сквозь знак, а не загораживается им. */
    mark.renderGlyph(ctx, view);
    for (let i = 0; i < cam.blend.length; i++) {
      const b = cam.blend[i];
      const act = ACTS[b.act];
      if (act && act.render) act.render(ctx, view, b, mark);
    }
    mark.renderRing(ctx, view);

    /* ── Бюджет кадра ───────────────────────────────────── */
    frameMs += (performance.now() - t0 - frameMs) * 0.1;
    if (frameMs > BUDGET_MS) {
      overBudget += view.dt;
      if (overBudget > 2 && dpr > 1) { dpr = 1; resize(); overBudget = 0; }
      else if (overBudget > 4 && !view.simple) { view.simple = true; overBudget = 0; }
    } else {
      overBudget = Math.max(0, overBudget - view.dt);
    }

    /* Один объект на всю жизнь страницы, а не новый каждый кадр: шестьдесят
       объектов в секунду — это работа для сборщика мусора, которая потом
       вылезает рывком в самом неподходящем месте. */
    const st = window.SBF_SCENE || (window.SBF_SCENE = {});
    st.act = cam.act; st.section = cam.section; st.t = cam.t;
    st.ms = frameMs; st.fps = Math.round(1000 / Math.max(frameMs, 1));
    st.simple = view.simple; st.dpr = dpr; st.mobile = view.mobile;
    st.markDim = view.markDim;
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

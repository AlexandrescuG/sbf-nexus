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
import { initTicker } from './ticker.js';
import { createLabels } from './labels.js';

const BUDGET_MS = 16;

function boot() {
  const layer = document.querySelector('.scene-layer');
  if (!layer) return;

  const cv = document.createElement('canvas');
  layer.appendChild(cv);
  const ctx = cv.getContext('2d');

  const camera = createCamera();
  const mark = createMark();
  /* Общий слой подписей: акт в каждом кадре объявляет, что нарисовал и
     как это называется. Линия без имени — украшение, а не смысл. */
  const labels = createLabels(layer);
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
    /* На телефоне рисуем в одну точку на пиксель CSS. Проверено заменой:
       на просадку кадра размер холста почти не влиял (виноват был разговор
       с DOM в каждом кадре, см. labels.js и placeMarkLink), но запас по
       слабым телефонам лишним не будет — линии сцены тонкие и однотонные,
       разница в резкости на глаз почти не видна. */
    dpr = Math.min(view.mobile ? 1 : 2, window.devicePixelRatio || 1);
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

    /* ── Тон мира ────────────────────────────────────────────
       На живом сайте финал тёмный, и это правильно: контакты — конец пути,
       вечер после дня. В гобелене не может быть «другого фона у секции», но
       может быть время суток: тон мира ведёт та же камера. Светлый день на
       первых актах, сумерки к финалу.

       Текст переключается вместе с фоном (body[data-dark]) — иначе тёмная
       страница осталась бы с тёмными буквами. */
    const darkness = cam.act === 'globe' ? smoothstep(cam.t / 0.35) : 0;
    if (darkness !== view.dark) {
      view.dark = darkness;
      const flag = darkness > 0.55 ? '1' : '0';
      if (document.body.dataset.dark !== flag) document.body.dataset.dark = flag;
    }
    /* Какой акт сейчас — знает сцена, а нужно это и вёрстке: в финале, где
       у акта своя кнопка заявки, плавающая кнопка прячется. Пишем в body
       только на смене, а не каждый кадр. */
    if (document.body.dataset.act !== cam.act) {
      document.body.dataset.act = cam.act;
    }
    /* Цвет фона нужен не только для заливки: акты, которым надо растворить
       свой край, красят по нему градиент. Без этого каждый акт заводил бы
       свою копию числа — тот самый дубль, из-за которого знак когда-то
       наехал на текст. */
    view.bg = mix([251, 246, 239], [10, 8, 14], darkness);
    ctx.fillStyle = view.bg;
    ctx.fillRect(0, 0, view.w, view.h);
    labels.begin();
    /* Знак — в два слоя, между ними акты: глиф снизу, кольцо сверху.
       Так лента свечей идёт сквозь знак, а не загораживается им.

       Исключение одно и оно осмысленное: в финале знак — центр шара, а не
       подложка под ним. Под тёмным непрозрачным шаром глиф читался как
       дыра. Акт просит об этом сам (markOnTop), заодно задавая свой размер:
       на живом сайте диск знака занимает примерно восьмую часть шара, а
       кольцо в полный рост перекрыло бы половину. */
    const lead = ACTS[cam.act];
    view.markScale = (lead && lead.markScale) || 1;
    view.markCy = lead && lead.markCy;
    /* Скорость прокрутки нужна не только камере: акт может решить не
       делать дорогую работу, пока страница летит под пальцем. */
    view.speed = cam.speed;
    const onTop = !!(lead && lead.markOnTop);
    if (!onTop) mark.renderGlyph(ctx, view);
    for (let i = 0; i < cam.blend.length; i++) {
      const b = cam.blend[i];
      const act = ACTS[b.act];
      if (act && act.render) act.render(ctx, view, b, mark, labels);
    }
    if (onTop) mark.renderGlyph(ctx, view);
    mark.renderRing(ctx, view);
    labels.end();
    placeMarkLink(ACTS[cam.act], mark.geometry(view));

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
    st.acts = ACTS;              /* инструментам нужен доступ к внутренностям акта */
    st.act = cam.act; st.section = cam.section; st.t = cam.t;
    st.ms = frameMs; st.fps = Math.round(1000 / Math.max(frameMs, 1));
    st.simple = view.simple; st.dpr = dpr; st.mobile = view.mobile;
    st.markDim = view.markDim;
    if (debug) hud(cam);
  }

  /* Знак нарисован на холсте, а по холсту не кликают. Там, где знак — дверь
     (акты «поток» и «терминал»), поверх него лежит настоящая ссылка: без неё
     повторилась бы прошлая история, когда подпись обещала «нажмите на знак»,
     а клик ничего не делал. Ссылка появляется только у тех актов, где у знака
     действительно есть куда вести. */
  let linkEl = null, linkShown = false, linkBox = [0, 0, 0];
  function placeMarkLink(act, g) {
    const href = act && act.link;
    if (!linkEl) {
      linkEl = document.createElement('a');
      linkEl.className = 'mark-link';
      linkEl.target = '_blank';
      linkEl.rel = 'noopener';
      layer.appendChild(linkEl);
    }
    if (!href) {
      if (linkShown) { linkEl.style.display = 'none'; linkShown = false; }
      return;
    }
    if (!linkShown) { linkEl.style.display = 'block'; linkShown = true; }
    if (linkEl.getAttribute('href') !== href) {
      linkEl.setAttribute('href', href);
      linkEl.setAttribute('aria-label', act.linkLabel || 'Открыть платформу');
      if (act.linkTrack) linkEl.dataset.track = act.linkTrack;
    }
    /* Геометрию пишем только при изменении: четыре записи в стиль каждый
       кадр — это четыре пересчёта раскладки, и на телефоне они стоили
       больше, чем вся отрисовка сцены. Знак стоит на месте почти всегда. */
    const L = Math.round(g.cx - g.r), T = Math.round(g.cy - g.r),
          S = Math.round(g.r * 2);
    if (linkBox[0] !== L || linkBox[1] !== T || linkBox[2] !== S) {
      linkBox = [L, T, S];
      linkEl.style.left = L + 'px';
      linkEl.style.top = T + 'px';
      linkEl.style.width = linkEl.style.height = S + 'px';
    }
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
  initTicker();
  start();
  window.SBF_STAGE = { camera: camera, mark: mark, acts: ACTS,
                       start: start, stop: stop, resize: resize };
}

function smoothstep(x) {
  x = x < 0 ? 0 : (x > 1 ? 1 : x);
  return x * x * (3 - 2 * x);
}
function mix(a, b, k) {
  return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' +
                  Math.round(a[1] + (b[1] - a[1]) * k) + ',' +
                  Math.round(a[2] + (b[2] - a[2]) * k) + ')';
}

document.documentElement.classList.remove('no-js');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

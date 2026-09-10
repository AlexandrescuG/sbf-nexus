/* mark.js — знак внутри сцены.

   Грамматика прежняя: знак — процессор, у него одна роль в каждый момент —
   принимает, обрабатывает, выдаёт. Новое здесь одно: роль меняется не
   ступенькой на границе секций, а плавно вместе с камерой.

   Где знак может находиться, решает не этот файл, а переменные коридора в
   css/scene.css. Читаем их оттуда, а не дублируем числа: ровно из-за такого
   дубля в первой версии сайта общий логотип наезжал на текст. */

const ROLES = {
  intake:  { ring: 0.28, label: 'принимает' },
  process: { ring: 0.62, label: 'обрабатывает' },
  output:  { ring: 1.00, label: 'выдаёт' },
};

export function createMark() {
  const img = new Image();
  let ready = false;
  img.onload = function () { ready = true; };
  img.onerror = function () { console.warn('[scene] знак не загрузился'); };
  img.src = '/assets/logo/logo.svg';

  let role = 'intake', fill = 0, target = 0;

  function corridor(view) {
    const css = getComputedStyle(document.documentElement);
    const x = parseFloat(css.getPropertyValue('--corridor-x')) || 0.7;
    const w = parseFloat(css.getPropertyValue('--corridor-w')) || 0.34;
    return { cx: view.w * x, halfW: view.w * w / 2 };
  }

  /* Размер знака — от ширины коридора, а не от ширины окна: коридор и есть
     то место, которое знаку выделено. */
  function geometry(view) {
    const c = corridor(view);
    const r = Math.min(c.halfW * 0.62, view.h * 0.19);
    const cy = view.w <= 900 ? view.h * 0.22 : view.h * 0.5;
    return { cx: c.cx, cy: cy, r: r, corridor: c };
  }

  function setRole(next) {
    if (!ROLES[next]) return;
    role = next;
    target = ROLES[next].ring;
  }

  function render(ctx, view, cam) {
    const g = geometry(view);
    /* Кольцо догоняет роль, а не прыгает в неё: смена роли — это процесс,
       и на непрерывном холсте ступенька читается как сбой. */
    fill += (target - fill) * Math.min(1, view.dt * 3);

    ctx.save();
    ctx.globalAlpha = 1;

    /* Ободок */
    ctx.strokeStyle = 'rgba(201,162,39,0.30)';
    ctx.lineWidth = Math.max(1.5, g.r * 0.012);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2); ctx.stroke();

    /* Заполнение по роли */
    ctx.strokeStyle = '#C9A227';
    ctx.lineWidth = Math.max(2, g.r * 0.028);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
    ctx.stroke();
    ctx.lineCap = 'butt';

    if (ready) {
      const w = g.r * 1.18, h = w * ((img.naturalHeight / img.naturalWidth) || 1);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(img, g.cx - w / 2, g.cy - h / 2, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return g;
  }

  return { render: render, setRole: setRole, geometry: geometry,
           get role() { return role; } };
}

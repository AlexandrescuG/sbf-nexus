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
    /* На узком экране знак стоит НАД колонкой, и его нижний край должен
       оставаться выше первой строки текста. 0.22 высоты давали кольцо,
       которое ложилось на заголовок: 0.17 плюс отступ колонки в 30vh
       разводят их с запасом. Проверяется автоматически, tools/scene-probe.py */
    const cy = view.w <= 900 ? view.h * 0.17 : view.h * 0.5;
    return { cx: c.cx, cy: cy, r: r, corridor: c };
  }

  function setRole(next) {
    if (!ROLES[next]) return;
    role = next;
    target = ROLES[next].ring;
  }

  /* Знак рисуется в два захода, между ними — акты.

     Иначе не получается главного: лента свечей должна идти СКВОЗЬ знак, а
     не за ним и не перед ним. Когда знак рисовался одним куском поверх
     всего, он просто закрывал ленту — и «обрабатывает» превращалось в
     «загораживает». Теперь глиф ложится под акт, кольцо — поверх: кольцо и
     есть линза, а внутри неё видно то, что делает акт. */
  function renderGlyph(ctx, view) {
    const g = geometry(view);
    if (!ready) return g;
    /* Масштаб отрисовки не меняет геометрию: акты считают по ней раскладку
       (коридор, ширину ленты), и «знак стал меньше» не должно означать
       «коридор стал уже». Уменьшается только то, что видно. */
    const s = view.markScale || 1;
    const w = g.r * 1.18 * s, h = w * ((img.naturalHeight / img.naturalWidth) || 1);
    ctx.save();
    /* Под лентой знак приглушён: он подложка, а не картинка поверх.
       markDim — уступка тексту на узком экране, см. stage.js.
       На тёмном финале знак, наоборот, выходит вперёд: там он не подложка,
       а центр шара — как на живом сайте. */
    const dark = view.dark || 0;
    ctx.globalAlpha = (0.42 + dark * 0.5) * (view.markDim == null ? 1 : view.markDim);
    ctx.drawImage(img, g.cx - w / 2, g.cy - h / 2, w, h);
    ctx.restore();
    return g;
  }

  function renderRing(ctx, view) {
    const g = geometry(view);
    /* Кольцо догоняет роль, а не прыгает в неё: смена роли — это процесс,
       и на непрерывном холсте ступенька читается как сбой. */
    fill += (target - fill) * Math.min(1, view.dt * 3);
    const s = view.markScale || 1;
    const r = g.r * s;

    ctx.save();
    ctx.globalAlpha = view.markDim == null ? 1 : view.markDim;
    ctx.strokeStyle = 'rgba(201,162,39,0.30)';
    ctx.lineWidth = Math.max(1.5, r * 0.012);
    ctx.beginPath(); ctx.arc(g.cx, g.cy, r, 0, Math.PI * 2); ctx.stroke();

    ctx.strokeStyle = '#C9A227';
    ctx.lineWidth = Math.max(2, r * 0.028);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill);
    ctx.stroke();
    ctx.restore();
    return g;
  }

  return { renderGlyph: renderGlyph, renderRing: renderRing,
           setRole: setRole, geometry: geometry,
           get role() { return role; } };
}

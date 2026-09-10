/* stub.js — заготовка акта.

   Этап 1 плана — каркас: камера должна ехать, акты сменяться, текст
   читаться. Содержимое актов переезжает на этапах 2–6, каждый в свой файл.

   Пока акт не написан, он не рисует ничего. Это осознанно: подставить
   «что-нибудь красивое на время» — верный способ оставить это навсегда и
   нарушить второй ограничитель плана (ни одной анимации без причины).
   Увидеть, что камера работает, можно и без картинки — через ?debug=1. */

export function makeStub(id, role, note) {
  let entered = false;
  return {
    id: id,
    role: role,
    note: note,                       /* что здесь появится; видно в HUD */
    enter: function () { entered = true; },
    leave: function () { entered = false; },
    render: function (ctx, view, cam) {
      if (!view.debug) return;
      /* Отладочная полоса: показывает вес акта в смеси, чтобы переход
         между соседями был виден глазом. В обычном режиме её нет. */
      const y = view.h - 34;
      ctx.save();
      ctx.globalAlpha = 0.25 + cam.w * 0.55;
      ctx.fillStyle = '#C9A227';
      ctx.fillRect(view.w * 0.06, y, (view.w * 0.88) * cam.t, 3);
      ctx.globalAlpha = 1;
      ctx.restore();
    },
    get entered() { return entered; },
  };
}

/**
 * act5-contact.js — финал: знак-узел в центре глобуса.
 *
 * Роль знака здесь — «выдаёт»: из него расходятся нити к четырём
 * филиалам, а когда уходит заявка, кольцо идёт вместе с запросом и
 * вспыхивает на успехе. Раньше этот файл гонял скрытый #sbf-logo по дуге
 * в угол — тот знак больше не показывается, код снят.
 *
 * События:
 *   mark:visible   (logo.js)     — рисуем нити, кольцо заполняется
 *   lead:sending   (lead-modal)  — кольцо сбрасывается и ползёт к 0.85
 *   lead:sent                    — кольцо замыкается, вспышка, нити мигают
 *   lead:failed                  — кольцо возвращается в полное «спокойное»
 */
(function () {
  'use strict';

  const section = document.getElementById('act-contact');
  if (!section) return;

  const mark   = section.querySelector('.contact-hub');
  const svg    = section.querySelector('.contact-threads');
  const cards  = Array.from(section.querySelectorAll('.finale-top .branch-card'));
  const logo   = () => window.SBF && window.SBF.logo;

  section.querySelector('[data-open-modal]')?.addEventListener('click', () => {
    window.leadModal?.open();
  });

  if (!mark || !svg || !logo()) return;

  /* ── Нити ─────────────────────────────────────────────────────────── */
  const NS = 'http://www.w3.org/2000/svg';
  let lines = [];

  function layout() {
    const sr = section.getBoundingClientRect();
    const mr = mark.getBoundingClientRect();
    if (!mr.width || getComputedStyle(mark).display === 'none') { svg.innerHTML = ''; lines = []; return; }
    svg.setAttribute('viewBox', `0 0 ${sr.width} ${sr.height}`);
    const cx = mr.left - sr.left + mr.width / 2;
    const cy = mr.top  - sr.top  + mr.height / 2;
    const R  = mr.width * 0.77;                 /* радиус кольца (r=46 в svg с inset -34%) */

    svg.innerHTML = '';
    lines = cards.map(card => {
      const cr = card.getBoundingClientRect();
      if (!cr.width) return null;
      const left = cr.left + cr.width / 2 < mr.left + mr.width / 2;
      const tx = (left ? cr.right : cr.left) - sr.left;
      const ty = cr.top - sr.top + cr.height / 2;
      const ang = Math.atan2(ty - cy, tx - cx);
      const sx = cx + Math.cos(ang) * R, sy = cy + Math.sin(ang) * R;
      /* Лёгкая дуга, чтобы нить не резала глобус по прямой */
      const mx = (sx + tx) / 2, my = (sy + ty) / 2 - Math.abs(tx - sx) * 0.08;
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', `M${sx.toFixed(1)},${sy.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`);
      p.setAttribute('class', 'thread');
      svg.appendChild(p);
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('cx', tx.toFixed(1)); dot.setAttribute('cy', ty.toFixed(1)); dot.setAttribute('r', '2.5');
      dot.setAttribute('class', 'thread-end');
      svg.appendChild(dot);
      const len = p.getTotalLength();
      p.style.strokeDasharray = len;
      p.style.strokeDashoffset = len;
      return p;
    }).filter(Boolean);
  }

  function draw() {
    lines.forEach((p, i) => {
      p.style.transition = 'none';
      p.style.strokeDashoffset = p.style.strokeDasharray;
      void p.getBoundingClientRect();
      p.style.transition = `stroke-dashoffset 0.9s cubic-bezier(0.22, 0.61, 0.36, 1) ${0.15 + i * 0.12}s`;
      p.style.strokeDashoffset = '0';
    });
    svg.classList.add('threads-on');
  }

  /* ── Кольцо ────────────────────────────────────────────────────────── */
  let shown = false;
  mark.addEventListener('mark:visible', () => {
    shown = true;
    layout();
    logo().setState(mark, { part: 1 });
    draw();
  });

  window.addEventListener('resize', () => { if (shown) { layout(); draw(); } });
  document.addEventListener('sbf:langchange', () => { if (shown) setTimeout(() => { layout(); draw(); }, 50); });

  /* Заявка. Пока идёт запрос — кольцо ползёт к 0.85 и ждёт; ответ его
     замыкает (успех) или возвращает к спокойному полному (ошибка). */
  document.addEventListener('lead:sending', () => {
    logo().setState(mark, { part: 0, animate: false });
    requestAnimationFrame(() => logo().setState(mark, { part: 0.85 }));
    mark.classList.add('hub-sending');
  });
  document.addEventListener('lead:sent', () => {
    mark.classList.remove('hub-sending');
    logo().setState(mark, { part: 1, pulse: true });
    svg.classList.remove('threads-flash'); void svg.getBoundingClientRect();
    svg.classList.add('threads-flash');
  });
  document.addEventListener('lead:failed', () => {
    mark.classList.remove('hub-sending');
    logo().setState(mark, { part: 1 });
  });

  window.SBF = window.SBF || {};
  window.SBF.contact = { layout, draw };
})();

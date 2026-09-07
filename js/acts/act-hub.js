/**
 * act-hub.js — второй экран, «Что выходит из шума».
 *
 * Задача одна: связать логотип с карточками так, чтобы он читался как
 * источник, а не как фон. Наводишь на карточку — подсвечивается нить,
 * идущая к ней от знака. Сам знак кликабелен и ведёт на платформу
 * (обработчик живёт в main.js), здесь — только подсказка и подсветка.
 */
(function () {
  'use strict';

  var section = document.getElementById('act-grow');
  if (!section) return;

  var cards = section.querySelectorAll('.hub-card[data-thread]');
  var lines = section.querySelectorAll('.thread-line[data-thread]');

  /* Нити рисуем от знака к карточкам по фактическим прямоугольникам.
     Знак теперь принадлежит секции (.sect-mark) и лежит в потоке —
     раньше здесь был общий fixed-логотип, и нити приходилось тянуть
     к точке, которая жила в координатах вьюпорта. */
  function drawThreads() {
    var svg = section.querySelector('.forecasts-threads');
    var logo = section.querySelector('.sect-mark');
    if (!svg || !logo) return;
    var sr = section.getBoundingClientRect();
    if (!sr.width) return;
    svg.setAttribute('viewBox', '0 0 ' + Math.round(sr.width) + ' ' + Math.round(sr.height));

    var lr = logo.getBoundingClientRect();
    var cx = lr.left + lr.width / 2 - sr.left;
    var cy = lr.top + lr.height / 2 - sr.top;

    cards.forEach(function (card) {
      var line = section.querySelector('.thread-line[data-thread="' + card.dataset.thread + '"]');
      if (!line) return;
      var r = card.getBoundingClientRect();
      line.setAttribute('x1', cx.toFixed(1));
      line.setAttribute('y1', cy.toFixed(1));
      line.setAttribute('x2', (r.left + r.width / 2 - sr.left).toFixed(1));
      line.setAttribute('y2', (r.top + r.height / 2 - sr.top).toFixed(1));
    });
  }

  function highlight(id) {
    lines.forEach(function (l) {
      l.classList.toggle('thread-hot', !!id && l.dataset.thread === id);
    });
  }

  cards.forEach(function (card) {
    var id = card.dataset.thread;
    card.addEventListener('mouseenter', function () { highlight(id); });
    card.addEventListener('mouseleave', function () { highlight(null); });
    /* Клавиатура: карточка — не ссылка, но нить должна отзываться и на фокус */
    card.setAttribute('tabindex', '0');
    card.addEventListener('focus', function () { highlight(id); });
    card.addEventListener('blur',  function () { highlight(null); });
  });

  /* Наведение на сам знак зажигает все четыре нити разом:
     видно, что они выходят именно из него. */
  var logo = section.querySelector('.sect-mark');
  if (logo) {
    logo.addEventListener('mouseenter', function () {
      if (!document.body.classList.contains('act-act-grow-active')) return;
      lines.forEach(function (l) { l.classList.add('thread-hot'); });
    });
    logo.addEventListener('mouseleave', function () { highlight(null); });
  }

  /* Уходим с экрана — гасим, иначе подсветка останется на следующем */
  section.addEventListener('snap-leave', function () { highlight(null); });

  /* ── Улики в карточках ────────────────────────────────────────────────
     Карточка «заголовок + одна фраза» ничем не отличается от описания у
     любого конкурента. Здесь в каждую подставляется сегодняшний материал
     платформы: заголовок брифа и ближайшие события, ход инструмента со
     спарклайном, паттерн с посчитанной долей срабатываний, строка журнала.
     Данные — те же, что кормят первый экран (hero-feed.json, крон /15). */
  var GROW = null;

  function lang() { return (window.i18n && window.i18n.getLang && window.i18n.getLang()) || 'ru'; }
  function T(k) { return (window.i18n && window.i18n.t) ? window.i18n.t(k) : ''; }
  function loc(v) { return (v && typeof v === 'object') ? (v[lang()] || v.ru || v.en || '') : (v || ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function hhmm(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleTimeString(lang() === 'en' ? 'en-GB' : (lang() === 'ro' ? 'ro-RO' : 'ru-RU'),
                                                { hour: '2-digit', minute: '2-digit' });
  }

  /* Спарклайн: 24 часовых закрытия. SVG, а не canvas — масштабируется
     вместе с карточкой и не требует пересчёта при resize. */
  function sparkline(values) {
    if (!values || values.length < 4) return '';
    var w = 150, h = 38, lo = Math.min.apply(null, values), hi = Math.max.apply(null, values);
    var rng = (hi - lo) || 1;
    var pts = values.map(function (v, i) {
      return (i / (values.length - 1) * w).toFixed(1) + ',' + (h - (v - lo) / rng * h).toFixed(1);
    }).join(' ');
    var up = values[values.length - 1] >= values[0];
    return '<svg class="proof-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">'
         + '<polyline points="' + pts + '" class="' + (up ? 'up' : 'dn') + '"/></svg>';
  }

  function fillProofs() {
    if (!GROW) return;
    section.querySelectorAll('.hub-proof').forEach(function (host) {
      var kind = host.dataset.proof, html = '';

      if (kind === 'brief' && GROW.brief) {
        var b = GROW.brief;
        var rows = (b.events || []).map(function (e) {
          return '<li><i>' + esc(hhmm(e.ts_utc)) + '</i> ' + esc(loc(e.country)) + ' · '
               + esc(loc(e.title)) + '</li>';
        }).join('');
        html = (b.headline ? '<p class="proof-head">' + esc(b.headline) + '</p>' : '')
             + (rows ? '<ul class="proof-list">' + rows + '</ul>' : '')
             + '<p class="proof-note">' + esc(T('grow.p_brief_note')) + '</p>';
      }

      if (kind === 'mover' && GROW.mover) {
        var m = GROW.mover, up = (m.chg_pct || 0) >= 0;
        html = '<div class="proof-row"><b>' + esc(m.symbol) + '</b>'
             + '<span class="' + (up ? 'up' : 'dn') + '">' + (up ? '+' : '') + esc(m.chg_pct) + '%</span></div>'
             + sparkline(m.spark)
             + '<p class="proof-note">' + esc(T('grow.p_mover_note').replace('{d}', m.date || '')) + '</p>';
      }

      if (kind === 'pattern' && GROW.pattern) {
        var p = GROW.pattern;
        var share = p.share != null ? Math.round(p.share * 100) : null;
        html = '<div class="proof-chip">' + esc(p.name_ru) + ' · ' + esc(p.symbol) + ' ' + esc(p.tf) + '</div>'
             + (share != null
                ? '<p class="proof-note">' + esc(T('grow.p_pattern_note')
                    .replace('{p}', share).replace('{n}', p.n || '')) + '</p>'
                : '');
      }

      if (kind === 'journal') {
        /* Пример записи, а не чей-то результат: показываем формат строки */
        html = '<div class="proof-journal">'
             + '<span>12.05</span><b>XAUUSD</b><span class="dir">long</span>'
             + '<span>' + esc(T('grow.p_j_risk')) + ' 0.5%</span><span class="up">+1.8R</span></div>'
             + '<p class="proof-note">' + esc(T('grow.p_j_note')) + '</p>';
      }

      host.innerHTML = html;
    });
  }

  fetch('/hero-feed.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { GROW = (d && d.grow) || null; fillProofs(); })
    .catch(function () { /* нет данных — карточки остаются с описаниями */ });

  document.addEventListener('sbf:langchange', fillProofs);

  /* Знак переезжает по ролям, окно меняет размер — нити пересчитываем */
  section.addEventListener('snap-enter', function () { setTimeout(drawThreads, 750); });
  window.addEventListener('resize', drawThreads);
  window.addEventListener('load', drawThreads);
  drawThreads();
})();

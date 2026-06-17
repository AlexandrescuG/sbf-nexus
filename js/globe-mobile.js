/**
 * globe-mobile.js — лёгкий Canvas 2D глобус для мобильных.
 * SVG-карта + меридианы, авторотация, без драга.
 */
(function () {
  'use strict';

  if (window.innerWidth >= 768) return;

  var mask = document.querySelector('.globe-mask');
  if (!mask) return;

  var dpr  = Math.min(window.devicePixelRatio || 1, 2);
  var SIZE = mask.offsetWidth || 280;
  var S    = SIZE * dpr;
  var R    = S / 2;

  var canvas = document.createElement('canvas');
  canvas.width  = S;
  canvas.height = S;
  canvas.style.cssText = 'width:100%;height:100%;display:block;';
  mask.innerHTML = '';
  mask.appendChild(canvas);

  var ctx = canvas.getContext('2d');

  /* Фон пока грузится SVG */
  ctx.beginPath();
  ctx.arc(R, R, R, 0, Math.PI * 2);
  ctx.fillStyle = '#07060c';
  ctx.fill();

  var shiftX  = 0;
  var SPEED   = 0.18 * dpr; // px/frame ≈ ~40 сек полный оборот
  var mapW    = S * 2;      // equirectangular: ширина = 2 × высота
  var raf     = null;
  var mapImg  = null;

  /* ── Построить оффскрин-карту из SVG ────────────────────── */
  function buildMap(svgText) {
    var modified = svgText.replace(/(<svg[^>]*)>/, '$1 preserveAspectRatio="none">');
    var blob = new Blob([modified], { type: 'image/svg+xml' });
    var url  = URL.createObjectURL(blob);
    var img  = new Image();

    img.onload = function () {
      URL.revokeObjectURL(url);

      /* Рисуем SVG в оффскрин-холст фиксированного размера */
      var off   = document.createElement('canvas');
      off.width  = mapW;
      off.height = S;
      var octx  = off.getContext('2d');
      octx.drawImage(img, 0, 0, mapW, S);
      mapImg = off;

      startAnimation();
    };

    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ── Кадр анимации ──────────────────────────────────────── */
  function drawFrame() {
    raf = requestAnimationFrame(drawFrame);

    ctx.clearRect(0, 0, S, S);
    ctx.save();

    /* Круговой клип */
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.clip();

    /* Фон */
    ctx.fillStyle = '#07060c';
    ctx.fillRect(0, 0, S, S);

    /* Карта (дважды для бесшовного оборота) */
    var x = -((shiftX % mapW + mapW) % mapW);
    if (mapImg) {
      ctx.drawImage(mapImg, x,        0, mapW, S);
      ctx.drawImage(mapImg, x + mapW, 0, mapW, S);
    }

    /* ── Меридианы (каждые 20°) ──────────────────────────── */
    ctx.strokeStyle = 'rgba(201,162,39,0.28)';
    ctx.lineWidth   = 0.7 * dpr;
    for (var lng = 0; lng < 18; lng++) {
      var lx = ((lng / 18) * mapW - (shiftX % mapW) + mapW) % mapW;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, S); ctx.stroke();
      /* правый дубль для wrap */
      if (lx < S) {
        ctx.beginPath(); ctx.moveTo(lx + mapW, 0); ctx.lineTo(lx + mapW, S); ctx.stroke();
      }
    }

    /* ── Параллели (каждые 20°) ──────────────────────────── */
    for (var lat = 1; lat < 9; lat++) {
      var ly = S * lat / 9;
      ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(S, ly); ctx.stroke();
    }

    /* ── Сферическое затенение (виньетка) ────────────────── */
    var grad = ctx.createRadialGradient(R * 1.15, R * 0.72, 0, R, R, R);
    grad.addColorStop(0,   'rgba(0,0,0,0)');
    grad.addColorStop(0.55,'rgba(0,0,0,0.04)');
    grad.addColorStop(0.80,'rgba(0,0,0,0.28)');
    grad.addColorStop(1,   'rgba(0,0,0,0.72)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, S, S);

    ctx.restore();

    shiftX += SPEED;
  }

  function startAnimation() {
    if (raf) return;
    drawFrame();
  }

  function stopAnimation() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  /* ── Пауза когда секция не видна ────────────────────────── */
  var section = document.getElementById('act-contact');
  if (section) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { startAnimation(); }
      else { stopAnimation(); }
    }, { threshold: 0.1 });
    io.observe(section);
  }

  /* ── Загрузка SVG ────────────────────────────────────────── */
  fetch('assets/finale/world-map.svg')
    .then(function (r) { return r.text(); })
    .then(buildMap)
    .catch(function () { startAnimation(); }); // показать хотя бы тёмный круг

})();

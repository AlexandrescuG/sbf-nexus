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

  /* ── Точки: офисы и гео-лента ────────────────────────────
     Тот же язык, что на большом глобусе: золото — четыре наших адреса,
     холодная точка со вспышкой — новость из ленты. Карта здесь плоская и
     едет по кругу, поэтому координата считается прямо в пикселях полотна. */
  var OFFICES = [
    { lon:  8.42, lat: 47.28 }, { lon: -9.14, lat: 38.72 },
    { lon: 28.86, lat: 47.01 }, { lon: 55.27, lat: 25.20 },
  ];
  var NEWS_SLOTS = 3;           /* телефон: три вспышки читаются, пять рябят */
  var geoPool = [], slots = [], prevT = 0;

  for (var si = 0; si < NEWS_SLOTS; si++) {
    slots.push({ point: null, t: 0, life: 0, wait: si * 1.1 });
  }

  function setPool(items) {
    geoPool = (items || []).filter(function (o) {
      return o && o.ll && typeof o.ll[0] === 'number' && typeof o.ll[1] === 'number';
    });
  }
  setPool(window.SBF_GEO_POINTS);
  document.addEventListener('sbf:geofeed', function (e) { setPool(e.detail); });

  /* Те же коэффициенты, что в globe3d.js: карта в world-map.svg занимает не
     весь viewBox, и по наивной формуле точка уезжает на 4° к северу и 14° к
     востоку. Подбор — tools/mapfit.html. */
  var TEX_U_K = 0.909747, TEX_U_B = 0.010172;
  var TEX_V_K = 0.905217, TEX_V_B = 0.041687;

  function mapY(lat) { return (TEX_V_K * (90 - lat) / 180 + TEX_V_B) * S; }
  /* Долгота с учётом прокрутки; возвращает ближайшую видимую копию точки */
  function mapX(lon) {
    var base = (TEX_U_K * (lon + 180) / 360 + TEX_U_B) * mapW;
    var x = ((base - (shiftX % mapW)) % mapW + mapW) % mapW;
    return x > S ? x - mapW : x;
  }

  function paintDot(lon, lat, color, r, alpha) {
    var x = mapX(lon), y = mapY(lat);
    if (x < -r || x > S + r) return null;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    return [x, y];
  }

  function stepNews(dt) {
    var taken = slots.map(function (s) { return s.point ? s.point.id : null; });
    slots.forEach(function (s) {
      if (!s.point) {
        s.wait -= dt;
        if (s.wait > 0) return;
        if (!geoPool.length) { s.wait = 1.5; return; }
        var p = null;
        for (var n = 0; n < 12 && !p; n++) {
          var c = geoPool[Math.floor(Math.random() * geoPool.length)];
          if (taken.indexOf(c.id) === -1) p = c;
        }
        if (!p) { s.wait = 1.2; return; }
        s.point = p; s.t = 0; s.life = 5.5 + Math.random() * 2.5;
        return;
      }
      s.t += dt;
      if (s.t >= s.life) {
        s.point = null;
        s.wait = 0.4 + Math.random() * 1.2;
      }
    });
  }

  function paintMarks() {
    OFFICES.forEach(function (o) {
      /* Тёмная подложка обязательна: суша на этой карте золотая, и золотая
         точка над Португалией просто исчезала. */
      var p = paintDot(o.lon, o.lat, 'rgba(8,6,12,0.62)', 6.5 * dpr, 1);
      if (!p) return;
      paintDot(o.lon, o.lat, '#FFE9A8', 3.2 * dpr, 0.98);
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#C9A227';
      ctx.lineWidth = 1.2 * dpr;
      ctx.beginPath(); ctx.arc(p[0], p[1], 6.5 * dpr, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    });

    slots.forEach(function (s) {
      if (!s.point) return;
      var u = s.t / s.life;
      var fade = Math.min(1, u / 0.14) * Math.min(1, (1 - u) / 0.18);
      var p = paintDot(s.point.ll[0], s.point.ll[1], '#BFD2E0', 2.2 * dpr, 0.62 * fade);
      if (!p) return;
      var r = Math.min(1, u / 0.45);
      if (r < 1) {
        ctx.globalAlpha = 0.5 * (1 - r) * Math.min(1, u / 0.1);
        ctx.strokeStyle = '#BFD2E0';
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.arc(p[0], p[1], (3 + r * 9) * dpr, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }

  /* ── Кадр анимации ──────────────────────────────────────── */
  function drawFrame(now) {
    raf = requestAnimationFrame(drawFrame);
    /* Клампим dt: метка rAF бывает раньше performance.now(), и без этого
       жизнь вспышки уходит в минус. */
    var dt = prevT ? Math.max(0, Math.min(0.05, (now - prevT) / 1000)) : 0;
    prevT = now;
    stepNews(dt);

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

    paintMarks();

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
    prevT = 0;
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

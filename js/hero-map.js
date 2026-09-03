/* hero-map.js — нити новостей на карте первого экрана.
   Лента: hero-feed.json (готовит hero-preview/build_feed.py),
   при её отсутствии — встроенные демо-строки. */
(function () {
  var stage = document.getElementById('hm-stage');
  var cv = document.getElementById('hm-cv');
  var ctx = cv.getContext('2d');
  var labelHost = document.getElementById('hm-labels');
  var W = 0, H = 0, world = null, graticule = null, proj = null, path = null;
  var core = [0, 0];
  var t = 0, last = performance.now(), flare = 0;
  var keep = [], active = 6, labelsOn = true, sc = 1;

  /* Логотип в центре карты рисует не канвас, а общий #sbf-logo:
     это один и тот же объект на всех экранах. Отсюда только сообщаем,
     куда его ставить — см. js/logo-roles.js. */
  function publishCore() {
    var r = cv.getBoundingClientRect();
    window.SBF_HERO_CORE = { x: r.left + core[0], y: r.top + core[1] };
    document.dispatchEvent(new CustomEvent('sbf:herocore'));
  }

  /* ————————————————————————————————————————————————
     ЛЕНТА НОВОСТЕЙ
     Источник задаётся тремя способами, в порядке приоритета:
       1) ?feed=https://... в адресе страницы
       2) window.SBF_FEED_URL = '...'  (объявить до этого скрипта)
       3) FEED_URL ниже
     Принимаются: RSS/Atom XML, либо JSON-массив вида
       [{ "title": "...", "tag": "Macro", "lon": 8.68, "lat": 50.1 }, ...]
     lon/lat необязательны — без них точка определяется по ключевым словам.
     Фид должен отдаваться с того же домена либо с заголовком
     Access-Control-Allow-Origin, иначе браузер его не прочитает.
     ———————————————————————————————————————————————— */
  var FEED_URL = '/hero-feed.json';
  var POLL_MS = 60000;

  var GEO = [
    [/\b(fed|fomc|powell|treasur|доллар|фрс)\b/i,            [-77.0, 38.9],  'Washington'],
    [/\b(spx|s&p|nasdaq|dow|wall street|nyse|equit)\b/i,     [-74.0, 40.7],  'New York'],
    [/\b(cme|chicago|futures|фьючерс)\b/i,                   [-87.6, 41.9],  'Chicago'],
    [/\b(ecb|euro|eur|frankfurt|lagarde|ецб|евро)\b/i,       [8.68, 50.1],   'Frankfurt'],
    [/\b(boe|gbp|london|ftse|sterling|фунт)\b/i,             [-0.13, 51.5],  'London'],
    [/\b(gold|xau|silver|xag|золот|серебр)\b/i,              [-0.13, 51.5],  'London'],
    [/\b(snb|chf|zurich|swiss)\b/i,                          [8.54, 47.4],   'Zurich'],
    [/\b(boj|jpy|yen|tokyo|nikkei|иена)\b/i,                 [139.7, 35.7],  'Tokyo'],
    [/\b(pboc|yuan|cny|china|shanghai|copper|медь|китай)\b/i,[121.5, 31.2],  'Shanghai'],
    [/\b(hkd|hong kong|hang seng)\b/i,                       [114.2, 22.3],  'Hong Kong'],
    [/\b(opec|oil|brent|wti|crude|нефт)\b/i,                 [55.3, 25.2],   'Dubai'],
    [/\b(rbi|inr|india|mumbai|индия)\b/i,                    [72.8, 19.1],   'Mumbai'],
    [/\b(sgd|singapore)\b/i,                                 [103.8, 1.35],  'Singapore'],
    [/\b(rba|aud|sydney|australia)\b/i,                      [151.2, -33.9], 'Sydney'],
    [/\b(brl|brazil|bovespa|бразил)\b/i,                     [-46.6, -23.5], 'Sao Paulo'],
    [/\b(mxn|mexico)\b/i,                                    [-99.1, 19.4],  'Mexico City'],
    [/\b(cad|canada|toronto)\b/i,                            [-79.4, 43.7],  'Toronto'],
    [/\b(zar|south africa|platinum|платин)\b/i,              [28.0, -26.2],  'Johannesburg'],
    [/\b(rub|moscow|росси|рубл)\b/i,                         [37.6, 55.7],   'Moscow'],
    [/\b(try|turkey|ankara|лира)\b/i,                        [32.9, 39.9],   'Ankara'],
    [/\b(eur\/usd|forex|fx|валютн)\b/i,                      [-9.14, 38.7],  'Lisbon'],
    [/\b(btc|eth|crypto|крипт)\b/i,                          [-118.2, 34.0], 'Los Angeles']
  ];
  var GEO_FALLBACK = [
    [-74.0, 40.7], [-0.13, 51.5], [8.68, 50.1], [139.7, 35.7], [55.3, 25.2],
    [121.5, 31.2], [151.2, -33.9], [-46.6, -23.5], [37.6, 55.7], [103.8, 1.35]
  ];

  /* Запасная лента — показывается, когда hero-feed.json недоступен.
     Три языка, потому что на карте не должно быть смеси. */
  var DEMO = [
    [{ru:'Голова и плечи',        en:'Head &amp; Shoulders',  ro:'Cap și umeri'},        {ru:'Медвежий',    en:'Bearish',     ro:'Ursesc'},       [-74.0, 40.7]],
    [{ru:'Бычий разворот',        en:'Bullish Reversal',      ro:'Revenire bullish'},    {ru:'Подтверждён', en:'Confirmed',   ro:'Confirmat'},    [151.2, -33.9]],
    [{ru:'ФРС снижает ставку',    en:'Fed Rate Cut',          ro:'Fed reduce dobânda'},  {ru:'Макро',       en:'Macro',       ro:'Macro'},        [-77.0, 38.9]],
    [{ru:'Сдвиг мировых рынков',  en:'Global Market Shift',   ro:'Schimbare globală'},   {ru:'Тревога',     en:'Alert',       ro:'Alertă'},       [-0.13, 51.5]],
    [{ru:'ЕЦБ сохранил ставку',   en:'ECB Rate Hold',         ro:'BCE menține dobânda'}, {ru:'Ставки',      en:'Rates',       ro:'Dobânzi'},      [8.68, 50.1]],
    [{ru:'Интервенция Банка Японии', en:'BOJ Intervention',   ro:'Intervenție BOJ'},     {ru:'USD/JPY 160', en:'USD/JPY 160', ro:'USD/JPY 160'},  [139.7, 35.7]],
    [{ru:'Дефицит меди',          en:'Copper Deficit',        ro:'Deficit de cupru'},    {ru:'Металлы',     en:'Metals',      ro:'Metale'},       [121.5, 31.2]],
    [{ru:'XAU $5,600',            en:'XAU $5,600',            ro:'XAU $5,600'},          {ru:'Золото',      en:'Gold',        ro:'Aur'},          [-0.13, 51.5]],
    [{ru:'Нефть +2.1%',           en:'Oil +2.1%',             ro:'Petrol +2.1%'},        {ru:'Поставки',    en:'Supply',      ro:'Ofertă'},       [55.3, 25.2]],
    [{ru:'SPX &minus;0.78%',      en:'SPX &minus;0.78%',      ro:'SPX &minus;0.78%'},    {ru:'Акции',       en:'Equities',    ro:'Acțiuni'},      [-74.0, 40.7]],
    [{ru:'Сжатие Боллинджера',    en:'Bollinger Squeeze',     ro:'Compresie Bollinger'}, {ru:'Волатильность', en:'Volatility', ro:'Volatilitate'},[8.54, 47.4]],
    [{ru:'Гэп и закрытие',        en:'Gap &amp; Fill',        ro:'Gap și umplere'},      {ru:'Форекс',      en:'FX',          ro:'Valutar'},      [-9.14, 38.7]],
    [{ru:'Симметричный треугольник', en:'Symmetric Triangle', ro:'Triunghi simetric'},   {ru:'Пробой',      en:'Breakout',    ro:'Străpungere'},  [103.8, 1.35]],
    [{ru:'Спрос на чипы Nvidia',  en:'Nvidia Chip Demand',    ro:'Cerere cipuri Nvidia'},{ru:'Технологии',  en:'Tech',        ro:'Tehnologie'},   [-118.2, 34.0]]
  ];

  var POOL = DEMO.map(function (d, i) { return { title: d[0], tag: d[1], ll: d[2], id: 'demo' + i }; });

  /* ── Язык подписей ────────────────────────────────────────────────────
     Пункт ленты хранит все три языка; на экран попадает текущий. */
  var LANGS = ['ru', 'en', 'ro'];

  function curLang() {
    var l = window.i18n && window.i18n.getLang ? window.i18n.getLang() : 'ru';
    return LANGS.indexOf(l) >= 0 ? l : 'ru';
  }

  /* Строка могла прийти как объект {ru,en,ro} или как один текст —
     из RSS, например. Второй случай отдаём как есть на любом языке. */
  function localized(v, lang) {
    if (v && typeof v === 'object') return v[lang] || v.en || v.ru || '';
    return v == null ? '' : String(v);
  }

  function renderLabel(s) {
    if (!s.el || !s.title) return;
    var lang = curLang();
    s.el.innerHTML = '<b>' + esc(trim(localized(s.title, lang), 34)) + '</b>'
                   + esc(trim(localized(s.tag, lang), 22));
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function trim(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:—-]+$/, '') + '…' : s;
  }
  function locate(text, i) {
    for (var g = 0; g < GEO.length; g++) if (GEO[g][0].test(text)) return { ll: GEO[g][1], place: GEO[g][2] };
    return { ll: GEO_FALLBACK[i % GEO_FALLBACK.length], place: '' };
  }
  function normalize(raw, i) {
    /* title и tag могут быть объектами {ru,en,ro} — их нельзя ни обрезать,
       ни экранировать здесь: это делает renderLabel уже на нужном языке. */
    var title = raw.title;
    var flat = localized(title, 'en') || localized(title, 'ru');
    if (!flat) return null;
    var hint = locate(flat + ' ' + localized(raw.tag, 'en') + ' ' + (raw.summary || ''), i);
    var ll = (typeof raw.lon === 'number' && typeof raw.lat === 'number') ? [raw.lon, raw.lat] : hint.ll;
    var tag = raw.tag || raw.category || hint.place || 'Live';
    return { title: title, tag: tag, ll: ll, id: raw.id || raw.link || flat };
  }

  function parseFeed(text, type) {
    var out = [];
    var trimmed = text.replace(/^\uFEFF/, '').trim();
    if (trimmed[0] === '[' || trimmed[0] === '{') {
      var data = JSON.parse(trimmed);
      var arr = Array.isArray(data) ? data : (data.items || data.entries || data.news || []);
      arr.forEach(function (o) { out.push({ title: o.title || o.headline || o.name, tag: o.tag || o.category || o.source, summary: o.summary || o.description, lon: o.lon, lat: o.lat, id: o.id || o.guid || o.link }); });
    } else {
      var doc = new DOMParser().parseFromString(trimmed, 'text/xml');
      var nodes = doc.querySelectorAll('item, entry');
      Array.prototype.forEach.call(nodes, function (n) {
        var g = function (sel) { var e = n.querySelector(sel); return e ? e.textContent : ''; };
        out.push({ title: g('title'), tag: g('category'), summary: g('description') || g('summary'), id: g('guid') || g('link') });
      });
    }
    return out;
  }

  var feedStatus = document.getElementById('hm-feed-status');
  function setStatus(txt, live) {
    if (!feedStatus) return;
    feedStatus.textContent = txt;
    feedStatus.dataset.live = live ? '1' : '0';
  }

  function loadFeed() {
    var url = new URLSearchParams(location.search).get('feed') || window.SBF_FEED_URL || FEED_URL;
    if (!url) { setStatus('Лента: демо-данные', false); return; }
    setStatus('Лента: подключение…', false);
    fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) {
        var items = parseFeed(txt).map(normalize).filter(Boolean);
        if (!items.length) throw new Error('пусто');
        POOL = items;
        usedNews = {};
        setStatus('Лента: в эфире · ' + items.length + ' событий', true);
        renderTicker();
      })
      .catch(function () {
        setStatus('Лента недоступна — демо-данные', false);
        renderTicker();   /* иначе в строке остался бы захардкоженный английский */
      });
  }

  var SLOTS = [], usedCity = {}, usedNews = {};
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeIn(x) { return x * x * x; }

  for (var i = 0; i < 6; i++) {
    var el = document.createElement('div');
    el.className = 'hm-lbl';
    labelHost.appendChild(el);
    SLOTS.push({ el: el, city: null, news: null, ll: null });
  }

  function reseed(s) {
    var nid, g2 = 0;
    do { nid = Math.floor(Math.random() * POOL.length); g2++; }
    while (g2 < 60 && (usedNews[nid] || usedCity[POOL[nid].ll.join(',')]));
    if (s.news != null && POOL[s.news]) { usedNews[s.news] = false; usedCity[POOL[s.news].ll.join(',')] = false; }
    if (s.city != null) usedCity[s.city] = false;
    var item = POOL[nid];
    usedNews[nid] = true; usedCity[item.ll.join(',')] = true;
    s.news = nid; s.city = item.ll.join(',');
    s.ll = item.ll;
    s.title = item.title; s.tag = item.tag;
    s.ph = Math.random() * 6.28;
    s.amp = 0.09 + Math.random() * 0.07;
    s.phase = 'wait'; s.time = 0; s.wait = 0.4 + Math.random() * 2.6;
    s.grow = 0; s.u = 1; s.alpha = 0; s.bloom = 0;
    renderLabel(s);
    project(s);
  }

  function project(s) {
    if (!proj || !s.ll) return;
    var p = proj(s.ll);
    s.tx = p[0]; s.ty = p[1];
    s.len = Math.hypot(s.tx - core[0], s.ty - core[1]) || 1;
    s.side = s.tx >= core[0] ? 'right' : 'left';
  }

  function fit() {
    W = cv.clientWidth; H = cv.clientHeight;
    if (!W || !H) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc = Math.max(0.42, Math.min(1, W / 1440));
    var stacked = W <= 1080;
    active = W < 620 ? 3 : (stacked ? 4 : 6);
    labelsOn = W >= 560;
    if (!world) return;

    var sr = stage.getBoundingClientRect();
    var k = sr.width ? stage.clientWidth / sr.width : 1;
    keep = [];
    var copyTop = H;
    ['.hm-copy', '.hm-side', '.hm-nav', '.hm-foot'].forEach(function (sel) {
      var n = stage.querySelector(sel);
      if (!n) return;
      var r = n.getBoundingClientRect();
      var box = {
        x0: (r.left - sr.left) * k - 14, y0: (r.top - sr.top) * k - 8,
        x1: (r.right - sr.left) * k + 14, y1: (r.bottom - sr.top) * k + 8
      };
      keep.push(box);
      if (sel === '.hm-copy' || sel === '.hm-side') copyTop = Math.min(copyTop, box.y0);
    });

    // the map lives in the free band: full frame on wide, above the copy when stacked
    var bottom = stacked ? Math.max(H * 0.40, Math.min(H * 0.72, copyTop - 10)) : H + 120;
    var left = stacked ? -W * 0.06 : -40;
    proj = d3.geoNaturalEarth1().rotate([-22, 0]).fitExtent([[left, -18], [W + 110 * sc, bottom]], world);
    path = d3.geoPath(proj, ctx);
    core = proj([28.86, 47.0]);
    publishCore();
    SLOTS.forEach(project);
  }

  function pointAt(s, v) {
    var bx = core[0] + (s.tx - core[0]) * v;
    var by = core[1] + (s.ty - core[1]) * v;
    var px = -(s.ty - core[1]) / s.len, py = (s.tx - core[0]) / s.len;
    var slack = s.phase === 'pull' ? 0.35 + 0.65 * s.u : 1;
    var env = Math.sin(Math.PI * Math.min(1, v / Math.max(0.05, s.reach || 1)));
    var o = env * slack * s.len * (s.amp * Math.sin(v * 2.2 + t * 0.5 + s.ph) + s.amp * 0.35 * Math.sin(v * 5.1 - t * 0.8 + s.ph * 2.1));
    return [bx + px * o, by + py * o];
  }

  function drawMap() {
    ctx.lineJoin = 'round';
    ctx.beginPath(); path(graticule);
    ctx.strokeStyle = 'rgba(120, 92, 44, 0.06)'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.beginPath(); path(world);
    ctx.fillStyle = 'rgba(176, 133, 66, 0.055)'; ctx.fill();
    ctx.strokeStyle = 'rgba(160, 118, 48, 0.34)'; ctx.lineWidth = 0.8; ctx.stroke();
  }

  function step(s, dt) {
    s.time += dt;
    if (s.phase === 'wait') {
      s.alpha = 0; s.bloom = 0; s.grow = 0;
      if (s.time >= s.wait) { s.phase = 'appear'; s.time = 0; }
    } else if (s.phase === 'appear') {
      var b = Math.min(1, s.time / 0.55);
      s.bloom = easeOut(b); s.alpha = s.bloom; s.grow = 0;
      if (b >= 1) { s.phase = 'grow'; s.time = 0; }
    } else if (s.phase === 'grow') {
      var g = Math.min(1, s.time / 0.95);
      s.grow = easeOut(g); s.bloom = 1; s.alpha = 1;
      if (g >= 1) { s.phase = 'hold'; s.time = 0; }
    } else if (s.phase === 'hold') {
      s.grow = 1; s.bloom = 1; s.alpha = 1;
      if (s.time >= 0.7) { s.phase = 'pull'; s.time = 0; }
    } else if (s.phase === 'pull') {
      var p = Math.min(1, s.time / 1.5);
      s.u = 1 - easeIn(p); s.grow = s.u; s.bloom = 1;
      s.alpha = Math.min(1, s.u * 3.4);
      if (p >= 1) { flare = Math.min(2.0, flare + 0.9); reseed(s); return; }
    }
    s.reach = s.phase === 'pull' ? s.u : s.grow;
    if (s.phase === 'pull') { var m = pointAt(s, s.u); s.mx = m[0]; s.my = m[1]; }
    else { s.mx = s.tx; s.my = s.ty; }
  }

  function drawThread(s) {
    if (s.reach <= 0.01) return;
    var N = 40, pts = [], i;
    for (i = 0; i <= N; i++) pts.push(pointAt(s, (i / N) * s.reach));
    for (i = 1; i <= N; i++) {
      var f = i / N;
      var a = (0.80 * (1 - f * 0.74)) * s.alpha;
      ctx.strokeStyle = 'rgba(154, 123, 30,' + a.toFixed(3) + ')';
      ctx.lineWidth = ((3.0 * sc) * (1 - f * 0.70) + 0.7) * (s.phase === 'pull' ? 1.15 : 1);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
      ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    }
    if (s.phase === 'grow' && s.grow < 0.99) {
      var tip = pts[N];
      ctx.fillStyle = 'rgba(154, 123, 30, 0.85)';
      ctx.beginPath(); ctx.arc(tip[0], tip[1], 2.4 * sc + 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawMarker(s) {
    if (s.bloom <= 0.01) return;
    var x = s.mx, y = s.my;
    var live = s.phase === 'pull' ? s.u : 1;
    var R = (36 * sc + 8) * s.bloom;
    var g = ctx.createRadialGradient(x, y, 0, x, y, R);
    g.addColorStop(0, 'rgba(226, 178, 62,' + (0.42 * s.bloom * live).toFixed(3) + ')');
    g.addColorStop(0.45, 'rgba(201, 162, 39,' + (0.14 * s.bloom * live).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(201, 162, 39, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(140, 96, 16,' + (0.92 * live).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(x, y, (2.6 + 2.4 * s.bloom) * (0.55 + 0.45 * live) * (0.6 + 0.4 * sc), 0, Math.PI * 2); ctx.fill();
    if (s.phase !== 'pull') {
      var ring = s.phase === 'appear' ? s.bloom : 1;
      ctx.strokeStyle = 'rgba(154, 123, 30,' + (0.42 * ring).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, y, (9 + 3 * Math.sin(t * 1.7 + s.ph)) * sc + 3 + 26 * (1 - ring), 0, Math.PI * 2);
      ctx.stroke();
    }
    s.lx = x; s.ly = y;
  }

  function placeLabel(s, on) {
    var el = s.el;
    if (!on || !labelsOn || s.bloom <= 0.02 || s.alpha <= 0.04 || s.lx == null) { el.style.opacity = 0; return; }
    var lw = el.offsetWidth, lh = el.offsetHeight;
    var right = s.side === 'right';
    var pad = 14 * sc + 6;
    var x0 = right ? s.lx + pad : s.lx - pad - lw;
    var y0 = s.ly - lh / 2;
    var ok = x0 > 8 && y0 > 8 && x0 + lw < W - 8 && y0 + lh < H - 8;
    if (ok) {
      for (var i = 0; i < keep.length; i++) {
        var q = keep[i];
        if (x0 < q.x1 && x0 + lw > q.x0 && y0 < q.y1 && y0 + lh > q.y0) { ok = false; break; }
      }
    }
    el.style.textAlign = right ? 'left' : 'right';
    el.style.borderLeftWidth = right ? '2px' : '0';
    el.style.borderRightWidth = right ? '0' : '2px';
    el.style.borderRightStyle = 'solid';
    el.style.borderRightColor = '#C9A227';
    el.style.left = x0 + 'px';
    el.style.top = y0 + 'px';
    var k = s.phase === 'pull' ? 0.62 + 0.38 * s.u : 1;
    el.style.transform = 'scale(' + k.toFixed(3) + ')';
    el.style.transformOrigin = right ? 'left center' : 'right center';
    el.style.opacity = ok ? (s.alpha * (s.phase === 'pull' ? s.u : 1)).toFixed(3) : 0;
  }

  function drawCore() {
    var cx = core[0], cy = core[1];
    var pulse = 0.5 + 0.5 * Math.sin(t * 1.35);
    var R = (72 + 14 * pulse + flare * 38) * sc + 14;
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(255, 250, 232, 0.98)');
    g.addColorStop(0.08, 'rgba(230, 194, 87, 0.90)');
    g.addColorStop(0.26, 'rgba(201, 162, 39, 0.42)');
    g.addColorStop(0.58, 'rgba(201, 162, 39, 0.14)');
    g.addColorStop(1, 'rgba(201, 162, 39, 0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.32);
    ctx.strokeStyle = 'rgba(154, 123, 30, 0.40)';
    for (var i = 0; i < 16; i++) {
      var a0 = (i / 16) * Math.PI * 2;
      var r0 = (12 + (i % 4) * 5) * sc + 4;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(0, 0, r0 + 8 * sc * Math.sin(t * 1.1 + i), a0, a0 + 0.9);
      ctx.stroke();
    }
    ctx.restore();

    /* Центр остаётся пустым: там стоит настоящий логотип, а кольцо ниже —
       его оправа. */
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.85)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, (26 + 3 * pulse) * sc + 9, 0, Math.PI * 2); ctx.stroke();

    for (var k = 0; k < 3; k++) {
      var ph = (t * 0.36 + k / 3) % 1;
      ctx.strokeStyle = 'rgba(154, 123, 30,' + (0.32 * (1 - ph)).toFixed(3) + ')';
      ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, cy, (22 + ph * 190) * sc, 0, Math.PI * 2); ctx.stroke();
    }

    var fs = Math.max(9, Math.round(12 * sc));
    ctx.font = "500 " + fs + "px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(107, 107, 120, 0.95)';
    /* Ниже логотипа, а не под ним: в центре теперь стоит #sbf-logo
       высотой около 100px, и прежние 40px попадали ему под низ. */
    ctx.fillText('MOLDOVA', cx, cy + (52 * sc + 12));
  }

  function frame() {
    var now = performance.now();
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now; t += dt;
    flare = Math.max(0, flare - dt * 1.9);
    if (W && world) {
      ctx.clearRect(0, 0, W, H);
      drawMap();
      SLOTS.forEach(function (s, i) { if (i < active) step(s, dt); });
      SLOTS.forEach(function (s, i) { if (i < active) drawThread(s); });
      SLOTS.forEach(function (s, i) { if (i < active) drawMarker(s); });
      drawCore();
      SLOTS.forEach(function (s, i) { placeLabel(s, i < active); });
    }
    requestAnimationFrame(frame);
  }

  d3.json('/vendor/countries-110m.json').then(function (topo) {
    world = topojson.feature(topo, topo.objects.countries);
    graticule = d3.geoGraticule10();
    fit();
    SLOTS.forEach(function (s, i) { reseed(s); s.wait = 0.2 + i * 0.7; });
    SLOTS.forEach(project);
    requestAnimationFrame(frame);
  });

  loadFeed();
  setInterval(loadFeed, POLL_MS);

  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(stage);
  window.addEventListener('resize', fit);

  /* ── Бегущая строка внизу первого экрана ───────────────────────────────
     В разметке она была захардкожена английскими заголовками, которые
     не менялись ни по языку, ни по времени. Кормим её той же лентой. */
  function renderTicker() {
    var track = document.getElementById('ticker-track');
    if (!track || !POOL.length) return;
    var lang = curLang();
    var parts = POOL.map(function (it) {
      var tag = localized(it.tag, lang);
      return '<span>' + (tag ? esc(tag).toUpperCase() + ': ' : '')
           + esc(localized(it.title, lang)) + ' &nbsp;·&nbsp; </span>';
    });
    /* Дублируем список: строка крутится по кругу, без второй копии
       на стыке будет пустота. */
    track.innerHTML = parts.join('') + parts.join('');
    animateTicker(track);
  }

  var tickerTween = null;

  /* Раньше строку крутил initTicker() из act1-map-legacy.js — файла, который
     ушёл вместе с Leaflet-картой, и анимация просто пропала. Держим её здесь,
     рядом с тем, кто наполняет строку: содержимое меняется при смене языка,
     и ширину надо пересчитывать вместе с ним. */
  function animateTicker(track) {
    if (!window.gsap) return;
    if (tickerTween) tickerTween.kill();
    gsap.set(track, { x: 0 });
    var w = track.scrollWidth / 2;
    if (!w) return;
    /* Скорость постоянная, а не длительность: на длинной ленте
       строка иначе разгонялась бы. */
    tickerTween = gsap.to(track, { x: -w, duration: w / 26, ease: 'none', repeat: -1 });
  }

  /* Язык переключили — подписи и бегущую строку перерисовываем на месте */
  document.addEventListener('sbf:langchange', function () {
    SLOTS.forEach(renderLabel);
    renderTicker();
  });
})();

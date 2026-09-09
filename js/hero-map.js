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

  /* Знак в центре карты рисует сам канвас: он часть первого экрана и едет
     вместе с ним. Общий fixed-логотип отсюда убран — при обычной прокрутке
     он ложился на текст. */
  var LOGO = new Image();
  var LOGO_RATIO = 1842.27 / 1998.6;   /* из viewBox logo.svg */
  var logoReady = false;
  LOGO.onload = function () { logoReady = true; };
  LOGO.onerror = function () { console.warn('[hero] знак не загрузился, ядро осталось точкой'); };
  LOGO.src = '/assets/logo/logo.svg';

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

  /* Словаря координат здесь больше нет. Он ставил точку по ключевым словам
     заголовка («oil» → Дубай, «crypto» → Лос-Анджелес) и был вторым
     справочником рядом с платформенным — то есть гарантированным
     расхождением: одна страна оказывалась в разных местах на карте и на
     глобусе. Координаты приходят готовыми из /api/geo/feed вместе с
     основанием привязки (поле rule).

     Демо-лента («XAU $5,600», «Дефицит меди») тоже убрана. Это были
     выдуманные заголовки в выдуманных городах: сайт продаёт рыночную
     аналитику, и подпись, которую нельзя проверить, стоит дороже пустого
     места. Нет ленты — нет подписей. */
  var POOL = [];   /* наполняется только из ленты; пусто — подписей нет */

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

  /* «сегодня 15:30» / «через 2 ч» / «40 мин назад» — время события в поясе
     посетителя. Без этого подпись на карте была просто названием показателя
     и ничем не отличалась от декорации. */
  function whenText(iso, lang) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var diff = (d - Date.now()) / 60000;               /* минуты */
    var hhmm = d.toLocaleTimeString(lang === 'ru' ? 'ru-RU' : (lang === 'ro' ? 'ro-RO' : 'en-GB'),
                                    { hour: '2-digit', minute: '2-digit' });
    var T = (window.i18n && window.i18n.t) ? window.i18n.t : function () { return ''; };
    if (diff > 90)  return T('hero.time_at').replace('{t}', hhmm);
    if (diff > 1)   return T('hero.time_in').replace('{n}', Math.round(diff));
    if (diff > -90) return T('hero.time_ago').replace('{n}', Math.max(1, Math.round(-diff)));
    return T('hero.time_at').replace('{t}', hhmm);
  }

  function reactionText(r, lang) {
    if (!r || !r.pct) return '';
    var T = (window.i18n && window.i18n.t) ? window.i18n.t : function () { return ''; };
    return T('hero.reaction').replace('{p}', r.pct.toFixed(2))
                             .replace('{s}', r.symbol || '')
                             .replace('{n}', r.n || '');
  }

  function renderLabel(s) {
    if (!s.el || !s.title) return;
    var lang = curLang();
    var when = whenText(s.ts, lang);
    /* Третья строка: у события — ожидаемая реакция рынка, у новости —
       источник. Пустой строки быть не должно: карточка тогда выглядит
       обрезанной. */
    var extra = reactionText(s.reaction, lang) || (s.source || '');
    var meta = esc(trim(localized(s.tag, lang), 22)) + (when ? ' · ' + esc(when) : '');
    s.el.dataset.impact = s.impact || '';
    s.el.dataset.kind = s.kind || '';
    s.el.innerHTML = '<b>' + esc(trim(localized(s.title, lang), 38)) + '</b>'
                   + '<i>' + meta + '</i>'
                   + (extra ? '<u>' + esc(trim(extra, 40)) + '</u>' : '');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function trim(s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/[\s,;:—-]+$/, '') + '…' : s;
  }
  function normalize(raw, i) {
    /* title и tag могут быть объектами {ru,en,ro} — их нельзя ни обрезать,
       ни экранировать здесь: это делает renderLabel уже на нужном языке. */
    var title = raw.title;
    var flat = localized(title, 'en') || localized(title, 'ru');
    if (!flat) return null;
    /* Точка ставится только по готовым координатам. Угадывать место по
       словам в заголовке — как раз тот способ, которым Intel оказывался
       во Франкфурте, а Amazon в Гонконге. */
    if (typeof raw.lon !== 'number' || typeof raw.lat !== 'number') return null;
    var ll = [raw.lon, raw.lat];
    var tag = raw.tag || raw.category || 'Live';
    return { title: title, tag: tag, ll: ll, id: raw.id || raw.link || flat,
             /* Время, важность и ожидаемая реакция — то, что отличает
                событие от строки-заголовка. У новости реакции нет: вместо
                неё показываем источник, иначе третья строка пустует. */
             ts: raw.ts_utc || null, impact: raw.impact || null,
             reaction: raw.reaction || null,
             kind: raw.kind || null, rule: raw.rule || null,
             source: raw.source || null };
  }

  function parseFeed(text, type) {
    var out = [];
    var trimmed = text.replace(/^\uFEFF/, '').trim();
    if (trimmed[0] === '[' || trimmed[0] === '{') {
      var data = JSON.parse(trimmed);
      var arr = Array.isArray(data) ? data : (data.items || data.entries || data.news || []);
      arr.forEach(function (o) { out.push({ title: o.title || o.headline || o.name, tag: o.tag || o.category, summary: o.summary || o.description, lon: o.lon, lat: o.lat, id: o.id || o.guid || o.link,
        /* Время, важность, реакция и происхождение идут дальше в normalize:
           без них подпись на карте снова стала бы просто заголовком */
        ts_utc: o.ts_utc, impact: o.impact, reaction: o.reaction,
        kind: o.kind, rule: o.rule, source: o.source }); });
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

  /* Весь ответ ленты целиком: кроме items там сегодняшний бриф и котировки */
  var META = {};

  var feedStatus = document.getElementById('hm-feed-status');
  function setStatus(txt, live) {
    /* Элемента #hm-feed-status в разметке сайта нет (остался от прототипа),
       поэтому статус ещё и в консоль: иначе о недоступной ленте не узнать. */
    console.info('[hero] ' + txt);
    if (!feedStatus) return;
    feedStatus.textContent = txt;
    feedStatus.dataset.live = live ? '1' : '0';
  }

  function loadFeed() {
    var url = new URLSearchParams(location.search).get('feed') || window.SBF_FEED_URL || FEED_URL;
    if (!url) { setStatus('Лента не задана', false); return; }
    setStatus('Лента: подключение…', false);
    fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) {
        try { META = JSON.parse(txt) || {}; } catch (e) { META = {}; }
        var items = parseFeed(txt).map(normalize).filter(Boolean);
        if (!items.length) throw new Error('пусто');
        /* Что пришло впервые — покажем раньше остального. */
        var fresh = items.filter(function (it) { return !knownIds[it.id]; })
                         .map(function (it) { return it.id; });
        POOL = items;
        items.forEach(function (it) { knownIds[it.id] = true; });
        /* Слоты держат индексы в старом массиве — после перезагрузки ленты
           тот же индекс указывает уже на другую новость. Пересобираем по id,
           иначе слот освободит чужой пункт, а свой оставит занятым навсегда. */
        usedNews = {}; usedCity = {};
        SLOTS.forEach(function (s) {
          s.news = null;
          if (!s.id) return;
          for (var i = 0; i < POOL.length; i++) {
            if (POOL[i].id === s.id) { s.news = i; break; }
          }
          if (s.news != null) {
            usedNews[s.news] = true;
            usedCity[POOL[s.news].ll.join(',')] = true;
          }
        });
        refillQueue(fresh);
        /* Шесть слотов на четыре новости дают дубли. Активных — не больше,
           чем пунктов, и не больше шести. */
        active = Math.max(3, Math.min(6, items.length));
        setStatus('Лента: в эфире · ' + items.length + ' событий', true);
        /* Те же точки нужны глобусу в контактах. Отдаём разобранную ленту,
           а не адрес файла: сервер отдаёт его с no-cache, и второй запрос
           был бы вторым сетевым походом за тем же самым. Глобус грузится
           лениво и почти всегда опаздывает — поэтому и событие, и склад. */
        window.SBF_GEO_POINTS = items;
        document.dispatchEvent(new CustomEvent('sbf:geofeed', { detail: items }));
        startSlots();
        renderToday();
        renderTicker();
      })
      .catch(function () {
        /* Молча подставить выдуманные строки нельзя — на карте это будет
           неправдой. Показываем карту без подписей и говорим об этом. */
        setStatus('Лента недоступна', false);
        renderTicker();
      });
  }

  /* Доля собранного пакета: 6 дошедших нитей — полное кольцо у ядра */
  var PACKET = 6, intake = 0;

  var SLOTS = [], usedCity = {}, usedNews = {};
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeIn(x) { return x * x * x; }

  for (var i = 0; i < 6; i++) {
    var el = document.createElement('div');
    el.className = 'hm-lbl';
    labelHost.appendChild(el);
    SLOTS.push({ el: el, city: null, news: null, ll: null });
  }

  /* Пока ленты нет, слотам нечего показывать: без этого reseed выбирал бы
     пункт из пустого массива и подписи приходили бы пустыми. */
  var slotsStarted = false;
  function startSlots() {
    if (slotsStarted || !POOL.length || !proj) return;
    slotsStarted = true;
    SLOTS.forEach(function (s, i) { reseed(s); s.wait = 0.2 + i * 0.7; });
    SLOTS.forEach(project);
  }

  /* Очередь показа — перетасованная лента. Случайный выбор при полутора
     десятках пунктов держал на карте одни и те же три-четыре заголовка, а
     половина ленты не показывалась ни разу: слот выбирал случайный пункт и
     чаще всего натыкался на Нью-Йорк, которым забита половина ленты.
     Очередь даёт правило: пока не показаны все, ни один не повторяется. */
  var queue = [];
  /* Показанное в текущем круге и всё, что лента приносила за сеанс.
     Круг считается по id, а не по индексу: лента перечитывается раз в
     минуту, и после перечитывания индексы означают уже другие новости. */
  var shownIds = {}, knownIds = {};

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {              /* Фишер — Йетс */
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* Очередь собирается из непоказанного. Раньше она пересобиралась целиком
     при каждой перезагрузке ленты — то есть раз в минуту круг начинался
     заново, и уже показанные заголовки возвращались, а до дальней части
     ленты очередь не доходила никогда. Отсюда и «одни и те же новости, пока
     не обновишь страницу». */
  function refillQueue(freshFirst) {
    var rest = [];
    POOL.forEach(function (it, i) { if (!shownIds[it.id]) rest.push(i); });
    if (!rest.length) {                 /* круг пройден — начинаем новый */
      shownIds = {};
      POOL.forEach(function (_, i) { rest.push(i); });
    }
    shuffle(rest);
    if (freshFirst && freshFirst.length) {
      var head = [], tail = [];
      rest.forEach(function (i) {
        (freshFirst.indexOf(POOL[i].id) >= 0 ? head : tail).push(i);
      });
      rest = head.concat(tail);         /* свежее — вперёд */
    }
    queue = rest;
  }

  /* Берём первый подходящий, непошедшие возвращаем в хвост — они дождутся
     своей очереди, а не выпадут из ротации. */
  function pickFromQueue(fits) {
    if (!queue.length) refillQueue();
    var skipped = [], nid = -1, guard = POOL.length + 1;
    while (queue.length && guard-- > 0) {
      var cand = queue.shift();
      if (POOL[cand] && fits(cand)) { nid = cand; break; }
      skipped.push(cand);
      if (!queue.length) break;
    }
    queue = queue.concat(skipped);
    return nid;
  }

  /* Две ленты дают почти одинаковые заголовки одной новости («Canada's
     retaliatory US tariffs take effect» и «…tariffs on US goods take
     effect»). По id они разные, на карте — дубль. Сверяем по первым словам. */
  function titleKey(it) {
    var s = localized(it.title, 'en') || localized(it.title, 'ru') || '';
    return s.toLowerCase().replace(/[^0-9a-zа-яё ]+/gi, ' ')
            .split(/\s+/).filter(Boolean).slice(0, 5).join(' ');
  }

  /* Есть ли сейчас на карте хоть одна живая подпись, кроме этого слота */
  function alone(s) {
    return !SLOTS.some(function (o) { return o !== s && o.news != null && o.alpha > 0.05; });
  }

  function reseed(s) {
    if (!POOL.length) return;
    /* Один и тот же заголовок в двух точках карты читается как ошибка
       данных. Пунктов бывает меньше, чем слотов (лента фильтруется по
       достоверности), поэтому сверяемся ещё и по id соседних слотов. */
    var shown = {}, taken = [];
    SLOTS.forEach(function (o) {
      if (o === s || o.news == null || !POOL[o.news]) return;
      shown[POOL[o.news].id] = true;
      shown[titleKey(POOL[o.news])] = true;
      /* Города бывают рядом: Лондон и Франкфурт на карте почти касаются, и
         их подписи налезали друг на друга. Держим экранную дистанцию —
         раньше её обеспечивал разнос выдуманных координат. */
      if (proj && o.ll) { var q = proj(o.ll); if (q) taken.push(q); }
    });

    /* Освобождаем свою прошлую новость и город ДО выбора новой.
       Раньше это делалось после успешного выбора — и слот, которому места
       не нашлось, уходил молчать, продолжая держать пункт занятым. Через
       минуту «занятыми» оказывались все, и карта пустела совсем: в прогоне
       на живом сайте 34 кадра из 40 были без единой подписи. */
    if (s.news != null && POOL[s.news]) {
      usedNews[s.news] = false;
      usedCity[POOL[s.news].ll.join(',')] = false;
    }
    if (s.city != null) usedCity[s.city] = false;
    s.news = null; s.city = null; s.id = null;
    /* 150px разводили точки так, что на карте оставалась одна подпись из
       шести: свободных мест не находилось. 105 — компромисс между
       «не наезжают» и «карта живая». Слоту, который не нашёл места дважды
       подряд, дистанцию ослабляем: иначе на карте бывало ноль подписей —
       половина ленты стоит в Нью-Йорке, и слоты глушили друг друга. */
    var MIN_GAP = (s.miss || 0) >= 2 ? 76 : 105;
    function tooClose(ll) {
      if (!proj) return false;
      var q = proj(ll);
      if (!q) return true;
      for (var i = 0; i < taken.length; i++)
        if (Math.hypot(q[0] - taken[i][0], q[1] - taken[i][1]) < MIN_GAP) return true;
      return false;
    }
    var nid = pickFromQueue(function (i) {
      var it = POOL[i];
      return it && it.ll && !usedNews[i] && !shown[it.id] &&
             !shown[titleKey(it)] && !usedCity[it.ll.join(',')] &&
             !tooClose(it.ll);
    });
    /* Ничего подходящего не нашлось — слот молчит до следующего круга.
       Пустое место честнее, чем две подписи одна на другой. Слот при этом
       обязан остаться в согласованном состоянии: без ll его координаты
       остаются NaN, и градиент ядра падает с «non-finite value». */
    if (nid < 0) {
      s.miss = (s.miss || 0) + 1;
      s.news = null; s.ll = null; s.title = null;
      s.alpha = 0; s.bloom = 0; s.grow = 0; s.u = 1;
      s.phase = 'wait'; s.time = 0;
      s.wait = alone(s) ? 0.25 : 0.5 + Math.random() * 0.6;
      if (s.el) s.el.style.opacity = 0;
      return;
    }
    s.miss = 0;
    var item = POOL[nid];
    shownIds[item.id] = true;
    usedNews[nid] = true; usedCity[item.ll.join(',')] = true;
    s.news = nid; s.id = item.id; s.city = item.ll.join(',');
    s.ll = item.ll;
    s.title = item.title; s.tag = item.tag;
    s.ts = item.ts; s.impact = item.impact; s.reaction = item.reaction;
    s.kind = item.kind; s.rule = item.rule; s.source = item.source;
    s.ph = Math.random() * 6.28;
    s.amp = 0.09 + Math.random() * 0.07;
    /* Пауза перед появлением. Если на карте сейчас нет ни одной подписи,
       ждать нечего: пустая карта выглядит сломанной, а не спокойной. */
    s.phase = 'wait'; s.time = 0;
    s.wait = alone(s) ? 0.05 : 0.4 + Math.random() * 2.6;
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
    if (!s.ll) { s.time += dt; if (s.time >= s.wait) reseed(s); return; }
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
      if (p >= 1) {
        flare = Math.min(2.0, flare + 0.9);
        /* Нить дошла до ядра — знак в шапке отзывается (logo.js) */
        document.dispatchEvent(new CustomEvent('sbf:thread'));
        intake += 1 / PACKET;
        if (intake >= 1) intake = 0;      /* пакет собран — начинаем следующий */
        reseed(s); return;
      }
    }
    s.reach = s.phase === 'pull' ? s.u : s.grow;
    if (s.phase === 'pull') { var m = pointAt(s, s.u); s.mx = m[0]; s.my = m[1]; }
    else { s.mx = s.tx; s.my = s.ty; }
  }

  function drawThread(s) {
    if (!s.ll || s.reach <= 0.01) return;
    var N = 40, pts = [], i;
    for (i = 0; i <= N; i++) pts.push(pointAt(s, (i / N) * s.reach));
    for (i = 1; i <= N; i++) {
      var f = i / N;
      /* Хвост нити гас почти до нуля, и на светлой карте нить читалась
         только у самого ядра. Держим не ниже 0.35 от исходной яркости. */
      var a = (0.92 * (1 - f * 0.62)) * s.alpha;
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
    if (!s.ll) return;
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
    if (!s.ll) { if (s.el) s.el.style.opacity = 0; return; }
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

    if (logoReady) {
      var lh = (34 + 4 * pulse + flare * 7) * sc + 13;
      var lw = lh * LOGO_RATIO;
      ctx.save();
      ctx.shadowColor = 'rgba(201, 162, 39, 0.55)';
      ctx.shadowBlur = (16 + 10 * pulse) * sc;
      ctx.drawImage(LOGO, cx - lw / 2, cy - lh / 2, lw, lh);
      ctx.restore();
    } else {
      ctx.fillStyle = 'rgba(154, 123, 30, 0.95)';
      ctx.beginPath(); ctx.arc(cx, cy, (7 + 2.2 * pulse) * sc + 2.5, 0, Math.PI * 2); ctx.fill();
    }
    /* Кольцо-дорожка и доля набранного пакета. Роль знака на этом экране —
       «принимает»: каждая дошедшая нить добавляет 1/PACKET, полное кольцо
       означает «пакет собран» и обнуляется. Раньше здесь было просто
       декоративное кольцо, одинаковое в любой момент. */
    var rr = (26 + 3 * pulse) * sc + 9;
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.30)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    if (intake > 0.001) {
      ctx.strokeStyle = 'rgba(201, 162, 39, 0.95)';
      ctx.lineWidth = 2.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * intake);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

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
    startSlots();
    requestAnimationFrame(frame);
  });

  loadFeed();
  setInterval(loadFeed, POLL_MS);

  if (window.ResizeObserver) new ResizeObserver(function () { fit(); }).observe(stage);
  window.addEventListener('resize', fit);

  /* ── Бегущая строка внизу первого экрана ───────────────────────────────
     В разметке она была захардкожена английскими заголовками, которые
     не менялись ни по языку, ни по времени. Кормим её той же лентой. */
  /* Строка «сегодня»: дата и заголовок утреннего брифа. Это единственное
     место на первом экране, где видно результат работы, а не сырьё.
     Бриф пока только на русском (META.today.lang) — на других языках
     помечаем язык оригинала, а не выдаём его за перевод. */
  function renderToday() {
    var host = document.getElementById('hm-today');
    if (!host) return;
    var t = META.today;
    if (!t || !t.headline) { host.hidden = true; return; }
    var lang = curLang();
    var T = (window.i18n && window.i18n.t) ? window.i18n.t : function () { return ''; };
    var d = t.date ? new Date(t.date + 'T00:00:00Z') : new Date();
    var date = d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : (lang === 'ro' ? 'ro-RO' : 'en-GB'),
                                    { day: 'numeric', month: 'long' });
    var mark = (t.lang && t.lang !== lang) ? ' <em>' + esc(t.lang.toUpperCase()) + '</em>' : '';
    host.hidden = false;
    host.innerHTML = '<b>' + esc(T('hero.today').replace('{d}', date)) + '</b> '
                   + esc(t.headline) + mark
                   + ' <a href="https://lp.sbfconsult.com/?utm_source=sbfconsult_site'
                   + '&utm_medium=cta&utm_campaign=hero_brief" target="_blank" rel="noopener">'
                   + esc(T('hero.read_brief')) + ' →</a>';
  }

  /* Котировки для второй половины бегущей строки. Данные старше двух часов
     не показываем совсем: устаревшая цена хуже отсутствующей. */
  function quoteParts(lang) {
    var q = META.quotes || [];
    if (!q.length) return [];
    var age = META.quotes_updated ? (Date.now() - new Date(META.quotes_updated)) / 3600000 : 99;
    if (!(age < 2)) return [];
    return q.map(function (it) {
      var up = it.chg_pct >= 0;
      return '<span class="tk-q"><i>' + esc(it.symbol) + '</i> '
           + esc(Number(it.bid).toFixed(it.digits))
           + ' <b class="' + (up ? 'up' : 'dn') + '">' + (up ? '▲' : '▼')
           + Math.abs(it.chg_pct).toFixed(2) + '%</b> &nbsp;·&nbsp; </span>';
    });
  }

  function renderTicker() {
    var track = document.getElementById('ticker-track');
    if (!track || !POOL.length) return;
    var lang = curLang();
    var parts = POOL.map(function (it) {
      var tag = localized(it.tag, lang);
      return '<span>' + (tag ? esc(tag).toUpperCase() + ': ' : '')
           + esc(localized(it.title, lang)) + ' &nbsp;·&nbsp; </span>';
    });
    /* Календарь и котировки идут в одной ленте попеременно: событие —
       это «что случится», цена — «что происходит прямо сейчас». */
    parts = quoteParts(lang).concat(parts);
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
    renderToday();
    renderTicker();
  });
})();

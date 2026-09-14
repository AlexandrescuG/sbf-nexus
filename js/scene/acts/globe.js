/* globe.js — акт 10: финал.

   Путь заканчивается там же, где начался, — на карте мира, но с другой
   стороны. В первом акте мир отдавал события знаку. Здесь знак отдаёт нити
   обратно: четыре наших адреса, и они настоящие.

   История этого акта — история трёх заготовок подряд, и каждую владелец
   называл своим словом.

   1. Каркас из меридианов: «буквально плейсхолдер вместо глобуса». Сетка
      без материков — не глобус, а чертёж глобуса.
   2. Выпечка шара в отдельный холст на каждые 3° поворота: «движется не
      плавно и прерывисто». Кадр дешевел, вращение шло ступеньками.
   3. Живая отрисовка по прорежённым контурам: «глобус ломается». И правда
      ломался — см. ниже про горизонт.

   Сейчас шар рисуется живьём каждый кадр по геометрии, прорежённой один
   раз при загрузке. На экране диаметром 700 px разницы не видно — точки
   чаще, чем пиксели, — а проекция пары тысяч точек стоит доли миллисекунды.
   Ступенек нет, потому что нет и шага: угол непрерывный.

   Почему шар не выглядит плоским кругом. Ортографическая проекция сама по
   себе даёт диск; объём делают три вещи, и все три взяты с живого сайта:
   свечение атмосферы за ободом, затемнение к краю (свет падает слева
   сверху) и звёздное поле позади. Без них это карта, вырезанная кругом.

   three.js сюда по-прежнему не тянется: 590 КБ ради последнего экрана —
   плата за то, что увидит меньшинство дошедших.
*/

import { t } from '../labels.js';

/* Адреса — те же, что в разметке акта. Здесь только координаты и связь с
   карточкой: текст живёт в документе, потому что без JS он тоже нужен. */
const OFFICES = [
  { lon:  8.42, lat: 47.28, key: 'contact.ch' },   /* Обфельден */
  { lon: -9.14, lat: 38.72, key: 'contact.pt' },   /* Лиссабон  */
  { lon: 28.86, lat: 47.01, key: 'contact.md' },   /* Кишинёв   */
  { lon: 55.27, lat: 25.20, key: 'contact.ae' },   /* Дубай     */
];

const RAD = Math.PI / 180;

/* Мягкий вход и мягкий выход: раскрытие не должно начинаться рывком от
   первого же пикселя прокрутки и не должно упираться в стенку в конце. */
function smooth(x) { return x * x * (3 - 2 * x); }

export const globe = {
  id: 'globe',
  role: 'output',
  note: 'глобус, нити к филиалам, форма',
  /* Знак здесь не подложка, а центр шара: рисуется поверх акта и мельче,
     чем в остальных актах, — как на живом сайте, где диск знака занимает
     примерно восьмую часть шара, а не половину. */
  markOnTop: true,
  markScale: 0.42,
  /* На узком экране знак стоит над колонкой, и по умолчанию это 0.17
     высоты — у самой шапки. Шар, раскрытый из такого кольца, упирался
     верхом в шапку, а низом лез в текст: владелец увидел это как «шар
     появляется где-то сверху». Ставим знак на треть высоты, а колонке
     под него добавлен отступ в css рядом с актом. */
  markCy: 0.34,

  spin: 0,
  rings: null,     /* прорежённые контуры материков */
  stars: null,
  cards: null,

  load(R) {
    if (this.geo) { this.fit(R); return; }
    if (this.loading) return;
    this.loading = true;
    if (!window.topojson) return;
    fetch('vendor/countries-110m.json').then(r => r.json()).then(topo => {
      this.geo = window.topojson.feature(topo, topo.objects.countries);
      this.fit(R);
    }).catch(() => console.warn('[scene] глобус без материков: карта не загрузилась'));
  },

  /* Прорежение — под размер, с которым шар рисуется.

     Прежний порог был числом (0.55°) и не зависел ни от чего. На шаре
     диаметром 360 px это давало 8764 точки — по два десятка на пиксель
     береговой линии. Кадр финала стоил 12 мс из 16 на телефоне, и линейка
     этого не видела: она мерила средний кадр по всей странице, а финал —
     один акт из семи. Такой же случай, как с картой первого экрана:
     дорого не рисование, а количество, которое никто не считал. */
  fit(R) {
    if (!this.geo || !R) return;
    /* Один градус по экватору — это R·π/180 пикселей. Держим шаг около
       четырёх пикселей: на шаре в 360 px это уже неразличимо от гладкой
       линии (проверено глазом на снимках), а точек становится втрое
       меньше. Исходный контур 110m сам по себе примерно такой густоты,
       поэтому прежний порог 0.55° не убирал почти ничего — отсюда и
       девять тысяч точек в кадре. */
    const min = Math.max(0.5, Math.min(3.5, 229 / R));
    if (this.minDeg && Math.abs(this.minDeg - min) < min * 0.25) return;
    this.minDeg = min;
    this.rings = simplify(this.geo, min);
  },

  /* Звёзды считаются один раз и по формуле, а не случайно в каждом кадре:
     мерцающая от кадра к кадру россыпь читается как помеха, а не как небо. */
  makeStars(view) {
    const n = view.mobile ? 60 : 130;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963;                    /* золотой угол */
      const r = Math.sqrt((i + 0.5) / n);
      out.push({ x: (0.5 + 0.5 * r * Math.cos(a * 7.1)) ,
                 y: (0.5 + 0.5 * r * Math.sin(a * 4.3)),
                 s: 0.6 + (i % 5) * 0.28,
                 a: 0.25 + ((i * 37) % 60) / 100 });
    }
    this.stars = out;
  },

  /* Свободная полоса кадра: под шапкой и над подвалом.

     Подвал — обычная секция документа, он приезжает снизу к концу пути и
     занимает половину кадра. Сцена при этом закреплена, и шар прежнего
     размера уходил под подвал: реквизиты компании лежали поверх Африки.
     Полосу читаем пять раз в секунду, как и прямоугольник колонки на
     первом экране, — по той же причине: раскладка во время прокрутки
     стоит дороже отрисовки. */
  band(view) {
    this.bandAt = (this.bandAt || 0) - view.dt;
    if (this.bandAt <= 0 || !this.bandBox) {
      this.bandAt = 0.2;
      if (!this.foot) this.foot = document.querySelector('.scene-foot');
      const nav = 56;
      let bottom = view.h;
      if (this.foot) {
        const r = this.foot.getBoundingClientRect();
        if (r.top < view.h) bottom = Math.max(nav + 120, r.top);
      }
      this.bandBox = { top: nav, bottom: bottom };
    }
    return this.bandBox;
  },

  /* Выпечка подложки шара: всё, что не зависит от угла поворота.

     Ключ — радиус и время суток, огрублённое до двадцатых: без огрубления
     ключ менялся бы в каждом кадре перехода к тёмному тону, и выпечка
     превратилась бы в ту же отрисовку, только с лишним холстом. */
  bake(view, R, night, hubR) {
    if (R < 8) return null;
    const key = Math.round(R) + ':' + Math.round(night * 20) + ':' + Math.round(hubR);
    if (this.baked && this.baked.key === key) return this.baked;
    const half = Math.ceil(R * 1.26);
    const mk = (n) => {
      const c = document.createElement('canvas');
      c.width = n * 2; c.height = n * 2;
      return c;
    };
    /* Задник — с запасом под свечение атмосферы, передник — ровно по шару:
       лишние двести тысяч пикселей прозрачности в кадре тоже кто-то
       складывает. */
    const back = mk(half), front = mk(Math.ceil(R) + 2);
    const fh = Math.ceil(R) + 2;
    const b = back.getContext('2d'), f = front.getContext('2d');

    const halo = b.createRadialGradient(half, half, R * 0.94, half, half, R * 1.22);
    halo.addColorStop(0, 'rgba(201,162,39,' + (0.30 * night).toFixed(3) + ')');
    halo.addColorStop(0.45, 'rgba(201,162,39,' + (0.10 * night).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(201,162,39,0)');
    b.fillStyle = halo;
    b.beginPath(); b.arc(half, half, R * 1.22, 0, Math.PI * 2); b.fill();

    const body = b.createRadialGradient(
      half - R * 0.32, half - R * 0.34, R * 0.05, half, half, R);
    body.addColorStop(0, 'rgba(26,22,34,0.96)');
    body.addColorStop(0.72, 'rgba(14,11,20,0.97)');
    body.addColorStop(1, 'rgba(6,5,10,0.99)');
    b.fillStyle = body;
    b.beginPath(); b.arc(half, half, R, 0, Math.PI * 2); b.fill();

    f.save();
    f.beginPath(); f.arc(fh, fh, R, 0, Math.PI * 2); f.clip();
    const shade = f.createRadialGradient(
      fh - R * 0.38, fh - R * 0.40, R * 0.10,
      fh + R * 0.12, fh + R * 0.14, R * 1.25);
    shade.addColorStop(0, 'rgba(255,240,200,0.10)');
    shade.addColorStop(0.42, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.72)');
    f.fillStyle = shade;
    f.fillRect(fh - R, fh - R, R * 2, R * 2);
    f.restore();
    f.beginPath(); f.arc(fh, fh, R, 0, Math.PI * 2);
    f.strokeStyle = 'rgba(230,194,87,0.50)'; f.lineWidth = 1.2; f.stroke();

    /* Узел в центре: диск и свечение вокруг него тоже не зависят от
       поворота — кольцо и глиф поверх рисует mark.js. */
    const hubHalf = Math.ceil(hubR * 2.2);
    const hub = mk(hubHalf);
    const u = hub.getContext('2d');
    const glow = u.createRadialGradient(hubHalf, hubHalf, hubR * 0.2,
                                        hubHalf, hubHalf, hubR * 2.1);
    glow.addColorStop(0, 'rgba(226,178,62,0.34)');
    glow.addColorStop(1, 'rgba(226,178,62,0)');
    u.fillStyle = glow;
    u.beginPath(); u.arc(hubHalf, hubHalf, hubR * 2.1, 0, Math.PI * 2); u.fill();
    u.fillStyle = 'rgba(16,13,22,0.92)';
    u.beginPath(); u.arc(hubHalf, hubHalf, hubR, 0, Math.PI * 2); u.fill();

    this.baked = { key: key, back: back, front: front, half: half,
                   frontHalf: fh, hub: hub, hubHalf: hubHalf };
    return this.baked;
  },

  /* Слой суши и сетки под текущий угол. Возвращает холст с полем half. */
  turn(view, R, spin) {
    if (!this.rings) return null;
    const half = Math.ceil(R) + 2;
    let L = this.layer;
    if (!L || L.half !== half) {
      L = this.layer = document.createElement('canvas');
      L.width = L.height = half * 2;
      L.half = half;
      L.spin = null;
    }
    /* Порог в сдвиге пикселей, а не в градусах: на маленьком шаре тот же
       угол — это меньше пикселей.

       На десктопе порога нет: шар поворачивается на 0.42 px за кадр, и
       порог в 0.8 px означал перерисовку через кадр — то есть 30 к/с у
       единственного движущегося предмета на экране. Владелец увидел это
       сразу: «глобус как-то странно движется». Экономить здесь можно было
       только там, где кадр действительно не укладывается в бюджет. */
    const step = view.mobile ? 0.8 : 0;
    if (L.spin != null && Math.abs(spin - L.spin) * R < step) return L;

    /* Пока страница летит под пальцем — не поворачиваем вовсе.

       Вращение здесь значит «мы работаем, пока вы читаете». Во время
       броска никто не читает, а перерисовка пяти тысяч точек стоит
       двадцати миллисекунд и попадает ровно в те кадры, где и так тяжело:
       медиана кадра в финале была 16.7 мс при p95 в 83 — то есть кадр в
       норме, а всплески давала как раз эта перерисовка. Остановился —
       шар поехал дальше с того же угла, без скачка. */
    if (view.mobile && L.spin != null && (view.speed || 0) > 260) return L;

    /* В упрощённом режиме шар вообще не поворачивается. Это самая дорогая
       работа финала — пять тысяч точек, — и отдаём её первой: неподвижный
       шар остаётся шаром, а рваная прокрутка остаётся рваной. Флаг ставит
       линейка кадра (stage.js), когда треть кадров подряд не укладывается
       в частоту экрана. */
    if (view.simple && L.spin != null) return L;
    L.spin = spin;
    const c = L.getContext('2d');
    c.clearRect(0, 0, L.width, L.height);

    /* Поворот считается один раз, дальше только умножения: координаты
       хранятся синусами и косинусами, угол складывается по формуле
       сложения. Шесть тригонометрических функций на каждую из пяти тысяч
       точек — это была вторая по величине статья расхода. */
    const cs = Math.cos(spin), ss = Math.sin(spin);

    c.strokeStyle = 'rgba(201,162,39,0.16)';
    c.lineWidth = 0.7;
    if (!this.grid) this.grid = graticule(view.mobile ? 8 : 5);
    for (let n = 0; n < this.grid.length; n++) {
      trace(c, this.grid[n], half, half, R, cs, ss, false);
      c.stroke();
    }

    /* Здесь и ломался шар. Точку на обратной стороне прежний код просто
       выбрасывал, разрывая контур через moveTo. Для обводки это работало,
       а заливка замыкает каждый подпуть прямой — и незамкнутая дуга
       заливалась хордой: через весь шар шли золотые клинья, которых нет
       ни на одной карте мира.

       Правильный приём — не выбрасывать заднюю точку, а прижимать её к
       горизонту: контур остаётся замкнутым и просто ложится вдоль обода.
       Америка, уходящая за край, при этом выглядит именно как уходящая
       за край. */
    c.beginPath();
    for (let n = 0; n < this.rings.length; n++) {
      const r = this.rings[n];
      /* Кольцо целиком за шаром — не трогаем вовсе */
      const z = r.cLat * (r.cLon * cs - r.sLon * ss);
      if (z < -r.sinRho) continue;
      trace(c, r, half, half, R, cs, ss, true);
    }
    c.fillStyle = 'rgba(201,162,39,0.80)'; c.fill();
    if (!view.mobile) {
      c.strokeStyle = 'rgba(240,205,105,0.42)';
      c.lineWidth = 0.7; c.stroke();
    }
    return L;
  },

  geometry(view, mark) {
    const g = mark.geometry(view);
    const b = this.band(view);
    /* Шар живёт правее колонки текста и не выходит ни за края кадра, ни
       под подвал. Раньше радиус считался от радиуса знака (×2.6) и на
       широком экране шар упирался в подвал и уезжал за правый край. */
    /* Радиус считается ТОЛЬКО от размера окна и никогда от полосы кадра.
       Полоса ездит вместе с подвалом, а по радиусу ключуется выпечка
       подложки — привязав одно к другому, мы пересобирали бы подложку
       пять раз в секунду всё время, пока подвал подъезжает. Это стоило
       41% кадров с пропуском на телефоне при медианном кадре в 16.7 мс:
       медиана в норме, а редкие всплески по 67 мс — как раз выпечки. */
    const R = view.mobile
      ? Math.min(view.w * 0.42, view.h * 0.30)
      : Math.min(view.h * 0.40,
                 (view.w - g.corridor.cx + g.corridor.halfW) * 0.52);
    /* Шар остаётся в центре знака — он и есть узел, из которого идут нити,
       и уводить его от знака нельзя. Зато он гаснет по мере того, как
       подвал поднимается снизу: путь кончился, мир уходит, остаются
       реквизиты. Это честнее, чем шар, просвечивающий сквозь подвал. */
    /* Занавес работает и на телефоне.

       Раньше там его не было, и конец пути выглядел так: колонка ушла
       вверх, приглушение снялось — и шар вспыхнул в полную силу ПОД
       подвалом, за реквизитами. Владелец описал это точно: «в конце на
       секунду становится ярким и потом снова тухнет». Ярким он становился
       потому, что текст уже прошёл, а тух — потому что подвал закрывал
       его собой. Правильный порядок обратный: подвал поднимается — мир
       уходит, и уходит заранее, а не после вспышки. */
    const veil = Math.max(0, Math.min(1, b.bottom / view.h * 1.5 - 0.35));
    return { cx: g.cx, cy: g.cy, R: R, mark: g, band: b, veil: veil };
  },

  render(ctx, view, cam, mark, labels) {
    if (!this.stars) this.makeStars(view);
    const G = this.geometry(view, mark);
    this.load(G.R);
    /* На узком экране шар стоит над колонкой и неизбежно с ней встречается
       — это геометрия, а не недосмотр. Спор решается так же, как у знака:
       в пользу текста. markDim сцена уже считает по прямоугольнику
       колонки, второй раз то же самое считать незачем. */
    const w = cam.w * G.veil *
              (view.mobile && view.markDim != null ? view.markDim : 1);
    if (w < 0.02) { this.hideCards(); return; }
    const cx = G.cx, cy = G.cy;

    /* ── Раскрытие ─────────────────────────────────────────
       Шар не возникает — он раскрывается из кольца знака.

       Владелец: «шар появляется не по центру, а где-то сверху, и его
       появление никак не обыгрывается, просто возник и всё». Второе
       важнее первого. Знак всю дорогу собирал: на первом экране мир
       отдавал ему события нитями, дальше он обрабатывал и выдавал. В
       финале он открывается в тот самый мир, который собирал, — это не
       украшение, а последняя фраза той же грамматики. Кольцо знака
       становится ободом шара и расходится до полного размера.

       Ведёт раскрытие прокрутка, а не таймер: остановился на середине —
       шар стоит полураскрытым, пошёл назад — закрывается обратно. Как и
       всё остальное в гобелене.

       Считается это даром. Подложка и слой суши пекутся в полный радиус
       один раз, а в кадре меняется только масштаб, с которым их кладут:
       drawImage умеет растягивать сам. Если бы радиус шёл в выпечку, она
       бы шла каждый кадр — ровно та ошибка, из-за которой финал уже
       однажды стоил 34 мс. */
    const hubR0 = G.mark.r * this.markScale;
    const open = smooth(Math.max(0, Math.min(1, cam.t / 0.3)));
    const R = hubR0 + (G.R - hubR0) * open;
    const k = R / G.R;                       /* во сколько ужимаем выпечку */

    /* Вращение непрерывное: угол — обычное число, а не индекс кадра.
       Медленно и только пока акт на экране: это единственное движение в
       финале, и оно означает «мы работаем, пока вы читаете». */
    this.spin += view.dt * (view.mobile ? 0.05 : 0.07);
    const spin = this.spin;

    ctx.save();
    ctx.globalAlpha = w;

    /* ── Небо ──────────────────────────────────────────────
       Звёзды видны ровно настолько, насколько мир уже потемнел: на светлом
       фоне первых актов их не бывает. Все точки — один путь и одна
       заливка: шестьдесят beginPath/fill в кадре стоят дороже, чем сами
       шестьдесят точек. */
    const night = Math.min(1, (view.dark || 0) * 1.2);
    if (night > 0.02 && !view.simple) {
      ctx.fillStyle = 'rgba(255,244,214,' + (0.5 * night).toFixed(3) + ')';
      ctx.beginPath();
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        const sx = s.x * view.w, sy = s.y * view.h;
        ctx.moveTo(sx + s.s, sy);
        ctx.arc(sx, sy, s.s, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    /* ── Атмосфера и тело шара ─────────────────────────────
       Свечение за ободом и затемнение к краю — то, что делает круг шаром:
       край перестаёт быть линией реза и становится краем тела.

       Пекутся в отдельный холст и не меняются, пока не изменились размер
       и время суток. Первая версия строила четыре радиальных градиента
       и заливала ими пол-экрана в каждом кадре: работа внутри кадра
       оставалась двумя миллисекундами — то есть линейка молчала, — а на
       телефоне ВСЕ кадры финала выходили за 25 мс. Ровно тот же урок, что
       с картой первого экрана: статичную подложку рисуют один раз. */
    const hubR = G.mark.r * (this.markScale + 0.16);
    const sky = this.bake(view, G.R, night, hubR);
    if (sky) {
      const h = sky.half * k;
      ctx.drawImage(sky.back, cx - h, cy - h, h * 2, h * 2);
    }

    /* ── Суша и сетка ──────────────────────────────────────
       Рисуются в отдельный холст и не каждый кадр. Замер на телефоне с
       процессором вчетверо медленнее: без материков кадр идёт 17 мс, с
       ними — 29. Пять тысяч точек контуров — это и есть весь финал по
       цене, всё остальное вместе стоит около миллисекунды.

       Прошлая попытка сэкономить здесь провалилась и была права в том,
       что провалилась: шар пекли на каждые 3° поворота, и владелец
       увидел ступеньки — «движется не плавно и прерывисто». Разница в
       шаге. Шар поворачивается на 2.9° в секунду, то есть при 60 кадрах
       точка экватора уезжает на 0.15 px за кадр. Перерисовывая при
       сдвиге в 0.8 px, мы обновляем картинку раз в пять кадров — глазу
       такой шаг неразличим, а стоит финал впятеро дешевле. Ступеньки
       были не от выпечки, а от 3°. */
    const layer = this.turn(view, G.R, spin);
    if (layer) {
      /* Материки проявляются чуть позже обода: сначала кольцо становится
         телом, потом на теле проступает суша. Одновременно получалась
         каша из линий в мелком круге. */
      const land = Math.max(0, Math.min(1, (open - 0.35) / 0.5));
      if (land > 0.01) {
        const h = layer.half * k;
        ctx.globalAlpha = w * land;
        ctx.drawImage(layer, cx - h, cy - h, h * 2, h * 2);
        ctx.globalAlpha = w;
      }
    }

    /* ── Свет и обод ───────────────────────────────────────
       Тень к нижнему правому краю: одна и та же для суши и океана,
       поэтому шар читается целиком, а не как аппликация. Печётся вместе
       с телом шара — по той же причине. */
    if (sky) {
      const h = sky.frontHalf * k;
      ctx.drawImage(sky.front, cx - h, cy - h, h * 2, h * 2);
    }

    /* ── Узел в центре ─────────────────────────────────────
       Знак стоит на шаре, а не под ним: под тёмным шаром он читался как
       дыра. Диск и свечение — его место, кольцо и глиф рисует mark.js
       поверх акта (markOnTop). */
    if (sky) ctx.drawImage(sky.hub, cx - sky.hubHalf, cy - sky.hubHalf);

    /* ── Офисы ─────────────────────────────────────────────
       Появляются по одному по мере прохождения акта: четыре адреса,
       четыре шага. Нить идёт от узла к точке — то же движение, что на
       первом экране, только в обратную сторону: там мир отдавал событие
       знаку, здесь знак дотягивается до своих. */
    const seen = [], live = [];
    OFFICES.forEach((o, i) => {
      /* Нити идут после того, как шар раскрылся: сначала знак становится
         миром, потом мир отвечает адресами. Одновременно нити росли внутри
         ещё не раскрытого круга и выглядели как царапины по кольцу.
         Четвёртый адрес при этом обязан успеть до того, как подвал начнёт
         поднимать занавес: при прежнем шаге Дубай выходил на t = 0.8, то
         есть ровно когда шар уже гас. */
      const on = Math.max(0, Math.min(1, (cam.t - 0.24) * 5.4 - i * 0.32));
      const p = project(o.lon, o.lat, spin, cx, cy, R);
      /* Карточка держится, пока акт на экране, а точка на шаре появляется
         и уходит вместе с вращением. Первая версия связывала их напрямую —
         и Дубай, ушедший за край, уносил с собой свой адрес: карточка
         мигала на ровном месте. Адрес не зависит от того, какой стороной
         сейчас повёрнут шар. */
      live.push(on > 0.9);
      seen.push(on > 0.9 && p ? p : null);
      if (on <= 0 || !p) return;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + (p[0] - cx) * on, cy + (p[1] - cy) * on);
      ctx.strokeStyle = 'rgba(230,194,87,' + (0.5 * on).toFixed(3) + ')';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      if (on > 0.9) {
        const g2 = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], 16);
        g2.addColorStop(0, 'rgba(255,233,168,0.55)');
        g2.addColorStop(1, 'rgba(255,233,168,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(p[0], p[1], 16, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, Math.PI * 2);
        ctx.fillStyle = '#FFE9A8'; ctx.fill();
      }
    });
    ctx.restore();

    /* Подписи под шаром здесь нет намеренно: «один центр · четыре офиса»
       уже стоит в колонке акта, и второй раз то же самое — не подпись, а
       эхо. Правило «всё нарисованное называет себя» выполняется тем, что
       у каждой точки есть карточка с адресом. */
    this.placeCards(view, G, seen, live, w, ctx);
  },

  /* ── Карточки филиалов ───────────────────────────────────
     Живут в разметке акта (без JS адреса тоже нужны), а место им даёт
     сцена. На живом сайте у карточки есть то, чего нет у строки списка:
     местное время и зелёная точка «сейчас открыто». Это единственное на
     финальном экране, что меняется само по себе, — и именно оно говорит
     «там сейчас люди», а не «вот наш адрес». */
  findCards(wide) {
    if (!this.host) {
      this.host = document.querySelector('.act[data-act="globe"] .act-offices');
      if (!this.host) return null;
      this.cards = Array.from(this.host.children);
    }
    /* Класс — только на широком экране. Он делает из строк списка
       закреплённые карточки с размытием под ними; на телефоне это и
       не нужно (шар меньше, карточкам негде встать), и дорого:
       backdrop-filter пересчитывается на каждом кадре прокрутки. */
    if (this.host.classList.contains('offices-scene') !== wide) {
      this.host.classList.toggle('offices-scene', wide);
      if (!wide) {
        this.cards.forEach(el => {
          el.style.transform = ''; el.style.opacity = '';
          el._tf = null; el._a = null;
        });
      }
    }
    return this.cards;
  },

  hideCards() {
    if (!this.cards) return;
    this.cards.forEach(el => {
      if (el._a !== 0) { el._a = 0; el.style.opacity = 0; }
    });
  },

  placeCards(view, G, seen, live, w, ctx) {
    /* На телефоне шар меньше экрана и карточки рядом с ним не встают —
       там они остаются обычным списком в колонке. */
    const wide = !view.mobile && view.w >= 900;
    const cards = this.findCards(wide);
    if (!cards) return;
    /* Местное время нужно и в списке на телефоне: строка «09–18 · —»
       выглядит поломкой, а не «здесь могло быть время». Часы обновляются
       раз в двадцать секунд независимо от того, карточки это или список. */
    this.tick = (this.tick || 0) - view.dt;
    const retime = this.tick <= 0;
    if (retime) { this.tick = 20; cards.forEach(localTime); }
    if (!wide) return;

    const right = Math.min(view.w - 16, G.cx + G.R + 40);
    /* Стопку центруем в свободной полосе кадра, а высоту копим по ходу:
       первая версия ставила i-ю карточку на i × (высота этой карточки), и
       карточки с адресом в две строки наезжали на соседние.

       Высоты меряем пять раз в секунду, а не в каждом кадре: offsetHeight
       заставляет браузер считать раскладку, и четыре таких чтения на кадр
       — это ровно та ошибка, из-за которой телефон once уже просел с 60
       кадров до 38 при двух миллисекундах отрисовки. */
    this.sizeAt = (this.sizeAt || 0) - view.dt;
    if (this.sizeAt <= 0 || !this.hs) {
      this.sizeAt = 0.2;
      this.hs = cards.map(el => el.offsetHeight || 96);
      this.ws = cards.map(el => el.offsetWidth || 268);
    }
    const hs = this.hs;
    let total = -12;
    for (let i = 0; i < hs.length; i++) total += hs[i] + 12;
    const band = G.band;
    let y = Math.max(band.top + 12, (band.top + band.bottom) / 2 - total / 2);
    cards.forEach((el, i) => {
      const p = seen[i];
      /* Карточка, которая не помещается в полосу, молчит: под подвалом её
         всё равно не прочитать, а половина карточки хуже её отсутствия. */
      const fits = y + hs[i] <= band.bottom - 8;
      const a = live[i] && fits ? w : 0;
      const x = right;
      const tf = 'translate(' + Math.round(x) + 'px,' + Math.round(y) +
                 'px) translateX(-100%)';
      if (el._tf !== tf) { el._tf = tf; el.style.transform = tf; }
      const av = Math.round(a * 20) / 20;
      if (el._a !== av) { el._a = av; el.style.opacity = av; }
      /* Поводок от точки на шаре к карточке: без него карточка — просто
         подпись у края, и непонятно, к какой точке она относится. */
      if (p && a > 0.05) {
        const ly = y + hs[i] / 2;
        ctx.save();
        ctx.globalAlpha = a * 0.5;
        ctx.strokeStyle = 'rgba(230,194,87,0.85)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(x - this.ws[i] - 6, ly);
        ctx.stroke();
        ctx.restore();
      }
      y += hs[i] + 12;
    });
  },

  enter() {}, leave() { this.hideCards(); },
};

/* Местное время филиала и признак «сейчас открыто».

   Часовой пояс берём из data-tz, а не считаем по долготе: летнее время
   долготой не выводится, а ошибка на час в строке «сейчас 16:14» хуже,
   чем её отсутствие. */
function localTime(el) {
  const tz = el.dataset.tz;
  const out = el.querySelector('.office-now');
  if (!tz || !out) return;
  const now = new Date();
  try {
    const hhmm = new Intl.DateTimeFormat('ru-RU',
      { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(now);
    const hour = parseInt(new Intl.DateTimeFormat('en-GB',
      { timeZone: tz, hour: '2-digit', hour12: false }).format(now), 10);
    const day = new Date(now.toLocaleString('en-US', { timeZone: tz })).getDay();
    const open = day >= 1 && day <= 5 && hour >= 9 && hour < 18;
    if (out.textContent !== hhmm) out.textContent = hhmm;
    const flag = open ? '1' : '0';
    if (el.dataset.open !== flag) el.dataset.open = flag;
  } catch (e) {
    out.textContent = '';
  }
}

/* Ортографическая проекция: точки на обратной стороне не рисуются вовсе —
   шар непрозрачный, и просвечивающие сквозь него точки читались бы как
   ошибка. */
function project(lon, lat, spin, cx, cy, R) {
  const la = lat * Math.PI / 180;
  const lo = (lon * Math.PI / 180) + spin;
  const z = Math.cos(la) * Math.cos(lo);
  if (z < 0) return null;
  return [cx + Math.cos(la) * Math.sin(lo) * R, cy - Math.sin(la) * R];
}

/* Прорежение контуров: один раз при загрузке.

   Прорежение по расстоянию, а не «каждая k-я точка». Первая версия брала
   каждую пятую-восьмую — и материки рассыпались на осколки: у мелких
   контуров оставалось три-четыре точки, и вместо береговой линии
   получались треугольники. Здесь точка сохраняется, только если ушла от
   предыдущей дальше порога, поэтому длинные ровные участки прореживаются
   сильно, а изрезанные — почти нет. */
function simplify(geo, MIN) {
  const out = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (!g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates]
                : g.type === 'MultiPolygon' ? g.coordinates : [];
    for (const poly of polys) {
      for (const r of poly) {
        if (r.length < 4) continue;       /* точка-остров: на шаре не видна */
        /* Кольцо мельче шага прорежения на шаре не различить: оно даст
           треугольник в два пикселя, то есть мусор, а не остров. */
        let x0 = 180, x1 = -180, y0 = 90, y1 = -90;
        for (let i = 0; i < r.length; i++) {
          if (r[i][0] < x0) x0 = r[i][0];
          if (r[i][0] > x1) x1 = r[i][0];
          if (r[i][1] < y0) y0 = r[i][1];
          if (r[i][1] > y1) y1 = r[i][1];
        }
        if (Math.max(x1 - x0, y1 - y0) < MIN * 2.5) continue;
        const pts = [r[0][0], r[0][1]];
        let lx = r[0][0], ly = r[0][1];
        for (let i = 1; i < r.length; i++) {
          const x = r[i][0], y = r[i][1];
          if (Math.abs(x - lx) + Math.abs(y - ly) < MIN) continue;
          pts.push(x, y); lx = x; ly = y;
        }
        if (pts.length >= 10) out.push(pack(pts));
      }
    }
  }
  return out;
}

/* Точка хранится не как «долгота и широта», а как четыре числа:
   sinLat, cosLat, sinLon, cosLon. Поворот шара тогда не требует ни одного
   вызова синуса — только формула сложения углов. Память та же (четыре
   числа вместо двух, но Float32 вместо Float64), а кадр дешевеет в разы. */
function pack(deg) {
  const out = new Float32Array(deg.length * 2);
  /* Заодно считаем середину кольца и его угловой радиус: по ним кольцо,
     целиком ушедшее на обратную сторону, отбрасывается одним сравнением,
     не перебирая точек. В любой момент за шаром примерно половина суши —
     это половина работы кадра, которую раньше делали впустую. */
  let mx = 0, my = 0, mz = 0;
  for (let i = 0, j = 0; i < deg.length; i += 2, j += 4) {
    const lo = deg[i] * RAD, la = deg[i + 1] * RAD;
    const sla = Math.sin(la), cla = Math.cos(la);
    const slo = Math.sin(lo), clo = Math.cos(lo);
    out[j] = sla; out[j + 1] = cla; out[j + 2] = slo; out[j + 3] = clo;
    mx += cla * slo; my += sla; mz += cla * clo;
  }
  const d = Math.hypot(mx, my, mz) || 1;
  mx /= d; my /= d; mz /= d;
  let cosMin = 1;
  for (let j = 0; j < out.length; j += 4) {
    const dot = out[j + 1] * out[j + 2] * mx + out[j] * my +
                out[j + 1] * out[j + 3] * mz;
    if (dot < cosMin) cosMin = dot;
  }
  /* Долгота середины — в том же виде, что у точек: синус и косинус */
  const lonC = Math.atan2(mx, mz);
  out.cLat = Math.hypot(mx, mz);              /* cos(широты середины) */
  out.sLon = Math.sin(lonC); out.cLon = Math.cos(lonC);
  out.sinRho = Math.sqrt(Math.max(0, 1 - cosMin * cosMin));
  return out;
}

/* Кольцо на холст.

   closed = true для контуров материков, false для сетки (там разрыв — это
   просто разрыв линии).

   Как замыкается контур, уходящий за край. Прошлая версия прижимала
   каждую заднюю точку к ободу. Для одиночной страны это работало, а для
   Антарктиды — нет: её кольцо обходит полюс по всем долготам, задняя
   часть прижималась к ободу и обходила его кругом, и заливка накрывала
   весь диск. Владелец видел это как «время от времени появляются
   странные шейдеры» — шар превращался в золотую кляксу и обратно.

   Теперь задние точки не рисуются вовсе, а разрыв замыкается ДУГОЙ ОБОДА
   по короткой стороне. Для страны, наполовину ушедшей за край, короткая
   дуга и есть её край. Для Антарктиды точки входа и выхода на ободе
   оказываются рядом, короткая дуга между ними крошечная — и остаётся
   ровно видимая полоса материка, а не диск. Кляксы взяться неоткуда:
   путь физически не может обойти обод.

   Возвращает false, если ничего не нарисовано. */
function trace(ctx, r, cx, cy, R, cs, ss, closed) {
  if (!closed) ctx.beginPath();
  let started = false, gap = false, first = 0, last = 0;
  for (let j = 0; j < r.length; j += 4) {
    const sla = r[j], cla = r[j + 1], slo = r[j + 2], clo = r[j + 3];
    const sinLo = slo * cs + clo * ss;
    const cosLo = clo * cs - slo * ss;
    if (cla * cosLo < 0) { gap = true; if (!closed) started = false; continue; }
    const x = cla * sinLo, y = sla;
    const sx = cx + x * R, sy = cy - y * R;
    const ang = Math.atan2(-y, x);
    if (!started) { ctx.moveTo(sx, sy); started = true; first = ang; }
    else if (gap && closed) { limb(ctx, cx, cy, R, last, ang); ctx.lineTo(sx, sy); }
    else ctx.lineTo(sx, sy);
    gap = false; last = ang;
  }
  if (closed && started) {
    if (gap) limb(ctx, cx, cy, R, last, first);
    ctx.closePath();
  }
  return started;
}

/* Дуга обода от a до b по короткой стороне.

   Коротким разрывам дуга не нужна: почти все они — одна-две точки на
   краю, где прямая и дуга отличаются меньше чем на пиксель, а arc()
   браузер всё равно разложит на отрезки. Проверка дешевле разложения. */
function limb(ctx, cx, cy, R, a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (Math.abs(d) * R < 3) { ctx.lineTo(cx + Math.cos(b) * R, cy + Math.sin(b) * R); return; }
  ctx.arc(cx, cy, R, a, b, d < 0);
}

/* Сетка меридианов и параллелей — теми же упакованными кольцами */
function graticule(step) {
  const out = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lon = -180; lon <= 180; lon += step) pts.push(lon, lat);
    out.push(pack(pts));
  }
  for (let lon = 0; lon < 360; lon += 30) {
    const pts = [];
    for (let lat = -90; lat <= 90; lat += step) pts.push(lon, lat);
    out.push(pack(pts));
  }
  return out;
}

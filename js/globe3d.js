/**
 * globe3d.js — Three.js 3D globe for act-contact finale.
 * Gold continents texture (world-map.svg) + wireframe graticule,
 * drag-to-rotate, auto-spin.
 */
(function () {
  'use strict';

  const GOLD       = 0xC9A227;
  /* Ядро офисной точки — светлее фирменного золота: на этой карте океан
     сам золотой, и точка цвета C9A227 над водой пропадает. */
  const OFFICE_DOT = 0xFFE9A8;
  const NEWS       = 0xBFD2E0;   /* холодный — «мир», в отличие от золота «мы» */
  const DARK_BG    = 0x07060c;
  const AUTO_SPEED = 0.0028;

  /* Четыре офиса. Координаты держим здесь, а не в общем справочнике: это
     наши адреса из разметки секции, а не страны из ленты. */
  const OFFICES = [
    { lon:  8.42, lat: 47.28 },   /* Obfelden */
    { lon: -9.14, lat: 38.72 },   /* Lisboa   */
    { lon: 28.86, lat: 47.01 },   /* Chișinău */
    { lon: 55.27, lat: 25.20 },   /* Dubai    */
  ];

  const NEWS_SLOTS = 5;           /* больше — глобус превращается в гирлянду */

  /* Куда на текстуре попадает точка с координатами lon/lat.

     Наивная формула «u = (lon+180)/360, v = (90−lat)/180» здесь неверна:
     assets/finale/world-map.svg — не чистая равнопромежуточная картинка на
     весь viewBox. Карта занимает 91% его ширины и 90% высоты, со сдвигом
     вниз и вправо (внизу ещё полоса-градиент под Антарктиду). С наивной
     формулой офис в Обфельдене вставал в Данию, а Кишинёв — под Минск:
     ошибка в 4° по широте и 14° по долготе, ровно на глаз.

     Коэффициенты подобраны сопоставлением этой SVG с эталоном world-atlas
     в равнопромежуточной проекции — tools/mapfit.html; совпадение профилей
     0.994 по долготе и 0.9985 по широте, проверено по мысу Игольному
     (20.02E, 34.83S): расчёт 1419×1029 px, на картинке 1416×1028. */
  const TEX_U_K = 0.909747, TEX_U_B = 0.010172;
  const TEX_V_K = 0.905217, TEX_V_B = 0.041687;

  function llToVec(THREE, lon, lat, r) {
    /* u — вдоль экватора, v — сверху вниз, как строки картинки */
    const u = TEX_U_K * (lon + 180) / 360 + TEX_U_B;
    const v = TEX_V_K * (90 - lat) / 180 + TEX_V_B;
    const phi = u * Math.PI * 2, theta = v * Math.PI;
    return new THREE.Vector3(
      -r * Math.cos(phi) * Math.sin(theta),
       r * Math.cos(theta),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* ── Build canvas texture from world-map.svg ─────────────── */
  function buildGlobeTexture(THREE, onReady) {
    const W = 2048, H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0d0b14';
    ctx.fillRect(0, 0, W, H);

    // Direct img.src avoids Blob URL — Chrome не применяет CSS-классы (.land)
    // из <style>-блока SVG при рендере через Blob URL в canvas.
    var img = new Image(W, H);
    img.onload = function () {
      ctx.drawImage(img, 0, 0, W, H);
      onReady(new THREE.CanvasTexture(canvas));
    };
    img.onerror = function () { onReady(null); };
    img.src = 'assets/finale/world-map.svg';
  }

  function initGlobe3D() {
    if (window.innerWidth < 768) return; // mobile handled by globe-mobile.js
    const mask = document.querySelector('.globe-mask');
    if (!mask || !window.THREE) return;

    const THREE = window.THREE;
    const W = mask.offsetWidth  || 340;
    const H = mask.offsetHeight || 340;

    /* ── Scene ─────────────────────────────────────────────── */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 50);
    camera.position.z = 3.3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(DARK_BG, 1);

    mask.innerHTML = '';
    const canvas = renderer.domElement;
    canvas.style.cssText = 'width:100%;height:100%;display:block;';
    mask.appendChild(canvas);

    const root = new THREE.Group();
    scene.add(root);

    /* ── Sphere (texture applied when SVG loads) ─────────────── */
    const sphereMat = new THREE.MeshPhongMaterial({
      color:     0x0d0b14,
      emissive:  0x070610,
      shininess: 0,
      specular:  0x000000,
    });
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 64),
      sphereMat
    );
    root.add(sphere);

    // Load continents texture async
    buildGlobeTexture(THREE, function (tex) {
      if (!tex) return;
      sphereMat.map = tex;
      sphereMat.color.set(0xffffff);   // let texture drive color
      sphereMat.emissive.set(0x000000);
      sphereMat.needsUpdate = true;
    });

    /* ── Gold graticule — явные окружности без диагоналей ───── */
    (function buildGraticule() {
      const R   = 1.004;
      const SEG = 128;   // точек на окружность (гладкость)
      const mat = new THREE.LineBasicMaterial({
        color: GOLD, transparent: true, opacity: 0.30,
      });
      const grp = new THREE.Group();

      // Параллели (широта через 20°)
      for (let lat = -80; lat <= 80; lat += 20) {
        const r = R * Math.cos(lat * Math.PI / 180);
        const y = R * Math.sin(lat * Math.PI / 180);
        const pts = [];
        for (let i = 0; i <= SEG; i++) {
          const t = (i / SEG) * Math.PI * 2;
          pts.push(new THREE.Vector3(r * Math.cos(t), y, r * Math.sin(t)));
        }
        grp.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts), mat
        ));
      }

      // Меридианы (долгота через 20°)
      for (let lon = 0; lon < 360; lon += 20) {
        const theta = lon * Math.PI / 180;
        const pts = [];
        for (let i = 0; i <= SEG; i++) {
          const phi = (i / SEG) * Math.PI * 2;
          pts.push(new THREE.Vector3(
            R * Math.cos(phi) * Math.cos(theta),
            R * Math.sin(phi),
            R * Math.cos(phi) * Math.sin(theta)
          ));
        }
        grp.add(new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts), mat
        ));
      }

      root.add(grp);
    })();

    /* ── Точки: четыре офиса и живая гео-лента ───────────────
       Две разные вещи на одном шаре, и их нельзя путать. Офисы — золото,
       ровный свет, всегда на месте: это мы. Новости — холодные, мельче и
       вспыхивают по одной: это мир, который сейчас шумит. Если бы точки
       ленты были такими же золотыми, четыре наших адреса растворились бы
       среди сорока чужих, а секция называется «контакты».

       Точки живут внутри root и крутятся вместе с глобусом, а шар
       непрозрачный — обратная сторона гаснет сама, без ручного отсечения. */
    const marks = new THREE.Group();
    root.add(marks);

    /* Размеры точек задаём в пикселях, а не в долях радиуса: контейнер
       глобуса — min(96vh, 96vw), и одна и та же доля даёт на ноутбуке
       аккуратную точку, а на большом мониторе кляксу. Шар при camera.z=3.3
       и fov 38° занимает ≈0.44 высоты кадра на радиус. */
    const unit = 2.27 / H;

    function addDot(v, color, radius, opacity) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 12, 12),
        new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: opacity })
      );
      m.position.copy(v);
      marks.add(m);
      return m;
    }
    function addRing(v, color, inner, outer, opacity) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(inner, outer, 32),
        new THREE.MeshBasicMaterial({ color: color, transparent: true,
                                      opacity: opacity, side: THREE.DoubleSide })
      );
      m.position.copy(v);
      m.lookAt(0, 0, 0);
      marks.add(m);
      return m;
    }

    OFFICES.forEach(function (o) {
      const v = llToVec(THREE, o.lon, o.lat, 1.012);
      /* Тёмный ободок вокруг точки, а не подложка под ней: суша на карте
         золотая, и светлая точка над Португалией без него теряется. Кольцом,
         а не диском — диск при взгляде вкось выезжал из-под точки тенью. */
      addRing(v, 0x08060c, 4.8 * unit, 7.4 * unit, 0.55);
      addDot(v, OFFICE_DOT, 4.5 * unit, 0.95);
      addRing(v, GOLD, 7.6 * unit, 9.2 * unit, 0.7);
    });

    /* Слоты ленты: точка + расходящееся кольцо. Заводим их сразу и
       переставляем по координатам — создавать геометрию на каждую новость
       значит собирать мусор прямо в кадре. */
    const newsSlots = [];
    for (let i = 0; i < NEWS_SLOTS; i++) {
      const zero = new THREE.Vector3(0, 0, 0);
      newsSlots.push({
        dot:  addDot(zero, NEWS, 3 * unit, 0),
        ring: addRing(zero, NEWS, 5 * unit, 6 * unit, 0),
        t: 0, life: 0, wait: i * 0.9, point: null,
      });
    }

    let geoPool = [];
    function setPool(items) {
      geoPool = (items || []).filter(function (o) {
        return o && o.ll && typeof o.ll[0] === 'number' && typeof o.ll[1] === 'number';
      });
    }
    setPool(window.SBF_GEO_POINTS);
    document.addEventListener('sbf:geofeed', function (e) { setPool(e.detail); });

    function pickPoint(taken) {
      if (!geoPool.length) return null;
      for (let n = 0; n < 12; n++) {
        const p = geoPool[Math.floor(Math.random() * geoPool.length)];
        if (taken.indexOf(p.id) === -1) return p;
      }
      return null;
    }

    function stepNews(dt) {
      const taken = newsSlots.map(function (s) { return s.point ? s.point.id : null; });
      newsSlots.forEach(function (s) {
        if (!s.point) {
          s.wait -= dt;
          if (s.wait > 0) return;
          const p = pickPoint(taken);
          if (!p) { s.wait = 1.5; return; }
          s.point = p;
          s.t = 0;
          s.life = 5.5 + Math.random() * 2.5;
          const v = llToVec(THREE, p.ll[0], p.ll[1], 1.012);
          s.dot.position.copy(v);
          s.ring.position.copy(v);
          s.ring.lookAt(0, 0, 0);
          return;
        }
        s.t += dt;
        const u = s.t / s.life;
        if (u >= 1) {
          s.point = null;
          s.dot.material.opacity = 0;
          s.ring.material.opacity = 0;
          s.wait = 0.4 + Math.random() * 1.2;
          return;
        }
        /* Появление и уход — по краям жизни, между ними ровный свет */
        const fade = Math.min(1, u / 0.14) * Math.min(1, (1 - u) / 0.18);
        s.dot.material.opacity = 0.62 * fade;
        /* Кольцо расходится один раз, в начале: это «здесь только что
           произошло», а не мигающая лампочка */
        const r = Math.min(1, u / 0.45);
        s.ring.scale.setScalar(1 + r * 2.6);
        s.ring.material.opacity = 0.5 * (1 - r) * Math.min(1, u / 0.1);
      });
    }

    /* ── Atmosphere — gold rim glow ─────────────────────────── */
    root.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        vertexShader: `
          varying vec3 vN;
          void main(){
            vN = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          varying vec3 vN;
          void main(){
            float i = pow(max(0.0, 0.68 - dot(vN, vec3(0,0,1.0))), 2.2);
            gl_FragColor = vec4(0.80, 0.64, 0.15, 1.0) * i * 0.85;
          }`,
      })
    ));

    /* ── Lights ─────────────────────────────────────────────── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.50));
    const key = new THREE.DirectionalLight(0xffffff, 0.52);
    key.position.set(4, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xC9A227, 0.12);
    fill.position.set(-4, -2, -3);
    scene.add(fill);

    /* ── Drag interaction ───────────────────────────────────── */
    let drag = false, px = 0, py = 0;
    /* Начальный поворот — Европа и Ближний Восток лицом к зрителю: три из
       четырёх офисов и почти вся лента живут там. При прежнем 0.3 секция
       контактов открывалась пустой Атлантикой и золотых точек ждали полминуты. */
    let rotY = -1.9, rotX = -0.08;

    canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', e => {
      drag = true;
      px = e.clientX; py = e.clientY;
      canvas.style.cursor = 'grabbing';
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointerup', e => {
      drag = false;
      canvas.style.cursor = 'grab';
      canvas.releasePointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag) return;
      rotY += (e.clientX - px) * 0.006;
      rotX = Math.max(-0.85, Math.min(0.85, rotX + (e.clientY - py) * 0.006));
      px = e.clientX; py = e.clientY;
    });

    /* ── Animation loop ─────────────────────────────────────── */
    let raf = null, active = false, prev = 0;

    function animate(now) {
      raf = requestAnimationFrame(animate);
      /* Метка rAF бывает раньше performance.now(): без клампа dt уходит в
         минус и вспышки ленты идут назад по времени. */
      const dt = prev ? Math.max(0, Math.min(0.05, (now - prev) / 1000)) : 0;
      prev = now;
      stepNews(dt);
      if (!drag) rotY += AUTO_SPEED;
      root.rotation.y = rotY;
      root.rotation.x = rotX;
      renderer.render(scene, camera);
    }

    function start() {
      if (active) return;
      active = true;
      animate();
    }
    function stop() {
      active = false;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    /* ── Snap section hooks ─────────────────────────────────── */
    const section = document.getElementById('act-contact');
    if (section) {
      section.addEventListener('snap-enter', start);
      section.addEventListener('snap-leave', stop);
    }

    /* ── Resize ─────────────────────────────────────────────── */
    const onResize = () => {
      const w = mask.offsetWidth  || W;
      const h = mask.offsetHeight || H;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onResize);
    }

    /* Start if already visible */
    if (section) {
      const rect = section.getBoundingClientRect();
      if (Math.abs(rect.top) < window.innerHeight * 0.15) start();
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGlobe3D);
  } else {
    initGlobe3D();
  }
})();

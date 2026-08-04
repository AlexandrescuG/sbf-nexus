/**
 * globe3d.js — Three.js 3D globe for act-contact finale.
 * Gold continents texture (world-map.svg) + wireframe graticule,
 * drag-to-rotate, auto-spin.
 */
(function () {
  'use strict';

  const GOLD       = 0xC9A227;
  const DARK_BG    = 0x07060c;
  const AUTO_SPEED = 0.0028;

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
    let rotY = 0.3, rotX = -0.08;

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
    let raf = null, active = false;

    function animate() {
      raf = requestAnimationFrame(animate);
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

/* ============================================================
   SBF NEXUS — Application Core
   Scroll · Portal · Map · Charts · Space Journey
   ============================================================ */

gsap.registerPlugin(ScrollTrigger);

/* ── Utility ─────────────────────────────────────────────── */
const q = id => document.getElementById(id);

/* ── Portal Engine ───────────────────────────────────────── */
const portal   = q('global-portal');
const pContent = q('portal-media');
const backdrop = q('portal-backdrop');
let portalOpen = false;
let chartInited = false;

function openPortal(panelId) {
    if (portalOpen) collapsePortal(false);

    document.querySelectorAll('.portal-panel').forEach(p => p.classList.remove('active'));
    const panel = q(panelId);
    if (panel) panel.classList.add('active');

    const isMobile = window.innerWidth <= 600;
    const pw = isMobile ? '92vw' : '76vw';
    const ph = isMobile ? '75vh' : '70vh';

    backdrop.classList.add('visible');
    gsap.to(portal, {
        width: pw, height: ph,
        borderRadius: '3px',
        duration: isMobile ? 0.75 : 0.95,
        ease: 'expo.out',
        onComplete() {
            pContent.classList.add('visible');
            portalOpen = true;
            if (panelId === 'portal-charts' && !chartInited) {
                initChartCanvas();
                chartInited = true;
            }
            if (panelId === 'portal-history') revealFigures();
        }
    });
}

function collapsePortal(resetFlag = true) {
    pContent.classList.remove('visible');
    backdrop.classList.remove('visible');
    setTimeout(() => {
        gsap.to(portal, {
            width: '14px', height: '14px',
            borderRadius: '50%',
            duration: 0.7,
            ease: 'expo.in'
        });
        if (resetFlag) portalOpen = false;
    }, 250);
}

/* ── Portal ScrollTriggers ───────────────────────────────── */
// Portal fires on dedicated spacer sections (empty snap blocks)
// so the portal never overlaps section text content
[
    { trigger: '#spacer-news',    panel: 'portal-news' },
    { trigger: '#spacer-charts',  panel: 'portal-charts' },
    { trigger: '#spacer-history', panel: 'portal-history' },
].forEach(({ trigger, panel }) => {
    ScrollTrigger.create({
        trigger,
        start: 'top 60%',
        end:   'bottom top',
        onEnter:     () => openPortal(panel),
        onLeave:     () => collapsePortal(),
        onEnterBack: () => openPortal(panel),
        onLeaveBack: () => collapsePortal(),
    });
});

/* ── Leaflet World Map ───────────────────────────────────── */
(function initMap() {
    const map = L.map('world-map', {
        center: [25, 10],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: false,
        keyboard: false,
        doubleClickZoom: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 6, subdomains: 'abcd'
    }).addTo(map);

    const mkIcon = () => L.divIcon({
        className: '',
        html: `<div style="
            width:8px;height:8px;
            background:#d4af37;border-radius:50%;
            box-shadow:0 0 0 0 rgba(212,175,55,0.5);
            animation:mapPulse 2s infinite;
        "></div>`,
        iconSize: [8, 8], iconAnchor: [4, 4]
    });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes mapPulse {
            0%   { box-shadow: 0 0 0 0 rgba(212,175,55,0.6); }
            70%  { box-shadow: 0 0 0 8px rgba(212,175,55,0); }
            100% { box-shadow: 0 0 0 0 rgba(212,175,55,0); }
        }
    `;
    document.head.appendChild(style);

    [
        { lat: 38.9,  lng: -77.0, label: 'FED',  note: 'Rate Decision Pending' },
        { lat: 51.5,  lng: -0.1,  label: 'BOE',  note: 'CPI Surprise −0.4%' },
        { lat: 50.1,  lng:  8.7,  label: 'ECB',  note: 'Policy Hold · Jun Cut?' },
        { lat: 35.7,  lng: 139.7, label: 'BOJ',  note: 'Yen 155 Intervention' },
        { lat: 31.2,  lng: 121.5, label: 'PBOC', note: 'RRR Cut −50bps' },
        { lat: 55.75, lng:  37.6, label: 'CBR',  note: 'Rate Hold 16%' },
        { lat: -33.9, lng: 151.2, label: 'RBA',  note: 'Rate Pause Confirmed' },
    ].forEach(m => {
        L.marker([m.lat, m.lng], { icon: mkIcon() })
            .bindTooltip(`<strong>${m.label}</strong><br>${m.note}`, {
                className: 'map-tooltip',
                permanent: false,
                offset: [8, 0]
            })
            .addTo(map);
    });

    /* Даём доступ к карте для city-lines canvas */
    window._sbfMap = map;
})();

/* ── News Ticker ─────────────────────────────────────────── */
(function initTicker() {
    const track = q('ticker-track');
    if (!track) return;
    const w = track.scrollWidth / 2;
    gsap.to(track, { x: -w, duration: 45, ease: 'none', repeat: -1 });
})();

/* ── Chart Canvas (Portal 2) ─────────────────────────────── */
function initChartCanvas() {
    const canvas = q('portal-chart-canvas');
    if (!canvas) return;

    const resize = () => {
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
    };
    resize();

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    /* Generate synthetic OHLC */
    const candles = (() => {
        const out = [];
        let price = H * 0.42;
        for (let i = 0; i < 65; i++) {
            const drift = (Math.random() - 0.47) * (H * 0.035);
            const o = price;
            const c = price + drift;
            const h = Math.min(o, c) - Math.random() * (H * 0.012);
            const l = Math.max(o, c) + Math.random() * (H * 0.012);
            out.push({ o, c, h: Math.max(0, h), l: Math.min(H, l) });
            price = Math.min(Math.max(c, H * 0.1), H * 0.85);
        }
        return out;
    })();

    const annotations = [
        { kind: 'line', y: H * 0.63, label: 'STRONG SUPPORT  4,200', color: '#4caf50' },
        { kind: 'line', y: H * 0.30, label: 'KEY RESISTANCE  4,580', color: '#ef5350' },
        { kind: 'zone', x1: W * 0.50, x2: W * 0.70, yc: H * 0.46, label: '◆ BULLISH REVERSAL', color: '#d4af37' },
        { kind: 'ema',  color: 'rgba(100,160,255,0.6)' },
    ];

    function drawGrid() {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 8; i++) {
            ctx.beginPath(); ctx.moveTo(0, H * i / 8); ctx.lineTo(W, H * i / 8); ctx.stroke();
        }
        for (let i = 1; i < 16; i++) {
            ctx.beginPath(); ctx.moveTo(W * i / 16, 0); ctx.lineTo(W * i / 16, H); ctx.stroke();
        }
    }

    function drawCandles(n) {
        const cw = Math.max(2, W / candles.length * 0.72);
        const step = W / candles.length;
        candles.slice(0, n).forEach((c, i) => {
            const x = step * i + step * 0.15;
            const isUp = c.c <= c.o;
            ctx.strokeStyle = isUp ? '#4caf50' : '#ef5350';
            ctx.fillStyle   = isUp ? 'rgba(76,175,80,0.75)' : 'rgba(239,83,80,0.75)';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x + cw / 2, c.h); ctx.lineTo(x + cw / 2, c.l); ctx.stroke();
            const bodyTop = Math.min(c.o, c.c);
            const bodyH   = Math.max(1, Math.abs(c.o - c.c));
            ctx.fillRect(x, bodyTop, cw, bodyH);
        });
    }

    function drawAnnotations(progress) {
        const ema = [];
        const period = 14;
        let sum = 0;
        candles.forEach((c, i) => {
            sum += (c.o + c.c) / 2;
            if (i >= period - 1) {
                if (i === period - 1) ema.push(sum / period);
                else ema.push(ema[ema.length - 1] * (1 - 2 / (period + 1)) + (c.o + c.c) / 2 * (2 / (period + 1)));
                if (i > period) sum -= (candles[i - period].o + candles[i - period].c) / 2;
            }
        });

        const step = W / candles.length;
        const shown = Math.floor(candles.length * progress);

        annotations.forEach((ann, idx) => {
            const t = Math.max(0, progress * 4 - idx);
            if (t <= 0) return;
            const alpha = Math.min(1, t);

            if (ann.kind === 'line') {
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = ann.color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 4]);
                ctx.beginPath(); ctx.moveTo(0, ann.y); ctx.lineTo(W, ann.y); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = ann.color;
                ctx.font = `600 9px Montserrat, sans-serif`;
                ctx.fillText(ann.label, 10, ann.y - 5);
                ctx.globalAlpha = 1;
            }

            if (ann.kind === 'zone') {
                ctx.globalAlpha = alpha * 0.9;
                ctx.strokeStyle = ann.color;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(ann.x1, ann.yc - 28, ann.x2 - ann.x1, 56);
                ctx.setLineDash([]);
                ctx.fillStyle = `rgba(212,175,55,${0.06 * alpha})`;
                ctx.fillRect(ann.x1, ann.yc - 28, ann.x2 - ann.x1, 56);
                ctx.fillStyle = ann.color;
                ctx.font = `bold 9px Montserrat, sans-serif`;
                ctx.fillText(ann.label, ann.x1 + 6, ann.yc - 32);
                ctx.globalAlpha = 1;
            }

            if (ann.kind === 'ema' && ema.length > 1) {
                ctx.globalAlpha = alpha * 0.7;
                ctx.strokeStyle = ann.color;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([]);
                ctx.beginPath();
                ema.slice(0, shown).forEach((y, i) => {
                    const x = step * (i + period - 1) + step * 0.5;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        });
    }

    let frame = 0;
    const totalFrames = 110;
    function animate() {
        ctx.clearRect(0, 0, W, H);
        const p = frame / totalFrames;
        drawGrid();
        drawCandles(Math.floor(candles.length * p));
        drawAnnotations(p);
        if (frame < totalFrames) { frame++; requestAnimationFrame(animate); }
    }
    animate();
}

/* ── History Portal: staggered reveal ───────────────────── */
function revealFigures() {
    document.querySelectorAll('.figure-card').forEach((card, i) => {
        setTimeout(() => card.classList.add('revealed'), i * 180);
    });
}

/* ── Benefit Cards Reveal ────────────────────────────────── */
ScrollTrigger.create({
    trigger: '#screen-trust',
    start: 'top 65%',
    onEnter() {
        document.querySelectorAll('.benefit-card').forEach((card, i) => {
            setTimeout(() => card.classList.add('revealed'), i * 160);
        });
        animateStats();
    }
});

function animateStats() {
    document.querySelectorAll('.stat-num').forEach(el => {
        const target = parseFloat(el.dataset.target);
        const isFloat = String(target).includes('.');
        const duration = 1600;
        const start = performance.now();
        function step(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            const val = target * ease;
            el.textContent = isFloat ? val.toFixed(1) : Math.floor(val);
            if (t < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}

/* ── Team Faces Reveal ───────────────────────────────────── */
ScrollTrigger.create({
    trigger: '#team-reveal',
    start: 'top 72%',
    onEnter() {
        document.querySelectorAll('.team-face').forEach((face, i) => {
            setTimeout(() => face.classList.add('revealed'), i * 130);
        });
    }
});

/* ── Space-to-Office Journey ─────────────────────────────── */
(function initSpaceJourney() {
    const canvas = q('space-canvas');
    const officeFinal = q('office-final');
    if (!canvas) return;

    let started = false;

    ScrollTrigger.create({
        trigger: '#space-journey',
        start: 'top 65%',
        onEnter() {
            if (started) return;
            started = true;
            canvas.width  = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
            runSpaceAnimation(canvas.getContext('2d'), canvas.width, canvas.height, officeFinal);
        }
    });
})();

function runSpaceAnimation(ctx, W, H, officeFinal) {
    /* Star field */
    const stars = Array.from({ length: 280 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.4 + 0.2,
        a: Math.random() * 0.8 + 0.1,
    }));

    let t = 0;
    const TOTAL = 360;

    function easeInOut(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

    function drawStars(zoom) {
        ctx.fillStyle = '#070710';
        ctx.fillRect(0, 0, W, H);
        stars.forEach(s => {
            const sx = W / 2 + (s.x - W / 2) / zoom;
            const sy = H / 2 + (s.y - H / 2) / zoom;
            const alpha = s.a * Math.min(1, 2 / zoom);
            if (alpha < 0.02) return;
            ctx.beginPath();
            ctx.arc(sx, sy, s.r / zoom, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${alpha})`;
            ctx.fill();
        });
    }

    function drawEarth(cx, cy, r, alpha) {
        const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.25, 0, cx, cy, r);
        g.addColorStop(0, `rgba(110,170,230,${alpha})`);
        g.addColorStop(0.55, `rgba(45,105,165,${alpha})`);
        g.addColorStop(1, `rgba(12,35,75,${alpha})`);
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = g; ctx.fill();

        /* Atmosphere glow */
        const ag = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, r * 1.22);
        ag.addColorStop(0, `rgba(80,160,255,${alpha * 0.35})`);
        ag.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
        ctx.fillStyle = ag; ctx.fill();

        /* Continent hints */
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = '#3a8c5a';
        [[cx - r*0.25, cy - r*0.05, r*0.28], [cx + r*0.22, cy - r*0.15, r*0.18],
         [cx - r*0.05, cy + r*0.22, r*0.22]].forEach(([ex, ey, er]) => {
            ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawCityGrid(progress) {
        ctx.fillStyle = '#0a1520';
        ctx.fillRect(0, 0, W, H);

        const vx = W / 2, vy = H * 0.28;
        ctx.globalAlpha = progress * 0.7;
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 0.5;
        for (let i = -12; i <= 12; i++) {
            ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(W / 2 + i * 55, H); ctx.stroke();
        }
        for (let j = 1; j <= 10; j++) {
            const fy = vy + (H - vy) * (j / 10) * Math.pow(progress, 0.6);
            const sp = (fy - vy) / (H - vy);
            ctx.beginPath(); ctx.moveTo(vx - sp * W * 0.65, fy); ctx.lineTo(vx + sp * W * 0.65, fy); ctx.stroke();
        }
        ctx.globalAlpha = 1;

        /* Skyline */
        const buildings = [
            { x: 0.06, w: 50, h: 0.38 }, { x: 0.16, w: 70, h: 0.54 },
            { x: 0.28, w: 42, h: 0.33 }, { x: 0.38, w: 90, h: 0.64 },
            { x: 0.54, w: 60, h: 0.44 }, { x: 0.66, w: 78, h: 0.52 },
            { x: 0.78, w: 48, h: 0.37 }, { x: 0.88, w: 55, h: 0.46 },
        ];
        buildings.forEach(b => {
            const bh = H * b.h * progress;
            const grd = ctx.createLinearGradient(0, H - bh, 0, H);
            grd.addColorStop(0, 'rgba(30,50,80,0.95)');
            grd.addColorStop(1, 'rgba(15,25,45,0.95)');
            ctx.fillStyle = grd;
            ctx.fillRect(W * b.x, H - bh, b.w, bh);
            /* windows */
            ctx.fillStyle = `rgba(212,175,55,${0.7 * progress})`;
            for (let wr = 1; wr <= 8; wr++) for (let wc = 1; wc <= 3; wc++) {
                const wx = W * b.x + b.w * wc / 4 - 3;
                const wy = H - bh + bh * wr / 9;
                if (wy > H - bh + 10 && Math.random() > 0.25)
                    ctx.fillRect(wx, wy, 5, 4);
            }
        });
    }

    function drawBuilding(progress) {
        ctx.fillStyle = '#080e18';
        ctx.fillRect(0, 0, W, H);

        const bx = W * 0.22, bw = W * 0.56;
        const bh = H * 0.75 * progress;
        const by = H - bh;

        /* Facade */
        const fg = ctx.createLinearGradient(bx, by, bx + bw, H);
        fg.addColorStop(0, '#1a2d45');
        fg.addColorStop(1, '#0d1b2a');
        ctx.fillStyle = fg;
        ctx.fillRect(bx, by, bw, bh);

        /* Edges */
        ctx.strokeStyle = 'rgba(212,175,55,0.15)';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);

        /* Windows */
        const rows = 9, cols = 7;
        for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) {
            const wx = bx + bw * c / (cols + 1) - 7;
            const wy = by + bh * r / (rows + 1) - 5;
            if (wy > by + 8) {
                const lit = Math.random() > 0.3;
                ctx.fillStyle = lit
                    ? `rgba(212,175,55,${0.5 + Math.random() * 0.3})`
                    : `rgba(255,255,255,0.05)`;
                ctx.fillRect(wx, wy, 13, 10);
            }
        }

        /* Logo */
        if (progress > 0.65) {
            const a = (progress - 0.65) / 0.35;
            ctx.globalAlpha = a;
            ctx.fillStyle = '#d4af37';
            ctx.font = `700 ${Math.floor(22 * progress)}px Montserrat, sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('SBF', W / 2, by + 42);
            ctx.font = `400 10px Montserrat, sans-serif`;
            ctx.fillStyle = '#a08c78';
            ctx.fillText('CONSULT  MANAGEMENT', W / 2, by + 60);
            ctx.textAlign = 'left';
            ctx.globalAlpha = 1;
        }
    }

    function render() {
        const p = Math.min(t / TOTAL, 1);

        if (p < 0.3) {
            /* Phase 1: Space → Earth appears */
            const zoom = 1 + p / 0.3 * 4;
            drawStars(zoom);
            drawEarth(W / 2, H / 2, 55 + (p / 0.3) * 90, p / 0.3);

        } else if (p < 0.6) {
            /* Phase 2: Earth → City zoom */
            const lp = easeInOut((p - 0.3) / 0.3);
            drawCityGrid(lp);

        } else if (p < 0.88) {
            /* Phase 3: City → Building zoom */
            const lp = easeInOut((p - 0.6) / 0.28);
            drawBuilding(lp);

        } else {
            /* Phase 4: Fade to office contact */
            const lp = (p - 0.88) / 0.12;
            drawBuilding(1);
            officeFinal.style.opacity = String(Math.min(1, lp));
        }

        if (t < TOTAL) {
            t++;
            requestAnimationFrame(render);
        }
    }
    render();
}

/* ── Section text fade-in ────────────────────────────────── */
document.querySelectorAll('.screen-section').forEach(sec => {
    const els = sec.querySelectorAll('.text-block, .data-aside, .section-meta, .team-intro');
    if (!els.length) return;
    gsap.fromTo(els,
        { opacity: 0, y: 35 },
        { opacity: 1, y: 0, duration: 0.85, stagger: 0.12, ease: 'power2.out',
          scrollTrigger: { trigger: sec, start: 'top 78%' } }
    );
});

/* ── Active node pulse ───────────────────────────────────── */
gsap.to('.static-node.is-active', {
    borderColor: 'rgba(212,175,55,0.5)',
    boxShadow: '0 0 18px rgba(212,175,55,0.12)',
    duration: 1.4, repeat: -1, yoyo: true, ease: 'sine.inOut'
});

/* ── Header scroll state ─────────────────────────────────── */
ScrollTrigger.create({
    trigger: 'body',
    start: '80px top',
    onEnter:     () => q('site-header').classList.add('scrolled'),
    onLeaveBack: () => q('site-header').classList.remove('scrolled'),
});

/* ══════════════════════════════════════════════════════════
   BRAIN NERVE CANVAS  — «Клубок»
   14 независимых нитей разной длины, скорости, характера.
   Хаотичное расположение — не симметричные пучки.
   Периодически нить «затягивает» информацию к центру.
   ══════════════════════════════════════════════════════════ */
(function initBrainNerve() {

    /* ── Мозг: HTML-div с CSS-кропом изображения ── */
    const brainDiv = document.createElement('div');
    brainDiv.id    = 'brain-center-el';
    Object.assign(brainDiv.style, {
        position:           'fixed',
        width:              '64px',
        height:             '64px',
        top:                '50%',
        left:               '50%',
        transform:          'translate(-50%, -50%)',
        borderRadius:       '50%',
        overflow:           'hidden',
        zIndex:             '28',
        pointerEvents:      'none',
        backgroundImage:    "url('brain.jpg')",
        backgroundSize:     '1536px 2752px',
        /* Мозг центрирован в оригинале на (768, 1400); element 64×64 → offset -(768-32) -(1400-32) */
        backgroundPosition: '-736px -1368px',
        opacity:            '1',
        transition:         'opacity 0.8s ease',
    });
    document.body.appendChild(brainDiv);

    /* Fade вместе с canvas при скролле */
    window.addEventListener('scroll', () => {
        const p = Math.min(window.scrollY / window.innerHeight, 1);
        brainDiv.style.opacity = String(Math.max(0, 1 - p * 2));
    }, { passive: true });

    const cv = document.createElement('canvas');
    cv.id    = 'brain-nerve-canvas';
    Object.assign(cv.style, {
        position:      'fixed',
        inset:         '0',
        pointerEvents: 'none',
        zIndex:        '25',
        opacity:       '1',
        transition:    'opacity 1.2s ease',
    });
    document.body.insertBefore(cv, document.body.firstChild);

    const ctx = cv.getContext('2d');
    let W, H, DPR;

    function resize() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        W   = window.innerWidth;
        H   = window.innerHeight;
        DPR = Math.min(window.devicePixelRatio || 1, 3);
        cv.width  = W * DPR;
        cv.height = H * DPR;
        cv.style.width  = W + 'px';
        cv.style.height = H + 'px';
        ctx.scale(DPR, DPR);
    }

    /* Hermite Value Noise 2D */
    const lerp     = (a, b, t) => a + (b - a) * t;
    const hermite  = t => t * t * (3.0 - 2.0 * t);
    const pseudo2D = (x, y) => {
        const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
        return s - Math.floor(s);
    };
    const noise2D = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix,        fy = y - iy;
        const ux = hermite(fx),   uy = hermite(fy);
        return lerp(
            lerp(pseudo2D(ix,   iy),   pseudo2D(ix+1, iy),   ux),
            lerp(pseudo2D(ix,   iy+1), pseudo2D(ix+1, iy+1), ux),
            uy
        ) * 2 - 1;
    };

    let time = 0;
    let rafId;

    /* ── 14 независимых нитей — намеренно без симметрии ────────
       Углы скучкованы в некоторых зонах и разрежены в других.
       a   — угол выхода из центра  l  — длина (×baseLen)
       f   — частота шума           s  — скорость шума
       amp — амплитуда изгиба       lw — толщина линии
       seed — уникальная фаза                               */
    const THREADS = [
        { a: -3.02, l: 0.70, f: 2.4, s: 0.40, amp: 0.44, lw: 0.55, seed:  7.3 },
        { a: -2.74, l: 1.40, f: 1.6, s: 0.27, amp: 0.22, lw: 0.88, seed: 23.1 },
        { a: -2.25, l: 0.95, f: 2.9, s: 0.58, amp: 0.38, lw: 0.64, seed: 41.8 },
        { a: -1.90, l: 0.55, f: 3.3, s: 0.82, amp: 0.54, lw: 0.42, seed: 58.2 },
        { a: -1.52, l: 1.55, f: 1.8, s: 0.43, amp: 0.28, lw: 0.92, seed: 74.5 },
        { a: -1.15, l: 1.05, f: 2.4, s: 0.65, amp: 0.34, lw: 0.70, seed: 91.3 },
        { a: -0.80, l: 0.82, f: 2.0, s: 0.36, amp: 0.40, lw: 0.60, seed: 12.7 },
        { a: -0.52, l: 1.30, f: 1.5, s: 0.50, amp: 0.24, lw: 0.82, seed: 35.9 },
        { a: -0.10, l: 0.90, f: 2.7, s: 0.72, amp: 0.46, lw: 0.65, seed: 53.4 },
        { a:  0.40, l: 1.45, f: 2.1, s: 0.54, amp: 0.32, lw: 0.86, seed: 68.7 },
        { a:  0.95, l: 0.65, f: 3.1, s: 0.78, amp: 0.50, lw: 0.48, seed: 82.1 },
        { a:  1.50, l: 1.20, f: 1.9, s: 0.41, amp: 0.28, lw: 0.76, seed: 96.4 },
        { a:  2.10, l: 0.85, f: 2.5, s: 0.60, amp: 0.36, lw: 0.58, seed: 15.8 },
        { a:  2.65, l: 1.35, f: 1.7, s: 0.31, amp: 0.20, lw: 0.82, seed: 44.2 },
    ];

    /* ── Состояние «затягивания» ────────────────────────────────
       Одна случайная нить периодически тянет искру к центру.   */
    let pullIdx  = 3;     /* индекс активной нити                */
    let pullPos  = 1.0;   /* 1.0 = кончик нити, 0.0 = центр      */
    let pullCool = 100;   /* пауза между затягиваниями (кадры)   */
    let pullPts  = [];    /* точки активной нити                  */

    /* Строим 100 точек нити по шуму */
    function buildPts(th, cx, cy) {
        const base   = Math.min(W, H) * 0.50;
        const total  = base * th.l;
        const SEGS   = 100;
        const segLen = total / SEGS;
        const pts    = [{ x: cx, y: cy }];
        let lx = cx, ly = cy;
        for (let s = 1; s <= SEGS; s++) {
            const n     = s / SEGS;
            const angle = th.a + noise2D(n * th.f, time * th.s + th.seed) * th.amp;
            lx += Math.cos(angle) * segLen;
            ly += Math.sin(angle) * segLen;
            pts.push({ x: lx, y: ly });
        }
        return pts;
    }

    /* Рисуем нить: прозрачно у ядра → золото → прозрачно */
    function drawThread(pts, th, cx, cy) {
        if (pts.length < 2) return;
        const tip = pts[pts.length - 1];

        const g = ctx.createLinearGradient(cx, cy, tip.x, tip.y);
        g.addColorStop(0.00, 'rgba(197,160,89, 0.00)');
        g.addColorStop(0.04, `rgba(220,188,112, ${0.58 * th.lw})`);
        g.addColorStop(0.10, `rgba(197,160,89,  ${0.90 * th.lw})`);
        g.addColorStop(0.52, `rgba(197,160,89,  ${0.75 * th.lw})`);
        g.addColorStop(0.80, `rgba(197,160,89,  ${0.38 * th.lw})`);
        g.addColorStop(0.95, `rgba(197,160,89,  ${0.06 * th.lw})`);
        g.addColorStop(1.00, 'rgba(197,160,89,  0.00)');

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.strokeStyle = g;
        ctx.lineWidth   = Math.max(0.40, th.lw * 0.95);
        ctx.lineJoin    = 'round';
        ctx.lineCap     = 'round';
        ctx.stroke();
    }

    /* Искра летит от кончика к центру — «информация затягивается» */
    function drawPull(pts, pos) {
        if (!pts.length || pos <= 0) return;
        const idx = Math.min(pts.length - 1, Math.max(0,
            Math.floor(pos * (pts.length - 1))));
        const sp = pts[idx];
        if (!sp) return;

        ctx.save();
        /* Тёплый внешний ореол */
        ctx.shadowColor = 'rgba(255,220,100, 0.9)';
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = 'rgba(255,235,160, 0.95)';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
        /* Золотое ядро искры */
        ctx.shadowColor = 'rgba(210,160,50, 0.8)';
        ctx.shadowBlur  = 16;
        ctx.fillStyle   = 'rgba(210,168,60, 0.80)';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    /* Ядро — «клубок нитей» в центре + янтарная корона */
    function drawCore(cx, cy) {
        const coronaR = Math.min(W, H) * 0.20;

        /* Широкая тёплая корона */
        const corona = ctx.createRadialGradient(cx, cy, 1, cx, cy, coronaR);
        corona.addColorStop(0.00, 'rgba(255,218, 78, 0.90)');
        corona.addColorStop(0.06, 'rgba(245,198, 68, 0.66)');
        corona.addColorStop(0.15, 'rgba(222,172, 62, 0.42)');
        corona.addColorStop(0.30, 'rgba(205,160, 68, 0.20)');
        corona.addColorStop(0.52, 'rgba(197,160, 89, 0.07)');
        corona.addColorStop(0.78, 'rgba(197,160, 89, 0.02)');
        corona.addColorStop(1.00, 'rgba(197,160, 89, 0.00)');
        ctx.beginPath();
        ctx.arc(cx, cy, coronaR, 0, Math.PI * 2);
        ctx.fillStyle = corona;
        ctx.fill();

        /* «Клубок» — несколько скрещивающихся дуг вокруг центра */
        ctx.save();
        const ballR = 13;
        for (let i = 0; i < 7; i++) {
            const phase = (i / 7) * Math.PI * 2;
            const t0    = phase + time * (0.08 + i * 0.012);
            const t1    = t0 + 1.35 + i * 0.18;
            const x0    = cx + Math.cos(t0) * ballR * 0.50;
            const y0    = cy + Math.sin(t0) * ballR * 0.50;
            const cpX   = cx + Math.cos(t0 + 0.68) * ballR * 1.15;
            const cpY   = cy + Math.sin(t0 + 0.68) * ballR * 1.15;
            const x1    = cx + Math.cos(t1) * ballR * 0.72;
            const y1    = cy + Math.sin(t1) * ballR * 0.72;
            const a     = 0.45 + 0.22 * Math.sin(time * 1.4 + i);
            ctx.strokeStyle = `rgba(197,160,89, ${a})`;
            ctx.lineWidth   = 0.75;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(cpX, cpY, x1, y1);
            ctx.stroke();
        }
        ctx.restore();

        /* Маленькая точка-якорь (HTML-div с мозгом находится поверх на z-index 28) */
        ctx.save();
        ctx.shadowColor = 'rgba(212,175,55, 0.9)';
        ctx.shadowBlur  = 8 + coreGlow * 16;
        ctx.beginPath();
        ctx.arc(cx, cy, 4 + coreGlow * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,245,200, ${0.6 + coreGlow * 0.4})`;
        ctx.fill();
        ctx.restore();
    }

    function render() {
        time += 0.004;
        ctx.clearRect(0, 0, W, H);
        const cx = W / 2;
        const cy = H / 2;

        /* Обновляем состояние затягивания */
        if (pullCool > 0) {
            pullCool--;
            if (pullCool === 0) pullPos = 1.0;   /* готовим к старту */
        } else {
            pullPos -= 0.022;                     /* летит ~45 кадров */
            if (pullPos <= 0) {
                pullPos  = 0;
                pullCool = 90 + ((pullIdx * 37) % 70);  /* 90-160 кадров пауза */
                pullIdx  = (pullIdx + 1 + ((pullIdx * 3) % 5)) % THREADS.length;
            }
        }

        /* Рисуем все нити, кешируем точки активной */
        THREADS.forEach((th, i) => {
            const pts = buildPts(th, cx, cy);
            if (i === pullIdx) pullPts = pts;
            drawThread(pts, th, cx, cy);
        });

        /* Ядро поверх нитей */
        drawCore(cx, cy);

        /* Искра затягивания поверх ядра */
        if (pullCool === 0 && pullPos > 0) drawPull(pullPts, pullPos);

        rafId = requestAnimationFrame(render);
    }

    resize();
    window.addEventListener('resize', resize);
    render();

    /* Исчезаем когда открыт портал */
    const bd = document.getElementById('portal-backdrop');
    if (bd) {
        new MutationObserver(() => {
            const hidden = bd.classList.contains('visible') ? '0' : '1';
            cv.style.opacity       = hidden;
            brainDiv.style.opacity = hidden;
        }).observe(bd, { attributes: true, attributeFilter: ['class'] });
    }

})();

/* ══════════════════════════════════════════════════════════
   CITY FIBERS — спиральные нити от городов к центру.
   Нить «раскручивается» по мере того как data-пакет
   тянет информацию от города к ядру SBF.
   ══════════════════════════════════════════════════════════ */
(function initCityLines() {

    const cv = document.createElement('canvas');
    cv.id = 'city-lines-canvas';
    Object.assign(cv.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '26', opacity: '1',
        transition: 'opacity 0.6s ease',
    });
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    let W, H, DPR;

    /* ── Города ── */
    const CITIES = [
        { name: 'LONDON',       lat:  51.50, lng:   -0.12 },
        { name: 'BRUSSELS',     lat:  50.85, lng:    4.35  },
        { name: 'CHISINAU',     lat:  47.00, lng:   28.86  },
        { name: 'MOSCOW',       lat:  55.75, lng:   37.62  },
        { name: 'DUBAI',        lat:  25.20, lng:   55.27  },
        { name: 'TOKYO',        lat:  35.68, lng:  139.69  },
        { name: 'BEIJING',      lat:  39.91, lng:  116.39  },
        { name: 'NEW YORK',     lat:  40.71, lng:  -74.01  },
        { name: 'CHICAGO',      lat:  41.88, lng:  -87.63  },
        { name: 'BRASILIA',     lat: -15.78, lng:  -47.93  },
        { name: 'BUENOS AIRES', lat: -34.60, lng:  -58.38  },
        { name: 'JOHANNESBURG', lat: -26.20, lng:   28.04  },
        { name: 'SYDNEY',       lat: -33.87, lng:  151.21  },
    ];

    /* Финансовые данные, которые летят по нитям */
    const SNIPPETS = [
        'SPX +0.41%', 'BTC −2.07%', 'FED HOLD', 'YIELD 4.72%',
        'EUR/USD 1.082', 'GOLD $2341', 'DXY 104.2', 'VIX 18.3',
        'OIL $83.40', 'NASDAQ −0.8%', 'PBoC RRR', 'BOJ ¥155',
        'CPI 3.4%', 'NFP 272K',
    ];

    /* Cubix Bezier helper */
    function cbez(t, x0, y0, x1, y1, x2, y2, x3, y3) {
        const m = 1 - t;
        return {
            x: m*m*m*x0 + 3*m*m*t*x1 + 3*m*t*t*x2 + t*t*t*x3,
            y: m*m*m*y0 + 3*m*m*t*y1 + 3*m*t*t*y2 + t*t*t*y3,
        };
    }

    let layout    = [];   /* геометрия нитей, пересчитывается при resize */
    let cityState = [];   /* пакеты по каждому городу */

    function layoutAll() {
        const m = window._sbfMap;
        if (!m) { layout = []; return; }

        const cx = W / 2, cy = H / 2;
        const TH = 10, PAD = 3;
        ctx.font = 'bold 9px Montserrat, sans-serif';

        layout = CITIES.map((city, i) => {
            const pt  = m.latLngToContainerPoint([city.lat, city.lng]);
            const tx  = pt.x, ty = pt.y;

            /* Единичный вектор город → центр */
            const ddx = cx - tx, ddy = cy - ty;
            const len = Math.sqrt(ddx*ddx + ddy*ddy);
            const ux = ddx / len, uy = ddy / len;

            /* Перпендикуляр (для спирали) */
            const nx = -uy, ny = ux;

            /* Контрольные точки S-кривой */
            const sign  = (i % 2 === 0 ? 1 : -1) * (1 + (i % 3) * 0.35);
            const bend  = len * 0.14 * sign;
            const cp1x  = tx + ux * len * 0.32 + nx * bend;
            const cp1y  = ty + uy * len * 0.32 + ny * bend;
            const cp2x  = tx + ux * len * 0.68 - nx * bend * 0.6;
            const cp2y  = ty + uy * len * 0.68 - ny * bend * 0.6;

            /* Позиция надписи (от города, наружу) */
            const angle = Math.atan2(ty - cy, tx - cx);
            const cos   = Math.cos(angle), sin = Math.sin(angle);
            const align = cos > 0.25 ? 'left' : cos < -0.25 ? 'right' : 'center';
            const base  = sin > 0.35 ? 'top'  : sin < -0.35 ? 'bottom' : 'middle';
            const tw    = ctx.measureText(city.name).width;

            return {
                tx, ty, nx, ny, cp1x, cp1y, cp2x, cp2y,
                angle, cos, sin, align, base, tw,
                lx: tx + cos * 8, ly: ty + sin * 8,
                city, i,
            };
        });

        /* Push-apart для надписей */
        function bbox(d) {
            const bx = d.align === 'left'  ? d.lx
                     : d.align === 'right' ? d.lx - d.tw
                     : d.lx - d.tw / 2;
            const by = d.base  === 'top'    ? d.ly
                     : d.base  === 'bottom' ? d.ly - TH
                     : d.ly - TH / 2;
            return { x: bx, y: by, w: d.tw, h: TH };
        }
        function overlaps(a, b) {
            const ba = bbox(a), bb = bbox(b);
            return ba.x < bb.x + bb.w + PAD && ba.x + ba.w + PAD > bb.x &&
                   ba.y < bb.y + bb.h + PAD && ba.y + ba.h + PAD > bb.y;
        }
        for (let pass = 0; pass < 6; pass++) {
            for (let a = 0; a < layout.length - 1; a++) {
                for (let b = a + 1; b < layout.length; b++) {
                    if (!overlaps(layout[a], layout[b])) continue;
                    layout[a].lx += Math.cos(layout[a].angle) * 3;
                    layout[a].ly += Math.sin(layout[a].angle) * 3;
                    layout[b].lx += Math.cos(layout[b].angle) * 3;
                    layout[b].ly += Math.sin(layout[b].angle) * 3;
                }
            }
        }

        /* Инициализируем состояние пакетов */
        cityState = CITIES.map((_, i) => ({
            packets:     [],
            cooldown:    50 + i * 17,
            snippetIdx:  (i * 3) % SNIPPETS.length,
        }));
    }

    function resize() {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        W   = window.innerWidth;
        H   = window.innerHeight;
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        cv.width  = W * DPR;
        cv.height = H * DPR;
        ctx.scale(DPR, DPR);
        layoutAll();
    }

    let time = 0;

    function render() {
        time += 0.013;
        ctx.clearRect(0, 0, W, H);

        if (!layout.length && window._sbfMap) layoutAll();

        const cx = W / 2, cy = H / 2;
        const SEGS = 72;

        layout.forEach((d, i) => {
            const state = cityState[i];
            if (!state) return;

            const { tx, ty, nx, ny, cp1x, cp1y, cp2x, cp2y } = d;

            /* ── Спаун пакета ── */
            if (--state.cooldown <= 0 && state.packets.length < 2) {
                state.packets.push({
                    t:     0,
                    label: SNIPPETS[state.snippetIdx % SNIPPETS.length],
                    alpha: 0,
                });
                state.snippetIdx++;
                state.cooldown = 110 + (i * 41) % 90;
            }

            /* ── Движение пакетов ── */
            const speed = 0.0065 + i * 0.00025;
            state.packets.forEach(p => {
                p.t    += speed;
                p.alpha = p.t < 0.08  ? p.t / 0.08
                        : p.t > 0.88  ? (1 - p.t) / 0.12
                        : 1.0;
            });
            state.packets = state.packets.filter(p => p.t < 1.0);

            /* t "самого дальнего" пакета (ближайшего к центру) */
            const leadT = state.packets.reduce((acc, p) => Math.max(acc, p.t), 0);

            /* ── Параметры спирали ── */
            const coilAmp  = 7 + (i % 3) * 1.8;       /* 7-11 px */
            const coilFreq = 3.5 + (i % 4) * 0.45;
            const coilSpd  = 0.7 + (i % 3) * 0.22;

            /* ── Строим полилинию нити ── */
            const pts = [];
            for (let s = 0; s <= SEGS; s++) {
                const t = s / SEGS;   /* 0 = город, 1 = центр */

                const base = cbez(t, tx, ty, cp1x, cp1y, cp2x, cp2y, cx, cy);

                /* Натуральная амплитуда: max у города, 0 у центра */
                const natAmp = Math.pow(1 - t, 1.15);

                /* Зона "уже раскрученного" — позади ведущего пакета */
                const RAMP = 0.09;
                const pulled = t < leadT - RAMP ? 0
                             : t < leadT        ? (t - (leadT - RAMP)) / RAMP
                             : 1.0;

                const amp   = coilAmp * natAmp * pulled;
                const phase = t * coilFreq * Math.PI * 2 + time * coilSpd + i * 1.4;

                pts.push({
                    x: base.x + nx * amp * Math.sin(phase),
                    y: base.y + ny * amp * Math.sin(phase),
                });
            }

            /* ── Рисуем нить ── */
            const grad = ctx.createLinearGradient(tx, ty, cx, cy);
            grad.addColorStop(0.00, 'rgba(212,175,55, 0.00)');
            grad.addColorStop(0.06, 'rgba(212,175,55, 0.58)');
            grad.addColorStop(0.50, 'rgba(197,160,89, 0.40)');
            grad.addColorStop(0.86, 'rgba(197,160,89, 0.18)');
            grad.addColorStop(1.00, 'rgba(197,160,89, 0.00)');

            ctx.save();
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s].x, pts[s].y);
            ctx.strokeStyle = grad;
            ctx.lineWidth   = 1.15;
            ctx.lineJoin    = 'round';
            ctx.lineCap     = 'round';
            ctx.stroke();

            /* Световой highlight */
            const gradH = ctx.createLinearGradient(tx, ty, cx, cy);
            gradH.addColorStop(0.00, 'rgba(255,240,160, 0.00)');
            gradH.addColorStop(0.06, 'rgba(255,240,160, 0.32)');
            gradH.addColorStop(0.50, 'rgba(255,240,160, 0.12)');
            gradH.addColorStop(1.00, 'rgba(255,240,160, 0.00)');
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let s = 1; s < pts.length; s++) ctx.lineTo(pts[s].x, pts[s].y);
            ctx.strokeStyle = gradH;
            ctx.lineWidth   = 0.42;
            ctx.stroke();
            ctx.restore();

            /* ── Маркер города ── */
            const pulse = 0.72 + 0.28 * Math.sin(time * 2.4 + i * 1.3);
            ctx.save();
            ctx.shadowColor = 'rgba(212,175,55, 0.85)';
            ctx.shadowBlur  = 7;
            ctx.beginPath();
            ctx.arc(tx, ty, 3.2 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(212,175,55, 0.95)';
            ctx.fill();
            ctx.restore();

            const ringR = 6 + 2.5 * Math.sin(time * 1.3 + i * 0.9);
            ctx.beginPath();
            ctx.arc(tx, ty, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(212,175,55,${0.16 + 0.09 * Math.sin(time * 1.3 + i)})`;
            ctx.lineWidth   = 0.55;
            ctx.stroke();

            /* ── Надпись ── */
            ctx.font         = 'bold 9px Montserrat, sans-serif';
            ctx.fillStyle    = 'rgba(65,48,12, 0.92)';
            ctx.textAlign    = d.align;
            ctx.textBaseline = d.base;
            ctx.fillText(d.city.name, d.lx, d.ly);
            ctx.textAlign    = 'left';
            ctx.textBaseline = 'alphabetic';

            /* ── Пучки света (без текста) ── */
            state.packets.forEach(p => {
                const t    = Math.min(p.t, 1.0);
                const base = cbez(t, tx, ty, cp1x, cp1y, cp2x, cp2y, cx, cy);
                const natAmp = Math.pow(1 - t, 1.15);
                const phase  = t * coilFreq * Math.PI * 2 + time * coilSpd + i * 1.4;
                const pOff   = coilAmp * natAmp * Math.sin(phase);
                const px     = base.x + nx * pOff;
                const py     = base.y + ny * pOff;

                ctx.save();
                ctx.globalAlpha = p.alpha;

                /* Хвост кометы — 4 призрака позади по пути */
                for (let tr = 4; tr >= 1; tr--) {
                    const tTr  = Math.max(0, t - tr * 0.028);
                    const bTr  = cbez(tTr, tx, ty, cp1x, cp1y, cp2x, cp2y, cx, cy);
                    const naTr = Math.pow(1 - tTr, 1.15);
                    const phTr = tTr * coilFreq * Math.PI * 2 + time * coilSpd + i * 1.4;
                    const ptx  = bTr.x + nx * coilAmp * naTr * Math.sin(phTr);
                    const pty  = bTr.y + ny * coilAmp * naTr * Math.sin(phTr);
                    const tR   = 9 - tr * 1.6;
                    const tA   = (1 - tr / 5) * 0.45;
                    const tg   = ctx.createRadialGradient(ptx, pty, 0, ptx, pty, tR);
                    tg.addColorStop(0, `rgba(255,220,80,${tA})`);
                    tg.addColorStop(1, 'rgba(255,200,50,0)');
                    ctx.beginPath();
                    ctx.arc(ptx, pty, tR, 0, Math.PI * 2);
                    ctx.fillStyle = tg;
                    ctx.fill();
                }

                /* Основной пучок — радиальный градиент "белое ядро → золото → прозрачный" */
                const R = 13;
                ctx.shadowColor = 'rgba(255,210,60, 0.85)';
                ctx.shadowBlur  = 18;
                const mg = ctx.createRadialGradient(px, py, 0, px, py, R);
                mg.addColorStop(0.00, 'rgba(255,255,248, 1.00)');
                mg.addColorStop(0.10, 'rgba(255,248,200, 0.96)');
                mg.addColorStop(0.25, 'rgba(255,215, 80, 0.82)');
                mg.addColorStop(0.50, 'rgba(212,175, 55, 0.52)');
                mg.addColorStop(0.75, 'rgba(197,160, 89, 0.20)');
                mg.addColorStop(1.00, 'rgba(197,160, 89, 0.00)');
                ctx.beginPath();
                ctx.arc(px, py, R, 0, Math.PI * 2);
                ctx.fillStyle = mg;
                ctx.fill();

                ctx.globalAlpha = 1;
                ctx.restore();
            });
        });

        requestAnimationFrame(render);
    }

    resize();
    window.addEventListener('resize', resize);

    const mapWait = setInterval(() => {
        if (window._sbfMap) { layoutAll(); clearInterval(mapWait); }
    }, 80);

    render();

    window.addEventListener('scroll', () => {
        const p = Math.min(window.scrollY / window.innerHeight, 1);
        cv.style.opacity = String(Math.max(0, 1 - p * 2));
    }, { passive: true });

    const bd = document.getElementById('portal-backdrop');
    if (bd) {
        new MutationObserver(() => {
            cv.style.opacity = bd.classList.contains('visible') ? '0' : '1';
        }).observe(bd, { attributes: true, attributeFilter: ['class'] });
    }

})();

/* ── Prevent page snap while scrolling inside portal panels ── */

/* ── Prevent page snap while scrolling inside portal panels ── */
const portalEl = q('global-portal');
if (portalEl) {
    portalEl.addEventListener('touchstart', () => {
        document.documentElement.style.scrollSnapType = 'none';
    }, { passive: true });
    portalEl.addEventListener('touchend', () => {
        setTimeout(() => {
            document.documentElement.style.scrollSnapType = 'y mandatory';
        }, 300);
    }, { passive: true });
}

/* ══════════════════════════════════════════════════════════
   WHEEL SNAP ENGINE
   Колесо крутит ровно до следующего блока.
   Переход — медленный (1500 мс), чтобы успеть выловить
   детали портала по пути.
   ══════════════════════════════════════════════════════════ */
(function initWheelSnap() {
    /* Только мышь/трекпад — тач оставляем нативному snap */
    if (!window.matchMedia('(pointer: fine)').matches) return;

    /* Отключаем CSS snap — мы сами всем управляем */
    document.documentElement.style.scrollSnapType = 'none';

    /* Собираем все snap-точки в порядке на странице */
    const getSections = () => Array.from(
        document.querySelectorAll('.hero-section, .screen-section, .portal-spacer')
    );

    /* Вычисляем абсолютный offsetTop каждой секции */
    const getOffsets = () => getSections().map(el => {
        let top = 0;
        let node = el;
        while (node) { top += node.offsetTop; node = node.offsetParent; }
        return Math.round(top);
    });

    /* Индекс секции, на которой сейчас стоим */
    const getCurrentIdx = (offsets) => {
        const y = window.scrollY + 2;
        let idx = 0;
        offsets.forEach((off, i) => { if (y >= off) idx = i; });
        return idx;
    };

    /* ── Функция плавного перехода ───────────────────────── */
    /* Кривая: медленный старт → плавный разгон → медленный
       финал. Пользователь видит контент и в начале и в конце. */
    const ease = t =>
        t < 0.5
            ? 4 * t * t * t                     /* кубик в начале */
            : 1 - Math.pow(-2 * t + 2, 3) / 2; /* кубик в конце  */

    let rafId       = null;
    let animating   = false;
    let targetIdx   = 0;

    function scrollToIdx(idx) {
        const offsets = getOffsets();
        idx = Math.max(0, Math.min(getSections().length - 1, idx));

        const startY  = window.scrollY;
        const endY    = offsets[idx];
        if (Math.abs(endY - startY) < 4) { animating = false; return; }

        const DURATION = 1500; /* мс — медленно, чтобы детали были видны */
        const startT   = performance.now();
        animating      = true;
        targetIdx      = idx;

        cancelAnimationFrame(rafId);

        function step(now) {
            const t      = Math.min((now - startT) / DURATION, 1);
            const eased  = ease(t);
            window.scrollTo(0, startY + (endY - startY) * eased);

            if (t < 1) {
                rafId = requestAnimationFrame(step);
            } else {
                window.scrollTo(0, endY);
                animating = false;
            }
        }
        rafId = requestAnimationFrame(step);
    }

    /* ── Wheel listener ──────────────────────────────────── */
    let wheelBuffer   = 0;   /* накапливаем дельту для тихих трекпадов */
    let wheelTimeout  = null;

    window.addEventListener('wheel', (e) => {
        e.preventDefault();

        wheelBuffer += e.deltaY;

        /* Ждём 40 мс тишины перед тем как решить — это одно
           намерение прокрутить. Трекпад шлёт много маленьких событий. */
        clearTimeout(wheelTimeout);
        wheelTimeout = setTimeout(() => {
            if (Math.abs(wheelBuffer) < 20) { wheelBuffer = 0; return; }

            const dir     = wheelBuffer > 0 ? 1 : -1;
            wheelBuffer   = 0;

            if (animating) {
                /* Если уже едем — позволяем перейти ещё на один блок
                   только если едем в том же направлении */
                const nextTarget = targetIdx + dir;
                const sections   = getSections();
                if (nextTarget < 0 || nextTarget >= sections.length) return;
                targetIdx = nextTarget;
                scrollToIdx(targetIdx);
                return;
            }

            const offsets = getOffsets();
            const cur     = getCurrentIdx(offsets);
            scrollToIdx(cur + dir);
        }, 40);

    }, { passive: false });

    /* ── Клавиатурная навигация ──────────────────────────── */
    window.addEventListener('keydown', (e) => {
        const offsets = getOffsets();
        const cur     = getCurrentIdx(offsets);

        if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            if (!animating) scrollToIdx(cur + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            if (!animating) scrollToIdx(cur - 1);
        }
    });

})();

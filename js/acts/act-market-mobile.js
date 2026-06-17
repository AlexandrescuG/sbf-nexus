/**
 * act-market-mobile.js — статичные свечные графики для мобильной версии.
 * Запускается только на ≤767px. Загружает 6 CSV, рисует раз и всё.
 */

if (!window.matchMedia('(max-width: 767px)').matches) {
  // noop на десктопе
} else {

const CHARTS = [
  { file: 'assets/data/EURUSD_gap_may2026.csv',              caseId: 'eurusd',   maxBars: 200 },
  { file: 'assets/data/NatGas_NG_2023.csv',                  caseId: 'ng'                    },
  { file: 'assets/data/XAUUSD_triangle_breakout_may2026.csv', caseId: 'gold-tri', maxBars: 100 },
  { file: 'assets/data/XAUUSD_bollinger_squeeze_pool.csv',   caseId: 'gold-bol', maxBars: 200 },
  { file: 'assets/data/USDJPY_intervention_may2026.csv',     caseId: 'jpy',      maxBars: 120 },
  { file: 'assets/data/Copper_channel_breakout_2026.csv',    caseId: 'copper',   maxBars: 100 },
];

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const hdr   = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const v = line.split(',');
    const r = {};
    hdr.forEach((h, i) => { r[h] = v[i]?.trim(); });
    return {
      open : parseFloat(r.Open  || r.open),
      high : parseFloat(r.High  || r.high),
      low  : parseFloat(r.Low   || r.low),
      close: parseFloat(r.Close || r.close),
    };
  }).filter(d => !isNaN(d.open));
}

function drawStatic(canvas, data, cfg) {
  const maxBars = cfg?.maxBars || 60;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const cssW = canvas.offsetWidth  || canvas.parentElement.offsetWidth || 360;
  const cssH = canvas.offsetHeight || 220;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const w = cssW, h = cssH;
  const VISIBLE = Math.min(data.length, maxBars);
  const slice   = data.slice(-VISIBLE);
  const n       = slice.length;

  const maxV = Math.max(...slice.map(d => d.high));
  const minV = Math.min(...slice.map(d => d.low));
  const pad  = (maxV - minV) * 0.08;
  const vTop = maxV + pad, vBot = minV - pad, vSpan = vTop - vBot || 1;

  const P    = { t: h * 0.06, r: w * 0.04, b: h * 0.06, l: w * 0.04 };
  const cW   = w - P.l - P.r;
  const cH   = h - P.t - P.b;
  const yS   = v => P.t + (1 - (v - vBot) / vSpan) * cH;
  const slotW = cW / n;
  const bodyW = Math.max(2, slotW * 0.58);

  /* Тёмный фон */
  ctx.fillStyle = 'rgba(10,8,16,0.92)';
  ctx.fillRect(0, 0, w, h);

  /* Сетка */
  ctx.strokeStyle = 'rgba(201,162,39,0.08)';
  ctx.lineWidth   = 0.5;
  for (let i = 0; i <= 3; i++) {
    const y = P.t + (i / 3) * cH;
    ctx.beginPath(); ctx.moveTo(P.l, y); ctx.lineTo(w - P.r, y); ctx.stroke();
  }

  /* Свечи */
  slice.forEach((d, i) => {
    const cx    = P.l + (i + 0.5) * slotW;
    const isBull = d.close >= d.open;
    const col   = isBull ? '#4CAF50' : '#E57373';
    const oY    = yS(d.open);
    const cY    = yS(d.close);
    const hY    = yS(d.high);
    const lY    = yS(d.low);
    const bTop  = Math.min(oY, cY);
    const bH    = Math.max(1, Math.abs(oY - cY));

    ctx.strokeStyle = col;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(cx, hY); ctx.lineTo(cx, lY); ctx.stroke();

    ctx.fillStyle = col;
    ctx.fillRect(cx - bodyW / 2, bTop, bodyW, bH);
  });

  /* Золотой оверлей-градиент по краям */
  const grad = ctx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0,   'rgba(201,162,39,0.22)');
  grad.addColorStop(0.1, 'rgba(201,162,39,0)');
  grad.addColorStop(0.9, 'rgba(201,162,39,0)');
  grad.addColorStop(1,   'rgba(201,162,39,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

async function initMarketMobile() {
  for (const cfg of CHARTS) {
    try {
      const text    = await fetch(cfg.file).then(r => r.text());
      const data    = parseCSV(text);
      const article = document.querySelector(`.market-case[data-case="${cfg.caseId}"]`);
      const canvas  = article?.querySelector('.market-case-chart');
      if (canvas && data.length) drawStatic(canvas, data, cfg);
    } catch (e) {
      console.warn('[market-mobile] chart load failed:', cfg.caseId, e);
    }
  }
}

document.fonts.ready.then(initMarketMobile);

} // end isMobile guard

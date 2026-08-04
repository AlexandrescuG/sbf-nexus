/**
 * act4-team.js — Stop 8: Команда.
 * Desktop: orbital layout — портреты вокруг центрального лого SBF.
 * Mobile: генерирует грид в #act-team-grid через initTeamGrid().
 */

import { TEAM }     from '../data/team.js';
import { AI_NODES } from '../data/ai-nodes.js';

/* ── Данные команды (с imgIdx → manifest.json) ──────────── */
const PEOPLE = [
  { name: 'Александр Петрович', role: 'Главный аналитик',          role_en: 'Chief Analyst',              city: 'Кишинёв',  imgIdx: 0  },
  { name: 'Ирина Корнеева',     role: 'Макро-стратег',             role_en: 'Macro Strategist',           city: 'Цюрих',     imgIdx: 6  },
  { name: 'Дмитрий Соколов',   role: 'Quant-аналитик',            role_en: 'Quant Analyst',              city: 'Кишинёв',  imgIdx: 1  },
  { name: 'Марина Тарасова',   role: 'Сырьевые рынки',            role_en: 'Commodities Markets',        city: 'Кишинёв',  imgIdx: 7  },
  { name: 'Виктор Алтынов',    role: 'ИИ-инфраструктура',         role_en: 'AI Infrastructure',          city: 'Кишинёв',  imgIdx: 2  },
  { name: 'Аиша Аль-Махмуд',   role: 'VIP-клиенты',               role_en: 'VIP Clients',                city: 'Дубай',     imgIdx: 8  },
  { name: 'Лев Бергман',       role: 'Forex-аналитика',           role_en: 'Forex Analytics',            city: 'Цюрих',     imgIdx: 3  },
  { name: 'Анна Карвалью',     role: 'Доверительное управление',  role_en: 'Discretionary Management',   city: 'Лиссабон',  imgIdx: 9  },
  { name: 'Сергей Морозов',    role: 'Технологическая платформа', role_en: 'Technology Platform',        city: 'Кишинёв',  imgIdx: 4  },
  { name: 'Юлия Гольдштейн',  role: 'Compliance & риски',        role_en: 'Compliance & Risk',          city: 'Цюрих',     imgIdx: 10 },
  { name: 'Тимур Берестов',    role: 'Криптоактивы',              role_en: 'Crypto Assets',              city: 'Дубай',     imgIdx: 5  },
  { name: 'Елена Краузе',      role: 'Институциональные клиенты', role_en: 'Institutional Clients',      city: 'Лиссабон',  imgIdx: 11 },
];

const AI_LABELS = []; // WP-4: LLM-бренды убраны

const INNER_R_MAX = 260;
const OUTER_R_MAX = 370;

/* ── Мобильный грид команды ────────────────────────────── */
async function initTeamGrid() {
  const grid = document.getElementById('act-team-grid');
  if (!grid) return;

  let manifest = [];
  try {
    manifest = await fetch('assets/team/manifest.json').then(r => r.json());
  } catch { /* без фото */ }

  const logoEl = document.createElement('img');
  logoEl.src = 'assets/logo/logo.svg';
  logoEl.className = 'team-grid-logo';
  logoEl.alt = 'SBF';
  grid.appendChild(logoEl);

  const hdr = document.createElement('div');
  hdr.className = 'section-animate';
  const i18 = window.i18n;
  hdr.innerHTML = `<p class="eyebrow" style="margin-bottom:12px">${i18 ? i18.t('team.eyebrow') : 'КОМАНДА И НЕЙРО-ИИ'}</p><h3 style="margin-bottom:40px">${i18 ? i18.t('team.mob_heading') : 'Эксперты,<br>усиленные ИИ'}</h3>`;
  grid.appendChild(hdr);

  const teamGrid = document.createElement('div');
  teamGrid.className = 'team-grid section-animate';
  const lang = window.i18n?.getLang?.() || 'ru';
  PEOPLE.slice(0, 10).forEach(member => {
    // WP-4 Variant B: портреты убраны
    const roleText = lang === 'en' ? (member.role_en || member.role) : member.role;
    const item = document.createElement('div');
    item.className = 'team-grid-item';
    item.innerHTML = `<div style="width:80px;height:80px;border-radius:50%;background:rgba(201,162,39,0.08);border:1px solid rgba(201,162,39,0.3);margin:0 auto"></div><div class="name">${member.name}</div><div class="role">${roleText}</div>`;
    teamGrid.appendChild(item);
  });
  grid.appendChild(teamGrid);

  const aiGrid = document.createElement('div');
  aiGrid.className = 'ai-grid section-animate';
  AI_NODES.forEach(name => {
    const item = document.createElement('div');
    item.className = 'ai-grid-item';
    item.textContent = name;
    aiGrid.appendChild(item);
  });
  grid.appendChild(aiGrid);

  if (window._sbfMobile) {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in-view'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.18 });
    grid.querySelectorAll('.section-animate').forEach(el => obs.observe(el));
  }
}

window.initTeamGrid = initTeamGrid;

// Только планшет (768–1023px): мобильный грид строит mobile-init.js
if (window.matchMedia('(min-width: 768px) and (max-width: 1023px)').matches) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTeamGrid);
  } else {
    initTeamGrid();
  }
}

/* ── Desktop: orbital ───────────────────────────────────── */

function buildOrbital(stage, manifest) {
  const container = stage.querySelector('#team-orbital');
  if (!container) return;
  container.innerHTML = '';

  const w = stage.offsetWidth;
  const h = stage.offsetHeight;
  if (!w || !h) return;

  const cx = w / 2;
  const cy = h * 0.54;

  // Масштабируем радиусы под реальный размер stage (важно при высоком зуме)
  const maxFit = Math.min(cy * 0.86, (h - cy) * 0.86, w * 0.42);
  const INNER_R = Math.min(INNER_R_MAX, maxFit);
  const OUTER_R = Math.min(OUTER_R_MAX, maxFit * (OUTER_R_MAX / INNER_R_MAX));

  // Внутренняя орбита — команда
  PEOPLE.forEach((person, i) => {
    const angle = (i / PEOPLE.length) * 2 * Math.PI - Math.PI / 2;
    const x = cx + INNER_R * Math.cos(angle);
    const y = cy + INNER_R * Math.sin(angle);

    // WP-4 Variant B: портреты убраны, только gold-ring placeholder
    const node = document.createElement('div');
    node.className = 'team-node';
    node.style.left = `${x}px`;
    node.style.top  = `${y}px`;
    node.style.opacity = '0';
    node.innerHTML = `
      <div class="team-portrait photo-empty"></div>
      <div class="team-node-info">
        <p class="team-node-name">${person.name}</p>
        <p class="team-node-role" data-role-ru="${person.role}" data-role-en="${person.role_en || person.role}">${window.i18n?.getLang?.() === 'en' ? (person.role_en || person.role) : person.role}</p>
        <p class="team-node-city">${person.city}</p>
      </div>`;
    container.appendChild(node);
  });

  // Внешняя орбита — ИИ-инструменты
  AI_LABELS.forEach((label, i) => {
    const angle = (i / AI_LABELS.length) * 2 * Math.PI - Math.PI / 2;
    const x = cx + OUTER_R * Math.cos(angle);
    const y = cy + OUTER_R * Math.sin(angle);

    const node = document.createElement('div');
    node.className = 'team-ai-orbital';
    node.style.left = `${x}px`;
    node.style.top  = `${y}px`;
    node.style.opacity = '0';
    node.textContent = label;
    container.appendChild(node);
  });
}

export async function initAct4() {
  const section     = document.getElementById('act-team');
  const teamOverlay = document.getElementById('team-overlay');
  if (!section || window.matchMedia('(max-width: 767px)').matches) return;

  const stage = section.querySelector('.team-stage');
  if (!stage) return;

  // Загружаем manifest фото один раз
  let manifest = [];
  try {
    manifest = await fetch('assets/team/manifest.json').then(r => r.json());
  } catch { /* без фото */ }

  buildOrbital(stage, manifest);

  // Перестраиваем при ресайзе/зуме; если секция видима — показываем узлы сразу
  let resizeTimer;
  const rebuildOrbital = () => {
    buildOrbital(stage, manifest);
    const rect = section.getBoundingClientRect();
    if (Math.abs(rect.top) < window.innerHeight * 0.15) {
      if (teamOverlay) gsap.set(teamOverlay, { opacity: 1, y: 0 });
      const nodes = stage.querySelectorAll('.team-node, .team-ai-orbital');
      gsap.set(nodes, { opacity: 1, scale: 1 });
    }
  };
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildOrbital, 200);
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(rebuildOrbital, 200);
    });
  }

  section.addEventListener('snap-enter', () => {
    window._teamTimelineActive = false;
    if (teamOverlay) gsap.fromTo(teamOverlay,
      { opacity: 0, y: -16 },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }
    );
    const nodes = stage.querySelectorAll('.team-node, .team-ai-orbital');
    gsap.fromTo(nodes,
      { opacity: 0, scale: 0.75 },
      { opacity: 1, scale: 1, duration: 0.45, stagger: 0.035, ease: 'back.out(1.4)' }
    );
  });

  section.addEventListener('snap-leave', () => {
    window._teamTimelineActive = false;
    if (teamOverlay) gsap.to(teamOverlay, { opacity: 0, duration: 0.3 });
    const nodes = stage.querySelectorAll('.team-node, .team-ai-orbital');
    gsap.to(nodes, { opacity: 0, duration: 0.25 });
  });
}

if (window.matchMedia('(min-width: 768px)').matches) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAct4);
  } else {
    initAct4();
  }
}

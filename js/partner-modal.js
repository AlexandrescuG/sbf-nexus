/**
 * partner-modal.js — попап с детальной информацией о брокере-партнёре.
 * Данные и лейблы берутся из window.i18n (поддержка RU / EN).
 */

/* Логотипы и ссылки — не зависят от языка */
const PARTNER_STATIC = {
  avatrade:   { logo: 'assets/partners/avatrade.svg',   referralUrl: 'https://www.avatrade.com/?tag=184200' },
  xm:         { logo: 'assets/partners/xm.svg',         referralUrl: 'https://clicks.pipaffiliates.com/c?c=1258918&l=ru&p=1' },
  naga:       { logo: 'assets/partners/naga.png',       referralUrl: 'https://go.joinnaga.com/29LSS44/23JF6C/' },
  instaforex: { logo: 'assets/partners/instaforex.svg', referralUrl: 'https://www.instaforex.com/fast_open_live_account' },
  fxpro:      { logo: 'assets/partners/fxpro.svg',      referralUrl: 'https://www.fxpro-direct.org/en/register/md/cri/32TQQFd7H' },
};

function renderPartnerModal(partnerId) {
  const stat = PARTNER_STATIC[partnerId];
  if (!stat) return;

  const i   = window.i18n || { t: k => k, partnerData: () => ({}) };
  const d   = i.partnerData(partnerId);
  const lbl = key => i.t('partner.' + key);

  const body = document.getElementById('partner-modal-body');
  body.innerHTML = `
    <img src="${stat.logo}" alt="${partnerId}" class="partner-logo">
    <h2>${d.name || partnerId}</h2>
    <p class="partner-tagline">${d.tagline || ''}</p>

    <div class="partner-section">
      <p class="partner-section-label">${lbl('section1')}</p>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('founded')}</span>
        <span class="partner-fact-value">${d.founded || ''}</span>
      </div>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('hq')}</span>
        <span class="partner-fact-value">${d.hq || ''}</span>
      </div>
      ${d.clients ? `<div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('clients')}</span>
        <span class="partner-fact-value">${d.clients}</span>
      </div>` : ''}
    </div>

    <div class="partner-section">
      <p class="partner-section-label">${lbl('section2')}</p>
      <ul class="partner-license-list">
        ${(d.licenses || []).map(l => `<li>${l}</li>`).join('')}
      </ul>
    </div>

    <div class="partner-section">
      <p class="partner-section-label">${lbl('section3')}</p>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('platforms')}</span>
        <span class="partner-fact-value">${d.platforms || ''}</span>
      </div>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('deposit')}</span>
        <span class="partner-fact-value">${d.minDeposit || ''}</span>
      </div>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('leverage')}</span>
        <span class="partner-fact-value">${d.maxLeverage || ''}</span>
      </div>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('spreads')}</span>
        <span class="partner-fact-value">${d.spreads || ''}</span>
      </div>
      ${d.instruments ? `<div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('instr')}</span>
        <span class="partner-fact-value">${d.instruments}</span>
      </div>` : ''}
    </div>

    <div class="partner-section">
      <p class="partner-section-label">${lbl('section4')}</p>
      <div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('methods')}</span>
        <span class="partner-fact-value">${d.funding || ''}</span>
      </div>
      ${d.inactivityFee ? `<div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('inactivity')}</span>
        <span class="partner-fact-value">${d.inactivityFee}</span>
      </div>` : ''}
      ${d.funds ? `<div class="partner-fact-row">
        <span class="partner-fact-key">${lbl('custody')}</span>
        <span class="partner-fact-value">${d.funds}</span>
      </div>` : ''}
    </div>

    <a href="${stat.referralUrl}" target="_blank" rel="noopener noreferrer" class="partner-modal-cta">
      ${lbl('goto')}
    </a>
  `;
}

function openPartnerModal(partnerId) {
  window._currentPartner = partnerId;
  renderPartnerModal(partnerId);
  const modal = document.getElementById('partner-modal');
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (window.snapNav) window.snapNav.locked = true;
}

function closePartnerModal() {
  window._currentPartner = null;
  const modal = document.getElementById('partner-modal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (window.snapNav) window.snapNav.locked = false;
}

document.addEventListener('click', (e) => {
  /* Карточка партнёра или любой элемент с data-open-partner
     (знак на «Доверительном управлении» ведёт к FxPro) */
  const card = e.target.closest('.partner-card, [data-open-partner]');
  if (card) {
    const id = card.dataset.partner || card.dataset.openPartner;
    if (id) openPartnerModal(id);
    return;
  }
  if (e.target.matches('[data-close]') || e.target.closest('[data-close]')) {
    closePartnerModal();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePartnerModal();
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const card = document.activeElement?.closest?.('.partner-card, [data-open-partner]');
  if (card) {
    e.preventDefault();
    const id = card.dataset.partner || card.dataset.openPartner;
    if (id) openPartnerModal(id);
  }
});

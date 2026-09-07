/**
 * lead-modal.js — модалка заявки.
 * Открывается по: CTA hero, sticky-кнопке, кликабельному лого.
 * Отправляет лид в Telegram-бот.
 */

class LeadModal {
  constructor() {
    this.modal   = document.getElementById('lead-modal');
    this.form    = document.getElementById('lead-form');
    if (!this.modal || !this.form) return;

    this.submitBtn     = this.form.querySelector('.lead-submit');
    this.gdprCheckbox  = this.form.querySelector('input[name="gdpr"]');
    this.successBlock  = this.modal.querySelector('.lead-success');
    this.errorBlock    = this.modal.querySelector('.lead-error');

    this._init();
  }

  _init() {
    /* Активация кнопки после GDPR */
    this.gdprCheckbox?.addEventListener('change', () => {
      this.submitBtn.disabled = !this.gdprCheckbox.checked;
    });

    /* Отправка формы */
    this.form.addEventListener('submit', e => {
      e.preventDefault();
      this._send();
    });

    /* Закрытие */
    this.modal.querySelector('.lead-modal-close')?.addEventListener('click', () => this.close());
    this.modal.querySelector('.lead-modal-backdrop')?.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.modal.classList.contains('visible')) this.close();
    });
  }

  /* Заявка с экрана услуги должна приходить с пометкой, какая это услуга,
     иначе в CRM все лиды выглядят одинаково и разбирать их некому.
     Значение уезжает в поле service вместе с UTM. */
  open(service) {
    this.service = service || null;
    this.modal.classList.remove('hidden');
    requestAnimationFrame(() => this.modal.classList.add('visible'));
    /* Замораживаем snap-навигацию */
    if (window.snapNav) window.snapNav.locked = true;
  }

  close() {
    this.modal.classList.remove('visible');
    setTimeout(() => {
      this.modal.classList.add('hidden');
      this._resetForm();
    }, 300);
    if (window.snapNav) window.snapNav.locked = false;
  }

  _resetForm() {
    this.form.reset();
    this.form.classList.remove('hidden');
    this.successBlock?.classList.add('hidden');
    this.errorBlock?.classList.add('hidden');
    if (this.submitBtn) this.submitBtn.disabled = true;
  }

  /* UTM: из текущего URL, иначе из сохранённых в этой сессии */
  _utm() {
    const keys  = ['utm_source', 'utm_medium', 'utm_campaign'];
    const query = new URLSearchParams(location.search);
    const out   = {};
    keys.forEach(k => {
      let v = query.get(k);
      if (v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
      else   { try { v = sessionStorage.getItem(k); } catch (e) { v = null; } }
      out[k] = v || '';
    });
    return out;
  }

  async _send() {
    const data  = new FormData(this.form);
    const name  = data.get('name');
    const phone = data.get('phone');
    const email = data.get('email');
    const lang  = window.i18n?.getLang?.() || 'ru';

    if (this.submitBtn) {
      this.submitBtn.disabled    = true;
      this.submitBtn.textContent = window.i18n?.t('modal.submitting') || 'ОТПРАВКА…';
    }
    /* Ход отправки слушает знак на финальном экране (act5-contact.js):
       кольцо идёт вместе с запросом и вспыхивает на успехе. */
    document.dispatchEvent(new CustomEvent('lead:sending'));

    try {
      const res = await fetch('https://lp.sbf.md/submit-nexus', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, phone, email, lang,
                                  service: this.service || '',
                                  referrer: document.referrer || '', ...this._utm() }),
      });
      if (!res.ok) throw new Error('api error');
      const result = await res.json();
      this._showSuccess(result.book_url);
      document.dispatchEvent(new CustomEvent('lead:sent'));
    } catch (err) {
      console.warn('[lead-modal] send failed:', err);
      this._showError();
      document.dispatchEvent(new CustomEvent('lead:failed'));
    } finally {
      if (this.submitBtn) {
        this.submitBtn.disabled    = false;
        this.submitBtn.textContent = window.i18n?.t('modal.submit') || 'ОТПРАВИТЬ ЗАЯВКУ';
      }
    }
  }

  _showSuccess(bookUrl) {
    this.form.classList.add('hidden');
    const bookLink = document.getElementById('lead-book-link');
    if (bookLink) bookLink.href = bookUrl || '#';
    this.successBlock?.classList.remove('hidden');
    setTimeout(() => this.close(), 8000);
  }

  _showError() {
    this.errorBlock?.classList.remove('hidden');
  }
}

window.leadModal = new LeadModal();

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

  open() {
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

  async _send() {
    const data  = new FormData(this.form);
    const name  = data.get('name');
    const phone = data.get('phone');

    if (this.submitBtn) {
      this.submitBtn.disabled    = true;
      this.submitBtn.textContent = window.i18n?.t('modal.submitting') || 'ОТПРАВКА…';
    }

    const text = `🔥 Новый лид с сайта SBF\n\n` +
                 `👤 Имя: ${name}\n` +
                 `📱 Телефон: ${phone}\n` +
                 `⏰ ${new Date().toLocaleString('ru-RU')}\n` +
                 `🌍 Источник: ${document.referrer || 'прямой заход'}`;

    try {
      const token  = window.SBF_BOT_TOKEN;
      const chatId = window.SBF_LEAD_CHAT_ID;

      if (!token || token === 'PLACEHOLDER_BOT_TOKEN') throw new Error('no token');

      const res = await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        }
      );
      if (!res.ok) throw new Error('api error');
      this._showSuccess();
    } catch (err) {
      console.warn('[lead-modal] send failed:', err);
      this._showError();
    } finally {
      if (this.submitBtn) {
        this.submitBtn.disabled    = false;
        this.submitBtn.textContent = window.i18n?.t('modal.submit') || 'ОТПРАВИТЬ ЗАЯВКУ';
      }
    }
  }

  _showSuccess() {
    this.form.classList.add('hidden');
    this.successBlock?.classList.remove('hidden');
    setTimeout(() => this.close(), 4000);
  }

  _showError() {
    this.errorBlock?.classList.remove('hidden');
  }
}

window.leadModal = new LeadModal();

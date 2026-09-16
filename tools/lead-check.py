#!/usr/bin/env python3
"""Открывается ли форма заявки — по каждой кнопке, настоящим кликом.

Аудит 16.09 нашёл, что ни одна из пяти кнопок форму не открывает, при этом
цель в Метрику уходит: отчёты показывали заявки, которых не было. Дефект
такого рода не видно ни в консоли, ни глазами на скриншоте — кнопка
нажимается, просто ничего не происходит.

Поэтому щуп кликает по-настоящему и смотрит на состояние модалки: класс,
вычисленный display и число видимых полей. Проверять по наличию
обработчика нельзя — обработчик может быть и не тот.

    python3 tools/lead-check.py
    python3 tools/lead-check.py --mobile
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'

STATE = """() => {
  const m = document.getElementById('lead-modal');
  if (!m) return { there: false };
  const fields = Array.from(m.querySelectorAll('input, textarea, select'))
    .filter(el => el.offsetParent !== null);
  return { there: true, cls: m.className,
           display: getComputedStyle(m).display,
           fields: fields.length,
           service: (window.leadModal || {}).service };
}"""


CLICKABLE = """(sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return s.display !== 'none' && s.visibility !== 'hidden' &&
         parseFloat(s.opacity) > 0.05 && s.pointerEvents !== 'none' &&
         r.width > 0 && r.height > 0;
}"""


def clickable(page, name):
    return page.evaluate(CLICKABLE, '[data-lead="%s"]' % name)


def main():
    mobile = '--mobile' in sys.argv
    size = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
    bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport=size, is_mobile=mobile, has_touch=mobile,
                            device_scale_factor=3 if mobile else 1)
        # Метрику глушим: прошлый прогон аудита нагнал полторы сотни
        # фальшивых просмотров и целей в живой счётчик.
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        errs = []
        p.on('pageerror', lambda e: errs.append(str(e)[:160]))
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1200)

        btns = p.eval_on_selector_all(
            '[data-lead]', '(els) => els.map(e => e.dataset.lead)')
        print('кнопок с data-lead: %d — %s' % (len(btns), ', '.join(btns)))
        if not btns:
            print('ПЛОХО: кнопок нет вовсе')
            sys.exit(1)

        for i, name in enumerate(btns):
            el = p.locator('[data-lead="%s"]' % name).first
            el.scroll_into_view_if_needed()
            p.wait_for_timeout(250)
            # Плавающая кнопка живёт не на всех актах: в первом и в финале,
            # где у экрана своя заявка, её гасят. Гасят через opacity и
            # pointer-events — а для Playwright такой элемент «видимый»,
            # is_visible() тут отвечает не на тот вопрос. Поэтому смотрим
            # вычисленный стиль сами, иначе щуп кликает в погашенную
            # кнопку, попадает в подвал и объявляет дефектом свою ошибку.
            if not clickable(p, name):
                # behavior: instant обязательно — у страницы плавная
                # прокрутка, и обычный scrollTo ехал бы ещё секунду.
                p.evaluate('() => scrollTo({ top: innerHeight * 2.2,'
                           ' behavior: "instant" })')
                p.wait_for_timeout(800)
            if not clickable(p, name):
                print('  %-11s кнопка погашена и в акте, и вне его' % name)
                bad.append(name + ' (погашена)')
                continue
            el.click()
            p.wait_for_timeout(500)
            st = p.evaluate(STATE)
            ok = (st.get('there') and 'hidden' not in (st.get('cls') or '')
                  and st.get('display') != 'none' and (st.get('fields') or 0) > 0)
            print('  %-11s поля: %-2s  display: %-6s  service: %-11r  %s'
                  % (name, st.get('fields'), st.get('display'),
                     st.get('service'), 'открылась' if ok else '← НЕ ОТКРЫЛАСЬ'))
            if not ok:
                bad.append(name)
            # Закрываем, иначе следующая кнопка кликается под модалкой и
            # проверка проходит на прошлом состоянии.
            p.keyboard.press('Escape')
            p.wait_for_timeout(450)
            after = p.evaluate(STATE)
            if 'hidden' not in (after.get('cls') or ''):
                print('    ← после Escape форма осталась открытой')
                bad.append(name + ' (не закрылась)')
        b.close()

    if errs:
        print('исключения в консоли: ' + '; '.join(errs[:3]))
        bad.append('JS')
    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: форма открывается с каждой кнопки и закрывается по Escape')


if __name__ == '__main__':
    main()

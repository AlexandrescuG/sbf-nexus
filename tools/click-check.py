#!/usr/bin/env python3
"""Доходит ли клик туда, куда обещает страница.

Ссылка на знаке невидима: знак нарисован на холсте, а ссылка — прозрачный
круг поверх него. Когда её накрывает другой слой, на экране не меняется
ничего — подпись по-прежнему обещает «нажмите на знак», клик просто не
работает. Консоль молчит, скриншот выглядит правильно. Аудит 16.09 нашёл
это только настоящим тапом.

Щуп спрашивает страницу, ЧТО лежит в точке клика (elementFromPoint), и
отдельно проверяет, что клик действительно открывает вкладку. Первое без
второго — реконструкция, второе без первого не скажет, кто мешал.

    python3 tools/click-check.py [--mobile]
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'

# Акты, где у знака есть куда вести. Список короткий и задан сценой
# (act.link), поэтому держим его здесь, а не угадываем.
ACTS = ['stream', 'terminal']

AT_MARK = """() => {
  const a = document.querySelector('.mark-link');
  if (!a || getComputedStyle(a).display === 'none') return { link: false };
  const r = a.getBoundingClientRect();
  const x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  const el = document.elementFromPoint(x, y);
  return { link: true, href: a.getAttribute('href'),
           x: x, y: y, size: Math.round(r.width),
           hit: el ? (el.tagName.toLowerCase() +
                      (el.className ? '.' + String(el.className).split(' ')[0] : ''))
                   : null,
           mine: !!(el && el.closest && el.closest('.mark-link')) };
}"""

SPAN = """(id) => {
  const els = Array.from(document.querySelectorAll('.act'));
  const el = els.find(e => e.dataset.act === id);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  scrollTo({ top: r.top + scrollY + r.height * 0.4 - innerHeight / 2,
             behavior: 'instant' });
  return true;
}"""


def main():
    mobile = '--mobile' in sys.argv
    size = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
    bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport=size, is_mobile=mobile, has_touch=mobile)
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1200)

        for act in ACTS:
            if not p.evaluate(SPAN, act):
                print('  %-9s секции нет' % act)
                bad.append(act)
                continue
            p.wait_for_timeout(900)
            st = p.evaluate(AT_MARK)
            if not st.get('link'):
                print('  %-9s ссылки на знаке нет' % act)
                bad.append(act + ' (нет ссылки)')
                continue
            print('  %-9s круг %d px, в точке (%d, %d) лежит %s'
                  % (act, st['size'], st['x'], st['y'], st['hit']))
            if not st['mine']:
                print('             ← клик перехватывает не ссылка')
                bad.append(act + ' (перехват)')
                continue
            # Настоящий клик: ссылка с target=_blank должна дать новую
            # вкладку. Проверка «обработчик есть» тут ничего не значит —
            # перехват происходит слоем выше, до всякого обработчика.
            try:
                with ctx.expect_page(timeout=4000) as tab:
                    p.mouse.click(st['x'], st['y'])
                new = tab.value
                print('             вкладка открылась: %s' % new.url[:58])
                new.close()
            except Exception:
                print('             ← вкладка не открылась')
                bad.append(act + ' (нет вкладки)')
        b.close()

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: клик по знаку доходит до ссылки и открывает платформу')


if __name__ == '__main__':
    main()

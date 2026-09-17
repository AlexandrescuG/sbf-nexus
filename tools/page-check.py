#!/usr/bin/env python3
"""Чего страница просит и не получает, и куда ведут её ссылки.

Три вещи, которые не видно ни на снимке, ни в коде глазами:

  * запрос с ответом 404 — страница просит файл, которого нет. Значок
    вкладки был именно таким: браузер сам идёт за /favicon.ico, получает
    404 и пишет в консоль на странице, которую открывают ради консоли;
  * якорь в никуда — ссылка на #раздел, которого в разметке нет;
  * подпись, обещающая действие, которого нет. Такую проверку
    автоматически не сделать, поэтому здесь только то, что проверяется:
    ссылки и запросы.

    python3 tools/page-check.py [--mobile]
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'


def main():
    mobile = '--mobile' in sys.argv
    size = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
    misses, errs = [], []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport=size, is_mobile=mobile, has_touch=mobile)
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        p.on('pageerror', lambda e: errs.append(str(e)[:160]))
        # Считаем ответы, а не запросы: 404 виден только в ответе.
        p.on('response', lambda r: misses.append((r.status, r.url))
             if r.status >= 400 else None)
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(2500)
        # Проезжаем страницу: часть файлов подтягивается по ходу.
        for i in range(8):
            p.evaluate('(k) => scrollTo({ top: document.body.scrollHeight * k,'
                       ' behavior: "instant" })', i / 8)
            p.wait_for_timeout(500)

        anchors = p.evaluate("""() => {
          const bad = [];
          document.querySelectorAll('a[href^="#"]').forEach(a => {
            const id = a.getAttribute('href').slice(1);
            if (!id) return;
            if (!document.getElementById(id) &&
                !document.querySelector('[name="' + id + '"]')) {
              bad.push(a.getAttribute('href') + '  («' +
                       (a.innerText || '').trim().slice(0, 30) + '»)');
            }
          });
          return bad;
        }""")
        b.close()

    print('ответы 4xx/5xx: %d' % len(misses))
    for code, url in misses[:12]:
        print('  %s  %s' % (code, url[:90]))
    print('якоря в никуда: %d' % len(anchors))
    for a in anchors[:12]:
        print('  ' + a)
    print('исключения JS: %d' % len(errs))
    for e in errs[:5]:
        print('  ' + e)
    print()
    if misses or anchors or errs:
        print('ПЛОХО')
        sys.exit(1)
    print('хорошо: всё запрошенное отдаётся, якоря ведут в разделы')


if __name__ == '__main__':
    main()

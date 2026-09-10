#!/usr/bin/env python3
"""Проба каркаса гобелена: что реально нарисовано на холсте сцены.

Скриншот страницы показывает результат вместе с CSS-фоном и текстом, и по
нему не понять, рисует ли сцена вообще. Здесь холст снимается отдельно
(toDataURL) и считается доля непрозрачных пикселей — если она ноль, сцена
молчит, сколько бы красиво ни выглядела страница.

    python3 tools/scene-probe.py [--url ...] [--scroll 0.0..1.0]
"""
import argparse, base64, pathlib

from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent / 'shots'


def main(url, scroll, width, height):
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_context(viewport={'width': width, 'height': height}).new_page()
        errs = []
        p.on('pageerror', lambda e: errs.append('JS: ' + str(e)[:200]))
        p.goto(url, wait_until='load')
        p.wait_for_timeout(1200)
        if scroll:
            p.evaluate('window.scrollTo(0, document.body.scrollHeight * %f)' % scroll)
            p.wait_for_timeout(800)

        info = p.evaluate("""() => {
          const c = document.querySelector('.scene-layer canvas');
          if (!c) return { canvas: null };
          const g = c.getContext('2d');
          const d = g.getImageData(0, 0, c.width, c.height).data;
          let ink = 0;
          for (let i = 3; i < d.length; i += 4) if (d[i] > 8) ink++;
          return { canvas: [c.width, c.height], ink: ink / (c.width * c.height),
                   scene: window.SBF_SCENE || null };
        }""")
        print('холст:', info.get('canvas'))
        if info.get('canvas'):
            print('нарисовано: %.3f%% площади' % (info['ink'] * 100))
        print('сцена:', info.get('scene'))

        # Правило коридора: колонка текста не заходит в полосу знака. Раньше
        # это проверялось глазами и один раз уже стоило нам логотипа поверх
        # текста, поэтому проверка автоматическая и по всей длине страницы.
        bad = p.evaluate("""() => {
          const cs = getComputedStyle(document.documentElement);
          const x = parseFloat(cs.getPropertyValue('--corridor-x'));
          const w = parseFloat(cs.getPropertyValue('--corridor-w'));
          const out = [];
          if (window.innerWidth <= 900) {
            // На телефоне коридор горизонтальный: знак стоит НАД колонкой,
            // и проверять надо вертикаль — нижний край кольца против первой
            // строки текста.
            // Пересечение здесь неизбежно: знак закреплён, текст едет мимо.
            // Нарушением считается не сам факт встречи, а непогашенный знак
            // поверх текста — сцена обязана его приглушить (markDim).
            const s = window.SBF_SCENE || {};
            const markTop = innerHeight * 0.17 -
                            Math.min(innerWidth * (w / 2) * 0.62, innerHeight * 0.19);
            const markBottom = innerHeight * 0.17 +
                               Math.min(innerWidth * (w / 2) * 0.62, innerHeight * 0.19);
            document.querySelectorAll('.act-col').forEach(el => {
              const r = el.getBoundingClientRect();
              const hits = r.height && r.top < markBottom && r.bottom > markTop;
              if (hits && (s.markDim == null || s.markDim > 0.35))
                out.push(['колонка под знаком', 'markDim ' + (s.markDim || 1).toFixed(2),
                          el.textContent.trim().slice(0, 30)]);
            });
            return out.slice(0, 4);
          }
          const left = innerWidth * (x - w / 2);
          document.querySelectorAll('.act-col, .act-col *').forEach(el => {
            if (!el.textContent.trim()) return;
            const r = el.getBoundingClientRect();
            if (r.width && r.right > left)
              out.push([el.tagName.toLowerCase(),
                        Math.round(r.right - left) + 'px в коридоре',
                        el.textContent.trim().slice(0, 34)]);
          });
          return out.slice(0, 6);
        }""")
        print('коридор знака:', 'чисто' if not bad else 'НАРУШЕН')
        for row in bad:
            print('   ', row)

        readable = p.evaluate("""() => {
          const h = document.querySelector('h1');
          return h ? [getComputedStyle(h).color, getComputedStyle(document.body).backgroundColor] : null;
        }""")
        print('цвет заголовка / фон:', readable)
        print('ошибки:', errs[:5])

        data = p.evaluate("document.querySelector('.scene-layer canvas').toDataURL('image/png')")
        (OUT / 'scene-canvas.png').write_bytes(base64.b64decode(data.split(',')[1]))
        p.screenshot(path=str(OUT / 'scene-page.png'))
        b.close()
    print('снимки:', OUT / 'scene-canvas.png', OUT / 'scene-page.png')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default='http://127.0.0.1:5001/index-next.html')
    ap.add_argument('--scroll', type=float, default=0.0)
    ap.add_argument('--width', type=int, default=1440)
    ap.add_argument('--height', type=int, default=900)
    a = ap.parse_args()
    main(a.url, a.scroll, a.width, a.height)

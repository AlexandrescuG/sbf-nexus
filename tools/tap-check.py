#!/usr/bin/env python3
"""Размер целей под палец на узком экране.

Аудит намерил в шапке «RU / EN / RO» по 16×14 px при шрифте 10 px. На
скриншоте такая шапка выглядит аккуратной — дефект виден только линейкой,
и только на телефоне.

Порог 44 px — из рекомендаций WCAG 2.5.5 и Apple HIG; Lighthouse считает
по нему же. Меряем ВСЕ цели страницы, а не только шапку: правка в одном
месте не должна оставить мелкими соседей.

Цели, погашенные в текущем акте (плавающая кнопка), пропускаем: их размер
ничего не значит, пока по ним нельзя попасть.

    python3 tools/tap-check.py            # 390x844
    python3 tools/tap-check.py 360 780
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
MIN = 44

SCAN = """(min) => {
  const sel = 'a[href], button, [role="button"], input, select';
  const out = [];
  document.querySelectorAll(sel).forEach(el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    if (parseFloat(s.opacity) < 0.05 || s.pointerEvents === 'none') return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (r.width >= min && r.height >= min) return;
    /* Ссылка внутри фразы — не самостоятельная цель, и раздувать её
       нельзя: отступы разорвали бы строку абзаца. WCAG (2.5.8) делает
       для таких ровно это исключение. Без него щуп требовал бы
       невыполнимого и не проходил бы никогда — а проверка, которая не
       может пройти, перестаёт что-либо значить.

       Отличаем по соседям: если рядом в том же абзаце есть свой текст,
       ссылка стоит в предложении. Одинокая ссылка в строке — цель. */
    const par = el.parentElement;
    if (par) {
      const own = (par.textContent || '').trim().length
                - (el.textContent || '').trim().length;
      const inline = getComputedStyle(el).display.startsWith('inline');
      if (inline && own > 2) return;
    }
    const name = (el.innerText || el.getAttribute('aria-label') || el.className || '')
      .trim().replace(/\\s+/g, ' ').slice(0, 34);
    out.push({ w: Math.round(r.width), h: Math.round(r.height),
               name: name, where: el.closest('.scene-nav') ? 'шапка'
                 : (el.closest('.scene-foot') ? 'подвал'
                 : (el.closest('.act-col') ? 'колонка' : 'прочее')) });
  });
  return out;
}"""


def main():
    args = [a for a in sys.argv[1:] if a.isdigit()]
    w, h = (int(args[0]), int(args[1])) if len(args) >= 2 else (390, 844)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True,
                            has_touch=True, device_scale_factor=3)
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1500)
        # Проходим страницу целиком: часть целей появляется только в
        # своём акте, и замер с одного экрана их не увидит.
        small, seen = [], set()
        steps = 14
        for i in range(steps):
            p.evaluate('(k) => scrollTo({ top: document.body.scrollHeight * k,'
                       ' behavior: "instant" })', i / steps)
            p.wait_for_timeout(450)
            for it in p.evaluate(SCAN, MIN):
                key = (it['where'], it['name'], it['w'], it['h'])
                if key in seen:
                    continue
                seen.add(key)
                small.append(it)
        b.close()

    print('%dx%d, порог %d px' % (w, h, MIN))
    if not small:
        print('хорошо: все цели не меньше %d px' % MIN)
        return
    for it in sorted(small, key=lambda x: x['w'] * x['h']):
        print('  %-8s %3dx%-3d  %s' % (it['where'], it['w'], it['h'], it['name']))
    print('\nПЛОХО: мелких целей %d' % len(small))
    sys.exit(1)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Снимки гобелена по актам.

Скриншот всей страницы для сцены бесполезен: сцена рисует то, что видит
камера, и «весь документ» — это десять экранов, из которых сцена рисует
один. Поэтому едем к нужной доле нужного акта и снимаем кадр.

    python3 tools/scene-shots.py                 # все акты, десктоп
    python3 tools/scene-shots.py globe lens      # только эти
    python3 tools/scene-shots.py --mobile        # телефон
    python3 tools/scene-shots.py --t 0.9 globe   # конкретная доля акта

Кладёт в tools/shots-scene/ и печатает, что снял.
"""
import sys
import pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'tools' / 'shots-scene'
URL = 'http://127.0.0.1:5001/index-next.html'

SPAN = """([id, t]) => {
  const els = Array.from(document.querySelectorAll('.act'));
  /* Сначала по id секции, потом по акту сцены. Один акт бывает у
     нескольких секций (терминал ×2, услуги ×3, поток ×2), и поиск
     только по акту всегда приводил к первой из них — снять вторую было
     нечем. */
  const el = els.find(e => e.id === id) ||
             els.find(e => e.dataset.act === id) || els[0];
  const r = el.getBoundingClientRect();
  const top = r.top + scrollY;
  const half = innerHeight / 2;
  const docH = document.documentElement.scrollHeight;
  const first = els.indexOf(el) === 0, last = els.indexOf(el) === els.length - 1;
  let lo = first ? Math.max(top, half) : top;
  let hi = last ? Math.min(top + r.height, docH - half) : top + r.height;
  scrollTo(0, Math.round(lo + (hi - lo) * t - half));
  return [id, Math.round(scrollY)];
}"""


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    mobile = '--mobile' in sys.argv
    t = 0.5
    if '--t' in sys.argv:
        t = float(sys.argv[sys.argv.index('--t') + 1])
        args = [a for a in args if a != str(t)]
    lang = 'ru'
    if '--lang' in sys.argv:
        lang = sys.argv[sys.argv.index('--lang') + 1]
        args = [a for a in args if a != lang]

    OUT.mkdir(exist_ok=True)
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
    tag = 'm-' if mobile else ''
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_context(viewport=vp, device_scale_factor=1).new_page()
        p.goto(URL + '?lang=' + lang, wait_until='load')
        p.wait_for_timeout(2500)
        acts = args or p.evaluate(
            "[...new Set([...document.querySelectorAll('.act')]"
            ".map(e => e.dataset.act || e.id))]")
        for i, act in enumerate(acts):
            p.evaluate(SPAN, [act, t])
            # Камера догоняет прокрутку за 0.2 с, лента и нити живут секундами
            p.wait_for_timeout(2600)
            name = f'{tag}{act}-{int(t * 100):02d}.png'
            p.screenshot(path=str(OUT / name))
            print(' ', name)
        b.close()


if __name__ == '__main__':
    main()

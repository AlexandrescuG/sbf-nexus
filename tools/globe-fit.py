#!/usr/bin/env python3
"""Раскладка финала в числах: шар, знак, колонка текста, карточки офисов.

Скриншот показывает, красиво или нет, но не говорит, ЧТО именно упёрлось.
Здесь печатаются все четыре участника кадра и зазоры между ними — так
видно, что ограничивает радиус: высота кадра, колонка слева или стопка
карточек справа. Без этого «сделай шар больше» превращается в подбор
чисел наугад.

    python3 tools/globe-fit.py                 # 1440x900
    python3 tools/globe-fit.py 1920 1080 1280 800
"""
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'

MEASURE = """(t) => {
  /* Едем к доле акта ровно так же, как tools/scene-shots.py: своя формула
     давала t=0.26 там, где просили 0.85, и числа описывали не тот кадр,
     который потом смотришь на снимке. */
  const els = Array.from(document.querySelectorAll('.act'));
  const el = els.find(e => e.dataset.act === 'globe');
  const r = el.getBoundingClientRect();
  const top = r.top + scrollY, half = innerHeight / 2;
  const docH = document.documentElement.scrollHeight;
  const lo = top, hi = Math.min(top + r.height, docH - half);
  scrollTo(0, Math.round(lo + (hi - lo) * t - half));
  return new Promise(res => setTimeout(() => {
    const g = window.SBF_SCENE.acts.globe;
    const S = window.SBF_SCENE;
    const view = S.view;
    if (!view || !S.mark) return res(null);
    const G = g.geometry(view, S.mark);
    const col = document.querySelector('.act[data-act="globe"] .act-col');
    const cards = Array.from(
      document.querySelectorAll('.act[data-act="globe"] .act-offices > *'));
    const vis = cards.filter(
      c => parseFloat(getComputedStyle(c).opacity || 0) > 0.05);
    const box = vis.length ? {
      l: Math.min(...vis.map(c => c.getBoundingClientRect().left)),
      r: Math.max(...vis.map(c => c.getBoundingClientRect().right)),
      t: Math.min(...vis.map(c => c.getBoundingClientRect().top)),
      b: Math.max(...vis.map(c => c.getBoundingClientRect().bottom)),
    } : null;
    res({
      cx: Math.round(G.cx), cy: Math.round(G.cy), R: Math.round(G.R),
      markR: Math.round(G.mark.r),
      colRight: Math.round(col.getBoundingClientRect().right),
      cards: box && { l: Math.round(box.l), r: Math.round(box.r),
                      t: Math.round(box.t), b: Math.round(box.b),
                      n: vis.length },
      w: view.w, h: view.h, act: S.act, camT: Math.round(S.t * 100) / 100,
      markCx: S.markCx,
    });
  }, 700));
}"""


def run(p, w, h):
    p.set_viewport_size({'width': w, 'height': h})
    p.goto(URL, wait_until='load')
    p.wait_for_timeout(1200)
    print('%dx%d' % (w, h))
    for t in (0.15, 0.35, 0.65, 0.85):
        m = p.evaluate(MEASURE, t)
        if not m:
            print('  t=%.2f — сцена молчит' % t)
            continue
        left = m['cx'] - m['R']
        right = m['cx'] + m['R']
        line = ('  %s t=%.2f (markCx %.2f)  R=%d  центр %d,%d'
                '  слева %d (колонка %d, зазор %d)  справа %d (за кадром %d)'
                % (m['act'], m['camT'], m['markCx'], m['R'], m['cx'], m['cy'],
                   left, m['colRight'], left - m['colRight'], right,
                   max(0, right - m['w'])))
        c = m['cards']
        if c:
            hub = round(m['markR'] * 0.58)
            hl, hr = m['cx'] - hub, m['cx'] + hub
            # Зазор по горизонтали между коробкой карточек и диском знака;
            # отрицательный — коробка и знак перекрываются по x.
            gap = max(hl - c['r'], c['l'] - hr)
            line += ('\n         карточки x %d..%d, y %d..%d — до знака %d,'
                     ' до колонки %d'
                     % (c['l'], c['r'], c['t'], c['b'], gap,
                        c['l'] - m['colRight']))
            if gap < 0:
                line += '  ← карточки НАКРЫВАЮТ знак'
        print(line)


def main(argv):
    sizes = [(1440, 900)]
    if argv:
        n = [int(x) for x in argv]
        sizes = list(zip(n[::2], n[1::2]))
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_context(viewport={'width': sizes[0][0],
                                    'height': sizes[0][1]}).new_page()
        for w, h in sizes:
            run(p, w, h)
        b.close()


if __name__ == '__main__':
    main(sys.argv[1:])

#!/usr/bin/env python3
"""Сколько на телефоне воздуха и во что упирается знак.

Отступы актов на узком экране — не украшение: сверху стоит знак, снизу
лежит плавающая кнопка. Поэтому «ужать пустоты» нельзя подбором чисел на
глаз — можно только посчитав, где у знака шапка сверху и первая строка
снизу. Ровно этот зазор однажды уже схлопнулся: кольцо легло на
заголовок.

Щуп печатает три вещи:
  * длину страницы в экранах и долю, которую занимают отступы;
  * зазор между текстом соседних актов — то, что человек и видит как
    «пустое пространство»;
  * зазоры знака: до шапки сверху и до первой строки снизу. Меньше 8 px —
    дефект, и неважно, насколько короче стала страница.

    python3 tools/scene-air.py
"""
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
W, H = 390, 844          # iPhone 12
MIN_GAP = 8

JS = """() => {
  const nav = document.querySelector('.scene-nav').getBoundingClientRect();
  const out = [];
  document.querySelectorAll('.act').forEach(el => {
    const r = el.getBoundingClientRect();
    const col = el.querySelector('.act-col').getBoundingClientRect();
    out.push({ id: el.dataset.act, h: Math.round(r.height),
               top: Math.round(col.top - r.top),
               bottom: Math.round(r.bottom - col.bottom) });
  });
  return { acts: out, nav: Math.round(nav.bottom),
           doc: document.documentElement.scrollHeight };
}"""

# Знак меряется у самой сцены, а не пересчитывается здесь по формуле:
# копия формулы разошлась бы с оригиналом — этим уже кончилась история
# с коридором, продублированным в CSS и в JS.
MARK = """(id) => {
  const els = Array.from(document.querySelectorAll('.act'));
  const el = els.find(e => e.dataset.act === id);
  const r = el.getBoundingClientRect();
  /* Ставим акт ровно под шапку. Знак закреплён относительно окна, а
     колонка едет с прокруткой — сравнивать их можно только в одном,
     заранее названном положении. Это и есть то положение, ради которого
     отступ задан: акт только что пришёл на экран. */
  scrollTo(0, r.top + scrollY);
  return new Promise(res => setTimeout(() => {
    const S = window.SBF_SCENE;
    const g = S.mark.geometry(S.view);
    const act = S.acts[id];
    /* У финала знак раскрывается в шар — снизу мешает уже шар, а не
       кольцо. Меряем то, что реально нарисовано. */
    const R = act && act.geometry
      ? act.geometry(S.view, S.mark).R : g.r;
    const col = el.querySelector('.act-col').getBoundingClientRect();
    res({ top: Math.round(g.cy - Math.max(g.r, R)),
          bottom: Math.round(g.cy + Math.max(g.r, R)),
          line: Math.round(col.top) });
  }, 600));
}"""


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_context(viewport={'width': W, 'height': H}, is_mobile=True,
                          has_touch=True, device_scale_factor=3).new_page()
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1500)
        d = p.evaluate(JS)

        pad = sum(a['top'] + a['bottom'] for a in d['acts'])
        print('страница %d px = %.1f экрана,  отступы %d px = %d%% страницы'
              % (d['doc'], d['doc'] / H, pad, round(pad * 100 / d['doc'])))
        print()
        acts = d['acts']
        print('зазор между текстом соседних актов:')
        for i in range(len(acts) - 1):
            gap = acts[i]['bottom'] + acts[i + 1]['top']
            print('  %-9s → %-9s %4d px = %.2f экрана'
                  % (acts[i]['id'], acts[i + 1]['id'], gap, gap / H))
        print()
        print('знак: зазор до шапки и до первой строки')
        bad = []
        for a in acts:
            m = p.evaluate(MARK, a['id'])
            up = m['top'] - d['nav']
            down = m['line'] - m['bottom']
            flag = ''
            if up < MIN_GAP or down < MIN_GAP:
                flag = '   ← ТЕСНО'
                bad.append(a['id'])
            print('  %-9s сверху %4d,  снизу %4d%s' % (a['id'], up, down, flag))
        b.close()
    print()
    print('ПЛОХО: знаку тесно в ' + ', '.join(bad) if bad
          else 'хорошо: знак нигде не ближе %d px к шапке и к тексту' % MIN_GAP)


if __name__ == '__main__':
    main()

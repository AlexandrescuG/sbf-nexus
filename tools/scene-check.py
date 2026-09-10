#!/usr/bin/env python3
"""Проверка каркаса гобелена (index-next.html).

Пять вопросов, на которые каркас обязан отвечать «да» после любой правки:
камера идёт по актам по порядку; кадр укладывается в бюджет под непрерывной
прокруткой; на телефоне колонка занимает всю ширину; при prefers-reduced-motion
сцена не двигается сама; без JS текст остаётся на месте, а сцена не мешает.

Проверку коридора знака делает соседний tools/scene-probe.py — она считается
по разметке и потому живёт рядом со снимком холста.

    python3 tools/scene-check.py
"""
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'


def acts_seen(p, steps=14):
    h = p.evaluate('document.body.scrollHeight')
    seq = []
    for i in range(steps):
        p.evaluate('window.scrollTo(0, %d)' % int(h * i / steps))
        p.wait_for_timeout(260)
        s = p.evaluate('window.SBF_SCENE')
        if s and (not seq or seq[-1] != s['act']):
            seq.append(s['act'])
    return seq


with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. Десктоп: акты по порядку, кадр под непрерывной прокруткой
    p = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
    errs = []
    p.on('pageerror', lambda e: errs.append(str(e)[:160]))
    p.goto(URL, wait_until='load')
    p.wait_for_timeout(1000)
    print('десктоп, порядок актов:', ' → '.join(acts_seen(p)))
    p.evaluate('window.scrollTo(0, 0)')
    p.wait_for_timeout(300)
    for i in range(60):                      # имитация прокрутки колесом
        p.mouse.wheel(0, 120)
    p.wait_for_timeout(400)
    print('кадр под прокруткой:', p.evaluate('window.SBF_SCENE.ms.toFixed(2)'), 'мс,',
          'dpr', p.evaluate('window.SBF_SCENE.dpr'),
          'упрощение:', p.evaluate('window.SBF_SCENE.simple'))
    print('ошибки:', errs[:3])

    # 2. Телефон: коридор уходит вниз, текст на всю ширину
    m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                      has_touch=True).new_page()
    m.goto(URL, wait_until='load')
    m.wait_for_timeout(900)
    print('телефон, акты:', ' → '.join(acts_seen(m, 8)))
    print('телефон, ширина колонки:',
          m.evaluate("getComputedStyle(document.querySelector('.act-col')).width"))

    # 3. Меньше движения: цикл не крутится сам по себе
    r = b.new_context(viewport={'width': 1440, 'height': 900},
                      reduced_motion='reduce').new_page()
    r.goto(URL, wait_until='load')
    r.wait_for_timeout(800)
    a = r.evaluate('window.SBF_SCENE && window.SBF_SCENE.t')
    r.wait_for_timeout(1200)
    bb = r.evaluate('window.SBF_SCENE && window.SBF_SCENE.t')
    print('меньше движения: сцена жива =', a is not None,
          ', сама не двигается =', a == bb)

    # 4. Без JS: текст на месте, сцены нет
    n = b.new_context(viewport={'width': 1440, 'height': 900},
                      java_script_enabled=False).new_page()
    n.goto(URL, wait_until='load')
    print('без JS: заголовок виден =',
          n.is_visible('h1'),
          ', слой сцены скрыт =',
          n.evaluate("getComputedStyle(document.querySelector('.scene-layer')).display") == 'none')
    b.close()

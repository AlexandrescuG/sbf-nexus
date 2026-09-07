#!/usr/bin/env python3
"""
Прогоняет проверку опорных точек из shots.py на трёх языках.

Зачем отдельно: shots.py снимает на русском, а подписи знаков в EN и RO
другой длины — «a third of the ring — that much is on our side» шире
русской, и именно такие строки ложились на абзацы. Скриншоты не делает,
только отчёт; запускать после shots.py.

    python3 tools/lang-check.py [--device iphone] [--url ...]
"""
import argparse, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from shots import DEVICES, ANCHORS_JS, DEFAULT_URL          # noqa: E402
from playwright.sync_api import sync_playwright              # noqa: E402

LANGS = ['ru', 'en', 'ro']


def run(url, devices):
    problems = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name in devices:
            d = DEVICES[name]
            ctx = browser.new_context(viewport={'width': d['width'], 'height': d['height']},
                                      device_scale_factor=1, is_mobile=d['mobile'], has_touch=d['mobile'])
            page = ctx.new_page()
            page.goto(url, wait_until='networkidle')
            page.wait_for_timeout(1500)
            # Пройти по всем секциям, чтобы знаки заполнились и подписи встали
            ids = page.eval_on_selector_all('.snap-stop', 'els => els.map(e => e.id)')
            for lang in LANGS:
                page.evaluate('l => window.i18n && window.i18n.setLang(l)', lang)
                page.wait_for_timeout(300)
                for sid in ids:
                    page.evaluate('id => window.scrollTo(0, document.getElementById(id).offsetTop)', sid)
                    page.wait_for_timeout(250)
                page.wait_for_timeout(1200)
                for a in page.evaluate(ANCHORS_JS):
                    problems.append(f'{name}/{lang}: {a}')
            print(f'  {name:10} проверено на {", ".join(LANGS)}')
            ctx.close()
        browser.close()
    print()
    if problems:
        print('НАЙДЕНО:')
        for p in problems:
            print('  ·', p)
    else:
        print('Проблем не найдено.')
    return 1 if problems else 0


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=DEFAULT_URL)
    ap.add_argument('--device', action='append', choices=list(DEVICES))
    a = ap.parse_args()
    sys.exit(run(a.url, a.device or ['laptop', 'laptop-low', 'iphone']))

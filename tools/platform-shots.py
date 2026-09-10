#!/usr/bin/env python3
"""Свежие экраны платформы для сцены.

Скриншоты в assets/platform/ стареют молча: платформа обновляется, а на
сайте остаётся кадр полугодовой давности — и это видно всем, кроме нас.
Здесь они снимаются с живой lp.sbfconsult.com одной командой.

Снимаем верхнюю часть экрана: в кольцо на сайте попадает именно она, а
низ страницы всё равно обрезается. Ширина 1440 — чтобы вёрстка была
десктопной, а не планшетной.

    python3 tools/platform-shots.py
    python3 tools/platform-shots.py --only terminal
"""
import argparse
import pathlib

from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / 'assets' / 'platform'

PAGES = [
    ('terminal', 'https://lp.sbfconsult.com/',             'главный экран: что обсуждают, эпицентр'),
    ('journal',  'https://lp.sbfconsult.com/journal.html', 'журнал сделок'),
    ('academy',  'https://lp.sbfconsult.com/edu/',         'академия'),
]


def main(only, width, height):
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width': width, 'height': height},
                            device_scale_factor=2)
        for name, url, what in PAGES:
            if only and only != name:
                continue
            p = ctx.new_page()
            try:
                p.goto(url, wait_until='networkidle', timeout=45000)
            except Exception:
                p.goto(url, wait_until='load', timeout=45000)
            p.wait_for_timeout(3500)          # графики и котировки дорисовываются
            # Чат-виджет и баннеры согласия в кадре не нужны: это не платформа,
            # это то, что поверх неё.
            p.evaluate("""() => {
              document.querySelectorAll(
                '[class*=chat], [id*=chat], [class*=cookie], [class*=consent]'
              ).forEach(e => e.style.display = 'none');
            }""")
            path = OUT / f'{name}.png'
            p.screenshot(path=str(path))
            kb = path.stat().st_size / 1024
            print(f'{name:9s} {kb:6.0f} КБ  {what}')
            p.close()
        b.close()


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--only')
    ap.add_argument('--width', type=int, default=1440)
    ap.add_argument('--height', type=int, default=900)
    a = ap.parse_args()
    main(a.only, a.width, a.height)

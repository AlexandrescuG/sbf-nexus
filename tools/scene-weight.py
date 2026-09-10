#!/usr/bin/env python3
"""Что тяжелее всего на первом экране гобелена.

Двенадцать самых крупных загрузок до первого экрана. Именно так нашлось,
что d3.min.js весит 273 КБ ради трёх функций.

    python3 tools/scene-weight.py
"""
from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport={'width': 390, 'height': 844}).new_page()
    p.goto('http://127.0.0.1:5001/index-next.html', wait_until='load')
    p.wait_for_timeout(2500)
    rows = p.evaluate("""() => performance.getEntriesByType('resource')
        .map(r => [r.name.split('/').slice(-1)[0], Math.round((r.transferSize||0)/1024)])
        .sort((a, b) => b[1] - a[1]).slice(0, 12)""")
    for name, kb in rows:
        print(f'{kb:6d} КБ  {name[:60]}')
    b.close()

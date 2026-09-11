#!/usr/bin/env python3
"""Проверка финала: не превращается ли шар в кляксу.

Прокручиваем шар на полный оборот и на каждом из 72 положений считаем
долю закрашенных пикселей внутри диска. Материки занимают от трети до
сорока с небольшим процентов видимой полусферы; клякса — почти всё.

Зачем отдельная проверка. Дефект был перемежающийся: на большинстве
углов шар выглядел правильно, а на некоторых заливка накрывала диск
целиком — владелец описал это как «время от времени появляются странные
шейдеры». Снимок экрана в случайный момент такое не ловит, а глазами
оборот не пересмотришь.

    python3 tools/globe-check.py
    python3 tools/globe-check.py --mobile
"""
import sys
from playwright.sync_api import sync_playwright

MEASURE = """() => {
  const g = window.SBF_SCENE.acts.globe;
  const L = g.layer;
  if (!L) return null;
  const c = L.getContext('2d');
  const d = c.getImageData(0, 0, L.width, L.height).data;
  let ink = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 40) ink++;
  const R = L.half - 2;
  const disc = Math.PI * R * R;
  let pts = 0; for (const r of (g.rings || [])) pts += r.length / 4;
  return { доля: +(ink / disc).toFixed(3), точек: pts, spin: +g.spin.toFixed(2) };
}"""

mobile = '--mobile' in sys.argv
vp = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
with sync_playwright() as pw:
    b = pw.chromium.launch()
    p = b.new_context(viewport=vp).new_page()
    p.goto('http://127.0.0.1:5001/index-next.html?lang=ru', wait_until='load')
    p.wait_for_timeout(2000)
    h = p.evaluate('document.documentElement.scrollHeight')
    p.evaluate(f'scrollTo(0, {int(h - vp["height"] * 1.9)})')
    p.wait_for_timeout(2500)
    worst, worst_at = 0, None
    N = 72
    for i in range(N):
        p.evaluate(f'window.SBF_SCENE.acts.globe.spin = {i * 6.2832 / N}')
        p.wait_for_timeout(70)
        r = p.evaluate(MEASURE)
        if not r:
            print('слой не построен'); break
        if r['доля'] > worst:
            worst, worst_at = r['доля'], r['spin']
    print('точек в кольцах:', r['точек'], ' худший угол:', worst_at)
    print('худшая доля заливки:', worst,
          '— клякса' if worst > 0.55 else '— нормально')
    b.close()

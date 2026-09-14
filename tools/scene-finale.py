#!/usr/bin/env python3
"""Снимки финала на реальном профиле устройства + что сцена сама о себе думает.

Нужен отдельно от scene-shots.py: тот снимает по секциям страницы, а финал
живёт не в секции, а в акте — шар рисуется на закреплённом холсте поверх
колонки, и его видимость зависит от markDim, который считается по
прямоугольнику этой колонки. Понять, что видно на телефоне, можно только
сняв кадр и спросив сцену про её же числа.

    python3 tools/scene-finale.py --device "Galaxy S24"
"""
import argparse
import pathlib

from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
OUT = pathlib.Path(__file__).parent / 'shots-scene'


def run(url, device, cpu, steps):
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as pw:
        prof = pw.devices[device]
        b = pw.chromium.launch()
        ctx = b.new_context(**prof)
        p = ctx.new_page()
        cdp = ctx.new_cdp_session(p)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        p.goto(url, wait_until='load')
        p.wait_for_timeout(2500)

        act = p.evaluate("""() => {
          const e = document.querySelector('.act[data-act="globe"]');
          return { top: e.offsetTop, h: e.offsetHeight,
                   doc: document.body.scrollHeight };
        }""")
        slug = device.replace(' ', '-').lower()
        for i in range(steps):
            y = act['top'] + act['h'] * i / (steps - 1)
            p.evaluate('window.scrollTo(0, %d)' % int(y))
            p.wait_for_timeout(700)
            st = p.evaluate("""() => {
              const s = window.SBF_SCENE || {};
              return { act: s.act, t: +(s.t || 0).toFixed(2),
                       markDim: +(s.markDim || 0).toFixed(2),
                       ms: +(s.ms || 0).toFixed(1), fps: s.fps,
                       dark: document.body.dataset.dark };
            }""")
            print(f'  {i}: y={int(y)}  акт={st["act"]}  t={st["t"]}  '
                  f'markDim={st["markDim"]}  кадр={st["ms"]} мс  '
                  f'fps≈{st["fps"]}  тёмный={st["dark"]}')
            p.screenshot(path=str(OUT / f'finale-{slug}-{i}.png'))
        b.close()
    print(f'снимки: {OUT}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=URL)
    ap.add_argument('--device', default='Galaxy S24')
    ap.add_argument('--cpu', type=int, default=4)
    ap.add_argument('--steps', type=int, default=6)
    a = ap.parse_args()
    run(a.url, a.device, a.cpu, a.steps)

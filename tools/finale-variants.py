#!/usr/bin/env python3
"""Варианты финала — снимками на профиле устройства, до правки самого акта.

Ничего в js/ и css/ не трогает: каждый вариант накладывается на живую
страницу в браузере (CSS + подмена пары чисел в акте) и снимается. Смысл в
том, чтобы выбирать глазами по кадрам, а не по описанию словами.

Что общего у всех вариантов — две починки вёрстки, которые нужны в любом
случае: «СВЯЖИТЕСЬ С НАМИ» сейчас обрезано липкой шапкой, а подпись второй
кнопки закрыта плавающей кнопкой CONTACT.

    python3 tools/finale-variants.py --device "Galaxy A55" --cpu 6
"""
import argparse
import pathlib

from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
OUT = pathlib.Path(__file__).parent / 'shots-finale'

# Общее для всех вариантов: убрать две коллизии.
FIX = """
  #act-contact { scroll-margin-top: 64px; }
  #act-contact .act-eyebrow { padding-top: 18px; }
  #act-contact .act-actions { padding-bottom: 96px; }
"""

VARIANTS = {
    # 0 — как сейчас, для сравнения
    'now': {'css': '', 'js': ''},

    # A — шару свой экран: он в полную силу и без текста поверх,
    #     контакты начинаются ниже
    'own-screen': {
        'css': FIX + """
          #act-contact .act-col { margin-top: 62vh; }
          #act-contact { min-height: 210vh; }
        """,
        'js': """() => {
          const g = window.SBF_STAGE.acts.globe;
          const r = g.render.bind(g);
          /* markDim гасит шар, пока колонка проходит через кольцо. На узком
             экране колонка во всю ширину, поэтому гашение включено всегда.
             Здесь колонка уехала вниз — гасить больше не от чего. */
          g.render = function (ctx, view, cam, mark, labels) {
            view.markDim = 1;
            return r(ctx, view, cam, mark, labels);
          };
        }""",
    },

    # B — без шара: только контакты, но с иерархией
    'no-globe': {
        'css': FIX + """
          #act-contact .act-facts li:first-child i { font-size: 1.5rem; }
          #act-contact .act-offices { display: grid;
            grid-template-columns: 1fr 1fr; gap: 14px 12px; }
          #act-contact .act-offices .office-addr { font-size: .78rem;
            opacity: .62; }
        """,
        'js': """() => {
          const g = window.SBF_STAGE.acts.globe;
          g.render = function () {};      /* шар на телефоне не рисуем вовсе */
        }""",
    },

    # C — шар в полную силу, но контакты на своей подложке, чтобы читались
    'panel': {
        'css': FIX + """
          #act-contact .act-col { margin-top: 34vh; }
          #act-contact .act-facts, #act-contact .act-offices,
          #act-contact .act-actions {
            background: rgba(8,6,12,.90);
            backdrop-filter: none;
            border-radius: 14px;
            padding: 14px 16px;
            margin-left: -4px; margin-right: -4px;
          }
        """,
        'js': """() => {
          const g = window.SBF_STAGE.acts.globe;
          const r = g.render.bind(g);
          g.render = function (ctx, view, cam, mark, labels) {
            view.markDim = 1;
            return r(ctx, view, cam, mark, labels);
          };
        }""",
    },
}


def run(url, device, cpu, only):
    OUT.mkdir(exist_ok=True)
    slug = device.replace(' ', '-').lower()
    with sync_playwright() as pw:
        prof = pw.devices[device]
        b = pw.chromium.launch()
        for name, v in VARIANTS.items():
            if only and name != only:
                continue
            ctx = b.new_context(**prof)
            p = ctx.new_page()
            cdp = ctx.new_cdp_session(p)
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
            p.goto(url, wait_until='load')
            p.wait_for_timeout(2200)
            if v['css']:
                p.add_style_tag(content=v['css'])
            if v['js']:
                p.evaluate(v['js'])
            top = p.evaluate("() => document.getElementById('act-contact').offsetTop")
            for i, k in enumerate((0.10, 0.40, 0.72)):
                p.evaluate('window.scrollTo(0, %d)'
                           % int(top + p.evaluate(
                               "() => document.getElementById('act-contact').offsetHeight") * k))
                p.wait_for_timeout(900)
                p.screenshot(path=str(OUT / f'{slug}-{name}-{i}.png'))
            st = p.evaluate("() => ({ ms: +(SBF_SCENE.ms||0).toFixed(1) })")
            print(f'  {name:12} снято 3 кадра, работа сцены {st["ms"]} мс')
            ctx.close()
        b.close()
    print(f'снимки: {OUT}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=URL)
    ap.add_argument('--device', default='Galaxy A55')
    ap.add_argument('--cpu', type=int, default=6)
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    run(a.url, a.device, a.cpu, a.only)

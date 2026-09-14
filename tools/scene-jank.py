#!/usr/bin/env python3
"""Где именно рвётся прокрутка — по актам, а не в среднем по странице.

Зачем отдельно от scene-perf.py: та проба считает среднее по всей странице и
по всем актам сразу. Среднее по странице прячет один дорогой акт — 46 плохих
кадров из 307 выглядят фоном, даже когда весь финал идёт по 34 мс. Здесь
каждый акт прокручивается отдельно и получает свою строку.

Прокрутка не «телепортом» по scrollTo раз в 90 мс, как в scene-perf: так
браузер получает один скачок и потом отдыхает, и рывок не воспроизводится.
Здесь — инерция: шаг на каждый кадр с затуханием, как после свайпа.

Устройство берётся из реестра Playwright (143 профиля), а не «сузим окно».
Узкое окно десктопного Chrome даёт innerWidth под 1300 и уводит сцену в
десктопную ветку кода — меряется тогда не то, что видит владелец телефона.
Профиль приносит с собой viewport, DPR, touch и мобильный user-agent.

    python3 tools/scene-jank.py                          # Galaxy S24, ×4
    python3 tools/scene-jank.py --device "iPhone 15"
    python3 tools/scene-jank.py --act memory --cpu 6
    python3 tools/scene-jank.py --list                    # что вообще есть
"""
import argparse

from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
DEVICE = 'Galaxy S24'

PROBE = """
(seg) => new Promise(res => {
  const f = [], w = [], y = [];
  let prev = performance.now(), v = seg.v0, pos = seg.from, n = 0;
  window.scrollTo(0, pos);
  const tick = t => {
    f.push(t - prev); prev = t;
    w.push(window.SBF_SCENE ? window.SBF_SCENE.ms : 0);
    y.push(pos);
    /* Инерция после свайпа: шаг затухает, как в браузере. */
    v *= seg.decay;
    pos += v;
    if (v < 0.4 || pos > seg.to || ++n > 600) {
      res({ f: f.slice(2), w: w.slice(2), y: y.slice(2) });
      return;
    }
    window.scrollTo(0, pos);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})
"""


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(len(xs) * p))]


def run(url, cpu, only, swipes, device):
    with sync_playwright() as pw:
        if device not in pw.devices:
            raise SystemExit(f'нет профиля «{device}». Список: --list')
        prof = pw.devices[device]
        b = pw.chromium.launch()
        ctx = b.new_context(**prof)
        p = ctx.new_page()
        cdp = ctx.new_cdp_session(p)
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        p.goto(url, wait_until='load')
        p.wait_for_timeout(2500)

        # Сцена сама решает, мобильная она или нет (view.w < 900). Если профиль
        # не довёл ширину — всё измерение не о том, и молчать об этом нельзя.
        seen = p.evaluate('() => ({ w: innerWidth, mobile: innerWidth < 900 })')
        if not seen['mobile']:
            raise SystemExit(f'профиль дал innerWidth {seen["w"]} — сцена уйдёт '
                             f'в десктопную ветку, мерить бессмысленно')

        acts = p.evaluate("""() => Array.from(document.querySelectorAll('.act'))
            .map(e => ({ id: e.dataset.act || e.id,
                         top: e.offsetTop, h: e.offsetHeight }))""")
        vp = prof['viewport']
        print(f'{device} {vp["width"]}×{vp["height"]} dpr{prof["device_scale_factor"]}, '
              f'процессор ×{cpu}, инерционная прокрутка')
        print(f'{"акт":12}{"кадров":>8}{"работа сцены":>14}{"интервал p50":>14}'
              f'{"p95":>8}{"пропусков":>11}')
        worst = []
        for a in acts:
            if only and a['id'] != only:
                continue
            fs, ws = [], []
            for k in range(swipes):
                seg = {'from': a['top'] + a['h'] * k / swipes,
                       'to': a['top'] + a['h'] * (k + 1) / swipes + 40,
                       'v0': 46, 'decay': 0.965}
                r = p.evaluate(PROBE, seg)
                fs += [x for x in r['f'] if x < 400]
                ws += r['w']
            if not fs:
                continue
            skips = sum(1 for x in fs if x > 25)
            ws = [x for x in ws if x]
            work = sum(ws) / len(ws) if ws else 0
            print(f'{a["id"]:12}{len(fs):>8}{work:>11.1f} мс'
                  f'{pct(fs, .5):>11.1f} мс{pct(fs, .95):>7.0f}'
                  f'{skips:>7} = {skips / len(fs) * 100:.0f}%')
            worst.append((skips / len(fs), a['id'], work, pct(fs, .95)))
        b.close()
    if worst:
        worst.sort(reverse=True)
        r = worst[0]
        print(f'\nхуже всех: {r[1]} — {r[0] * 100:.0f}% кадров с пропуском, '
              f'работа сцены {r[2]:.1f} мс, p95 интервала {r[3]:.0f} мс')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=URL)
    ap.add_argument('--cpu', type=int, default=4)
    ap.add_argument('--act', default='')
    ap.add_argument('--swipes', type=int, default=3)
    ap.add_argument('--device', default=DEVICE)
    ap.add_argument('--list', action='store_true')
    a = ap.parse_args()
    if a.list:
        with sync_playwright() as pw:
            for n in sorted(pw.devices):
                if 'landscape' in n:
                    continue
                d = pw.devices[n]
                print(f'{n:28} {d["viewport"]["width"]}×{d["viewport"]["height"]}'
                      f'  dpr{d["device_scale_factor"]}')
        raise SystemExit
    run(a.url, a.cpu, a.act, a.swipes, a.device)

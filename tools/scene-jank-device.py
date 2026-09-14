#!/usr/bin/env python3
"""То же измерение, что scene-jank.py, но на настоящем телефоне по USB.

Профиль устройства в Playwright подделывает размер, DPR и user-agent, но не
подделывает ни процессор, ни GPU, ни то, как Android компонует прокрутку.
Пока телефон подключён — меряем на нём, эмулятор остаётся запасным.

Подготовка (телефон):
    Настройки → Для разработчиков → Отладка по USB
    adb forward tcp:9222 localabstract:chrome_devtools_remote

Работает ТОЛЬКО со вкладкой нужного сайта: остальные вкладки не трогаются и
не читаются — там личные страницы владельца.

    python3 tools/scene-jank-device.py
    python3 tools/scene-jank-device.py --act globe
"""
import argparse

from playwright.sync_api import sync_playwright

CDP = 'http://127.0.0.1:9222'
SITE = 'sbfconsult.com/index-next.html'

PROBE = """
(seg) => new Promise(res => {
  const f = [], w = [];
  let prev = performance.now(), v = seg.v0, pos = seg.from, n = 0;
  window.scrollTo(0, pos);
  const tick = t => {
    f.push(t - prev); prev = t;
    w.push(window.SBF_SCENE ? window.SBF_SCENE.ms : 0);
    v *= seg.decay; pos += v;
    if (v < 0.4 || pos > seg.to || ++n > 600) {
      res({ f: f.slice(2), w: w.slice(2) }); return;
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


def run(only, swipes, url):
    with sync_playwright() as pw:
        br = pw.chromium.connect_over_cdp(CDP)
        page = None
        for c in br.contexts:
            for p in c.pages:
                if SITE in (p.url or ''):
                    page = p
        if page is None:
            raise SystemExit(f'на телефоне нет вкладки с {SITE} — откройте её')
        if url:
            page.goto(url, wait_until='load')
            page.wait_for_timeout(2500)
        page.bring_to_front()

        info = page.evaluate("""() => ({ w: innerWidth, h: innerHeight,
            dpr: devicePixelRatio, scene: !!window.SBF_STAGE })""")
        if not info['scene']:
            raise SystemExit('сцена не загрузилась на странице')
        print(f'живой телефон {info["w"]}×{info["h"]} dpr{info["dpr"]}, '
              f'инерционная прокрутка')
        print(f'{"акт":12}{"кадров":>8}{"работа сцены":>14}{"интервал p50":>14}'
              f'{"p95":>8}{"пропусков":>11}')

        acts = page.evaluate("""() => Array.from(document.querySelectorAll('.act'))
            .map(e => ({ id: e.dataset.act || e.id,
                         top: e.offsetTop, h: e.offsetHeight }))""")
        rows = []
        for a in acts:
            if only and a['id'] != only:
                continue
            fs, ws = [], []
            for k in range(swipes):
                seg = {'from': a['top'] + a['h'] * k / swipes,
                       'to': a['top'] + a['h'] * (k + 1) / swipes + 40,
                       'v0': 46, 'decay': 0.965}
                r = page.evaluate(PROBE, seg)
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
            rows.append((skips / len(fs), a['id'], work, pct(fs, .5)))
        br.close()
    if rows:
        rows.sort(reverse=True)
        r = rows[0]
        print(f'\nхуже всех: {r[1]} — {r[0] * 100:.0f}% кадров с пропуском, '
              f'сцена думает, что тратит {r[2]:.1f} мс, '
              f'реальный кадр {r[3]:.0f} мс')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--act', default='')
    ap.add_argument('--swipes', type=int, default=3)
    ap.add_argument('--url', default='')
    a = ap.parse_args()
    run(a.act, a.swipes, a.url)

#!/usr/bin/env python3
"""Сколько стоит гобелен на слабом устройстве и медленной сети.

Мерить сцену на рабочей машине бессмысленно: там всё летает. Здесь браузеру
режут процессор вчетверо и сеть до 4G, а потом прокручивают страницу до
конца и обратно — как человек, который читает.

Что печатается:
  LCP           когда появился самый крупный видимый элемент
  вес           сколько байт ушло по сети до первого экрана
  работа        сколько миллисекунд сцена тратит внутри кадра
  интервал      сколько времени проходит между кадрами
  пропусков     сколько раз интервал перевалил за 25 мс — это и есть рывок

Про интервал важно: при 60 кадрах в секунду он равен 16.7 мс просто по
устройству rAF, и «среднее 17 мс» означает «успеваем», а не «на пределе».
Первая версия этой пробы считала такие интервалы падениями и рапортовала о
беде там, где всё в порядке. Смотреть надо на работу внутри кадра (её мерит
сама сцена) и на пропущенные кадры.

Порог из плана: LCP < 2.5 с, кадр в бюджете.

    python3 tools/scene-perf.py                 # телефон
    python3 tools/scene-perf.py --desktop
"""
import argparse

from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'


def run(url, mobile, cpu, net):
    vp = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile,
                            device_scale_factor=3 if mobile else 2)
        p = ctx.new_page()
        cdp = ctx.new_cdp_session(p)
        cdp.send('Network.enable')
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': cpu})
        if net:
            cdp.send('Network.emulateNetworkConditions', {
                'offline': False,
                'latency': 150,               # 4G с запасом
                'downloadThroughput': 1.6 * 1024 * 1024 / 8,
                'uploadThroughput': 750 * 1024 / 8,
            })

        p.goto(url, wait_until='load')
        p.wait_for_timeout(2500)

        lcp = p.evaluate("""() => new Promise(res => {
          let v = 0;
          new PerformanceObserver(list => {
            for (const e of list.getEntries()) v = e.startTime;
          }).observe({ type: 'largest-contentful-paint', buffered: true });
          setTimeout(() => res(v), 400);
        })""")
        weight = p.evaluate("""() => performance.getEntriesByType('resource')
            .reduce((s, r) => s + (r.transferSize || 0), 0)""")

        # Прокрутка вниз и обратно с замером каждого кадра
        p.evaluate("""() => {
          window.__f = [];        /* интервалы между кадрами */
          window.__w = [];        /* работа сцены внутри кадра */
          let prev = performance.now();
          const tick = t => {
            window.__f.push(t - prev); prev = t;
            if (window.SBF_SCENE) window.__w.push(window.SBF_SCENE.ms);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }""")
        h = p.evaluate('document.body.scrollHeight')
        for i in range(30):
            p.evaluate('window.scrollTo(0, %d)' % int(h * i / 30))
            p.wait_for_timeout(90)
        for i in range(30, 0, -1):
            p.evaluate('window.scrollTo(0, %d)' % int(h * i / 30))
            p.wait_for_timeout(90)
        f = p.evaluate('window.__f.slice(5)')
        w = p.evaluate('window.__w.slice(5)')
        scene = p.evaluate('window.SBF_SCENE')
        b.close()

    f = [x for x in f if x < 400]                 # выбросы на паузах не считаем
    skips = sum(1 for x in f if x > 25)
    print(('телефон' if mobile else 'десктоп') +
          f', процессор ×{cpu}' + (', сеть 4G' if net else ''))
    print(f'  LCP        {lcp / 1000:.2f} с   (порог 2.5)')
    print(f'  вес        {weight / 1024:.0f} КБ по сети')
    if w:
        print(f'  работа     {sum(w) / len(w):.2f} мс в кадре, худшая {max(w):.2f} мс'
              f'   (бюджет 16)')
    print(f'  интервал   {sum(f) / len(f):.1f} мс средний'
          f'   (при 60 к/с так и должно быть)')
    print(f'  пропусков  {skips} из {len(f)} кадров дольше 25 мс')
    print(f'  сцена      dpr {scene["dpr"]}, упрощение: {scene["simple"]}')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=URL)
    ap.add_argument('--desktop', action='store_true')
    ap.add_argument('--cpu', type=int, default=4)
    ap.add_argument('--fast', action='store_true', help='без ограничения сети')
    a = ap.parse_args()
    run(a.url, not a.desktop, a.cpu, not a.fast)

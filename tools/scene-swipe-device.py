#!/usr/bin/env python3
"""Замер по НАСТОЯЩЕМУ свайпу на живом телефоне.

Чем это отличается от scene-jank-device.py. Там прокрутка задаётся из
страницы: на каждый кадр прибавляем к scrollY с затуханием. Это похоже на
бросок, но ведёт его наш же JS — то есть та самая работа, которую мы
меряем, заодно и двигает страницу.

Настоящий бросок ведёт компоновщик Android: палец отпустили, дальше
система сама доводит прокрутку в своём потоке, а наш код к этому
отношения не имеет. Именно на такой прокрутке владелец увидел рывки, и
меряться она обязана отдельно.

Требуется, кроме обычной отладки по USB, пункт «Отладка по USB (настройки
безопасности)» в меню разработчика: без него Android не принимает
события ввода от adb (SecurityException INJECT_EVENTS).

    python3 tools/scene-swipe-device.py
    python3 tools/scene-swipe-device.py --act globe --swipes 4
"""
import argparse
import statistics
import subprocess
import time

from playwright.sync_api import sync_playwright

CDP = 'http://127.0.0.1:9222'
SITE = 'index-next'

REC = """() => {
  window.__f = []; let last = performance.now();
  const step = (now) => { window.__f.push(now - last); last = now;
    if (window.__rec) requestAnimationFrame(step); };
  window.__rec = true; requestAnimationFrame(step);
}"""

GO = """([id]) => {
  const els = [...document.querySelectorAll('.act')];
  const el = els.find(e => (e.dataset.act || e.id) === id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  scrollTo(0, Math.round(r.top + scrollY));
  return [innerWidth, innerHeight, devicePixelRatio];
}"""


def sh(cmd):
    return subprocess.run(['adb', 'shell'] + cmd, capture_output=True, text=True,
                          timeout=30).stdout.strip()


def pick(browser):
    """Вкладка выбирается по живой сцене, а не по адресу.

    Вкладок с одним и тем же адресом бывает несколько, и в фоновой браузер
    останавливает кадры: получается противоречие — прокрутка срабатывает,
    а сцена «молчит». Признак живой вкладки — что в ней вообще есть
    SBF_SCENE; её же выводим вперёд, иначе снимок экрана покажет соседнюю.
    """
    best = None
    for c in browser.contexts:
        for p in c.pages:
            if SITE not in p.url:
                continue
            try:
                if p.evaluate("typeof window.SBF_SCENE") == 'object':
                    best = p
            except Exception:
                pass
    return best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--act')
    ap.add_argument('--swipes', type=int, default=3)
    a = ap.parse_args()

    size = sh(['wm', 'size']).split(':')[-1].strip()
    px_w, px_h = (int(v) for v in size.split('x'))

    with sync_playwright() as pw:
        b = pw.chromium.connect_over_cdp(CDP)
        page = pick(b)
        if not page:
            print('вкладка с живой сценой не найдена — открой '
                  'sbfconsult.com/index-next.html на телефоне')
            return 1
        page.bring_to_front()
        acts = [a.act] if a.act else page.evaluate(
            "[...new Set([...document.querySelectorAll('.act')]"
            ".map(e => e.dataset.act || e.id))]")
        print(f'живой телефон {px_w}x{px_h} px, настоящий свайп пальцем')
        print(f'{"акт":12}{"кадров":>8}{"работа сцены":>14}'
              f'{"интервал p50":>14}{"p95":>8}{"пропусков":>11}')
        worst = None
        for act in acts:
            box = page.evaluate(GO, [act])
            if not box:
                continue
            time.sleep(1.2)
            page.evaluate(REC)
            for _ in range(a.swipes):
                # Снизу вверх, быстро — это бросок, а не перетаскивание.
                sh(['input', 'swipe', str(px_w // 2), str(int(px_h * 0.78)),
                    str(px_w // 2), str(int(px_h * 0.22)), '120'])
                time.sleep(1.1)
            page.evaluate('window.__rec = false')
            f = [x for x in page.evaluate('window.__f') if 0.5 < x < 2000]
            ms = page.evaluate("(window.SBF_SCENE||{}).ms || 0")
            if not f:
                continue
            f.sort()
            p50 = statistics.median(f)
            p95 = f[min(len(f) - 1, int(len(f) * 0.95))]
            bad = sum(1 for x in f if x > 25)
            share = 100 * bad // len(f)
            print(f'{act:12}{len(f):>8}{ms:>11.1f} мс{p50:>11.1f} мс'
                  f'{p95:>8.0f}{bad:>7} = {share}%')
            if worst is None or share > worst[1]:
                worst = (act, share, ms, p95)
        if worst:
            print(f'\nхуже всех: {worst[0]} — {worst[1]}% кадров с пропуском, '
                  f'работа сцены {worst[2]:.1f} мс, p95 интервала {worst[3]:.0f} мс')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

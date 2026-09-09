#!/usr/bin/env python3
"""
Собирает GIF с лентой свечей и знаком SBF.

Кадры рисует tools/gif/tape.html: Playwright вызывает draw(position) с
точным шагом и снимает каждый кадр. Так, а не скриншотами живого сайта,
потому что там лента идёт 0.5 свечи в секунду — за пять секунд GIF почти
не менялся бы, а шаг между скриншотами rAF неровный.

Шов на стыке цикла закрыт растворением: последние кадры смешиваются с
первым. Полностью бесшовный цикл потребовал бы, чтобы за длину ролика
лента прошла ровно всю ленту данных — это либо очень быстрое движение,
либо очень длинный файл.

    python3 tools/gif/make.py [--out путь.gif] [--frames 90] [--speed 2.0]

--speed — свечей в секунду (на сайте 0.5; для ролика нужно быстрее).
"""
import argparse, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

try:
    from playwright.sync_api import sync_playwright
    from PIL import Image
except ImportError as exc:
    sys.exit(f'нужны playwright и Pillow: {exc}')


def build(out: Path, frames: int, fps: int, speed: float, width: int, fade: int,
          base: str = 'http://127.0.0.1:5001', colors: int = 96):
    step = speed / fps                      # свечей за кадр
    delay = int(round(1000 / fps))          # мс на кадр
    tmp = Path(tempfile.mkdtemp(prefix='sbf-gif-'))
    shots = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_context(viewport={'width': 940, 'height': 560},
                                   device_scale_factor=2).new_page()
        # Через file:// страница не может прочитать CSV (fetch блокируется
        # политикой origin), поэтому берём её с локального сервера сайта.
        page.goto(base + '/tools/gif/tape.html', wait_until='load')
        page.wait_for_function('window.ready === true', timeout=20000)
        page.wait_for_timeout(400)          # шрифты и logo.svg

        stage = page.locator('#stage')
        for i in range(frames):
            page.evaluate('p => window.draw(p)', i * step)
            page.wait_for_timeout(30)
            f = tmp / f'{i:03d}.png'
            stage.screenshot(path=str(f))
            shots.append(f)
        browser.close()

    imgs = [Image.open(f).convert('RGB') for f in shots]
    if width and imgs[0].width != width:
        h = round(imgs[0].height * width / imgs[0].width)
        imgs = [im.resize((width, h), Image.LANCZOS) for im in imgs]

    # Растворение хвоста в первый кадр — стык цикла перестаёт быть скачком
    if fade:
        first = imgs[0]
        for k in range(fade):
            a = (k + 1) / (fade + 1)
            idx = len(imgs) - fade + k
            imgs[idx] = Image.blend(imgs[idx], first, a)

    # Общая палитра на все кадры и без дизеринга: дизеринг рассыпает ровные
    # заливки в шум, и GIF раздувался вчетверо. Своя палитра на кадр давала
    # ещё и плавание цвета на стыках.
    # весил вчетверо больше и на стыках кадров плыл цвет. Палитру берём с
    # середины ролика — там в кадре есть и лента, и разметка внутри линзы.
    pal = imgs[len(imgs) // 2].quantize(colors=colors, method=Image.MEDIANCUT)
    imgs = [im.quantize(palette=pal, dither=Image.NONE) for im in imgs]

    out.parent.mkdir(parents=True, exist_ok=True)
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=delay,
                 loop=0, optimize=True, disposal=1)
    size = out.stat().st_size / 1024
    print(f'{out}  {imgs[0].width}×{imgs[0].height}, кадров {len(imgs)}, '
          f'{delay} мс/кадр, {size:.0f} КБ')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT / 'assets' / 'promo' / 'sbf-tape.gif'))
    ap.add_argument('--frames', type=int, default=90)
    ap.add_argument('--fps', type=int, default=15)
    ap.add_argument('--speed', type=float, default=2.0, help='свечей в секунду')
    ap.add_argument('--width', type=int, default=800)
    ap.add_argument('--fade', type=int, default=10, help='кадров растворения в стыке')
    ap.add_argument('--base', default='http://127.0.0.1:5001', help='адрес локального сервера сайта')
    ap.add_argument('--colors', type=int, default=96, help='цветов в общей палитре')
    a = ap.parse_args()
    build(Path(a.out), a.frames, a.fps, a.speed, a.width, a.fade, a.base, a.colors)

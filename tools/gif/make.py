#!/usr/bin/env python3
"""
Собирает GIF: крупный план кольца SBF, сквозь которое идёт лента свечей.

Кадры рисует tools/gif/tape.html вызовом draw(position). Цикл замкнут по
данным: лента едет по кольцу из RING свечей, и за ролик проходит ровно это
кольцо — кадр «после последнего» совпадает с первым попиксельно. Поэтому
здесь нет ни растворения, ни подрезки: склеивать нечего.

Первая версия ролика склеивалась растворением хвоста в первый кадр, и это
было видно как «моргание». Растворение убрано вместе с причиной.

    python3 tools/gif/make.py                 # 720×720, ~5 c
    python3 tools/gif/make.py --check         # + проверка смыкания цикла
    python3 tools/gif/make.py --width 480 --frames 72
"""
import argparse, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

try:
    from playwright.sync_api import sync_playwright
    from PIL import Image, ImageChops
except ImportError as exc:
    sys.exit(f'нужны playwright и Pillow: {exc}')


def build(out: Path, frames: int, fps: int, width: int, colors: int,
          base: str, check: bool):
    delay = int(round(1000 / fps))
    tmp = Path(tempfile.mkdtemp(prefix='sbf-gif-'))
    shots = []

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_context(viewport={'width': 760, 'height': 760},
                                   device_scale_factor=2).new_page()
        # Через file:// страница не может прочитать CSV (fetch блокируется
        # политикой origin), поэтому берём её с локального сервера сайта.
        page.goto(base + '/tools/gif/tape.html', wait_until='load')
        page.wait_for_function('window.ready === true', timeout=20000)
        page.wait_for_timeout(500)          # шрифты и logo.svg

        ring = page.evaluate('window.ringLength')
        step = ring / frames                # за ролик проходим ровно кольцо
        stage = page.locator('#stage')

        for i in range(frames):
            page.evaluate('p => window.draw(p)', i * step)
            page.wait_for_timeout(25)
            f = tmp / f'{i:03d}.png'
            stage.screenshot(path=str(f))
            shots.append(f)

        if check:
            # Кадр «после последнего» обязан совпасть с первым: иначе цикл
            # не замкнут и на стыке будет скачок.
            page.evaluate('p => window.draw(p)', frames * step)
            page.wait_for_timeout(25)
            wrap = tmp / 'wrap.png'
            stage.screenshot(path=str(wrap))
            a = Image.open(shots[0]).convert('RGB')
            b = Image.open(wrap).convert('RGB')
            diff = ImageChops.difference(a, b).getbbox()
            print('смыкание цикла:', 'кадры совпали' if diff is None
                  else f'РАСХОЖДЕНИЕ в области {diff}')
        browser.close()

    imgs = [Image.open(f).convert('RGB') for f in shots]
    if width and imgs[0].width != width:
        h = round(imgs[0].height * width / imgs[0].width)
        imgs = [im.resize((width, h), Image.LANCZOS) for im in imgs]

    # Общая палитра на все кадры и без дизеринга: дизеринг рассыпает ровные
    # заливки в шум и раздувал файл вчетверо, а своя палитра на каждый кадр
    # давала плавание цвета на стыках.
    pal = imgs[len(imgs) // 2].quantize(colors=colors, method=Image.MEDIANCUT)
    imgs = [im.quantize(palette=pal, dither=Image.NONE) for im in imgs]

    out.parent.mkdir(parents=True, exist_ok=True)
    imgs[0].save(out, save_all=True, append_images=imgs[1:], duration=delay,
                 loop=0, optimize=True, disposal=1)
    size = out.stat().st_size / 1024
    print(f'{out}  {imgs[0].width}×{imgs[0].height}, кадров {len(imgs)}, '
          f'{delay} мс/кадр, {len(imgs) * delay / 1000:.1f} c, {size:.0f} КБ')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=str(ROOT / 'assets' / 'promo' / 'sbf-mark.gif'))
    ap.add_argument('--frames', type=int, default=96)
    ap.add_argument('--fps', type=int, default=20)
    ap.add_argument('--width', type=int, default=640)
    ap.add_argument('--colors', type=int, default=128)
    ap.add_argument('--base', default='http://127.0.0.1:5001')
    ap.add_argument('--check', action='store_true', help='проверить смыкание цикла')
    a = ap.parse_args()
    build(Path(a.out), a.frames, a.fps, a.width, a.colors, a.base, a.check)

#!/usr/bin/env python3
"""Контраст текста — по пикселям на экране, а не по стилям.

Прошлый инструмент контраста на этом сайте врал трижды: регулярка по CSS
не знает каскада, обход предков не видит фона, который рисует холст, а
выборка одного пикселя попадает в сглаживание. Поэтому здесь ни то, ни
другое, ни третье.

Как считается. Элемент снимается как картинка. В ней самый частый цвет —
фон, а текст — среднее по пикселям, дальше всего отстоящим от фона.
Между ними и считается контраст по формуле WCAG. Этот способ видит то,
что видит глаз: и прозрачность (opacity смешивает текст с фоном, и в
стилях цвет остаётся «правильным»), и подложку, нарисованную на холсте.

Контроль с известным ответом обязателен: если щуп не отличает заведомо
плохую пару от заведомо хорошей, его числам верить нельзя.

Известная погрешность, и её надо знать, чтобы не чинить несуществующее.
На тексте 10–11 px, набранном моноширинным с большим межбуквенным
размахом, щуп занижает примерно на 0.3–0.5: даже при dpr 3 внутри тонкой
буквы мало пикселей полного цвета. Поэтому значения в диапазоне 4.2–4.5
у такого текста — повод пересчитать цвет по формуле руками, а не сразу
править. Значения ниже 4 подделать сглаживанием невозможно: там дефект.

Остаются и переходы. Элемент, пойманный в середине проявления, даёт
контраст около единицы. Явные случаи щуп отсеивает (прозрачность,
сравнение двух кадров), но переход цвета в подвале длится полсекунды и
в отдельных прогонах всё же попадает в замер.

    python3 tools/contrast-check.py [--mobile]
"""
import io
import sys
from collections import Counter

from PIL import Image
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
# 4.5:1 — порог WCAG AA для обычного текста; для крупного (18.66px+
# полужирный или 24px+) достаточно 3:1.
AA_SMALL, AA_LARGE = 4.5, 3.0


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def lum(rgb):
    r, g, b = rgb
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def dist(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3))


def measure(img, box=None):
    """(фон, текст) по картинке элемента. img — PNG-байты или Image."""
    im = img if isinstance(img, Image.Image) else Image.open(io.BytesIO(img))
    im = im.convert('RGB')
    if box:
        im = im.crop(box)
    px = list(im.getdata())
    if len(px) < 20:
        return None
    bg = Counter(px).most_common(1)[0][0]
    far = sorted(px, key=lambda p: dist(p, bg), reverse=True)
    # Только ядро глифов — верхние 2%.
    #
    # Сначала брал 12%, и щуп объявил плохими 163 элемента вместо 25:
    # у надзаголовков межбуквенный размах 0.22em, буквы занимают меньше
    # десятой доли рамки, и в «12% самых далёких» попадало сглаживание.
    # Текст выходил почти цветом фона — то есть щуп мерил не текст.
    top = far[:max(3, len(far) * 2 // 100)]
    ink = tuple(sum(p[i] for p in top) // len(top) for i in range(3))
    return bg, ink


TEXTY = """() => {
  const out = [];
  const sel = 'p, li, a, b, i, u, span, h1, h2, h3, button, em, strong';
  document.querySelectorAll(sel).forEach(el => {
    if (el.querySelector(sel)) return;            // только листья
    const t = (el.innerText || '').trim();
    if (t.length < 2) return;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    /* Не в полной силе — значит, ещё проявляется. WCAG говорит про
       устоявшееся состояние; элемент, пойманный в середине перехода,
       даёт контраст 1.00, и таких «дефектов» щуп насчитывал полтора
       десятка. Прозрачность считаем накопленную: гасят обычно родителя
       (карточки офисов, ленту новостей), а не сам текст. */
    let op = 1, n = el;
    while (n && n !== document.body) {
      op *= parseFloat(getComputedStyle(n).opacity);
      n = n.parentElement;
    }
    if (op < 0.99) return;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 6) return;
    if (r.bottom < 0 || r.top > innerHeight) return;
    const size = parseFloat(s.fontSize);
    const bold = (parseInt(s.fontWeight, 10) || 400) >= 700;
    out.push({ text: t.slice(0, 30).replace(/\\s+/g, ' '),
               size: size, large: size >= 24 || (bold && size >= 18.66),
               cls: (el.className || el.tagName).toString().split(' ')[0],
               box: [Math.max(0, Math.round(r.left)), Math.max(0, Math.round(r.top)),
                     Math.round(r.right), Math.round(r.bottom)] });
  });
  return out;
}"""


def main():
    mobile = '--mobile' in sys.argv
    size = {'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}
    bad, checked, moving = [], 0, 0
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        # Снимаем в тройном разрешении.
        #
        # При dpr 1 у текста 10–11 px сглаживание съедает ядро глифа: щуп
        # мерил у надзаголовков 3.4 вместо 4.56, то есть занижал на
        # полбалла и ровно на этом объявлял дефекты. Подкрутить порог под
        # такую погрешность значило бы чинить линейку числом. При dpr 3
        # внутри буквы есть пиксели настоящего цвета.
        ctx = b.new_context(viewport=size, is_mobile=mobile, has_touch=mobile,
                            device_scale_factor=3)
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1500)

        # Контроль: пара, про которую ответ известен заранее.
        p.evaluate("""() => {
          const d = document.createElement('div');
          d.id = '__ctl';
          d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;' +
            'background:#fbf6ef;color:#dcd2bf;font:11px monospace;padding:4px';
          d.textContent = 'control';
          document.body.appendChild(d);
        }""")
        bad_r = ratio(*measure(p.locator("#__ctl").screenshot()))
        # И вторая половина контроля: заведомо ХОРОШАЯ пара. Щуп, который
        # всё объявляет плохим, тоже «ловит дефекты» — и первая версия
        # этого файла ровно так и делала: 163 элемента вместо 25.
        p.evaluate("""() => {
          const d = document.getElementById('__ctl');
          d.style.color = '#241f18';
          d.textContent = 'CONTROL GOOD';
        }""")
        p.wait_for_timeout(120)
        good_r = ratio(*measure(p.locator("#__ctl").screenshot()))
        ok = bad_r < 2.5 and good_r > 7
        print('контроль: плохая пара %.2f:1, хорошая %.2f:1 — %s'
              % (bad_r, good_r, 'щуп различает' if ok else 'ЩУПУ ВЕРИТЬ НЕЛЬЗЯ'))
        if not ok:
            sys.exit(1)
        p.evaluate("() => document.getElementById('__ctl').remove()")

        steps = 12
        seen = set()
        for i in range(steps):
            p.evaluate('(k) => scrollTo({ top: document.body.scrollHeight * k,'
                       ' behavior: "instant" })', i / steps)
            p.wait_for_timeout(900)
            items = p.evaluate(TEXTY)
            # Один снимок экрана на шаг, а не по снимку на элемент: сотни
            # обращений к браузеру шли минутами, и проверку переставали
            # запускать — а не запускаемая проверка не ловит ничего.
            #
            # Снимков два с паузой: контент актов проявляется, и элемент,
            # пойманный в середине проявления, даёт контраст 1.00 — текст
            # цветом фона. Таких «дефектов» щуп насчитал полтора десятка.
            # WCAG говорит про устоявшееся состояние, поэтому меряем то,
            # что не меняется между двумя кадрами.
            shot = Image.open(io.BytesIO(p.screenshot())).convert('RGB')
            p.wait_for_timeout(420)
            shot2 = Image.open(io.BytesIO(p.screenshot())).convert('RGB')
            sw, sh = shot.size
            for it in items:
                key = (it['cls'], it['text'])
                if key in seen:
                    continue
                # Рамки приходят в CSS-пикселях, картинка — в тройном
                # разрешении: без пересчёта кроп уехал бы в левый верхний
                # угол и мерил чужой участок.
                k = sw / size['width']
                x0, y0, x1, y1 = [round(v * k) for v in it['box']]
                x1, y1 = min(x1, sw), min(y1, sh)
                if x1 - x0 < 8 * k or y1 - y0 < 6 * k:
                    continue
                m = measure(shot, (x0, y0, x1, y1))
                m2 = measure(shot2, (x0, y0, x1, y1))
                if not m or not m2:
                    continue
                if dist(m[1], m2[1]) > 64 or dist(m[0], m2[0]) > 64:
                    moving += 1
                    continue
                seen.add(key)
                checked += 1
                r = ratio(*m)
                need = AA_LARGE if it['large'] else AA_SMALL
                if r < need:
                    bad.append((r, need, it, m))
        b.close()

    print('проверено элементов: %d, пропущено на переходе: %d' % (checked, moving))
    for r, need, it, m in sorted(bad, key=lambda x: x[0])[:25]:
        print('  %.2f:1 (надо %.1f)  %2.0f px  %-16s  %s  фон #%02x%02x%02x '
              'текст #%02x%02x%02x'
              % (r, need, it['size'], it['cls'], it['text'][:26], *m[0], *m[1]))
    print()
    if bad:
        print('ПЛОХО: ниже порога %d элементов' % len(bad))
        sys.exit(1)
    print('хорошо: весь проверенный текст берёт порог AA')


if __name__ == '__main__':
    main()

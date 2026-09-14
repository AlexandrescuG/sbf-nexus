#!/usr/bin/env python3
"""Сколько сцена пересобирается из-за адресной строки телефона.

Зачем. На iOS при прокрутке адресная строка Safari сворачивается и
разворачивается, и браузер шлёт resize с новой innerHeight — десятками за
один жест. Chrome на Android держит высоту постоянной, поэтому на Android
этого не видно вообще: жалоба «на iPhone лагает, а на слабом Android
нет» — про движок, а не про мощность.

Каждая такая пересборка — это обход всех актов через
getBoundingClientRect и перепечка подложек глобуса. Отсюда всплески по
несколько десятков миллисекунд посреди жеста.

Мерить это на Android нечем — там события просто не приходят. Поэтому
щуп их подделывает и считает, сколько раз после этого сцена пересоздала
холст, пересчитала карту актов и перепекла глобус. Счётчики снимаются с
самой страницы, а не восстанавливаются по логике.

Два места, где щуп легко соврал бы, и как это закрыто:
  * прогон без единого resize — контроль с известным ответом: сцена и
    сама по себе перепекает подложку, пока мир темнеет, и без контроля
    эту нормальную работу записали бы в дефект;
  * подделка через set_viewport_size перевёрстывает документ, чего iOS
    не делает вовсе — см. BAR ниже.

    python3 tools/scene-urlbar.py
"""
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'
WIDE, TALL, SHORT = 390, 844, 754   # iPhone 12, строка свёрнута / развёрнута

COUNT = """() => {
  window.__n = { canvas: 0, bake: 0, measure: 0 };
  const S = window.SBF_STAGE;
  const cv = document.querySelector('.scene-layer canvas');
  /* Считаем не вызовы функций, а их следствия: изменившийся размер
     растра и новую выпечку. Перехват функции соврал бы, если бы она
     вышла раньше. */
  const g = S.acts.globe;
  let w = cv.width, h = cv.height, baked = g.baked;
  window.__watch = setInterval(() => {
    if (cv.width !== w || cv.height !== h) { w = cv.width; h = cv.height; window.__n.canvas++; }
    /* Именно смена объекта, а не вызов bake(): она зовётся каждый кадр и
       почти всегда отдаёт готовое из кэша. Считать вызовы значило бы
       считать кадры и объявить дефектом нормальную работу. */
    if (g.baked !== baked) {
      baked = g.baked; window.__n.bake++;
      (window.__keys = window.__keys || []).push(baked && baked.key);
    }
  }, 16);
  const cam = S.camera, m = cam.measure.bind(cam);
  cam.measure = function () { window.__n.measure++; return m.apply(cam, arguments); };
  return true;
}"""


# Подделываем адресную строку так, как её делает iOS, и НЕ так, как это
# делает set_viewport_size. Разница принципиальная: set_viewport_size
# перевёрстывает документ — высота актов задана в vh, значит меняется и
# высота страницы, и доля пройденного акта, и сцена честно перерисуется.
# На iOS вёрстка не меняется вовсе: адресная строка лежит ПОВЕРХ страницы,
# layout viewport постоянен, меняется только innerHeight. Поэтому здесь
# подменяется ровно innerHeight и шлётся resize — иначе щуп мерил бы свою
# собственную перевёрстку и требовал чинить то, чего у человека нет.
BAR = """(h) => {
  window.__h = h;
  if (!window.__patched) {
    window.__patched = true;
    Object.defineProperty(window, 'innerHeight',
                          { get: () => window.__h, configurable: true });
  }
  window.dispatchEvent(new Event('resize'));
}"""


def run(p, label):
    p.goto(URL, wait_until='load')
    p.wait_for_timeout(1500)
    # Уезжаем в финал: там самая дорогая пересборка — выпечка глобуса.
    p.evaluate("""() => {
      const el = document.querySelector('.act[data-act="globe"]');
      scrollTo(0, el.getBoundingClientRect().top + scrollY - innerHeight * 0.3);
    }""")
    p.wait_for_timeout(1200)
    p.evaluate(COUNT)
    # Десять «свернулась/развернулась» — примерно один долгий свайп.
    for i in range(10):
        if label != 'контроль':
            p.evaluate(BAR, SHORT if i % 2 else TALL)
        p.wait_for_timeout(120)
    p.wait_for_timeout(500)
    n = p.evaluate('() => { clearInterval(window.__watch); return window.__n; }')
    keys = p.evaluate('() => window.__keys || []')
    if keys:
        print('        ключи выпечки (радиус:ночь:ядро): ' + ', '.join(
            str(k) for k in keys[:12]))
    print('%-10s холст пересоздан %2d,  глобус перепечён %2d,  '
          'карта актов пересчитана %2d' % (label, n['canvas'], n['bake'],
                                           n['measure']))
    return n


def main():
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        # pointer: coarse — иначе страница считает себя десктопом и
        # бережного пути для адресной строки не включит.
        c = b.new_context(viewport={'width': WIDE, 'height': TALL},
                          is_mobile=True, has_touch=True,
                          device_scale_factor=3)
        p = c.new_page()
        # Контроль с известным ответом: та же выдержка, но вьюпорт не
        # трогаем. Без него легко принять обычную работу сцены (переход
        # к тёмному тону перепекает подложку по шагам) за вину адресной
        # строки — на это уже попадались с «полом нормы».
        base = run(p, 'контроль')
        n = run(p, '20 resize')
        b.close()
    d = {k: n[k] - base[k] for k in n}
    print('разница: холст %+d, выпечка %+d, карта актов %+d'
          % (d['canvas'], d['bake'], d['measure']))
    bad = d['canvas'] > 1 or d['bake'] > 1 or d['measure'] > 1
    print('ПЛОХО: сцена пересобирается от адресной строки' if bad
          else 'хорошо: адресная строка сцену не трогает')


if __name__ == '__main__':
    main()

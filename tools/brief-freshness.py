#!/usr/bin/env python3
"""Что первый экран говорит про свежесть утреннего брифа.

Бриф пишет утренний прогон market_intel, сайт его только показывает. Если
прогон не отработал, вчерашний заголовок остаётся в hero-feed.json — и
строка «Сегодня · …» превращается в неправду ровно там, где она обещает
свежесть. Котировки рядом такое правило соблюдают с самого начала: старше
двух часов не показываются вовсе.

Страниц две, и правило на них живёт в РАЗНЫХ файлах: у живой главной —
js/hero-map.js (renderToday), у гобелена — js/scene/ticker.js. Проверять
надо обе: правка в одной не переносится во вторую сама, а первую ещё и
читают поисковые и агентские краулеры — дата отсюда уходит в чужой ответ
как факт с нашего сайта.

Ленту подменяем на сетевом уровне, а не через внутренности страницы.
Первая версия клала данные в window и слала событие — гобелен это принял,
а живая главная нет: у неё лента лежит в приватной переменной модуля, и
щуп показывал настоящий заголовок, делая вид, что проверил. Подмена
ответа сервера работает одинаково для обеих и заодно проверяет весь путь:
запрос, разбор, отрисовку.

    python3 tools/brief-freshness.py
"""
import datetime
import json
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5001'
# страница → id строки брифа на ней
PAGES = [
    ('живая главная', '/index.html', 'hm-today'),
    ('гобелен', '/index-next.html', 'scene-today'),
]

READ = """(id) => {
  const el = document.getElementById(id);
  if (!el) return { missing: true };
  /* Обещание ищем не по слову «Сегодня»: страница бывает на трёх языках,
     и щуп, знающий одно слово, объявил бы дефектом английскую версию —
     что он и сделал в первый прогон. Берём саму строку из словаря. */
  const tpl = window.i18n.t('hero.today').replace('{d}', '').trim()
              .replace(/[·|]\\s*$/, '').trim();
  const txt = (el.textContent || '').trim();
  return { hidden: el.hidden, text: txt,
           promise: !!(tpl && txt.indexOf(tpl) >= 0) };
}"""


def feed(date):
    """Лента с одной новостью и заданной датой брифа.

    Новость обязательна, хотя проверяем мы не её: у живой главной
    обработчик ленты бросает исключение на пустом списке событий
    (`if (!items.length) throw`) и до строки брифа не доходит вовсе. С
    пустым items щуп показывал «скрыто» на всех четырёх случаях и
    выглядел так, будто нашёл дефект, — а нашёл своё же сырьё."""
    tri = {'en': 'Test headline', 'ru': 'Тестовая новость',
           'ro': 'Știre de test'}
    return json.dumps({
        'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'today': {'headline': 'ЗАГОЛОВОК БРИФА', 'date': date, 'lang': 'ru'},
        'items': [{
            'id': 'probe-1', 'ts_utc': date + 'T06:00:00Z',
            'title': tri, 'tag': dict(tri), 'summary': dict(tri),
            'lon': 28.83, 'lat': 47.02,
        }],
        'quotes': [], 'grow': {}, 'macro': [],
    }, ensure_ascii=False)


def main():
    today = datetime.date.today()
    cases = [
        (0, 'сегодняшний',    'обещание свежести на месте'),
        (1, 'вчерашний',      'только дата, без обещания'),
        (3, 'трёхдневный',    'только дата, без обещания'),
        (4, 'четырёхдневный', 'не показывать вовсе'),
    ]
    bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width': 1440, 'height': 900})
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        for page, path, el_id in PAGES:
            print('\n%s (%s)' % (page, path))
            for age, name, want in cases:
                d = (today - datetime.timedelta(days=age)).isoformat()
                body = feed(d)
                # Лямбда принимает РОВНО один аргумент. Playwright зовёт
                # обработчик с двумя, если он их принимает, и в попытке
                # передать тело через значение по умолчанию во второй
                # параметр прилетал Request — «Object of type Request is
                # not JSON serializable». Тело берём из замыкания.
                p.route('**/hero-feed.json*',
                        lambda route: route.fulfill(
                            status=200, content_type='application/json',
                            body=body))
                p.goto(BASE + path, wait_until='load')
                p.wait_for_timeout(1600)
                r = p.evaluate(READ, el_id)
                p.unroute('**/hero-feed.json*')
                if r.get('missing'):
                    print('  строки #%s на странице нет' % el_id)
                    bad.append(page)
                    break
                shown = '' if r['hidden'] else r['text']
                ok = (age == 0 and r['promise'] and not r['hidden']) or \
                     (0 < age <= 3 and not r['hidden'] and not r['promise']) or \
                     (age > 3 and r['hidden'])
                if not ok:
                    bad.append('%s / %s' % (page, name))
                print('  %-15s %-32s %s' % (
                    name, want,
                    'скрыто' if r['hidden'] else '«%s»' % shown[:64]))
        b.close()
    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: «Сегодня» стоит только над сегодняшним брифом — на обеих')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Что остаётся на первом экране, когда лента приходит неполной.

Лента кормит три независимые вещи: точки на карте, строку утреннего
брифа и бегущие котировки. Приходит она одним файлом — и потому легко
написать код, в котором отсутствие одной части стирает остальные. Так и
было: пустой список новостей бросал исключение, выполнение уходило в
catch, и строка брифа не появлялась вовсе, хотя бриф пришёл и лежал
разобранным. Статус при этом сообщал «Лента недоступна» — то есть
неправду.

Проверяем три состояния, подменяя ответ сервера:

  полная      — есть всё: новости, бриф, котировки
  без новостей — бриф и котировки есть, событий нет
  нет ленты   — сервер отвечает 500

и смотрим, что из трёх частей выжило. Ожидание простое: каждая часть
живёт ровно до тех пор, пока есть ЕЁ данные, и ни секундой меньше.

    python3 tools/feed-degrade.py
"""
import datetime
import json
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:5001'
# Идентификаторы у страниц разные, и это не мелочь: щуп, взявший «похожее»
# имя, показал бы «котировок нет» на всех трёх случаях и выглядел бы как
# находка. Имена взяты из самой разметки.
PAGES = [('живая главная', '/index.html', 'hm-today', 'ticker-track'),
         ('гобелен', '/index-next.html', 'scene-today', 'scene-ticker')]

STATE = """([todayId, tickerId]) => {
  const t = document.getElementById(todayId);
  const k = document.getElementById(tickerId);
  const txt = el => el ? (el.textContent || '').trim() : '';
  return {
    brief: !!(t && !t.hidden && txt(t).length > 10),
    ticker: !!(k && txt(k).length > 10),
    points: (window.SBF_GEO_POINTS || []).length,
  };
}"""


def feed(with_items=True, with_brief=True):
    d = datetime.date.today().isoformat()
    tri = {'en': 'Test', 'ru': 'Тест', 'ro': 'Test'}
    body = {
        'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'items': [], 'quotes': [
            {'symbol': 'EURUSD', 'bid': 1.16, 'chg_pct': 0.12, 'digits': 5},
            {'symbol': 'XAUUSD', 'bid': 4300.5, 'chg_pct': -0.4, 'digits': 1},
        ],
        'quotes_updated': datetime.datetime.now(
            datetime.timezone.utc).isoformat(),
        'grow': {}, 'macro': [],
    }
    if with_brief:
        body['today'] = {'headline': 'ЗАГОЛОВОК БРИФА', 'date': d, 'lang': 'ru'}
    if with_items:
        body['items'] = [{
            'id': 'probe-%d' % i, 'ts_utc': d + 'T06:00:00Z',
            'title': dict(tri), 'tag': dict(tri), 'summary': dict(tri),
            'lon': 28.83 + i, 'lat': 47.02,
        } for i in range(4)]
    return json.dumps(body, ensure_ascii=False)


# состояние → (тело или None для 500, что ДОЛЖНО остаться)
CASES = [
    ('полная', feed(True, True), {'brief': True, 'ticker': True, 'points': True}),
    ('без новостей', feed(False, True),
     {'brief': True, 'ticker': True, 'points': False}),
    ('нет ленты', None, {'brief': False, 'ticker': True, 'points': False}),
]


def main():
    bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        ctx = b.new_context(viewport={'width': 1440, 'height': 900})
        ctx.route('**/mc.yandex.ru/**', lambda r: r.abort())
        p = ctx.new_page()
        for page, path, today_id, ticker_id in PAGES:
            print('\n%s' % page)
            for name, body, want in CASES:
                if body is None:
                    p.route('**/hero-feed.json*',
                            lambda route: route.fulfill(status=500, body=''))
                else:
                    p.route('**/hero-feed.json*',
                            lambda route: route.fulfill(
                                status=200, content_type='application/json',
                                body=body))
                p.goto(BASE + path, wait_until='load')
                p.wait_for_timeout(2200)
                st = p.evaluate(STATE, [today_id, ticker_id])
                p.unroute('**/hero-feed.json*')
                got = {'brief': st['brief'], 'ticker': st['ticker'],
                       'points': st['points'] > 0}
                ok = got == want
                if not ok:
                    bad.append('%s / %s' % (page, name))
                print('  %-13s бриф %-3s котировки %-3s точки %-3s  %s'
                      % (name,
                         'да' if got['brief'] else 'нет',
                         'да' if got['ticker'] else 'нет',
                         st['points'] or 'нет',
                         '' if ok else '← ожидали ' + str(want)))
        b.close()
    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: части ленты не тянут друг друга за собой')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Что первый экран говорит про свежесть утреннего брифа.

Бриф пишет утренний прогон market_intel, сайт его только показывает. Если
прогон не отработал, вчерашний заголовок остаётся в hero-feed.json — и
строка «Сегодня · …» превращается в неправду ровно там, где она обещает
свежесть. Котировки рядом такое правило уже соблюдают: старше двух часов
не показываются вовсе.

Щуп подставляет ленту с разными датами и печатает, что вышло на экран.
Проверяется не логика в голове, а текст в DOM.

    python3 tools/brief-freshness.py
"""
import datetime
import sys
from playwright.sync_api import sync_playwright

URL = 'http://127.0.0.1:5001/index-next.html'

FEED = """(d) => {
  const meta = { today: { headline: 'ЗАГОЛОВОК БРИФА', date: d, lang: 'ru' } };
  document.dispatchEvent(new CustomEvent('sbf:feedmeta', { detail: meta }));
  const el = document.getElementById('scene-today');
  /* Обещание ищем не по слову «Сегодня»: страница бывает на трёх языках,
     и щуп, знающий одно слово, объявил бы дефектом английскую версию —
     что он и сделал в первый прогон. Берём саму строку из словаря. */
  const tpl = window.i18n.t('hero.today').replace('{d}', '').trim()
              .replace(/[·|]\\s*$/, '').trim();
  return { hidden: el.hidden, text: (el.textContent || '').trim(),
           promise: tpl && (el.textContent || '').indexOf(tpl) >= 0 };
}"""


def main():
    today = datetime.date.today()
    cases = [
        (0, 'сегодняшний',   'обещание свежести на месте'),
        (1, 'вчерашний',     'только дата, без обещания'),
        (3, 'трёхдневный',   'только дата, без обещания'),
        (4, 'четырёхдневный', 'не показывать вовсе'),
    ]
    bad = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        p = b.new_context(viewport={'width': 1440, 'height': 900}).new_page()
        p.goto(URL, wait_until='load')
        p.wait_for_timeout(1500)
        for age, name, want in cases:
            d = (today - datetime.timedelta(days=age)).isoformat()
            r = p.evaluate(FEED, d)
            shown = '' if r['hidden'] else r['text']
            says_today = r['promise']
            ok = (age == 0 and says_today and not r['hidden']) or \
                 (0 < age <= 3 and not r['hidden'] and not says_today) or \
                 (age > 3 and r['hidden'])
            if not ok:
                bad.append(name)
            print('%-15s %-34s %s' % (
                name, want,
                'скрыто' if r['hidden'] else '«%s»' % shown[:70]))
        b.close()
    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: «Сегодня» стоит только над сегодняшним брифом')


if __name__ == '__main__':
    main()

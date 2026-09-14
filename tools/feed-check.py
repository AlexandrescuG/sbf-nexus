#!/usr/bin/env python3
"""Что лежит в hero-feed.json и насколько оно свежее.

Лента собирается из чужих данных: бриф и макро пишет market_intel, сайт их
только показывает. Значит все отказы здесь тихие — блок не падает, он
просто выходит пустым или вчерашним, а страница выглядит как задумано.

Щуп проверяет не «файл есть», а что в нём: сколько макро-рядов из
запланированных, сколько уровней доверия, у скольких событий календаря
посчитана прошлая реакция, и не протух ли каждый блок по своим часам —
макро обновляется раз в сутки, котировки каждые 15 секунд.

    python3 tools/feed-check.py
"""
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FEED = ROOT / 'hero-feed.json'

# Сколько часов блок имеет право быть старым. Числа разные, потому что
# источники разные: FRED публикует раз в сутки и по будням, котировки идут
# непрерывно. Общий порог на всех означал бы, что для одних он бессмысленно
# строг, а для других не ловит ничего.
STALE_H = {'updated': 1, 'macro_updated': 72, 'quotes_updated': 2}
WANT_MACRO = 7
WANT_TIERS = 3


def age_h(ts):
    if not ts:
        return None
    try:
        t = datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=datetime.timezone.utc)
    return (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 3600


def main():
    if not FEED.exists():
        print('ленты нет: ' + str(FEED))
        sys.exit(1)
    d = json.loads(FEED.read_text(encoding='utf-8'))
    bad = []

    for key, limit in STALE_H.items():
        a = age_h(d.get(key))
        if a is None:
            print('%-16s нет отметки времени' % key)
            bad.append(key)
            continue
        mark = '' if a <= limit else '   ← старее %d ч' % limit
        print('%-16s %5.1f ч назад%s' % (key, a, mark))
        if a > limit:
            bad.append(key)

    macro = d.get('macro') or []
    print('макро-рядов    %d из %d' % (len(macro), WANT_MACRO))
    if len(macro) < WANT_MACRO:
        bad.append('macro')
    # Ряд без значения или без подписи на одном из языков — дырка в панели,
    # которую на экране видно как пустое место, а в файле не видно вовсе.
    for m in macro:
        miss = [k for k in ('ru', 'en', 'ro') if not (m.get('label') or {}).get(k)]
        if m.get('value') is None or miss:
            print('  %s: значение %r, нет подписи %s'
                  % (m.get('key'), m.get('value'), miss or '—'))
            bad.append(m.get('key'))

    grow = d.get('grow') or {}
    tiers = grow.get('context') or []
    print('уровней доверия %d из %d  (%s)'
          % (len(tiers), WANT_TIERS,
             ', '.join(t.get('confidence') or '?' for t in tiers) or '—'))
    if len(tiers) < WANT_TIERS:
        bad.append('context')

    ev = (grow.get('brief') or {}).get('events') or []
    withpast = [e for e in ev if e.get('past')]
    print('событий календаря %d, с прошлой реакцией %d' % (len(ev), len(withpast)))
    if not ev:
        bad.append('calendar')
    # Медиана по одному-двум наблюдениям — это не медиана. Показывать её
    # рядом с числом наблюдений можно, выдавать за статистику нельзя.
    for e in withpast:
        n = (e.get('past') or {}).get('n') or 0
        if n < 3:
            print('  прошлая реакция по %d наблюдениям: %s'
                  % (n, (e.get('title') or {}).get('ru')))

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(str(x) for x in bad))
        sys.exit(1)
    print('хорошо: лента полная и свежая')


if __name__ == '__main__':
    main()

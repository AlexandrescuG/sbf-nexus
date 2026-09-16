#!/usr/bin/env python3
"""Что сервер отдаёт наружу и с каким кэшем.

Сайт раздаётся прямо из каталога репозитория, поэтому «отдаётся лишнее» —
здесь не гипотетический риск, а состояние по умолчанию: аудит 16.09 нашёл
открытыми .git, server.py, CLAUDE.md и листинги каталогов.

Щуп ходит по списку в обе стороны: что ДОЛЖНО быть закрыто и что ДОЛЖНО
остаться открытым. Только первая половина была бы опасной проверкой —
всё закрыть и отрапортовать успех можно, положив сайт целиком.

    python3 tools/server-check.py [--url http://127.0.0.1:5001]
"""
import sys
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:5001'
if '--url' in sys.argv:
    BASE = sys.argv[sys.argv.index('--url') + 1]

CLOSED = [
    '/.git/HEAD', '/.git/config', '/.git/index', '/.git/logs/HEAD',
    '/server.py', '/CLAUDE.md', '/README.md',
    '/package.json', '/package-lock.json',
    '/tools/', '/tools/scene-check.py', '/docs/', '/_archive/',
    '/node_modules/', '/hero-preview/build_feed.py',
    # Обход нормализацией: тот же файл, записанный иначе. Проверка
    # «начинается с /tools» на этом и ловится.
    '/js/../server.py', '/./.git/HEAD', '/tools/../server.py',
]

OPEN = [
    ('/index.html', None),
    ('/index-next.html', None),
    ('/hero-feed.json', 'no-cache'),
    ('/css/scene.css', 'no-cache'),
    ('/js/scene/stage.js', 'no-cache'),
    ('/assets/logo/logo.svg', 'max-age'),
    ('/vendor/countries-110m.json', 'max-age'),
]


def get(path):
    req = urllib.request.Request(BASE + path, method='GET')
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, dict(r.headers), len(r.read())
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), 0
    except Exception as exc:
        return None, {}, str(exc)


def main():
    bad = []
    print('должно быть закрыто:')
    for p in CLOSED:
        code, _, _ = get(p)
        ok = code in (403, 404)
        print('  %-34s %s%s' % (p, code, '' if ok else '   ← ОТКРЫТО'))
        if not ok:
            bad.append(p)

    print('\nдолжно остаться открытым:')
    for p, want_cache in OPEN:
        code, hdr, size = get(p)
        cc = (hdr.get('Cache-Control') or '').lower()
        ok = code == 200 and isinstance(size, int) and size > 0
        note = ''
        if not ok:
            note = '   ← НЕ ОТДАЁТСЯ'
            bad.append(p)
        elif want_cache and want_cache not in cc:
            note = '   ← кэш «%s», ожидали «%s»' % (cc, want_cache)
            bad.append(p + ' (кэш)')
        print('  %-34s %s  %-28s%s' % (p, code, cc or '—', note))

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        sys.exit(1)
    print('хорошо: служебное закрыто, сайт отдаётся, кэш по назначению')


if __name__ == '__main__':
    main()

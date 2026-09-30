#!/usr/bin/env python3
"""Мягкие 404: отдаёт ли сервер главную вместо «нет такой страницы».

Зачем отдельный щуп. Это дефект, который не видно ни в браузере, ни в
консоли, ни глазами: человек по таким адресам не ходит. Его показал
журнал краулеров — сканеры уязвимостей получали 200 и полные 88 КБ
главной на /actuator/env, /wp-json и на случайные строки. Для
поисковика и для ИИ-агента это бесконечное число разных адресов с
одинаковым содержимым, то есть ровно противоположность тому, ради чего
делались отдельные адреса брифов.

Проверяем три вещи:

  1. Несуществующий путь без расширения → 404, а не 200 с главной.
  2. Языковые псевдонимы → 301 на канонический адрес (а не 200 с
     содержимым: дубль главной по шести адресам — тот же дефект,
     только с приличными именами).
  3. Живые адреса по-прежнему отдаются. Щуп, который «починил» сайт,
     сломав его, полезнее не сделал.

Контроль. Пункт 1 проверяется и на заведомо плохом ответе: щуп,
который не умеет отличить 200-с-главной от 404, напишет «всё хорошо» и
на старом сервере. Поэтому размер тела сравнивается с размером главной,
и совпадение считается провалом независимо от кода ответа.

    python3 tools/softly-404.py
    python3 tools/softly-404.py --base https://sbfconsult.com
"""
import argparse
import sys
import urllib.error
import urllib.request

# Пути, которых на сайте нет и быть не должно. Часть взята прямо из
# журнала краулеров — это то, что у нас реально запрашивали.
MISSING = [
    '/ld0jxwilo7xt1k6e6kvl',        # случайная строка из журнала
    '/actuator/env',
    '/wp-json',
    '/api/config',
    '/config',
    '/admin',
    '/nosuchpage',
    '/brief/nosuchdate',
]

ALIASES = {
    '/ru': 'lang=ru', '/en': 'lang=en', '/ro': 'lang=ro',
    '/uk': 'lang=ru', '/be': 'lang=ru', '/kk': 'lang=ru',
}

ALIVE = ['/', '/risk.html', '/brief/', '/robots.txt', '/sitemap.xml',
         '/llms.txt']


def fetch(url, redirect=True):
    """Возвращает (код, длина тела, Location). Ошибки — тоже ответ."""
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **kw):
            return None

    opener = urllib.request.build_opener(
        *([] if redirect else [NoRedirect]))
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.1; '
                      '+https://openai.com/gptbot)'})
    try:
        with opener.open(req, timeout=15) as r:
            return r.status, len(r.read()), r.headers.get('Location')
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, len(body), e.headers.get('Location')
    except urllib.error.URLError as e:
        return None, 0, str(e.reason)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://127.0.0.1:5001')
    args = ap.parse_args()
    base = args.base.rstrip('/')
    bad = []

    home_code, home_len, _ = fetch(base + '/')
    if home_code != 200 or home_len < 1000:
        print('главная не отдаётся (%s, %d б) — остальное мерить нечем'
              % (home_code, home_len))
        return 1
    print('главная: %d б — с этим размером и сравниваем' % home_len)

    print()
    print('— несуществующие адреса —')
    for p in MISSING:
        code, ln, _ = fetch(base + p)
        # Совпадение размера с главной — провал даже при коде 404:
        # значит тело главной, а код приклеили сверху.
        same = abs(ln - home_len) < 200
        ok = code == 404 and not same
        print('  %-24s %s %6d б%s' % (p, code, ln,
              '' if ok else '   ← мягкий 404' if same else '   ←'))
        if not ok:
            bad.append(p)

    print()
    print('— языковые псевдонимы: должен быть 301 —')
    for p, want in ALIASES.items():
        code, ln, loc = fetch(base + p, redirect=False)
        ok = code in (301, 308) and loc and want in loc
        print('  %-24s %s → %s%s' % (p, code, loc, '' if ok else '   ←'))
        if not ok:
            bad.append(p)

    print()
    print('— живые адреса не должны пострадать —')
    for p in ALIVE:
        code, ln, _ = fetch(base + p)
        ok = code == 200 and ln > 100
        print('  %-24s %s %6d б%s' % (p, code, ln, '' if ok else '   ←'))
        if not ok:
            bad.append(p)

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(bad))
        return 1
    print('хорошо: нет такой страницы — значит 404, псевдонимы редиректят, '
          'живое живо')
    return 0


if __name__ == '__main__':
    sys.exit(main())

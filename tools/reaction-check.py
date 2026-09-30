#!/usr/bin/env python3
"""Страницы реакции: честны ли они и видит ли их агент.

Эти страницы — единственное на сайте, что сделано специально ради
цитирования, и цитировать будут числа. Значит проверять надо не вёрстку, а
то, при каких числах они стоят.

Что проверяется:

  1. Читается без JS. Краулеры скрипты почти никогда не исполняют.
  2. У КАЖДОГО отношения есть число наблюдений. Медиана без n — это
     утверждение без основания, и именно так выглядит вся остальная
     индустрия.
  3. Есть период выборки, дата пересчёта, дисклеймер, реквизиты, canonical
     и структурные данные.
  4. Ни слова про направление цены. При наших выборках это монетка, и
     фраза «обычно растёт» здесь была бы прогнозом, а не измерением.
  5. Единица измерения названа. Отношение к фону — безразмерное; если на
     странице появится «%» рядом с ним, это уже другая величина. Тот же
     дефект однажды уехал в гобелен: 0,104 доли ATR подписали как «10,4%».
  6. Объявлена в карте сайта, отдаётся сервером агенту, связана в обе
     стороны с оглавлением.

КОНТРОЛЬ. Пункты 2 и 4 проверяются на заведомо плохой странице, которую
щуп собирает сам: медиана без n и фраза про направление. Щуп, который не
поймал подделку, ничего не доказывает и про настоящие страницы.

    python3 tools/reaction-check.py
    python3 tools/reaction-check.py --base https://sbfconsult.com
"""
import argparse
import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'reaction'
STATS = ROOT / 'reaction-stats.json'

# Разметка — ищется в сыром HTML.
MUST_HAVE_HTML = [
    ('реквизиты', '254900BW4MI5M0006I30'),
    ('ссылка на риски', 'risk.html'),
    ('canonical', 'rel="canonical"'),
    ('структурные данные', 'application/ld+json'),
]

# Проза — ищется в ТЕКСТЕ со сжатыми пробелами, а не в сыром HTML.
# Первая версия щупа искала «не публикуем» прямо в исходнике и забраковала
# все двенадцать настоящих страниц: в файле фраза разорвана переводом
# строки («мы не\nпубликуем»), потому что исходник свёрстан по 72 колонки.
# Щуп обвинял работающий код — ровно тот случай, когда чинить надо щуп.
MUST_HAVE_TEXT = [
    ('дисклеймер', 'не инвестиционная рекомендация'),
    ('дата пересчёта', 'Пересчитано'),
    ('оговорка про направление', 'не публикуем'),
]

# Слова, которых на странице быть не должно: они превращают измерение в
# прогноз. Ищем по тексту без тегов, чтобы не ловить служебную разметку.
FORBIDDEN = [
    (r'обычно\s+(?:растёт|падает|идёт\s+вверх|идёт\s+вниз)', 'обещание направления'),
    (r'(?:вероятнее всего|скорее всего)\s+(?:вырастет|упадёт)', 'прогноз'),
    (r'рекоменду(?:ем|ется)\s+(?:покупать|продавать)', 'рекомендация сделки'),
]


def text_of(html):
    t = re.sub(r'<(script|style).*?</\1>', ' ', html, flags=re.S)
    t = re.sub(r'<[^>]+>', ' ', t)
    return re.sub(r'\s+', ' ', t)


def check_numbers(html, name, bad):
    """У каждого отношения «N.NN×» рядом должно стоять число наблюдений."""
    plain = text_of(html)
    ratios = re.findall(r'\d+[.,]\d+\s*×', plain)
    if not ratios:
        print('  %s: ни одного отношения на странице' % name)
        bad.append(name)
        return
    # «из N раз выше обычного» — счёт наблюдений рядом с каждым отношением
    counts = re.findall(r'из\s+\d+\s+раз', plain)
    if len(counts) < len(ratios) - 5:
        # −5: в ведущей фразе, в списке соседей и в подписи отношения
        # упоминаются без своей клетки таблицы
        print('  %s: отношений %d, а счётчиков наблюдений %d'
              % (name, len(ratios), len(counts)))
        bad.append(name)
    if not re.search(r'[Нн]аблюдений от \d+ до \d+', plain) \
            and not re.search(r'\d+ наблюдени', plain):
        print('  %s: нет числа наблюдений словами' % name)
        bad.append(name)
    # Процент рядом с отношением — другая величина
    if re.search(r'\d+[.,]\d+\s*×\s*%', plain) or \
            re.search(r'к обычному получасу[^.]{0,40}%', plain):
        print('  %s: отношение подписано процентом' % name)
        bad.append(name)


def check_forbidden(html, name, bad):
    plain = text_of(html)
    for pat, why in FORBIDDEN:
        m = re.search(pat, plain, re.I)
        if m:
            print('  %s: %s — «%s»' % (name, why, m.group(0)))
            bad.append(name)


def control():
    """Заведомо плохая страница: щуп обязан её забраковать."""
    print('— контроль: подделка, которую щуп обязан поймать —')
    fake = ('<!DOCTYPE html><html lang="ru"><body>'
            '<h1>Реакция на CPI</h1>'
            '<p>Медиана 4.52× к обычному получасу.</p>'
            '<p>После выхода данных золото обычно растёт.</p>'
            '</body></html>')
    bad = []
    check_numbers(fake, 'подделка', bad)
    check_forbidden(fake, 'подделка', bad)
    if bad:
        print('  поймана по %d признакам — щупу можно верить\n' % len(bad))
        return True
    print('  НЕ ПОЙМАНА — щуп ничего не доказывает\n')
    return False


def fetch(base, path):
    req = urllib.request.Request(base + path, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.1; '
                      '+https://openai.com/gptbot)'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except urllib.error.URLError:
        return None, ''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://127.0.0.1:5001')
    args = ap.parse_args()

    if not control():
        return 1

    pages = sorted(p for p in OUT.glob('*.html') if p.stem != 'index')
    if not pages:
        print('страниц реакции нет')
        return 1
    print('страниц: %d' % len(pages))

    bad = []
    stats = json.loads(STATS.read_text(encoding='utf-8'))
    slugs = {e['slug'] for e in stats['events']}
    idx = (OUT / 'index.html').read_text(encoding='utf-8')
    smap = (ROOT / 'sitemap.xml').read_text(encoding='utf-8')

    print('\n— каждая страница —')
    for p in pages:
        html = p.read_text(encoding='utf-8')
        if p.stem not in slugs:
            print('  %s: нет в reaction-stats.json (осиротела)' % p.name)
            bad.append(p.name)
        # JS: ld+json не в счёт
        js = re.findall(r'<script(?![^>]*application/ld\+json)[^>]*>', html)
        if js:
            print('  %s: на странице есть JS (%d)' % (p.name, len(js)))
            bad.append(p.name)
        for label, needle in MUST_HAVE_HTML:
            if needle not in html:
                print('  %s: нет — %s' % (p.name, label))
                bad.append(p.name)
        plain_html = text_of(html)
        for label, needle in MUST_HAVE_TEXT:
            if needle not in plain_html:
                print('  %s: нет — %s' % (p.name, label))
                bad.append(p.name)
        if not re.search(r'\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4}', text_of(html)):
            print('  %s: нет периода выборки' % p.name)
            bad.append(p.name)
        check_numbers(html, p.name, bad)
        check_forbidden(html, p.name, bad)
        if p.name not in idx:
            print('  %s: нет в оглавлении' % p.name)
            bad.append(p.name)
        if p.name not in smap:
            print('  %s: нет в карте сайта' % p.name)
            bad.append(p.name)
    print('  проверено, замечаний: %d' % len(set(bad)))

    print('\n— отдаётся ли агенту —')
    for path in ['/reaction/', '/reaction/%s' % pages[0].name]:
        code, body = fetch(args.base, path)
        plain = text_of(body)
        ok = code == 200 and len(plain) > 800
        print('  %-34s %s, текста %d знаков%s'
              % (path, code, len(plain), '' if ok else '   ←'))
        if not ok:
            bad.append(path)

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(sorted(set(bad))))
        return 1
    print('хорошо: числа стоят с наблюдениями, направления нет, '
          'страницы читаются без JS и отдаются агенту')
    return 0


if __name__ == '__main__':
    sys.exit(main())

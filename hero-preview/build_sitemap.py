#!/usr/bin/env python3
"""Карта сайта — одна, собирается сканированием диска.

Почему отдельным файлом. Раньше карту писал build_brief_pages.py целиком.
Как только появился второй сборщик страниц (реакция на события), это стало
ловушкой: два сборщика писали бы один файл, и тот, кто прогонится вторым,
вычеркнул бы страницы первого. Причём молча — карта осталась бы валидным
XML, просто без половины сайта, и заметить это можно было бы только по
падению трафика через недели.

Поэтому карта не «дописывается» ни одним из них, а СОБИРАЕТСЯ ЗАНОВО по
тому, что реально лежит на диске. Источник правды — каталог, а не память
скрипта. Побочная выгода: карта самопочиняется, если страницу добавили или
удалили руками.

Постоянные адреса перечислены явно: их мало, и они не выводятся из
структуры каталогов.

    python3 hero-preview/build_sitemap.py
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = 'https://sbfconsult.com'

# (адрес, частота, приоритет, нужны ли языковые альтернативы)
FIXED = [
    ('/', 'daily', '1.0', True),
    ('/brief/', 'daily', '0.9', False),
    ('/reaction/', 'weekly', '0.9', False),
    ('/risk.html', 'yearly', '0.5', False),
    ('/cons-kz/', 'monthly', '0.6', False),
]

# Каталоги с генерируемыми страницами. never — архив, который не
# переписывается; weekly — страницы, которые пересчитываются, когда у
# события появляется новое наблюдение. Врать в changefreq незачем: это
# подсказка краулеру, как часто возвращаться.
SCAN = [
    ('brief', 'never', '0.6', True),      # True — ставить lastmod из имени
    ('reaction', 'weekly', '0.8', False),
]


def url(loc, freq, prio, alts=False, lastmod=None):
    out = ['  <url>', '    <loc>%s%s</loc>' % (SITE, loc)]
    if lastmod:
        out.append('    <lastmod>%s</lastmod>' % lastmod)
    if alts:
        for lg in ('ru', 'en', 'ro'):
            out.append('    <xhtml:link rel="alternate" hreflang="%s" '
                       'href="%s/?lang=%s"/>' % (lg, SITE, lg))
        out.append('    <xhtml:link rel="alternate" hreflang="x-default" '
                   'href="%s/"/>' % SITE)
    out.append('    <changefreq>%s</changefreq>' % freq)
    out.append('    <priority>%s</priority>' % prio)
    out.append('  </url>')
    return out


def write():
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<!-- Собирается hero-preview/build_sitemap.py сканированием',
           '     каталогов. Руками не править: правка исчезнет при первом',
           '     же прогоне любого из сборщиков страниц. -->',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
           '        xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    n = 0
    for loc, freq, prio, alts in FIXED:
        out += url(loc, freq, prio, alts=alts)
        n += 1
    for folder, freq, prio, date_in_name in SCAN:
        d = ROOT / folder
        if not d.is_dir():
            continue
        for p in sorted((q for q in d.glob('*.html') if q.stem != 'index'),
                        reverse=True):
            lastmod = p.stem if date_in_name and p.stem[:4].isdigit() else None
            out += url('/%s/%s' % (folder, p.name), freq, prio,
                       lastmod=lastmod)
            n += 1
    out.append('</urlset>')
    (ROOT / 'sitemap.xml').write_text('\n'.join(out) + '\n', encoding='utf-8')
    return n


if __name__ == '__main__':
    print('адресов в карте сайта: %d' % write())

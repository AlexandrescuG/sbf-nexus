#!/usr/bin/env python3
"""Архив брифов: читается ли он, честен ли и не переписывается ли задним числом.

Страницы архива — единственное на сайте, что делается специально для
цитирования. Значит и требования к ним другие, чем к обычной странице:

  * читаются БЕЗ JS — краулеры скрипты почти никогда не исполняют;
  * несут дисклеймер и реквизиты: числа без «это не рекомендация» — это
    уже не информация, а совет;
  * не меняются задним числом. Вчерашняя ссылка обязана показывать то,
    что по ней читали вчера, иначе ссылаться на архив нельзя;
  * объявлены в карте сайта и связаны с оглавлением в обе стороны.

Отдельно проверяется единица измерения прошлой реакции. Она уже один раз
была подписана процентами вместо доли дневного ATR, и 0,104 выходило на
страницу как «10,4% за полчаса» — числа такого порядка за 30 минут не
бывает, а страница архивная и осталась бы с этим навсегда.

    python3 tools/brief-archive-check.py
"""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'brief'
BASE = 'http://127.0.0.1:5001'

MUST_HAVE = [
    ('дисклеймер', 'не инвестиционная рекомендация'),
    ('реквизиты', '254900BW4MI5M0006I30'),
    ('ссылка на риски', 'risk.html'),
    ('canonical', 'rel="canonical"'),
    ('структурные данные', 'application/ld+json'),
]


def main():
    bad = []
    pages = sorted(p for p in OUT.glob('*.html') if p.stem != 'index')
    if not pages:
        print('в архиве нет ни одной страницы')
        return 1
    print('страниц в архиве: %d' % len(pages))

    for p in pages:
        txt = p.read_text(encoding='utf-8')
        # 1. Без JS. Ищем любой исполняемый script: ld+json не в счёт.
        scripts = re.findall(r'<script(?![^>]*application/ld\+json)[^>]*>', txt)
        if scripts:
            print('  %s: на странице есть JS (%d)' % (p.name, len(scripts)))
            bad.append(p.name)
        # 2. Обязательное
        for name, needle in MUST_HAVE:
            if needle not in txt:
                print('  %s: нет — %s' % (p.name, name))
                bad.append(p.name)
        # 3. Единица прошлой реакции
        # Запятая здесь — десятичный разделитель («0,1 дневного ATR»), а не
        # конец значения. Первая версия резала по ней и видела «0»,
        # объявляя дефектом правильную строку.
        for m in re.finditer(r'медиана хода за 30 минут: ([^<]+)', txt):
            val = m.group(1).strip()
            if 'ATR' not in val:
                print('  %s: прошлая реакция без единицы — «%s»' % (p.name, val))
                bad.append(p.name)
        # 4. Дата в адресе совпадает с датой в тексте
        if p.stem not in txt and p.stem.replace('-', '') not in txt:
            # дата может быть только человеческой — проверим год
            if p.stem[:4] not in txt:
                print('  %s: в тексте нет даты страницы' % p.name)
                bad.append(p.name)

    # 5. Архив не переписывается: прогон сборщика не должен менять
    #    существующие файлы. Сравниваем содержимое до и после.
    before = {p.name: p.read_bytes() for p in pages}
    subprocess.run([sys.executable, str(ROOT / 'hero-preview'
                                        / 'build_brief_pages.py')],
                   capture_output=True)
    changed = [n for n, b in before.items()
               if (OUT / n).read_bytes() != b]
    print('перезаписано при повторном прогоне: %d' % len(changed))
    if changed:
        print('  ' + ', '.join(changed))
        bad.extend(changed)

    # 6. Оглавление и карта сайта знают про все выпуски
    idx = (OUT / 'index.html').read_text(encoding='utf-8')
    smap = (ROOT / 'sitemap.xml').read_text(encoding='utf-8')
    for p in pages:
        if p.name not in idx:
            print('  %s: нет в оглавлении' % p.name)
            bad.append(p.name)
        if p.name not in smap:
            print('  %s: нет в карте сайта' % p.name)
            bad.append(p.name)

    # 7. Отдаётся ли сервером и виден ли текст без JS
    try:
        import urllib.request
        for path in ('/brief/', '/brief/%s' % pages[-1].name):
            req = urllib.request.Request(
                BASE + path, headers={'User-Agent': 'Mozilla/5.0 (compatible; '
                                      'GPTBot/1.1; +https://openai.com/gptbot)'})
            with urllib.request.urlopen(req, timeout=10) as r:
                body = r.read().decode('utf-8', 'replace')
            plain = re.sub(r'<(script|style).*?</\1>', ' ', body, flags=re.S)
            plain = re.sub(r'<[^>]+>', ' ', plain)
            plain = re.sub(r'\s+', ' ', plain).strip()
            ok = r.status == 200 and len(plain) > 400
            print('  %-28s %s, текста %d знаков%s'
                  % (path, r.status, len(plain), '' if ok else '   ←'))
            if not ok:
                bad.append(path)
    except Exception as exc:
        print('  сервер на 5001 не отвечает (%s) — раздачу не проверили'
              % str(exc)[:50])
        bad.append('сервер')

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(sorted(set(bad))))
        return 1
    print('хорошо: архив читается без JS, честен и не переписывается')
    return 0


if __name__ == '__main__':
    sys.exit(main())

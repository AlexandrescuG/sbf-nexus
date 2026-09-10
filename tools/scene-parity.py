#!/usr/bin/env python3
"""Чего в новом каркасе ещё нет по сравнению с живым сайтом.

Сравнивает index.html и index-next.html по трём спискам:

  ключи i18n   — что вообще написано на странице;
  ссылки       — куда с неё можно уйти (включая UTM-метки);
  цели Метрики — что мы считаем (data-track).

Это не «похоже ли», а «не потерялось ли». Пока список непустой,
переключать главную нельзя — и это единственный смысл проверки.

    python3 tools/scene-parity.py
    python3 tools/scene-parity.py --full   # печатать всё, а не первые 20
"""
import argparse
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OLD = ROOT / 'index.html'
NEW = ROOT / 'index-next.html'

KEY = re.compile(r'data-i18n(?:-html|-aria|-title)?="([^"]+)"')
HREF = re.compile(r'href="([^"#][^"]*)"')
TRACK = re.compile(r'data-track="([^"]+)"')

# Осознанно не переносим — с причиной, иначе список превращается в свалку
# «потом разберёмся», и ноль внизу перестаёт что-либо значить.
SKIP_KEYS = {
    **{f'dots.{i}': 'точки snap-навигации: в гобелене нет постраничных остановок'
       for i in range(10)},
    'nav.menu_aria': 'бургер-меню не заводим: три ссылки и языки помещаются '
                     'в строку, меню было бы лишним экраном между человеком и '
                     'разделом',
    'approach.hint': 'на живом сайте лента едет сама и останавливается по '
                     'наведению; в гобелене она едет от прокрутки — наводить '
                     'не на что, и подсказка была бы неправдой',
}
# Файлы стилей и скриптов старого каркаса сравнивать бессмысленно: у нового
# они свои. Сверяем только то, куда может уйти человек.
SKIP_LINK = re.compile(r'^(css/|js/|vendor/|assets/|https://fonts\.)')


def grab(path, rx):
    text = path.read_text(encoding='utf-8').replace('&amp;', '&')
    return set(rx.findall(text))


# Часть ссылок и целей живёт не в разметке, а в актах сцены: знак нарисован
# на холсте, и ссылка под ним ставится из js/scene/acts/*.js. Не заглянув
# туда, проверка объявила бы потерянным то, что на месте.
ACTS_DIR = ROOT / 'js' / 'scene' / 'acts'
ACT_LINK = re.compile(r"link:\s*'([^']+)'")
ACT_TRACK = re.compile(r"linkTrack:\s*'([^']+)'")
# То же и с текстом. Легенда графика переехала из колонки на сам график —
# подпись стоит рядом с линией, которую называет, — и ключи теперь берутся
# из t('approach.lg_level') в акте, а не из data-i18n в разметке. Проверка,
# смотревшая только в HTML, объявила их потерянными: четыре ключа на месте,
# просто в другом файле. Ошибка того же рода, что «числитель и знаменатель
# разными линейками»: списки собирались из разных источников.
# Ищем не вызов t(), а сам вид ключа: часть из них лежит в таблицах
# (`{ key: 'approach.lg_sma', … }`), и привязка к форме вызова уже один раз
# соврала. Форма «слово.слово» строчными достаточно узкая: пути к файлам
# содержат косую черту, события — двоеточие, часовые пояса — заглавные.
ACT_KEY = re.compile(r"'([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+)'")


def grab_acts(rx):
    out = set()
    for f in sorted(ACTS_DIR.glob('*.js')):
        out |= set(rx.findall(f.read_text(encoding='utf-8')))
    return out


def section(name, old, new, full):
    missing = sorted(old - new)
    extra = sorted(new - old)
    print(f'\n{name}: в старом {len(old)}, в новом {len(new)}, '
          f'не перенесено {len(missing)}')
    show = missing if full else missing[:20]
    for m in show:
        print('   ', m)
    if len(missing) > len(show):
        print(f'    … и ещё {len(missing) - len(show)}')
    if extra:
        print(f'  только в новом ({len(extra)}):')
        for e in (extra if full else extra[:8]):
            print('   +', e)
    return len(missing)


def main(full):
    gaps = 0
    old_keys = grab(OLD, KEY) - set(SKIP_KEYS)
    gaps += section('ключи i18n', old_keys, grab(NEW, KEY) | grab_acts(ACT_KEY),
                    full)
    old_links = {h for h in grab(OLD, HREF) if not SKIP_LINK.match(h)}
    new_links = {h for h in grab(NEW, HREF) if not SKIP_LINK.match(h)}
    new_links |= grab_acts(ACT_LINK)
    gaps += section('ссылки', old_links, new_links, full)
    gaps += section('цели Метрики', grab(OLD, TRACK),
                    grab(NEW, TRACK) | grab_acts(ACT_TRACK), full)

    print('\nОсознанно не переносим:')
    for k, why in sorted(set(SKIP_KEYS.items())):
        print(f'    {k} — {why}')

    print('\nИТОГО не перенесено:', gaps)
    print('Переключать главную можно, только когда здесь ноль '
          '(и когда так решит владелец).')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--full', action='store_true')
    main(ap.parse_args().full)

#!/usr/bin/env python3
"""
Сверяет ключи переводов: три локали между собой и разметку со словарём.

Зачем. Ключи добавляются по одному экрану за раз, и промахи не видны:
ключ есть в ru, забыт в ro — на румынском на месте текста остаётся пусто
или сам ключ. Прогон tools/lang-check.py ловит только перекрытия, но не
дыры в словаре. Ошибка тихая: страница не падает, просто часть текста
исчезает у части посетителей.

    python3 tools/i18n-check.py

Печатает три списка: ключи не во всех локалях, ключи из разметки без
перевода, ключи словаря, которых нет в разметке (кандидаты на удаление).
Код возврата 1, если есть первые две категории.
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / 'js' / 'i18n.js'
# Проверяем оба каркаса сразу: у нового те же ключи, и разъехаться они
# не должны — иначе в каркасе появится текст, которого нет в словаре, и
# увидим мы это только на живом сайте после переключения.
HTML = ROOT / 'index.html'
HTML_NEXT = ROOT / 'index-next.html'


def load_locales():
    """Достаём _LOCALES через node: это JS-объект, а не JSON — с кавычками
    без кавычек, комментариями и запятыми в конце."""
    js = ("const src=require('fs').readFileSync(%r,'utf8');"
          "const m=src.match(/const _LOCALES = \\{[\\s\\S]*?\\n\\};/);"
          "eval('var L='+m[0].replace('const _LOCALES = ','')+';');"
          "process.stdout.write(JSON.stringify(L));" % str(I18N))
    out = subprocess.run(['node', '-e', js], capture_output=True, text=True)
    if out.returncode:
        sys.exit('не удалось прочитать _LOCALES: ' + out.stderr[:300])
    return json.loads(out.stdout)


def flatten(d, prefix=''):
    keys = set()
    for k, v in d.items():
        path = f'{prefix}{k}'
        if isinstance(v, dict):
            keys |= flatten(v, path + '.')
        elif isinstance(v, list):
            # Массивы (dots) адресуются по индексу: dots.0, dots.1 …
            for i in range(len(v)):
                keys.add(f'{path}.{i}')
        else:
            keys.add(path)
    return keys


def main():
    loc = load_locales()
    langs = list(loc)
    sets = {l: flatten(loc[l]) for l in langs}
    common = set.union(*sets.values())

    missing = []
    for key in sorted(common):
        absent = [l for l in langs if key not in sets[l]]
        if absent:
            missing.append((key, absent))

    html = (HTML.read_text(encoding='utf-8') + (HTML_NEXT.read_text(encoding='utf-8') if HTML_NEXT.exists() else ''))
    used = set(re.findall(r'data-i18n(?:-html|-title|-aria|-placeholder)?="([^"]+)"', html))
    # Часть ключей берётся не из разметки, а из кода: подписи на карте,
    # карточка партнёра, формат времени. Без их учёта список «лишних»
    # состоял бы наполовину из работающих ключей и был бы бесполезен.
    prefixes = set()
    quoted = set()
    for js in sorted((ROOT / 'js').rglob('*.js')):
        src = js.read_text(encoding='utf-8', errors='ignore')
        # В актах функция перевода часто зовётся T() — короткий локальный алиас
        used |= set(re.findall(r"""[\s(][tT]\(\s*['"]([\w.]+)['"]""", src))
        used |= set(re.findall(r"""i18n\.t\(\s*['"]([\w.]+)['"]""", src))
        prefixes |= set(re.findall(r"""['"]([\w.]+\.)['"]\s*\+""", src))
        # Ключ не всегда стоит прямо в скобках: в fundamentals.js он лежит
        # в таблице соответствий, а зовётся уже переменной. Считаем любую
        # строку в кавычках, которая ЕСТЬ в словаре, — выдумать такое
        # совпадение случайно нельзя, а без этого девять работающих ключей
        # попадали в «кандидаты на удаление».
        quoted |= set(re.findall(r"""['"]([a-z][\w]*\.[\w.]+)['"]""", src))
    base = sets[langs[0]]
    used |= (quoted & base)
    no_translation = sorted(k for k in used if k not in base)
    pf = tuple(prefixes)
    unused = sorted(k for k in base
                    if k not in used and not (pf and k.startswith(pf)))

    if missing:
        print('НЕ ВО ВСЕХ ЛОКАЛЯХ:')
        for k, absent in missing:
            print(f'  · {k} — нет в {", ".join(absent)}')
    if no_translation:
        print('\nВ РАЗМЕТКЕ, НО НЕТ В СЛОВАРЕ:')
        for k in no_translation:
            print('  ·', k)
    if unused:
        print(f'\nВ СЛОВАРЕ, НО НЕ В РАЗМЕТКЕ ({len(unused)}) — кандидаты на удаление:')
        print('  ' + ', '.join(unused[:40]) + (' …' if len(unused) > 40 else ''))

    if not missing and not no_translation:
        print('Ключи в порядке: три локали совпадают, все ключи разметки переведены.')
        return 0
    return 1


if __name__ == '__main__':
    sys.exit(main())

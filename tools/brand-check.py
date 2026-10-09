#!/usr/bin/env python3
"""Имя компании на сайте — одно и то же везде, и совпадает с entity.json.

Зачем. 09.10.2026 в ветке со страницами о компании приехало имя «SBF
Company»: оно значилось решением владельца и было помечено в спеке как не
подлежащее пересмотру. Решение к тому моменту уже изменилось — бренд
остаётся SBF Consult. Если бы страницы влили как есть, на сайте оказалось
бы два имени одной компании сразу: новые страницы под одним, главная,
архив брифов и страницы реакции под другим.

Для ИИ-видимости это хуже, чем кажется. Модель собирает сущность по
совпадению имени в разных местах; два имени на одном домене она с равным
успехом может счесть двумя разными компаниями или просто не связать ни
с чем.

Отдельная сложность — бренд и юрлицо здесь разные:

    бренд   SBF Consult          — так компания называется для читателя
    юрлицо  «SBF COMPANY» S.R.L. — так она записана в реестре

Поэтому щуп не ищет «нет ли слова Company», а сверяет регистр: заглавными
и в кавычках — юрлицо, его трогать нельзя; в заголовочном регистре —
бренд, и он обязан совпасть с entity.json.

    python3 tools/brand-check.py
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENTITY = ROOT / 'data' / 'entity.json'

# Где смотрим. Архив брифов намеренно не включён: опубликованные выпуски
# не переписываются задним числом, и имя в них — часть того, что по
# ссылке читали.
LOOK = ['index.html', 'risk.html',
        'about', 'team', 'methodology', 'faq',
        'en', 'ro', 'reaction', 'llms.txt']

# Имена, которые могли бы оказаться на сайте вместо нужного.
CANDIDATES = ['SBF Consult', 'SBF Company', 'SBF Capital', 'SBF Group']


def files():
    for name in LOOK:
        p = ROOT / name
        if p.is_file():
            yield p
        elif p.is_dir():
            for q in sorted(p.rglob('*.html')):
                yield q


def main():
    if not ENTITY.exists():
        print('нет %s — сверять не с чем' % ENTITY)
        return 1
    ent = json.loads(ENTITY.read_text(encoding='utf-8'))
    brand = ent['brand']
    legal = ent['legal_name']['short']
    print('бренд по entity.json:  %s' % brand)
    print('юрлицо по entity.json: %s' % legal)
    print()

    # Все написания юрлица — из entity.json, а не из головы. Первая
    # версия щупа знала только форму заглавными и обвинила главную в пяти
    # «чужих именах»: там стоит «SBF Company SRL» — то же юрлицо
    # латиницей, записанное в entity.json как legal_name.latin и живущее
    # на странице с самого первого коммита. Щуп обвинял работающий код.
    legal_forms = sorted(
        {v for v in ent['legal_name'].values() if v} |
        {legal.replace('«', '').replace('»', '')},
        key=len, reverse=True)

    wrong = {}
    seen_legal = 0
    checked = 0
    for p in files():
        txt = p.read_text(encoding='utf-8', errors='replace')
        checked += 1
        seen_legal += sum(txt.count(f) for f in legal_forms)
        # Вырезаем юрлицо до поиска бренда — иначе «SBF Company SRL»
        # попадётся как «SBF Company» со словесной границей перед SRL.
        masked = txt
        for f in legal_forms:
            masked = masked.replace(f, '§')
        for cand in CANDIDATES:
            if cand == brand:
                continue
            hits = len(re.findall(r'\b%s\b' % re.escape(cand), masked))
            if hits:
                wrong.setdefault(cand, []).append(
                    (str(p.relative_to(ROOT)), hits))

    print('проверено файлов: %d' % checked)
    print('упоминаний юрлица «SBF COMPANY» (так и должно быть): %d'
          % seen_legal)
    print()
    if not wrong:
        print('хорошо: на сайте одно имя бренда — %s' % brand)
        return 0
    for cand, places in sorted(wrong.items()):
        total = sum(h for _, h in places)
        print('ЧУЖОЕ ИМЯ «%s» — %d упоминаний в %d файлах:'
              % (cand, total, len(places)))
        for path, h in places[:12]:
            print('   %-44s %d' % (path, h))
        if len(places) > 12:
            print('   … и ещё %d файлов' % (len(places) - 12))
    return 1


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Страницы «как рынок реагирует на публикацию» — из reaction-stats.json.

Зачем эти страницы существуют. Вопрос «насколько сильно двигается рынок,
когда выходит статистика по инфляции» людям действительно интересен, и
почти никто не отвечает на него числом: пишут «данные важны для рынка» и
на этом заканчивают. У SBF есть посчитанный ответ, и это единственный
материал на сайте, который другим выгодно процитировать не из вежливости,
а потому что больше взять негде.

Чем эти страницы отличаются от архива брифов.

  Архив брифов НЕ МЕНЯЕТСЯ: вчерашняя ссылка обязана показывать то, что по
  ней читали вчера. Здесь наоборот — страница ПЕРЕСЧИТЫВАЕТСЯ, потому что
  каждый новый выход события добавляет наблюдение и уточняет оценку. Врать
  об этом нельзя, поэтому на странице стоит дата пересчёта и число
  наблюдений, а в карте сайта — weekly, а не never.

Правила, которые важнее кода.

1. НИ ОДНОГО ЧИСЛА БЕЗ n И ПЕРИОДА. Медиана по девяти наблюдениям и по
   сорока выглядят одинаково, а утверждают разное.
2. РЯДОМ С МЕДИАНОЙ — РАЗБРОС И СЧЁТ «ВЫШЕ ОБЫЧНОГО K ИЗ n». При девяти
   наблюдениях одна медиана создаёт вид точности, которого нет. «Выше
   обычного в 4 случаях из 9» — грубее и честнее.
3. НАПРАВЛЕНИЕ НЕ ПУБЛИКУЕМ. Куда пойдёт цена — при такой выборке
   монетка, а выглядело бы как прогноз. На странице это сказано прямо, а
   не умолчано.
4. СТРАНИЦА ЧИТАЕТСЯ БЕЗ JS. Ради этого всё и делается.
5. ФОРМУЛИРОВКА «ОТНОСИТЕЛЬНО ОБЫЧНОГО ДЛЯ ЭТОГО ВРЕМЕНИ СУТОК», а не
   «сильнее обычного». Решение ФРС выходит в 18:00 UTC, когда Лондон уже
   закрыт и типичный получас особенно тих; «в 19 раз сильнее обычного»
   звучало бы как свойство события, хотя половина эффекта — свойство
   часа. На странице сравнение названо полностью.

    python3 hero-preview/build_reaction_pages.py
"""
import datetime
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'reaction-stats.json'
OUT = ROOT / 'reaction'
SITE = 'https://sbfconsult.com'

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_brief_pages import STYLE, esc, ru_date   # noqa: E402

EXTRA = """
.lead{font-size:19px}
.how{border-left:3px solid var(--line);padding:2px 0 2px 14px;margin:0 0 18px}
.more{list-style:none;padding:0}
.more li{padding:8px 0;border-bottom:1px solid var(--line)}
td.sym{white-space:nowrap}
/* На узком экране заголовки колонок сходились вплотную:
   «ИНСТРУМЕНТМЕДИАНА». Разводим первую колонку от второй. */
th:first-child,td:first-child{padding-right:16px}
/* Подпись под числом — проза, и она обязана переноситься.
   td.n в общем стиле стоит white-space:nowrap, чтобы не разрывались сами
   числа; small это наследовал, строка «7 из 9 раз выше обычного · разброс
   0.09—18.37» вытягивалась в 360 px и таблица вылезала за край экрана на
   66 пикселей. Виновата была не вёрстка таблицы, а унаследованное
   свойство — нашлось только замером ширины каждого элемента. */
td.n small{white-space:normal;text-align:right}
@media (max-width:560px){
  h1{font-size:25px}
  th,td{padding:10px 0}
  td.n{font-size:14px}
}
"""

# Как называется страна в предложении «публикация в ...».
COUNTRY = {'US': 'США', 'EU': 'еврозоне', 'GB': 'Великобритании'}


def plural(n, one, few, many):
    n = abs(n) % 100
    if 11 <= n <= 14:
        return many
    n %= 10
    if n == 1:
        return one
    if 2 <= n <= 4:
        return few
    return many


def cases(n):
    return '%d %s' % (n, plural(n, 'наблюдение', 'наблюдения', 'наблюдений'))


def table(ev, titles):
    """Две колонки, а не четыре.

    Первая версия давала отдельные колонки под число наблюдений и разброс.
    На экране 390 px таблица вылезала за край на 43 пикселя, и колонка
    разброса обрезалась прямо посередине числа. Колонка «Набл.» вдобавок
    дублировала то, что уже написано словами в «7 из 9 раз выше
    обычного». Убрали лишнее — стало и уже, и понятнее."""
    rows = []
    for r in ev['rows']:
        name = titles.get(r['symbol'], r['symbol'])
        rows.append(
            '<tr><td class="sym">%s</td>'
            '<td class="n">%.2f×<small>%d из %d раз выше обычного · '
            'разброс %.2f—%.2f</small></td></tr>'
            % (esc(name), r['median_ratio'], r['above'], r['n'],
               r['min_ratio'], r['max_ratio']))
    return ('<table><thead><tr><th>Инструмент</th>'
            '<th class="n">Медиана к обычному получасу</th>'
            '</tr></thead><tbody>%s</tbody></table>' % ''.join(rows))


def lead_sentence(ev, titles):
    """Одна фраза, которую можно процитировать целиком.

    Берём самый выразительный инструмент — первый в отсортированной
    таблице. Если даже он ниже единицы, так и говорим: событие проходит
    тише обычного получаса. Такой вывод тоже полезен и его точно никто
    не публикует."""
    top = ev['rows'][0]
    name = titles.get(top['symbol'], top['symbol'])
    # Регистр названия не трогаем: «USD/JPY» — тикер, и «usd/jpy» в первой
    # же фразе страницы выглядело как опечатка. Предложение построено так,
    # чтобы имя стояло в нём как есть.
    if top['median_ratio'] >= 1:
        return ('Сильнее всего реагирует %s: медианный ход за первые 30 минут '
                'в %.2f раза больше, чем в обычные дни в это же время суток. '
                'Выше обычного — в %d случаях из %d.'
                % (name, top['median_ratio'], top['above'], top['n']))
    return ('Ни по одному инструменту публикация не даёт хода выше обычного: '
            'даже у инструмента %s медиана — %.2f от типичного получаса '
            'этого времени суток (%s). Событие проходит спокойнее, чем '
            'принято считать.'
            % (name, top['median_ratio'], cases(top['n'])))


def page(ev, meta):
    titles = meta['symbol_titles']
    human_from = ru_date(ev['period'][0])
    human_to = ru_date(ev['period'][1])
    built = ev.get('_built_human', '')
    times = ' или '.join(ev['times_utc'])
    n_min = min(r['n'] for r in ev['rows'])
    n_max = max(r['n'] for r in ev['rows'])

    also = ''
    if ev['also_at_same_time']:
        also = ('<h2>В ту же минуту выходит ещё</h2>'
                '<p>Это один отчёт, а не несколько событий: разделить их '
                'реакцию на получасовых свечах невозможно, и любые цифры '
                '«отдельно по каждому показателю» были бы одним и тем же '
                'измерением под разными именами.</p><p class="note">%s</p>'
                % esc(', '.join(ev['also_at_same_time'])))

    ld = {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        'name': 'Реакция рынка на %s' % ev['title'],
        'description': ('Медианный ход цены за 30 минут после публикации, '
                        'в отношении к типичному получасу того же времени '
                        'суток. %s публикаций, %s — %s.'
                        % (ev['releases'], ev['period'][0], ev['period'][1])),
        'inLanguage': 'ru',
        'isAccessibleForFree': True,
        'url': '%s/reaction/%s.html' % (SITE, ev['slug']),
        'dateModified': meta['built_at'][:10],
        'temporalCoverage': '%s/%s' % (ev['period'][0], ev['period'][1]),
        'variableMeasured': 'отношение 30-минутного хода к типичному '
                            'получасу того же времени суток',
        'creator': {'@type': 'Organization', 'name': 'SBF Consult',
                    'url': SITE + '/',
                    'identifier': '254900BW4MI5M0006I30'},
    }

    return """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Как рынок реагирует на %(title)s — статистика SBF</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(site)s/reaction/%(slug)s.html">
<link rel="icon" href="/assets/logo/logo.svg" type="image/svg+xml">
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>%(style)s%(extra)s</style>
<script type="application/ld+json">%(ld)s</script>
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="/">SBF Consult<span> · реакция рынка</span></a>
</header>

<p class="date">%(releases)d публикаций · %(from)s — %(to)s</p>
<h1>Как рынок реагирует на %(title)s</h1>
<p class="lead">%(lead)s</p>

<h2>По инструментам</h2>
<p class="note">Ход за первые 30 минут после публикации, поделённый на
типичный ход того же получаса суток в обычные дни. Единица означает
«как в любой другой день в это время»; два — «вдвое активнее обычного».
Число безразмерное, поэтому золото и валютные пары можно сравнивать между
собой.</p>
%(table)s
<p class="note">Публикация выходит в %(times)s UTC. Наблюдений от
%(nmin)d до %(nmax)d в зависимости от инструмента: получасовая история у
разных инструментов начинается в разное время, и мы не показываем клетку,
где наблюдений меньше %(mincases)d.</p>

%(also)s

<h2>Как это посчитано</h2>
<div class="how">
<p>Берём получасовую свечу, которая начинается в момент публикации, и
считаем ход как разницу закрытия и открытия по модулю. Делим на медианный
ход <b>того же получаса суток</b> за %(window)d дней до и после события —
порядка сотни обычных дней. Сравнение именно с тем же временем суток
принципиально: 40 пунктов по золоту в 15:30 и в 03:00 — разные события.</p>
<p>Фон считается заново вокруг каждой публикации, а не один раз на всю
историю. Иначе делитель отстаёт от уровня цен, и отношение растёт само по
себе от хода времени, без всякого участия событий.</p>
</div>

<h2>Чего здесь нет</h2>
<p><b>Направления.</b> Куда пойдёт цена — вверх или вниз — мы не
публикуем. При таком числе наблюдений доля «вверх» неотличима от монетки,
а на странице выглядела бы как прогноз. У нас уже измерено на 90 тысячах
сделок, что у свечных паттернов направленного преимущества нет; выдавать
шум за сигнал тем более не будем.</p>
<p><b>Обещаний.</b> Медиана описывает прошлые выходы этого события, а не
следующий. Разброс в таблице показывает, насколько по-разному они
проходили: у большинства событий есть и почти незаметные выходы, и
десятикратные.</p>

<h2>Другие события</h2>
<ul class="more">%(more)s</ul>

<p><a href="/reaction/">Все события</a> ·
<a href="/brief/">Утренние брифы</a> ·
<a href="/">О компании</a> ·
<a href="https://lp.sbfconsult.com/">Терминал</a></p>

<footer>
<p class="note">Пересчитано %(built)s. Страница обновляется: каждая новая
публикация события добавляет наблюдение, поэтому числа здесь со временем
уточняются — в отличие от <a href="/brief/">архива брифов</a>, который
фиксирует конкретный день и не переписывается.</p>
<p><b>Это не инвестиционная рекомендация.</b> Материал носит
информационный характер. Историческая статистика не гарантирует будущих
результатов. Торговля CFD и маржинальными инструментами сопряжена с
высоким риском быстрой потери средств.</p>
<p>«SBF COMPANY» S.R.L., Str. Alexei Sciusev 47, Кишинёв, Молдова.
LEI 254900BW4MI5M0006I30. SBF не принимает средства клиентов и не хранит
их: счёт открывается у партнёра.
<a href="/risk.html">Предупреждение о рисках</a></p>
</footer>
</div>
</body>
</html>
""" % {
        'title': esc(ev['title']), 'slug': esc(ev['slug']), 'site': SITE,
        'style': STYLE, 'extra': EXTRA,
        'ld': json.dumps(ld, ensure_ascii=False),
        'desc': esc('Медианный ход за 30 минут после публикации по '
                    '%d выходам события с %s по %s. С числом наблюдений и '
                    'разбросом.' % (ev['releases'], ev['period'][0],
                                    ev['period'][1])),
        'releases': ev['releases'],
        'from': esc(human_from), 'to': esc(human_to),
        'lead': esc(lead_sentence(ev, titles)),
        'table': table(ev, titles),
        'times': esc(times), 'nmin': n_min, 'nmax': n_max,
        'mincases': meta['min_cases'],
        'also': also,
        'window': meta['baseline']['window_days'],
        'more': ev['_more'], 'built': esc(built),
    }


def index(events, meta):
    rows = []
    for ev in sorted(events, key=lambda e: -e['rows'][0]['median_ratio']):
        top = ev['rows'][0]
        name = meta['symbol_titles'].get(top['symbol'], top['symbol'])
        rows.append(
            '<li><a href="/reaction/%s.html">%s</a><br>'
            '<span class="note">%s — %.2f× к обычному получасу, %s</span></li>'
            % (esc(ev['slug']), esc(ev['title']), esc(name),
               top['median_ratio'], esc(cases(top['n']))))
    return """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Реакция рынка на экономические события — измерения SBF</title>
<meta name="description" content="Насколько сильно двигается цена в первые 30 минут после публикации статистики: медиана, число наблюдений и разброс по каждому событию и инструменту.">
<link rel="canonical" href="%(site)s/reaction/">
<link rel="icon" href="/assets/logo/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>%(style)s%(extra)s</style>
</head>
<body>
<div class="wrap">
<header><a class="brand" href="/">SBF Consult<span> · реакция рынка</span></a></header>
<h1>Реакция рынка на экономические события</h1>
<p class="lead">На вопрос «насколько двигается рынок, когда выходит
статистика» обычно отвечают словами «данные важны для рынка». Здесь —
числом: медианный ход за первые 30 минут после публикации, в отношении к
типичному получасу того же времени суток.</p>
<p class="note">Рядом с каждым числом стоит, по скольким публикациям оно
посчитано, и насколько по-разному они проходили. Направление цены мы не
публикуем: при таком числе наблюдений это монетка. Календарь, из которого
берутся даты публикаций, начинается %(cal_from)s — поэтому у месячных
событий наблюдений меньше десятка, и это написано на каждой странице.</p>

<ul class="more">%(rows)s</ul>

<h2>Чего в списке нет</h2>
<p class="note">Решения ЕЦБ. Ставку объявляют в 12:15 UTC — ровно посередине
получасовой свечи, и окно измерения не совпало бы с подписью «получас
после публикации»: свеча содержала бы пятнадцать минут до объявления.
Лучше не публиковать, чем подписать измерение неверно.</p>

<p><a href="/brief/">Утренние брифы</a> · <a href="/">О компании</a> ·
<a href="https://lp.sbfconsult.com/">Терминал</a></p>
<footer>
<p><b>Это не инвестиционная рекомендация.</b> Материалы носят
информационный характер. Историческая статистика не гарантирует будущих
результатов.</p>
<p>«SBF COMPANY» S.R.L., Кишинёв, Молдова. LEI 254900BW4MI5M0006I30.
<a href="/risk.html">Предупреждение о рисках</a></p>
</footer>
</div>
</body>
</html>
""" % {'site': SITE, 'style': STYLE, 'extra': EXTRA,
       'rows': ''.join(rows), 'cal_from': esc(ru_date(meta['calendar_from']))}


def main():
    if not SRC.exists():
        print('нет %s — сначала build_reaction_stats.py' % SRC.name)
        return 1
    meta = json.loads(SRC.read_text(encoding='utf-8'))
    events = meta['events']
    if not events:
        print('в файле нет событий — страницы не пишем')
        return 1

    OUT.mkdir(exist_ok=True)
    built_human = ru_date(meta['built_at'][:10])

    for ev in events:
        ev['_built_human'] = built_human
        # Перекрёстные ссылки: у каждой страницы четыре соседа. Ассистент
        # и человек попадают на одну страницу, а уходить должны не в
        # тупик.
        sib = [o for o in events if o['slug'] != ev['slug']]
        sib.sort(key=lambda o: -o['rows'][0]['median_ratio'])
        ev['_more'] = ''.join(
            '<li><a href="/reaction/%s.html">%s</a> '
            '<span class="note">— %.2f× по %s</span></li>'
            % (esc(o['slug']), esc(o['title']), o['rows'][0]['median_ratio'],
               esc(meta['symbol_titles'].get(o['rows'][0]['symbol'],
                                             o['rows'][0]['symbol'])))
            for o in sib[:5])

    for ev in events:
        (OUT / ('%s.html' % ev['slug'])).write_text(page(ev, meta),
                                                    encoding='utf-8')
    (OUT / 'index.html').write_text(index(events, meta), encoding='utf-8')
    print('страниц реакции: %d + оглавление' % len(events))

    import build_sitemap
    n = build_sitemap.write()
    print('в карте сайта адресов: %d' % n)
    return 0


if __name__ == '__main__':
    sys.exit(main())

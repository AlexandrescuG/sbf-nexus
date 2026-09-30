#!/usr/bin/env python3
"""Постоянные страницы утреннего брифа.

Зачем. Бриф — единственное, что SBF производит каждый день и что можно
процитировать: дата, числа, посчитанная прошлая реакция рынка и —
редкость — явная пометка, откуда факт и насколько он проверен. До сих
пор он жил строкой на первом экране и JSON-файлом, который переписывает
следующий прогон крона. Сослаться было не на что ни человеку, ни
ассистенту: адрес есть, а завтра по нему другой текст.

Здесь у каждого утра появляется свой адрес с датой внутри.

Три правила, которые важнее кода.

1. ПЕРВАЯ ЗАПИСЬ ЗА ДАТУ ПОБЕЖДАЕТ. brief_today.json в течение дня
   меняется — котировки и контекст обновляются. Если переписывать
   страницу, архив перестанет быть архивом: вчерашняя ссылка покажет не
   то, что по ней читали. Перезапись только явным --force.

2. НИЧЕГО СВЕРХ ИСТОЧНИКА. На странице только то, что есть в брифе, и с
   теми же пометками достоверности. Ни одной фразы «мы считаем, что» —
   их в источнике нет.

3. СТРАНИЦА ЧИТАЕТСЯ БЕЗ JS. Ради этого всё и делается: краулеры
   скрипты почти никогда не исполняют. Никакого JS на странице нет
   вообще, стиль внутри файла.

    python3 hero-preview/build_brief_pages.py
    python3 hero-preview/build_brief_pages.py --force     # переписать сегодня
    python3 hero-preview/build_brief_pages.py --date 2026-09-16
"""
import datetime
import re
import html
import json
import pathlib
import sys

SRC = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel/web/data')
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'brief'
SITE = 'https://sbfconsult.com'

# Подписи уровней доверия. Метка приходит из market_intel и означает,
# ОТКУДА факт. Незнакомую метку не показываем вовсе: подписать её наугад
# значило бы соврать ровно там, ради чего блок и сделан.
TIERS = {
    'quotes': ('Из котировок', 'Цифры, которые можно посмотреть самому'),
    'media': ('Из СМИ', 'Со ссылкой на издание — проверяемо, '
                        'но это чужое утверждение'),
    'social_unverified': ('Из соцсетей, не проверено',
                          'Показываем, потому что рынок на это реагирует. '
                          'Не подтверждаем'),
}

MACRO_ROWS = [
    ('DFF', 'Ставка ФРС', '%'),
    ('CPIAUCSL', 'Потребительские цены США', None),
    ('UNRATE', 'Безработица в США', '%'),
    ('T10Y2Y', 'Спред 10 лет минус 2 года', '%'),
    ('T10YIE', 'Ожидаемая инфляция на 10 лет', '%'),
    ('DCOILWTICO', 'Нефть WTI', '$'),
    ('DTWEXBGS', 'Торгово-взвешенный доллар', None),
]

MONTHS = ('января февраля марта апреля мая июня июля августа сентября '
          'октября ноября декабря').split()

# Заглушки вместо названия показателя — те же, что отбрасывает build_feed.py
PLACEHOLDER = {'calendar', 'event', 'holiday', ''}

STYLE = """
:root { --ink:#241f18; --dim:#5f564a; --gold:#7c6110; --line:rgba(154,123,30,.2) }
*{box-sizing:border-box} body{margin:0;background:#FBF6EF;color:var(--ink);
 font:400 17px/1.6 'Archivo',system-ui,-apple-system,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:32px 20px 72px}
a{color:var(--gold);text-underline-offset:3px}
header{border-bottom:1px solid var(--line);padding-bottom:18px;margin-bottom:26px}
.brand{font:600 13px/1 'JetBrains Mono',ui-monospace,monospace;
 letter-spacing:.14em;text-transform:uppercase;text-decoration:none;color:var(--ink)}
.brand span{color:var(--gold)}
h1{font:400 30px/1.2 'Instrument Serif',Georgia,serif;margin:.5em 0 .2em}
.date{font:500 12px/1.6 'JetBrains Mono',ui-monospace,monospace;
 letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin:0}
h2{font:400 22px/1.25 'Instrument Serif',Georgia,serif;margin:1.8em 0 .5em}
.tier{border-left:3px solid var(--gold);padding:6px 0 6px 14px;margin:0 0 16px}
.tier[data-t="media"]{border-left-color:rgba(154,123,30,.55)}
.tier[data-t="social_unverified"]{border-left-color:rgba(154,123,30,.28)}
.tier b{display:block;font:500 10px/1.6 'JetBrains Mono',ui-monospace,monospace;
 letter-spacing:.16em;text-transform:uppercase;color:var(--gold)}
.tier i{display:block;font-style:normal;font-size:13px;color:var(--dim)}
.tier p{margin:4px 0 0}
table{width:100%;border-collapse:collapse;margin:0 0 1em}
th,td{text-align:left;padding:8px 0;border-bottom:1px solid var(--line);
 vertical-align:top}
th{font:500 10px/1.6 'JetBrains Mono',ui-monospace,monospace;
 letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
td.n{text-align:right;white-space:nowrap;
 font:500 15px/1.4 'JetBrains Mono',ui-monospace,monospace}
td small{display:block;color:var(--dim);font-size:13px}
.note{font-size:14px;color:var(--dim)}
footer{margin-top:40px;padding-top:18px;border-top:1px solid var(--line);
 font-size:13px;color:var(--dim)}
"""


def esc(s):
    return html.escape(str(s if s is not None else ''))


def ru_date(iso):
    y, m, d = (int(x) for x in iso.split('-'))
    return '%d %s %d' % (d, MONTHS[m - 1], y)


def num(v, unit=None):
    if v is None:
        return ''
    s = ('%.2f' % v).rstrip('0').rstrip('.').replace('.', ',')
    if unit == '$':
        return '$' + s
    return s + (' ' + unit if unit else '')


def load(name):
    p = SRC / name
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except Exception as exc:
        print('  %s не прочитан: %s' % (name, exc))
        return None


def macro_block(macro):
    """Таблица макро-рядов. Даты у рядов свои: FRED публикует их в разное
    время, и «ставка на 15-е, инфляция на 1-е» — это правда, а не сбой."""
    if not macro:
        return ''
    rows = []
    for key, label, unit in MACRO_ROWS:
        r = macro.get(key)
        if not isinstance(r, dict) or r.get('value') is None:
            continue
        val, delta = r['value'], r.get('delta')
        span = ''
        if key == 'CPIAUCSL' and delta:
            # Индекс сам по себе (334,131) человеку не говорит ничего —
            # показываем шаг к прошлому значению в процентах.
            base = val - delta
            if base:
                val, unit, span = round(delta / base * 100, 2), '%', ' за месяц'
                delta = None
        step = ''
        if delta is not None:
            step = ('без изменения' if delta == 0
                    else ('↑ ' if delta > 0 else '↓ ') + num(abs(delta), unit)
                         + ' к прошлому значению')
        rows.append(
            '<tr><td>%s<small>%s%s</small></td><td class="n">%s'
            '<small>%s</small></td></tr>'
            % (esc(label), esc(step), esc(span), esc(num(val, unit)),
               esc(r.get('date') or '')))
    if not rows:
        return ''
    return ('<h2>На чём стоит рынок</h2><table><tr><th>ряд</th>'
            '<th style="text-align:right">значение</th></tr>'
            + ''.join(rows) + '</table>'
            '<p class="note">Данные ФРБ Сент-Луиса (FRED). '
            'Мы их показываем и объясняем, но рекомендаций по ним не даём.</p>')


def calendar_block(events):
    """События дня с посчитанной прошлой реакцией.

    Число наблюдений печатается ВСЕГДА рядом с медианой: медиана по
    четырём случаям и по сорока выглядят одинаково, а утверждают разное.
    Меньше трёх наблюдений — пишем об этом прямо."""
    rows = []
    for e in events or []:
        name = (e.get('indicator') or e.get('title') or '').strip()
        # «Calendar», «Event», «Holiday» — не показатели, а заглушки в
        # источнике. build_feed.py отбрасывает их у себя, здесь то же
        # самое: строка «Calendar · медиана хода 0,06» не значит ничего.
        if name.lower() in PLACEHOLDER:
            continue
        pr = e.get('past_reaction') or {}
        med, n = pr.get('median_atr_30m'), pr.get('n') or 0
        if med is not None and n:
            # Это ДОЛЯ ДНЕВНОГО ATR инструмента, а не проценты цены.
            # Так и написано в event_reactions_job.py: «0.31 ATR за 30
            # мин, а не сырые пункты». Подписать это процентами — значит
            # выпустить в мир число, завышенное в сотню раз: 0,104
            # превращалось в «10,4% за полчаса», чего не бывает вовсе.
            past = ('медиана хода за 30 минут: %s дневного ATR, '
                    'наблюдений: %d' % (num(med), n))
            if n < 5:
                past += ' — наблюдений мало для медианы'
        else:
            past = 'прошлых выходов пока мало'
        when = (e.get('ts_utc') or '')[11:16]
        fc = ''
        if e.get('forecast') is not None and e.get('previous') is not None:
            fc = ' · прогноз %s, прошлое %s' % (e['forecast'], e['previous'])
        rows.append('<tr><td>%s<small>%s%s</small></td>'
                    '<td class="n">%s<small>%s</small></td></tr>'
                    % (esc(name), esc(past), esc(fc), esc(when + ' UTC'),
                       esc(e.get('country') or '')))
    if not rows:
        return ''
    return ('<h2>События дня и как рынок ходил на прошлых</h2>'
            '<table><tr><th>событие</th>'
            '<th style="text-align:right">время</th></tr>'
            + ''.join(rows) + '</table>')


def movers_block(movers):
    """Инструменты, прошедшие день заметно шире обычного."""
    rows = []
    for side, mark in (('up', '↑'), ('down', '↓')):
        for m in (movers or {}).get(side) or []:
            ev = (m.get('event') or {}).get('title')
            ratio = m.get('ratio')
            extra = []
            if ratio:
                extra.append('в %s раза шире обычного дневного хода'
                             % num(ratio))
            if ev:
                extra.append('рядом событие: ' + ev)
            rows.append('<tr><td>%s<small>%s</small></td>'
                        '<td class="n">%s %s%%<small>%s</small></td></tr>'
                        % (esc(m.get('symbol') or ''), esc(' · '.join(extra)),
                           mark, esc(num(abs(m.get('chg_pct') or 0))),
                           esc(m.get('bar_date') or '')))
    if not rows:
        return ''
    return ('<h2>Кто ходил шире обычного</h2><table><tr><th>инструмент</th>'
            '<th style="text-align:right">за день</th></tr>'
            + ''.join(rows) + '</table>')


# Слова, которыми модель сама помечает, что источник не проверен. Ищем их
# в начале заголовка: «Соцсети: ФРС подняла ставку…» — именно так выглядел
# выпуск 17.09.
SOCIAL_MARKERS = ('соцсет', 'в соцсетях', 'слухи', 'ходят слухи',
                  'неподтверж', 'twitter', 'телеграм-канал', 'x пишет')


def quotes_headline(brief, human):
    """Заголовок из того, что можно посмотреть самому.

    Берём текст уровня quotes — это котировки, их видно на любом
    терминале. Если его нет, собираем из движений; если нет и их, остаётся
    дата. Ничего не выдумываем: все три источника уже есть в выпуске."""
    for c in brief.get('context') or []:
        if c.get('confidence') == 'quotes' and (c.get('text') or '').strip():
            t = ' '.join(c['text'].split())
            # Режем по границе предложения, а не по символу: обрубок
            # «золото 4 277,70 (+0,1» хуже короткого заголовка.
            if len(t) > 110:
                cut = t[:110].rsplit('.', 1)[0]
                t = (cut + '.') if len(cut) > 40 else t[:110].rsplit(' ', 1)[0]
            return t
    mov = brief.get('movers') or {}
    names = [m.get('symbol') or m.get('name') for m in
             (mov.get('up') or []) + (mov.get('down') or [])]
    names = [n for n in names if n][:4]
    if names:
        return 'Шире обычного ходили ' + ', '.join(names) + ' — ' + human
    return 'Утренние числа — %s' % human


def safe_headline(brief, human):
    """(заголовок, причина подмены). Причина пустая — заголовок свой.

    Зачем. H1 и schema.org headline — ровно то, что цитируют: их берут
    и поисковик, и ассистент, и превью в мессенджере. Утверждение,
    источник которого мы не подтверждали, там стоять не должно, даже если
    в самом разборе оно честно помечено «не проверено».

    Выпуск 17.09 показал обе стороны этого правила. Заголовок гласил
    «Соцсети: ФРС подняла ставку до 3,75–4%», и ставку ФРС действительно
    подняла — 16.09, решение опубликовано на federalreserve.gov, это была
    ошибка разметки, а не факта. То есть правило иногда снимает с витрины
    верное утверждение. Мы всё равно его применяем: страница не умеет
    отличить верное непроверенное от неверного непроверенного, а правило
    о происхождении проверяемо. Сам разбор при этом никуда не девается —
    он ниже, с исходной пометкой.

    Совпадение с пунктом social_unverified проверяем отдельно от меток:
    17.09 непроверенным пунктом был вывод войск из Ирана, а не ставка, и
    одного сравнения текстов не хватило бы."""
    head = ' '.join((brief.get('headline') or '').split())
    if not head:
        return quotes_headline(brief, human), 'пусто'

    low = head.lower()
    if any(low.startswith(m) for m in SOCIAL_MARKERS) or \
            any(m in low[:40] for m in SOCIAL_MARKERS):
        return quotes_headline(brief, human), 'помечен как соцсети'

    for c in brief.get('context') or []:
        if c.get('confidence') != 'social_unverified':
            continue
        txt = ' '.join((c.get('text') or '').split()).lower()
        if not txt:
            continue
        # Совпадение по существу, а не по символам: берём длинные слова
        # заголовка и смотрим, сколько их в непроверенном пункте.
        words = [w.strip('.,;:«»"()') for w in low.split() if len(w) > 5]
        if words and sum(1 for w in words if w in txt) >= max(2, len(words) // 2):
            return quotes_headline(brief, human), 'совпал с непроверенным'
    return head, ''


def page(date, brief, macro):
    ctx = []
    for c in brief.get('context') or []:
        t = (c.get('text') or '').strip()
        conf = c.get('confidence')
        if not t or conf not in TIERS:
            continue
        title, why = TIERS[conf]
        ctx.append('<div class="tier" data-t="%s"><b>%s</b><i>%s</i>'
                   '<p>%s</p></div>' % (esc(conf), esc(title), esc(why), esc(t)))
    human = ru_date(date)
    head, why_replaced = safe_headline(brief, human)
    degraded = why_replaced == 'пусто'

    lead = ('<p class="note">Разбор сделан утром %s и с тех пор не менялся. '
            'Страница — архивная копия: числа в ней относятся к этой дате, '
            'а не к сегодняшнему рынку.</p>' % esc(human))
    if degraded:
        lead = ('<p class="note"><b>В этот день комментарий не собрался.</b> '
                'Календарь, движения и выбросы считаются без участия '
                'языковой модели, поэтому они на месте и относятся к '
                '%s. Словесного разбора и разметки по уровням доверия за '
                'этот день нет — и мы не подставляем на их место ничего '
                'написанного задним числом.</p>' % esc(human))
    elif why_replaced:
        lead = ('<p class="note"><b>Заголовок собран из котировок.</b> '
                'Разбор за %s опирался на сообщение, источник которого мы '
                'не подтверждали, — такое утверждение не выносится в '
                'заголовок страницы. Сам разбор ниже приведён полностью и '
                'с исходной пометкой достоверности.</p>' % esc(human))

    ld = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        'headline': head[:110] or ('Утренний бриф SBF, ' + human),
        'datePublished': brief.get('generated_at') or date,
        'dateModified': brief.get('generated_at') or date,
        'inLanguage': 'ru',
        'isAccessibleForFree': True,
        'url': '%s/brief/%s.html' % (SITE, date),
        'author': {'@type': 'Organization', 'name': 'SBF Consult',
                   'url': SITE + '/'},
        'publisher': {'@type': 'Organization', 'name': 'SBF Consult',
                      'identifier': '254900BW4MI5M0006I30'},
    }

    return """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Утренний бриф SBF — %(human)s</title>
<meta name="description" content="%(desc)s">
<link rel="canonical" href="%(site)s/brief/%(date)s.html">
<link rel="icon" href="/assets/logo/logo.svg" type="image/svg+xml">
<meta name="robots" content="index, follow">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>%(style)s</style>
<script type="application/ld+json">%(ld)s</script>
</head>
<body>
<div class="wrap">
<header>
  <a class="brand" href="/">SBF Consult<span> · бриф</span></a>
</header>

<p class="date">Утро %(human)s</p>
<h1>%(head)s</h1>
%(lead)s

<h2>Что известно — и насколько этому можно верить</h2>
<p class="note">Поток разложен по источнику: что видно прямо в котировках,
что сказали СМИ, а что пишут соцсети и мы не проверяли.</p>
%(ctx)s

%(cal)s
%(mov)s
%(macro)s

<p><a href="/brief/">Все выпуски</a> · <a href="/">О компании</a> ·
<a href="https://lp.sbfconsult.com/">Терминал</a></p>

<footer>
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
        'human': esc(human), 'date': esc(date), 'site': SITE,
        'head': esc(head) or 'Утренний бриф', 'lead': lead,
        'desc': esc((head or 'Утренний разбор рынков SBF')[:180]),
        'style': STYLE, 'ld': json.dumps(ld, ensure_ascii=False),
        'ctx': ''.join(ctx) or '<p class="note">Разбор за этот день '
                                'не сохранился.</p>',
        'cal': calendar_block(brief.get('calendar')),
        'mov': movers_block(brief.get('movers')),
        'macro': macro_block(macro),
    }


def read_head(path):
    """Дата и заголовок уже записанной страницы — для оглавления.

    Читаем готовый файл, а не пересобираем из источника: источник за
    прошлые дни уже перезаписан, и единственная правда о том, что было
    опубликовано, лежит в самой странице."""
    txt = path.read_text(encoding='utf-8', errors='replace')
    m = re.search(r'<h1>(.*?)</h1>', txt, re.S)
    head = re.sub(r'<[^>]+>', '', m.group(1)).strip() if m else ''
    return html.unescape(head)


def build_index():
    """Оглавление архива — обычная страница со списком, без JS."""
    pages = sorted((p for p in OUT.glob('*.html') if p.stem != 'index'),
                   key=lambda p: p.stem, reverse=True)
    rows = []
    for p in pages:
        rows.append('<li><a href="/brief/%s.html">%s</a> — %s</li>'
                    % (esc(p.stem), esc(ru_date(p.stem)), esc(read_head(p))))
    body = ('<ul class="arch">%s</ul>' % ''.join(rows)) if rows else \
        '<p class="note">Выпусков пока нет.</p>'
    (OUT / 'index.html').write_text("""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Утренние брифы SBF — архив</title>
<meta name="description" content="Архив утренних разборов рынка SBF Consult: дата, числа, источники и посчитанная реакция рынка на прошлые публикации.">
<link rel="canonical" href="%(site)s/brief/">
<link rel="icon" href="/assets/logo/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Archivo:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>%(style)s .arch{list-style:none;padding:0}
.arch li{padding:10px 0;border-bottom:1px solid var(--line)}
.arch a{font-weight:500;white-space:nowrap}</style>
</head>
<body>
<div class="wrap">
<header><a class="brand" href="/">SBF Consult<span> · брифы</span></a></header>
<h1>Утренние брифы</h1>
<p class="note">Каждое утро до открытия европейской сессии. У каждого
выпуска свой адрес и своя дата: страницы не переписываются задним
числом, поэтому на них можно ссылаться. Разбор выходит на русском.</p>
%(body)s
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
""" % {'site': SITE, 'style': STYLE, 'body': body}, encoding='utf-8')
    return [p.stem for p in pages]


def build_sitemap(dates):
    """Карта сайта живёт в build_sitemap.py и собирается сканированием диска.

    Здесь она собиралась целиком, пока архив брифов был единственным
    источником генерируемых страниц. Появился второй (реакция на события),
    и писать один файл из двух мест стало ловушкой: прогнавшийся вторым
    вычеркнул бы страницы первого — молча, оставив валидный XML без
    половины сайта. Теперь источник правды — каталог, а не память скрипта,
    поэтому порядок прогонов больше не важен."""
    import build_sitemap as sm
    return sm.write()


def main():
    force = '--force' in sys.argv
    want = None
    if '--date' in sys.argv:
        want = sys.argv[sys.argv.index('--date') + 1]

    brief = load('brief_today.json')
    if not brief:
        print('брифа нет вовсе — страницу не пишем')
        return 1
    date = want or brief.get('date')
    if not date:
        print('у брифа нет даты — страницу не пишем')
        return 1

    # Заголовок и уровни доверия пишет модель; календарь, движения,
    # выбросы и макро считает обычный Python. Раньше здесь стояло
    # `not brief.get('headline') → return 1`, то есть отсутствие одного
    # блока из модели выбрасывало и все остальные, посчитанные без неё.
    #
    # Ровно этим 17–29.09 конвейер брифинга и встал на двенадцать дней:
    # claude -p отвечал отказом доступа, run_daily.sh падал целиком. Тот
    # же дефект оказался и здесь, этажом ниже: двенадцать дней с готовым
    # календарём и посчитанной прошлой реакцией не попали в архив — не
    # потому что их не было, а потому что к ним не написали фразу.
    #
    # Теперь страница выходит на том, что есть. Отсутствие разбора не
    # прячем: на странице сказано прямо, что в этот день комментарий не
    # собрался. Пустую страницу всё же не пишем — если нет ни календаря,
    # ни движений, ни выбросов, публиковать нечего.
    degraded = not (brief.get('headline') or '').strip()
    has_data = any(brief.get(k) for k in ('calendar', 'movers', 'outliers'))
    if degraded and not has_data:
        print('в брифе нет ни заголовка, ни данных — страницу не пишем')
        return 1

    OUT.mkdir(exist_ok=True)
    target = OUT / ('%s.html' % date)
    wrote_today = False
    if target.exists() and not force:
        # Не ошибка и не повод шуметь: за день сборка зовётся десятки раз.
        print('%s уже есть — архив не переписываем (--force, если надо)'
              % target.name)
    else:
        wrote_today = True
        macro = load('macro.json') or {}
        target.write_text(page(date, brief, macro), encoding='utf-8')
        if degraded:
            print('%s: БЕЗ РАЗБОРА — модель не написала заголовок, '
                  'страница вышла на числах' % target.name)
        print('%s: %d КБ, уровней доверия %d, событий %d, макро-рядов %d'
              % (target.name, len(target.read_text(encoding='utf-8')) // 1024,
                 len([c for c in (brief.get('context') or [])
                      if c.get('confidence') in TIERS]),
                 len([e for e in (brief.get('calendar') or [])
                      if (e.get('indicator') or e.get('title') or '').strip()
                      .lower() not in PLACEHOLDER]),
                 sum(1 for k, _, _ in MACRO_ROWS
                     if isinstance(macro.get(k), dict))))

    # Оглавление и карту пересобираем всегда: даже если страница за
    # сегодня уже была, список мог отстать от каталога.
    dates = build_index()
    n = build_sitemap(dates)
    print('архив: %d выпусков, в карте сайта %d адресов' % (len(dates), n))

    # Поисковикам сообщаем только о НОВОЙ странице. Скрипт помнит
    # отправленное и повторов не шлёт, но звать его на каждом из десятков
    # дневных прогонов всё равно незачем.
    if wrote_today:
        import build_sitemap as sm
        sm.ping_indexnow(['%s/brief/%s.html' % (SITE, date),
                          '%s/brief/' % SITE])

    # Наблюдатель за пропусками. Стоит после публикации и ничего не
    # поднимает наверх: если он сам сломается, выпуск всё равно вышел.
    import brief_gap
    brief_gap.check()
    return 0


if __name__ == '__main__':
    sys.exit(main())

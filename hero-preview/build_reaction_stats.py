#!/usr/bin/env python3
"""Реакция рынка на публикацию события — считаем сами, в reaction-stats.json.

Зачем не брать готовое. В bot.db лежит таблица event_reaction_stats, её
пишет market_intel/event_reactions_job.py, и боту она годится. Для
публикации — нет, по трём независимым причинам, каждая из которых ломает
само число:

1. ОДИН ТИП СОБЫТИЯ — МНОГО СТРАН. В event_type='cpi' лежат публикации
   США, Австралии, Японии, Канады и еврозоны вперемешку (70 релизов), в
   'inflation rate' — сотня по десятку стран. Реакция EURUSD на
   австралийский CPI и на американский — разные величины, а в таблице
   они усреднены в одну. Считаем по (страна, событие, инструмент).

2. ОДИН РЕЛИЗ ВЫХОДИТ ПОД СЕМЬЮ ИМЕНАМИ. nfp, unemployment_rate,
   average hourly earnings, government payrolls, manufacturing payrolls,
   average weekly hours и labor force participation rate публикуются в
   одну минуту — это один отчёт по занятости. В таблице у них побайтово
   одинаковые цифры, то есть семь «находок» из одного измерения.
   Схлопываем по времени публикации внутри страны; остальные имена не
   выбрасываем, а показываем как «выходит одновременно с» — это само по
   себе полезный факт, которого никто не публикует.

3. ФОН ВОСЬМИЛЕТНИЙ И В АБСОЛЮТНЫХ ПУНКТАХ. baseline_ratio_30m делит
   сегодняшний ход на median_pts из hourly_profile.json, усреднённый по
   ВСЕМ периодам: у золота это два числа на весь файл (20.78 для часа 13
   и 14.60 для часа 12). Цена золота за восемь лет выросла, ход вырос,
   делитель остался старым — и отношение растёт само от хода времени, без
   всякого участия событий. Числитель и знаменатель разными линейками.
   Здесь фон считается своим: медиана |close-open| по ТОМУ ЖЕ получасу
   суток в окне ±90 дней вокруг события, порядка 126 наблюдений. После
   замены NFP×золото стало 4.52× вместо 2.83×, CPI×золото 0.89× вместо
   0.52× — то есть прежние числа врали в обе стороны.

Что публикуем и чего не публикуем.

  * Отношение к типичному получасу — главное число: оно безразмерно и
    поэтому сравнимо между инструментами, в отличие от «пунктов».
  * Рядом с медианой всегда n, период выборки и «выше обычного в K
    случаях из n». Медиана по девяти наблюдениям — слабая оценка, и
    честнее показать разброс, чем одно число с видом точности.
  * НАПРАВЛЕНИЕ НЕ ПУБЛИКУЕМ ВОВСЕ. При девяти наблюдениях доля
    «вверх/вниз» неотличима от монетки, а выглядит как прогноз. У SBF уже
    измерено на 90 тысячах сделок, что направленного преимущества у
    свечных паттернов нет; выдавать здесь шум за сигнал тем более нельзя.
  * Управляемые курсы исключены. У USDCNY типичный получас почти нулевой,
    поэтому любой ход даёт кратность: он «реагировал» на настроения
    малого бизнеса Канады в 2.11 раза. Это свойство делителя, не события.

    python3 hero-preview/build_reaction_stats.py
    python3 hero-preview/build_reaction_stats.py --scan      # что доступно
"""
import argparse
import datetime
import json
import pathlib
import sqlite3
import statistics
import sys
from collections import defaultdict

MI = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel')
DB = pathlib.Path('/mnt/sbfdata/sbf-platform/SBFAcademy_bot/bot.db')
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'reaction-stats.json'

# Имя инструмента на витрине → имя в price_bars. Два разных пространства
# имён, золото в них называется по-разному.
PRICE_SYMBOL = {'GOLD': 'XAUUSD'}

# Масштаб пункта — только для показа абсолютного хода. Для отношения к
# фону масштаб сокращается и не важен, но 0.0006 на экране выглядит как
# «0.00», поэтому у валютных пар ход переводим в пипсы.
PIP_SCALE = {
    'EURUSD': 10000, 'GBPUSD': 10000, 'USDJPY': 100, 'EURGBP': 10000,
    'USDCAD': 10000, 'USDCHF': 10000, 'AUDUSD': 10000, 'NZDUSD': 10000,
    'USDMXN': 10000, 'USDZAR': 10000, 'USDPLN': 10000, 'USDTRY': 10000,
}

# Инструменты витрины. Управляемые и привязанные курсы (USDCNY, USDRUB,
# USDKZT, USDAED) исключены намеренно: у них типичный получас почти
# нулевой, и отношение к фону измеряет их режим котирования, а не событие.
SYMBOLS = [
    ('GOLD',   'Золото'),
    ('EURUSD', 'EUR/USD'),
    ('USDJPY', 'USD/JPY'),
    ('GBPUSD', 'GBP/USD'),
    ('SPX',    'S&P 500'),
    ('NASDAQ', 'Nasdaq 100'),
    ('DJI',    'Dow Jones'),
    ('WTI',    'Нефть WTI'),
    ('SILVER', 'Серебро'),
    ('DXY',    'Индекс доллара'),
    ('AUDUSD', 'AUD/USD'),
    ('USDCAD', 'USD/CAD'),
    ('USDCHF', 'USD/CHF'),
    ('NZDUSD', 'NZD/USD'),
    ('EURGBP', 'EUR/GBP'),
    ('USDZAR', 'USD/ZAR'),
    ('BTC',    'Биткоин'),
]

# Витрина. Ключ — (страна, event_type) из normalize_event_type, значение —
# адрес страницы и человеческое имя. Список курируемый, а не автоматический:
# из 569 пар «страна × событие» большинство — аукционы векселей и индексы
# ипотечных заявок, про которые никто не спрашивает. Здесь только то, что
# люди действительно спрашивают у ассистента.
EVENTS = [
    ('US', 'nfp', 'us-nfp',
     'Отчёт по занятости в США (Non-Farm Payrolls)'),
    ('US', 'inflation rate', 'us-cpi',
     'Инфляция в США (CPI)'),
    ('US', 'rate', 'us-fed-rate',
     'Решение ФРС по ставке'),
    ('US', 'producer prices', 'us-ppi',
     'Цены производителей в США (PPI)'),
    ('US', 'retail sales mom', 'us-retail-sales',
     'Розничные продажи в США'),
    ('US', 'core pce price index mom', 'us-core-pce',
     'Базовый индекс цен PCE в США'),
    ('US', 'gdp', 'us-gdp',
     'ВВП США'),
    ('US', 'jobless_claims_initial', 'us-jobless-claims',
     'Первичные заявки на пособие по безработице в США'),
    ('US', 'crude oil stocks change', 'us-crude-stocks',
     'Запасы нефти в США (EIA)'),
    ('EU', 'inflation rate', 'eu-cpi',
     'Инфляция в еврозоне'),
    ('EU', 'rate', 'eu-ecb-rate',
     'Решение ЕЦБ по ставке'),
    ('GB', 'inflation rate', 'gb-cpi',
     'Инфляция в Великобритании'),
    ('GB', 'rate', 'gb-boe-rate',
     'Решение Банка Англии по ставке'),
]

BASELINE_DAYS = 90        # окно вокруг события для типичного получаса
MIN_BASELINE_BARS = 20    # меньше — фон не считаем вовсе
MIN_CASES = 6             # меньше — клетку не показываем


def load_job():
    """Импортируем счётчик реакции из market_intel, а не копируем его.

    Одно определение математики на две системы: если там переименуют
    функцию, сборка упадёт громко при следующем прогоне, а не начнёт
    молча расходиться с ботом."""
    sys.path.insert(0, str(MI))
    import event_reactions_job as job
    from core.event_types import normalize_event_type
    return job, normalize_event_type


def releases(con, normalize):
    """Реальные публикации: (страна, тип) → отсортированный список строк.

    Дедуп по (страна, тип, сутки): одну и ту же публикацию присылают и
    ForexFactory, и TradingView разными строками title, и без дедупа один
    релиз считается дважды."""
    rows = con.execute("""
        SELECT country, title, indicator, actual, forecast, previous,
               scheduled_ts, source
        FROM econ_events
        WHERE actual IS NOT NULL AND actual != '' AND scheduled_ts IS NOT NULL
    """).fetchall()

    best = {}
    for r in rows:
        et = normalize(r['indicator'] or r['title'])
        key = (r['country'], et, r['scheduled_ts'] // 86400)
        cur = best.get(key)
        pri = {'curated_official': 0, 'forexfactory': 1, 'tradingview': 2}
        if cur is None or pri.get(r['source'], 9) < pri.get(cur['source'], 9):
            best[key] = r

    out = defaultdict(list)
    # Заодно запоминаем, что ещё выходит в ту же минуту в той же стране —
    # это и есть «один релиз под многими именами».
    at_moment = defaultdict(set)
    for (country, et, _day), r in best.items():
        out[(country, et)].append(r)
        at_moment[(country, r['scheduled_ts'])].add(et)
    for v in out.values():
        v.sort(key=lambda r: r['scheduled_ts'])
    return out, at_moment


def baseline(con, symbol, ts):
    """Типичный ход ЭТОГО получаса суток вокруг ЭТОЙ даты.

    Ключевое отличие от hourly_profile.json: окно привязано к дате
    события, а слот — к тому же получасу суток (ts % 86400). Поэтому фон
    не отстаёт от уровня цен и сравнивает событие с обычным днём того же
    времени, а не со средним за восемь лет."""
    ps = PRICE_SYMBOL.get(symbol, symbol)
    rows = con.execute(
        "SELECT o, c FROM price_bars WHERE symbol=? AND tf='30m' "
        "AND ts BETWEEN ? AND ? AND ts % 86400 = ?",
        (ps, ts - BASELINE_DAYS * 86400, ts + BASELINE_DAYS * 86400,
         ts % 86400)).fetchall()
    moves = [abs(r['c'] - r['o']) for r in rows]
    if len(moves) < MIN_BASELINE_BARS:
        return None, len(moves)
    return statistics.median(moves), len(moves)


def cell(con, symbol, rs):
    """Одна клетка таблицы: инструмент × событие."""
    ratios, moves, dates = [], [], []
    for r in rs:
        ts = r['scheduled_ts']
        ps = PRICE_SYMBOL.get(symbol, symbol)
        bar = con.execute(
            "SELECT o, c FROM price_bars WHERE symbol=? AND tf='30m' AND ts=?",
            (ps, ts)).fetchone()
        if not bar:
            continue
        base, _k = baseline(con, symbol, ts)
        if not base:
            continue
        move = abs(bar['c'] - bar['o'])
        ratios.append(move / base)
        moves.append(move * PIP_SCALE.get(symbol, 1))
        dates.append(datetime.date.fromtimestamp(ts).isoformat())
    if len(ratios) < MIN_CASES:
        return None
    return {
        'symbol': symbol,
        'n': len(ratios),
        'median_ratio': round(statistics.median(ratios), 2),
        'above': sum(1 for x in ratios if x > 1),
        'min_ratio': round(min(ratios), 2),
        'max_ratio': round(max(ratios), 2),
        'median_move': round(statistics.median(moves), 2),
        'unit': 'пипс' if symbol in PIP_SCALE else 'пункт',
        'period': [min(dates), max(dates)],
    }


def build(con, normalize, only=None):
    rel, at_moment = releases(con, normalize)
    events = []
    for country, etype, slug, title in EVENTS:
        if only and slug not in only:
            continue
        rs = rel.get((country, etype)) or []
        if len(rs) < MIN_CASES:
            print('  %-18s релизов всего %d — страницу не делаем'
                  % (slug, len(rs)))
            continue

        # Публикация обязана попадать в сетку получасовых свечей. ЕЦБ
        # объявляет ставку в 12:15, то есть ровно посередине свечи: свеча
        # 12:00–12:30 содержала бы пятнадцать минут ДО публикации, а
        # следующая начиналась бы через пятнадцать минут ПОСЛЕ. Ни то, ни
        # другое не равно «получас после публикации», а подпись на
        # странице была бы именно такой.
        #
        # Отказываемся явно и с причиной. Без этой проверки событие просто
        # не находило баров и исчезало из витрины молча — «ноль» тут
        # означал бы «я туда не дошёл», а не «мерить нечего».
        # Одна страница — один релиз, а не всё, что похоже называется.
        # normalize_event_type свёл к 'nfp' и «Non Farm Payrolls Annual
        # Revision Prel» — годовую ревизию занятости, которая выходит
        # 28 августа в 14:00 и отчётом за месяц не является. В выборке она
        # выглядела как ещё одна публикация NFP.
        #
        # Отбираем по времени суток: берём самый частый слот и слот ровно
        # в часе от него — это тот же час по местному времени страны при
        # переходе на летнее (12:30 и 13:30 UTC — оба 8:30 в Нью-Йорке,
        # 18:00 и 19:00 — оба 14:00). Всё остальное время суток — другое
        # событие. Так обходимся без часовых зон и без списка исключений.
        slots = defaultdict(int)
        titles = defaultdict(int)
        for r in rs:
            slots[r['scheduled_ts'] % 86400] += 1
            titles[r['title']] += 1
        main_slot = max(slots, key=lambda s: (slots[s], -s))
        main_title = max(titles, key=lambda t: (titles[t], t))
        keep = {main_slot, (main_slot + 3600) % 86400,
                (main_slot - 3600) % 86400}

        # Отсеиваем только когда расходятся И время, И название. Одного
        # времени мало: первая версия этого фильтра выбросила пять
        # публикаций запасов нефти EIA, сдвинутых из-за праздничных
        # недель. Это тот же самый отчёт в другой час — его надо считать,
        # и фон для него всё равно берётся по его собственному часу, так
        # что сравнение остаётся честным. А годовая ревизия занятости
        # отличается и названием, и часом — значит это другое событие.
        alien = [r for r in rs
                 if r['scheduled_ts'] % 86400 not in keep
                 and r['title'] != main_title]
        if alien:
            print('  %-18s отсеяно по времени суток: %d (%s)'
                  % (slug, len(alien),
                     ', '.join(sorted({r['title'] for r in alien}))[:70]))
            drop = {id(r) for r in alien}
            rs = [r for r in rs if id(r) not in drop]
            if len(rs) < MIN_CASES:
                print('  %-18s после отсева осталось %d — страницу не делаем'
                      % (slug, len(rs)))
                continue

        off = [r for r in rs if r['scheduled_ts'] % 1800]
        if off:
            print('  %-18s ПРОПУСК: %d из %d публикаций вне сетки 30м '
                  '(время %s) — окно не совпало бы с подписью'
                  % (slug, len(off), len(rs),
                     datetime.datetime.fromtimestamp(
                         off[0]['scheduled_ts'],
                         datetime.timezone.utc).strftime('%H:%M')))
            continue
        rows = [c for c in (cell(con, s, rs) for s, _ in SYMBOLS) if c]
        if not rows:
            print('  %-18s ни одного инструмента с историей' % slug)
            continue
        rows.sort(key=lambda c: -c['median_ratio'])

        # Что ещё публикуется в те же минуты. Берём имена, встречающиеся
        # хотя бы в половине релизов, иначе в список попадёт случайное
        # совпадение одной даты.
        together = defaultdict(int)
        for r in rs:
            for et in at_moment[(country, r['scheduled_ts'])]:
                if et != etype:
                    together[et] += 1
        also = sorted(et for et, k in together.items() if k >= len(rs) / 2)

        hh = {datetime.datetime.fromtimestamp(
            r['scheduled_ts'], datetime.timezone.utc).strftime('%H:%M')
            for r in rs}
        events.append({
            'slug': slug, 'country': country, 'event_type': etype,
            'title': title,
            'releases': len(rs),
            'period': [datetime.date.fromtimestamp(rs[0]['scheduled_ts']).isoformat(),
                       datetime.date.fromtimestamp(rs[-1]['scheduled_ts']).isoformat()],
            'times_utc': sorted(hh),
            'also_at_same_time': also,
            'rows': rows,
        })
        print('  %-18s релизов %2d, инструментов %2d, максимум %.2f×'
              % (slug, len(rs), len(rows), rows[0]['median_ratio']))
    return events


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scan', action='store_true',
                    help='только показать, что доступно, файл не писать')
    ap.add_argument('--only', help='один slug, для отладки')
    args = ap.parse_args()

    if not DB.exists():
        print('нет базы %s — считать нечего' % DB)
        return 1
    job, normalize = load_job()
    con = sqlite3.connect('file:%s?mode=ro' % DB, uri=True)
    con.row_factory = sqlite3.Row

    span = con.execute(
        "SELECT date(min(scheduled_ts),'unixepoch'), "
        "date(max(scheduled_ts),'unixepoch') FROM econ_events "
        "WHERE actual IS NOT NULL AND actual != ''").fetchone()
    print('календарь: %s .. %s' % (span[0], span[1]))

    events = build(con, normalize,
                   only={args.only} if args.only else None)
    if not events:
        print('ни одного события с достаточной историей — файл не пишем')
        return 1

    payload = {
        'built_at': datetime.datetime.now(datetime.timezone.utc)
                    .strftime('%Y-%m-%dT%H:%M:%SZ'),
        'calendar_from': span[0], 'calendar_to': span[1],
        'baseline': {
            'window_days': BASELINE_DAYS,
            'min_bars': MIN_BASELINE_BARS,
            'how': 'медиана |close-open| по тому же получасу суток '
                   'в окне ±%d дней вокруг даты события' % BASELINE_DAYS,
        },
        'min_cases': MIN_CASES,
        'symbol_titles': dict(SYMBOLS),
        'events': events,
    }
    if args.scan:
        print('\n--scan: файл не записан')
        return 0
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1),
                   encoding='utf-8')
    print('\n%s: событий %d, размер %d КБ'
          % (OUT.name, len(events), len(OUT.read_text(encoding='utf-8')) // 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""Готовит ленту для первого экрана из данных market_intel.

Читает (только на чтение, чужая зона) календарь макро-событий и тикеры,
которые обсуждают, и складывает их в формат, который понимает герой:
{"items": [{"title": {ru,en,ro}, "tag": {ru,en,ro}, "lon", "lat", "id"}]}

Каждый пункт несёт сразу три языка: на карте не должно быть смеси.
Названия макро-показателей переводит словарь `calendar-terms.js` из
market_intel — 569 индикаторов, ключ совпадает с полем `indicator`.

Запуск: python3 build_feed.py   → sbf-nexus/hero-feed.json
Источник обновляется кроном market_intel, поэтому запускать по расписанию,
например раз в 15 минут.
"""
import json, pathlib, datetime, re

SRC_DIR = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel/web/data')
TERMS_JS = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel/web/edu/assets/calendar-terms.js')
OUT = pathlib.Path('/mnt/sbfdata/sbf-nexus/hero-feed.json')

# Столицы/финансовые центры — куда ставить точку для события страны
COUNTRY_LL = {
    'US': (-74.0, 40.7), 'EU': (8.68, 50.1), 'DE': (13.4, 52.5), 'FR': (2.35, 48.9),
    'GB': (-0.13, 51.5), 'UK': (-0.13, 51.5), 'JP': (139.7, 35.7), 'CN': (116.4, 39.9),
    'CH': (8.54, 47.4), 'CA': (-79.4, 43.7), 'AU': (151.2, -33.9), 'NZ': (174.8, -41.3),
    'IT': (12.5, 41.9), 'ES': (-3.70, 40.4), 'RU': (37.6, 55.7), 'IN': (72.8, 19.1),
    'BR': (-46.6, -23.5), 'MX': (-99.1, 19.4), 'TR': (32.9, 39.9), 'ZA': (28.0, -26.2),
    'SG': (103.8, 1.35), 'HK': (114.2, 22.3), 'AE': (55.3, 25.2), 'MD': (28.86, 47.0),
}
# Криптo и металлы страны не имеют — раскидываем по биржевым городам.
# Точек нарочно много и они разнесены: герой рисует нити от Кишинёва к точке,
# и на близких координатах подписи налезают друг на друга.
ASSET_LL = [
    (-74.0, 40.7), (103.8, 1.35), (-0.13, 51.5), (139.7, 35.7), (114.2, 22.3),
    (-118.2, 34.0), (151.2, -33.9), (55.3, 25.2), (-46.6, -23.5), (8.68, 50.1),
    (-99.1, 19.4), (72.8, 19.1),
]


# Названия стран для подписи под событием
COUNTRY_NAMES = {
    'US': ('USA', 'США', 'SUA'),          'EU': ('Eurozone', 'Еврозона', 'Zona euro'),
    'DE': ('Germany', 'Германия', 'Germania'), 'FR': ('France', 'Франция', 'Franța'),
    'GB': ('UK', 'Великобритания', 'Marea Britanie'), 'UK': ('UK', 'Великобритания', 'Marea Britanie'),
    'JP': ('Japan', 'Япония', 'Japonia'), 'CN': ('China', 'Китай', 'China'),
    'CH': ('Switzerland', 'Швейцария', 'Elveția'), 'CA': ('Canada', 'Канада', 'Canada'),
    'AU': ('Australia', 'Австралия', 'Australia'), 'NZ': ('New Zealand', 'Новая Зеландия', 'Noua Zeelandă'),
    'IT': ('Italy', 'Италия', 'Italia'), 'ES': ('Spain', 'Испания', 'Spania'),
    'RU': ('Russia', 'Россия', 'Rusia'), 'IN': ('India', 'Индия', 'India'),
    'BR': ('Brazil', 'Бразилия', 'Brazilia'), 'MX': ('Mexico', 'Мексика', 'Mexic'),
    'TR': ('Turkey', 'Турция', 'Turcia'), 'ZA': ('South Africa', 'ЮАР', 'Africa de Sud'),
    'SG': ('Singapore', 'Сингапур', 'Singapore'), 'HK': ('Hong Kong', 'Гонконг', 'Hong Kong'),
    'AE': ('UAE', 'ОАЭ', 'EAU'), 'MD': ('Moldova', 'Молдова', 'Moldova'),
}

# Именованные события, которых нет в словаре показателей market_intel.
# Список пополняется по строке «без перевода» в выводе этого скрипта.
EVENT_NAMES = {
    'Jackson Hole Symposium': ('Jackson Hole Symposium', 'Симпозиум в Джексон-Хоуле', 'Simpozionul de la Jackson Hole'),
    "National People's Congress": ("National People's Congress", 'Всекитайское собрание', 'Congresul Național al Poporului'),
    'FOMC Meeting Minutes': ('FOMC Minutes', 'Протоколы FOMC', 'Procesele-verbale FOMC'),
    'ECB Press Conference': ('ECB Press Conference', 'Пресс-конференция ЕЦБ', 'Conferința de presă BCE'),
}


def load_terms():
    """Достаёт CALENDAR_TERMS из JS-файла: ключи в кавычках, а ru/ro — нет."""
    try:
        raw = TERMS_JS.read_text(encoding='utf-8')
        body = re.search(r'var CALENDAR_TERMS = \{(.*?)\n\};', raw, re.S).group(1)
        # В словаре есть строки-комментарии (`// 31.08.2026: события под ...`).
        # Без их удаления json.loads падал на первом же таком блоке, и весь
        # календарь на карте молча оставался английским — при том что перевод
        # для 569 показателей лежал рядом.
        body = '\n'.join(l for l in body.split('\n') if not l.lstrip().startswith('//'))
        body = re.sub(r'([{,]\s*)(ru|ro)\s*:', r'\1"\2":', body)
        body = re.sub(r',(\s*[}\]])', r'\1', body)
        return json.loads('{' + body + '}')
    except Exception as exc:
        print(f'  словарь переводов не прочитан ({exc}) — календарь останется английским')
        return {}


TERMS = load_terms()


def tri(en, ru=None, ro=None):
    """Пункт на трёх языках. Без перевода — английский во всех трёх,
    но это видно в логе, а не молча."""
    return {'en': en, 'ru': ru or en, 'ro': ro or en}


# Значения поля indicator, которые ничего не называют — для них берём title
PLACEHOLDER_INDICATORS = {'calendar', 'event', 'holiday', ''}


# .title() ломает аббревиатуры: «yoy» → «Yoy». Возвращаем их обратно.
ABBR = {'Yoy': 'YoY', 'Mom': 'MoM', 'Qoq': 'QoQ', 'Yty': 'YTD', 'Pmi': 'PMI',
        'Gdp': 'GDP', 'Cpi': 'CPI', 'Ppi': 'PPI', 'Boj': 'BOJ', 'Ecb': 'ECB',
        'Fomc': 'FOMC', 'Api': 'API', 'Eia': 'EIA', 'Ism': 'ISM', 'Adp': 'ADP'}


def nice_en(s):
    """В источнике часть индикаторов приходит строчными («housing starts yoy»).
    В подписи рядом с заголовками это выглядит опечаткой."""
    if not s or s != s.lower():
        return s
    return ' '.join(ABBR.get(w, w) for w in s.title().split())


def tri_term(en):
    """Перевод названия показателя по словарю market_intel."""
    t = TERMS.get(en) or TERMS.get(en.title()) or {}
    return tri(nice_en(en), t.get('ru'), t.get('ro'))


def load(name):
    try:
        return json.loads((SRC_DIR / name).read_text(encoding='utf-8'))
    except Exception as exc:
        print(f'  пропускаю {name}: {exc}')
        return None


items, seen = [], set()
used_ll = set()
untranslated = set()


def free_ll(preferred=None):
    """Свободная точка на карте. Две новости в одном городе — это две подписи
    друг на друге, поэтому координаты не переиспользуются."""
    if preferred and preferred not in used_ll:
        used_ll.add(preferred)
        return preferred
    for ll in ASSET_LL:
        if ll not in used_ll:
            used_ll.add(ll)
            return ll
    return preferred or ASSET_LL[len(used_ll) % len(ASSET_LL)]

# 1. Макро-календарь: у события есть страна — ставим точку по ней
brief = load('brief_today.json')
for ev in (brief or {}).get('calendar', []):
    title = (ev.get('title') or '').strip()
    if not title or title in seen:
        continue
    ll = COUNTRY_LL.get((ev.get('country') or '').upper())
    if not ll:
        continue
    ll = free_ll(ll)
    seen.add(title)
    indicator = (ev.get('indicator') or '').strip()
    if indicator.lower() in PLACEHOLDER_INDICATORS:
        indicator = ''
    name = indicator or title
    if name in EVENT_NAMES:
        en, ru, ro = EVENT_NAMES[name]
        head = tri(en, ru, ro)
    else:
        head = tri_term(name)
        if name not in TERMS:
            untranslated.add(name)
    country = (ev.get('country') or '').upper()
    cn = COUNTRY_NAMES.get(country)
    item = {
        'title': head,
        'tag': tri(*cn) if cn else tri('Calendar', 'Календарь', 'Calendar'),
        'lon': ll[0], 'lat': ll[1],
        'id': f"cal-{ev.get('scheduled_ts') or len(items)}",
        'ts_utc': ev.get('ts_utc'),
        'impact': (ev.get('impact') or '').lower() or None,
    }
    # Ожидаемая реакция: медиана хода за 30 минут по прошлым выходам.
    # Меньше пяти наблюдений — это не статистика, а совпадение: не показываем.
    pr = ev.get('past_reaction') or {}
    if pr.get('n', 0) >= 5 and pr.get('median_atr_30m'):
        item['reaction'] = {'symbol': pr.get('symbol'),
                            'n': pr['n'],
                            'pct': round(float(pr['median_atr_30m']), 3)}
    items.append(item)

# 2. Тикеры, которые сейчас обсуждают — по биржевым городам
buzz = load('buzz.json')
for i, t in enumerate((buzz or {}).get('tickers', [])[:6]):
    tag = (t.get('tag') or '').strip()
    if not tag or tag in seen:
        continue
    seen.add(tag)
    ll = free_ll()
    n = t.get('mentions', 0)
    items.append({
        'title': tri(f'{tag} · {n} mentions', f'{tag} · {n} упоминаний', f'{tag} · {n} mențiuni'),
        'tag': tri('Buzz', 'В обсуждениях', 'În discuții'),
        'lon': ll[0], 'lat': ll[1],
        'id': f'buzz-{tag}',
    })

# 3. Аномалии — если есть, они интереснее всего
anom = load('anomalies.json')
for i, a in enumerate((anom or {}).get('anomalies', [])[:4]):
    title = (a.get('title') or a.get('symbol') or '').strip()
    if not title or title in seen:
        continue
    seen.add(title)
    ll = free_ll()
    items.append({'title': tri_term(title),
                  'tag': tri('Alert', 'Аномалия', 'Anomalie'),
                  'lon': ll[0], 'lat': ll[1], 'id': f'anom-{i}'})

# 4. Заголовок сегодняшнего брифа — единственная строка на первом экране,
# которая говорит «из этого шума уже что-то извлечено».
today = None
if brief and brief.get('headline'):
    today = {
        'headline': brief['headline'],
        'date': brief.get('date'),
        'generated_at': brief.get('generated_at'),
        # Языки брифа: синтез приходит на русском. Пока перевода нет —
        # честно помечаем, чтобы герой не выдавал русский за английский.
        'lang': 'ru',
    }

# 5. Котировки для бегущей строки. Берём ликвидную корзину, а не первые 10
# строк файла: там 842 инструмента в порядке брокера.
QUOTE_BASKET = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'XAGUSD',
                'BTCUSD', 'ETHUSD', 'USOIL', 'US500', 'GER40']
quotes = []
bq = load('broker_quotes.json')
if bq and bq.get('items'):
    fields = bq.get('fields') or ['symbol', 'bid', 'ask', 'chg_pct', 'quote_ts']
    idx = {name: i for i, name in enumerate(fields)}
    by_symbol = {row[idx['symbol']]: row for row in bq['items'] if row}
    for sym in QUOTE_BASKET:
        row = by_symbol.get(sym)
        if not row:
            continue
        bid = row[idx['bid']]
        quotes.append({'symbol': sym,
                       'bid': bid,
                       'chg_pct': row[idx['chg_pct']],
                       # Знаков после запятой у металлов и индексов меньше,
                       # чем у валют: 1.16296 против 4440.2
                       'digits': 5 if bid < 20 else (3 if bid < 500 else 1)})

# 6. Материал для второго экрана: каждой карточке — своя улика.
# Раньше там были четыре описания без единого числа.
grow = {}
if brief:
    # 6.1 Бриф: заголовок дня и три ближайших события
    ev = []
    for e in (brief.get('calendar') or [])[:3]:
        name = (e.get('indicator') or e.get('title') or '').strip()
        head = tri(*EVENT_NAMES[name]) if name in EVENT_NAMES else tri_term(name)
        cn = COUNTRY_NAMES.get((e.get('country') or '').upper())
        ev.append({'ts_utc': e.get('ts_utc'),
                   'country': tri(*cn) if cn else tri('', '', ''),
                   'title': head,
                   'impact': (e.get('impact') or '').lower() or None})
    grow['brief'] = {'headline': brief.get('headline'), 'date': brief.get('date'),
                     'lang': 'ru', 'events': ev}

    # 6.2 Инструмент дня: самый сильный ход + спарклайн часовых закрытий
    ups = (brief.get('movers') or {}).get('up') or []
    downs = (brief.get('movers') or {}).get('down') or []
    # Спарклайны есть не для всех инструментов (82 из 842): берём самый
    # сильный ход из тех, что можно нарисовать, иначе карточка была бы
    # с числом, но без графика.
    series = (load('broker_sparklines.json') or {}).get('series') or {}
    have = [m for m in ups + downs if series.get(m.get('symbol'))]
    best = max(have or ups + downs, key=lambda m: abs(m.get('chg_pct') or 0), default=None)
    if best:
        spark = series.get(best['symbol'])
        grow['mover'] = {'symbol': best['symbol'],
                         'chg_pct': best.get('chg_pct'),
                         'close': best.get('close'),
                         'date': best.get('bar_date'),
                         'spark': [round(float(x), 6) for x in (spark or [])][-24:]}

    # 6.3 Паттерн дня: у него есть посчитанная доля срабатываний, а не картинка
    pats = brief.get('patterns') or []
    pat = max(pats, key=lambda p: p.get('n') or 0, default=None)
    if pat:
        grow['pattern'] = {'symbol': pat.get('symbol'), 'tf': pat.get('tf'),
                           'name_ru': pat.get('display_name_ru'),
                           'key': pat.get('pattern_key'),
                           'direction': pat.get('direction'),
                           'share': pat.get('agree_share_5'), 'n': pat.get('n')}

payload = {
    'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'grow': grow,
    'items': items,
    'today': today,
    'quotes': quotes,
    'quotes_updated': (bq or {}).get('updated'),
}
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'{OUT}: {len(items)} событий')
if untranslated:
    # Молча показывать английский посреди русского текста — хуже, чем знать
    print(f'  без перевода ({len(untranslated)}): ' + ', '.join(sorted(untranslated)[:8]))
if len(items) < 4:
    # Герой держит 6 нитей; на малой ленте он честно смешает её с демо-данными
    print('  мало событий — на экране будут и демо-строки')

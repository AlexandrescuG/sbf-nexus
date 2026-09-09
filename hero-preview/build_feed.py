#!/usr/bin/env python3
"""Готовит ленту для первого экрана: точки на карте, бриф дня, котировки.

Точки на карте берутся из /api/geo/feed платформы — там уже посчитана
географическая привязка с указанием основания (поле `rule`). Своего
справочника координат здесь нет и быть не должно: два справочника
разъезжаются, и одна страна оказывается в разных местах на карте и на
глобусе.

Что показываем на карте и почему:

  calendar  событие макро-календаря, страна взята из данных.  Показываем.
  headline  место названо в самом заголовке новости.          Показываем.
  symbol    страна инструмента, опознанного в тексте.         НЕ показываем:
            «Fortum Shares Jump on Google Nuclear Deal» уезжает в Нью-Йорк,
            хотя Fortum финская. Ошибка такого рода проверяется одним
            взглядом и бьёт по доверию сильнее, чем отсутствие точки.

До 09.09.2026 вторая половина ленты (обсуждаемые тикеры) расставлялась
функцией `free_ll()` — «возьми следующий свободный город из списка», лишь
бы подписи не наложились. Это давало Intel во Франкфурте и Amazon в
Гонконге: шесть точек из шести мимо. Блок удалён вместе с обоими
справочниками координат.

Формат на выходе понимает js/hero-map.js:
{"items": [{"title": {ru,en,ro}, "tag": {ru,en,ro}, "lon", "lat", "id", ...}]}

Запуск: python3 build_feed.py   → sbf-nexus/hero-feed.json
Крон каждые 15 минут, со сдвигом от sbf-news-geo.timer, чтобы лента
собиралась уже по свежей привязке.
"""
import json, pathlib, datetime, re, sys, urllib.request, urllib.error

SRC_DIR = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel/web/data')
TERMS_JS = pathlib.Path('/mnt/sbfdata/sbf-platform/market_intel/web/edu/assets/calendar-terms.js')
OUT = pathlib.Path('/mnt/sbfdata/sbf-nexus/hero-feed.json')

GEO_API = 'https://lp.sbfconsult.com/api/geo/feed?hours=24&limit=60&kind=all'

# Ярусы привязки, которым доверяем настолько, чтобы ставить точку на карту.
# `symbol` намеренно вне списка — см. шапку файла.
TRUSTED_RULES = ('calendar', 'headline')

# Карта первого экрана — про рынок. В ленту новостей приходит и то, что к
# рынку отношения не имеет: «Print Edition | Wall Street Journal» (служебный
# заголовок рубрики), регби, гобелен из Байё. Пропускаем заголовок, если в
# нём есть рыночный маркер и нет служебного шаблона.
# Целые слова: ищутся с границей и слева, и справа (плюс окончание -s/-es).
# Без правой границы 'euro' находился внутри «Europe», и «Putin assures Trump
# that Moscow doesn't have aggressive plans toward Europe» шла на карту как
# рыночная новость. Тот же класс, что 'bank' внутри «West Bank».
MARKET_WORDS = (
    'stock', 'share', 'market', 'bond', 'yield', 'oil', 'brent', 'crude',
    'gas', 'gold', 'dollar', 'euro', 'yen', 'inflation', 'cpi', 'gdp',
    'fed', 'ecb', 'central bank', 'tariff', 'export', 'import', 'revenue',
    'profit', 'ipo', 'merger', 'economy', 'jobs', 'budget', 'debt', 'opec',
)
# Корни: ищутся по началу слова, окончание любое.
MARKET_STEMS = ('treasur', 'currenc', 'earning', 'unemploy', 'econom',
                'recession', 'commodit')
MARKET_CYR = (
    'акци', 'рынок', 'рынк', 'ставк', 'инфляц', 'ввп', 'нефт', 'газ', 'золот',
    'доллар', 'евро', 'иен', 'облигац', 'бирж', 'тариф', 'экспорт',
    'импорт', 'прибыл', 'выручк', 'бюджет', 'долг', 'занятост',
)
JUNK_PATTERNS = ('print edition', 'photos of', 'what to watch', 'quiz', 'crossword',
                 'west bank',      # «West Bank» — это не банк, а Западный берег
                 'luncheon', 'walks by', 'helps organize', 'to host', 'photo',
                 # Спорт и культура: рыночное слово в таком заголовке всегда
                 # случайное. «LIV Golf Files for Bankruptcy» — про банкротство,
                 # но на карте рыночной аналитики это гольф.
                 'golf', 'rugby', 'tennis', 'football', 'soccer', 'olympic',
                 'tapestry', 'museum', 'cultural revolution', 'celebrit',
                 'футбол', 'теннис', 'олимпи',
                 # Служебные страницы курсов валют: числа есть, новости нет
                 'exchange rate', 'exchange rates', 'rate today', 'rates today',
                 'курсы валют', 'официальные курс')

# Признак события — число или глагол движения. Раньше он требовался всегда,
# и это оказалось слишком строго: «Chinese Inflation Revives as Oil Spike Feed
# Into Prices», «Dollar Eyes Seven-Month Low», «The Fed's Three Choices» —
# новости рынка без числа и без глагола из списка. Список глаголов при этом
# не расширить: в живом языке их сотни. Теперь событие требуется только там,
# где рыночное слово могло попасть в заголовок случайно (см. WEAK_TOPIC).
NUMBERS = re.compile(r'[$€£¥]\s?\d|\d+(?:[.,]\d+)?\s?%|\b\d{2,}\b')
ACTION_WORDS = (
    'rise', 'rises', 'rose', 'fall', 'falls', 'fell', 'jump', 'jumps', 'surge',
    'surges', 'drop', 'drops', 'plunge', 'plunges', 'rally', 'rallies', 'tumble',
    'slump', 'climb', 'gain', 'gains', 'lose', 'loses', 'cut', 'cuts', 'hike',
    'hikes', 'raise', 'raises', 'hold', 'holds', 'halt', 'halts', 'ban', 'bans',
    'impose', 'imposes', 'take effect', 'takes effect', 'hit', 'hits', 'top',
    'tops', 'reach', 'reaches', 'sign', 'signs', 'launch', 'launches', 'set for',
    'record', 'beat', 'beats', 'miss', 'misses', 'warn', 'warns', 'pump', 'pumps',
    'вырос', 'упал', 'подорожал', 'подешевел', 'снизил', 'повысил', 'сократил',
    'рекорд', 'обвал', 'скачок',
)
_ACTION = re.compile(r'\b(' + '|'.join(
    w.replace(' ', r'\s') for w in ACTION_WORDS if w.isascii()) + r')', re.I)
_ACTION_CYR = tuple(w for w in ACTION_WORDS if not w.isascii())

# Слова, которые сами по себе рыночными не делают: «bank» есть в названии
# любого учреждения, «trade» — и в «trade war», и в «trade school», «rate» —
# в чём угодно. Для них по-прежнему нужен признак события.
WEAK_TOPIC = ('bank', 'trade', 'deal', 'rate', 'fund', 'invest', 'price',
              'loan', 'billion', 'million', 'shipping', 'supply', 'demand',
              'банк', 'торгов', 'цен', 'поставк', 'спрос')

# Одна страна не должна занимать всю карту: в один прогон приходило шесть
# заголовков про ФРС, и все шесть вставали в Нью-Йорк. Три вместо двух —
# после того, как ослабленный фильтр дал больше материала: при двух карта
# крутила один и тот же десяток заголовков по кругу.
MAX_PER_PLACE = 3

_STRONG = re.compile(
    r'\b(?:' + '|'.join(w.replace(' ', r'\s') for w in MARKET_WORDS) + r')(?:e?s)?\b'
    r'|\b(?:' + '|'.join(MARKET_STEMS) + r')\w*', re.I)
_WEAK = re.compile(
    r'\b(?:' + '|'.join(w for w in WEAK_TOPIC if w.isascii()) + r')\w*', re.I)
_WEAK_CYR = tuple(w for w in WEAK_TOPIC if not w.isascii())


def market_related(title: str) -> bool:
    """Заголовок — про рынок?

    Сильный маркер (нефть, инфляция, ФРС) — достаточно сам по себе. Слабый
    (банк, цена, поставки) требует ещё и признака события: числа или глагола
    движения. Именно слабые слова приводили на карту «обед Федрезерва в
    Кентукки» и подпись к фотографии «мужчина проходит мимо здания банка».
    """
    t = (title or '').lower()
    if any(j in t for j in JUNK_PATTERNS):
        return False
    if _STRONG.search(t) or any(w in t for w in MARKET_CYR):
        return True
    if not (_WEAK.search(t) or any(w in t for w in _WEAK_CYR)):
        return False
    return bool(NUMBERS.search(t)) or bool(_ACTION.search(t)) \
        or any(w in t for w in _ACTION_CYR)


def fetch_geo():
    """Лента привязок платформы. Молча подставлять старьё нельзя: если ручка
    недоступна, лучше не трогать hero-feed.json и сказать об этом вслух."""
    # Без своего User-Agent ручка отвечает 403: клиент urllib по умолчанию
    # представляется «Python-urllib/3.x», и фронт lp его отсекает. С любым
    # осмысленным UA (проверено тремя) приходит 200.
    req = urllib.request.Request(GEO_API, headers={
        'User-Agent': 'sbf-nexus/build_feed (+https://sbfconsult.com)',
        'Accept': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode('utf-8'))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        print(f'  /api/geo/feed недоступен ({exc}) — лента не перезаписана')
        return None

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


items = []
untranslated = set()

brief = load('brief_today.json')

# ── Точки на карте: одна ручка платформы, один справочник координат ──────
geo = fetch_geo()
if geo is None:
    sys.exit(1)          # не переписываем ленту старьём и не молчим

# Ожидаемая реакция рынка есть только в brief_today (медиана хода за 30 минут
# по прошлым выходам показателя). Сопоставляем с событием календаря по стране
# и времени: у геоленты этих чисел нет, а на карточке они главное.
reactions = {}
for ev in (brief or {}).get('calendar', []):
    pr = ev.get('past_reaction') or {}
    if pr.get('n', 0) < 5 or not pr.get('median_atr_30m'):
        continue          # меньше пяти наблюдений — совпадение, а не статистика
    ts = ev.get('scheduled_ts')
    key = ((ev.get('country') or '').upper(), int(ts) if ts else None)
    reactions[key] = {'symbol': pr.get('symbol'), 'n': pr['n'],
                      'pct': round(float(pr['median_atr_30m']), 3)}

skipped = {'rule': 0, 'offtopic': 0, 'crowded': 0}
per_place = {}
for it in geo.get('items', []):
    rule = it.get('rule')
    if rule not in TRUSTED_RULES:
        skipped['rule'] += 1
        continue
    if it.get('lon') is None or it.get('lat') is None:
        continue

    ru = (it.get('title') or '').strip()
    en = (it.get('title_en') or '').strip() or ru
    if not ru:
        continue

    if it.get('kind') == 'news' and not market_related(ru):
        skipped['offtopic'] += 1
        continue

    country = (it.get('country') or '').upper()
    place   = (it.get('place') or '').strip()

    # События календаря пропускаем всегда: их немного и они — факт.
    # Новости из уже занятого города придержим, иначе карта превращается
    # в один Нью-Йорк.
    if it.get('kind') == 'news':
        key = place or country
        if per_place.get(key, 0) >= MAX_PER_PLACE:
            skipped['crowded'] += 1
            continue
        per_place[key] = per_place.get(key, 0) + 1
    # Румынского в ленте нет: у новостей его взять неоткуда, а выдумывать
    # перевод заголовка нельзя — показываем английский.
    item = {
        'title': {'ru': ru, 'en': en, 'ro': en},
        'tag': tri(place or country, place or country, place or country),
        'lon': it['lon'], 'lat': it['lat'],
        'id': it.get('id') or f"{rule}-{len(items)}",
        'kind': it.get('kind'),
        'rule': rule,
        'impact': (it.get('impact') or '').lower() or None,
    }
    if it.get('ts'):
        item['ts_utc'] = datetime.datetime.fromtimestamp(
            it['ts'], datetime.timezone.utc).isoformat().replace('+00:00', 'Z')
    if it.get('source'):
        item['source'] = it['source']
    if it.get('url'):
        item['url'] = it['url']

    r = reactions.get((country, it.get('ts')))
    if r:
        item['reaction'] = r
    items.append(item)

print(f'  точек на карту: {len(items)}  '
      f"(отброшено: ярус symbol {skipped['rule']}, "
      f"не про рынок {skipped['offtopic']}, город занят {skipped['crowded']})")

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
        # Учёт непереведённых показателей раньше вёлся в блоке карты; тот
        # блок ушёл вместе с buzz-тикерами, и сигнал бы потерялся молча.
        if name and name not in EVENT_NAMES and name not in TERMS:
            untranslated.add(name)
        cn = COUNTRY_NAMES.get((e.get('country') or '').upper())
        ev.append({'ts_utc': e.get('ts_utc'),
                   'country': tri(*cn) if cn else tri('', '', ''),
                   'title': head,
                   'impact': (e.get('impact') or '').lower() or None})
    # Картинка брифа: её рисует brief_image_job раз в сутки. Берём последнюю
    # существующую, а не «сегодня» — если утренний прогон не отработал,
    # лучше вчерашний бриф с честной датой, чем битая картинка.
    imgs = sorted(SRC_DIR.glob('brief_image_*.png'))
    img = imgs[-1].name if imgs else None
    grow['brief'] = {'headline': brief.get('headline'), 'date': brief.get('date'),
                     'lang': 'ru', 'events': ev,
                     'image': ('https://lp.sbfconsult.com/data/' + img) if img else None,
                     'image_date': img.replace('brief_image_', '').replace('.png', '') if img else None}

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

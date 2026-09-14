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

# Порог «сколько новостей с одного места» поднимался трижды: 2 → 3 → 8.
# Смысл его при этом изменился. Сначала он спасал экран: шесть заголовков
# про ФРС вставали в одну точку Нью-Йорка и подписи наезжали. Но экран с тех
# пор защищён иначе — hero-map.js разводит подписи по экранной дистанции и
# держит не больше одной новости на город одновременно. Осталась вторая
# роль: не дать одному городу вытеснить остальные из ротации. Для неё
# хватает восьми, а лента выходит вдвое длиннее — именно её длина и
# определяет, как скоро заголовок вернётся на экран.
MAX_PER_PLACE = 8

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


# Макро-ряды. macro.json приходит из FRED с английскими подписями и без
# объяснений; на сайте нужно и то, и другое. Порядок здесь — порядок на
# экране: сначала то, чем ставку задают, потом то, что от неё зависит.
#
# Третья строка у каждого ряда — зачем на него смотреть. Без неё панель
# была бы семью числами, то есть тем же сырьём, только в другом месте:
# сайт обещает «улики», а улика — это число с объяснением.
#
# «Хорошо» и «плохо» здесь не пишем ни для одного ряда: рост нефти хорош
# для одного клиента и плох для другого, а сайт не даёт рекомендаций
# (llms.txt, «чего мы НЕ делаем»).
MACRO_ROWS = [
    ('DFF', ('Fed Funds Rate', 'Ставка ФРС', 'Rata Fed'),
     ('the price of money for everyone else',
      'цена денег для всех остальных',
      'prețul banilor pentru toți ceilalți'), '%'),
    # Единственный ряд, который показываем не уровнем: CPI приходит
    # индексом (334,131), и это число человеку не говорит ничего. Считаем
    # изменение к прошлому значению в процентах — 0,4% за месяц читается.
    # База — ПРОШЛОЕ значение, а не текущее: иначе числитель и знаменатель
    # снова разными линейками.
    ('CPIAUCSL', ('US Consumer Prices', 'Потребительские цены США', 'Prețuri de consum SUA'),
     ('what the Fed is raising rates against',
      'то, против чего ставку и поднимают',
      'ceea ce contracarează majorarea ratei'), 'pct_change'),
    ('UNRATE', ('US Unemployment', 'Безработица в США', 'Șomaj SUA'),
     ('the second half of the Fed mandate',
      'вторая половина мандата ФРС',
      'a doua jumătate a mandatului Fed'), '%'),
    ('T10Y2Y', ('10y minus 2y Yield', 'Спред 10 лет минус 2 года', 'Spread 10 ani minus 2 ani'),
     ('below zero it has preceded every US recession since 1955',
      'ниже нуля он предшествовал каждой рецессии в США с 1955 года',
      'sub zero a precedat fiecare recesiune din SUA din 1955'), '%'),
    ('T10YIE', ('10y Breakeven Inflation', 'Ожидаемая инфляция на 10 лет', 'Inflație așteptată la 10 ani'),
     ('inflation the bond market is pricing in, not the forecast',
      'инфляция, заложенная рынком облигаций, а не прогноз',
      'inflația inclusă în prețuri de piața obligațiunilor'), '%'),
    ('DCOILWTICO', ('WTI Oil', 'Нефть WTI', 'Petrol WTI'),
     ('an input cost in nearly every other price',
      'входит в себестоимость почти всех прочих цен',
      'intră în costul aproape tuturor celorlalte prețuri'), '$'),
    ('DTWEXBGS', ('Trade-Weighted Dollar', 'Торгово-взвешенный доллар', 'Dolar ponderat comercial'),
     ('the exchange rate the rest of the world pays',
      'курс, по которому платит остальной мир',
      'cursul pe care îl plătește restul lumii'), None),
]

# Уровни доверия из brief.context. Метка приходит из market_intel и
# означает, ОТКУДА факт: из котировок, из СМИ или из соцсетей без
# проверки. Это и есть то, чего нет у конкурентов, — не «рынок вырастет»,
# а «вот что известно, откуда и насколько мы в этом уверены».
CONTEXT_TIERS = {
    'quotes': ('from quotes', 'из котировок', 'din cotații'),
    'media': ('from media', 'из СМИ', 'din presă'),
    'social_unverified': ('from social media, unverified',
                          'из соцсетей, не проверено',
                          'din rețele sociale, neverificat'),
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


# Города, откуда приходят события. Платформа отдаёт место по-русски — и
# оно так и доезжало до английской и румынской версий: под заголовком
# «The ECB is virtually certain…» стояло «ФРАНКФУРТ» кириллицей. Городов
# в ленте девять, список закрытый и растёт медленно; чего нет в таблице,
# показываем как есть и печатаем в лог, а не молча.
PLACES = {
    'Нью-Йорк':  ('New York', 'New York'),
    'Франкфурт': ('Frankfurt', 'Frankfurt'),
    'Лондон':    ('London', 'Londra'),
    'Москва':    ('Moscow', 'Moscova'),
    'Киев':      ('Kyiv', 'Kiev'),
    'Шанхай':    ('Shanghai', 'Shanghai'),
    'Токио':     ('Tokyo', 'Tokio'),
    'Тегеран':   ('Tehran', 'Teheran'),
    'Мумбаи':    ('Mumbai', 'Mumbai'),
    'Хельсинки': ('Helsinki', 'Helsinki'),
    'Пекин':     ('Beijing', 'Beijing'),
    'Гонконг':   ('Hong Kong', 'Hong Kong'),
    'Сеул':      ('Seoul', 'Seul'),
    'Сингапур':  ('Singapore', 'Singapore'),
    'Брюссель':  ('Brussels', 'Bruxelles'),
    'Париж':     ('Paris', 'Paris'),
    'Берлин':    ('Berlin', 'Berlin'),
    'Цюрих':     ('Zurich', 'Zurich'),
    'Дубай':     ('Dubai', 'Dubai'),
    'Кишинёв':   ('Chisinau', 'Chișinău'),
    'Вашингтон': ('Washington', 'Washington'),
    'Оттава':    ('Ottawa', 'Ottawa'),
    'Канберра':  ('Canberra', 'Canberra'),
    'Веллингтон': ('Wellington', 'Wellington'),
    'Бразилиа':  ('Brasilia', 'Brasília'),
    'Мехико':    ('Mexico City', 'Ciudad de México'),
    'Йоханнесбург': ('Johannesburg', 'Johannesburg'),
    'Стамбул':   ('Istanbul', 'Istanbul'),
    'Эр-Рияд':   ('Riyadh', 'Riad'),
    # 12.09.2026: лог прогона назвал их сам («город не в таблице») — ровно для
    # этого строка в логе и заведена.
    'Сидней':    ('Sydney', 'Sydney'),
    'Тайбэй':    ('Taipei', 'Taipei'),
    'Торонто':   ('Toronto', 'Toronto'),
}
unknown_places = set()


def tri_place(ru):
    if not ru:
        return tri('', '', '')
    p = PLACES.get(ru)
    if not p:
        if not ru.isascii():
            unknown_places.add(ru)
        return tri(ru, ru, ru)
    return {'ru': ru, 'en': p[0], 'ro': p[1]}


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
# Пропуски, о которых иначе никто не узнает: ряд FRED, которого не
# оказалось в macro.json, и незнакомая метка доверия в контексте брифа.
# Обе дырки тихие — блок просто выйдет короче, чем задумано.
missing_macro = []
unknown_conf = set()

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
    #
    # У событий календаря переводить есть по чему: рядом лежит словарь
    # market_intel на 575 показателей. Платформа переводит не всё —
    # «Existing Home Sales MoM» приезжала английской на русскую страницу,
    # хотя «Продажи вторичного жилья м/м» есть в словаре, — поэтому то,
    # что пришло непереведённым, прогоняем через словарь сами.
    title = {'ru': ru, 'en': en, 'ro': en}
    if it.get('kind') != 'news' and ru == en:
        t = tri_term(en)
        title = {'ru': t['ru'], 'en': en, 'ro': t['ro']}
        if t['ru'] == en:
            untranslated.add(en)

    item = {
        'title': title,
        'tag': tri_place(place or country),
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

# Копим ленту, а не заменяем её целиком. Ручка отдаёт максимум 60 пунктов за
# запрос, после фильтров остаётся два десятка — на экране это значит, что
# заголовок возвращается примерно раз в полминуты, и посетитель видит
# «одни и те же новости по кругу». Прогон идёт каждые 15 минут и почти
# всегда приносит что-то новое; сохраняя прошлые пункты, за пару часов
# набираем полную суточную ленту вместо среза на 60 штук.
KEEP_HOURS = 24
KEEP_MAX = 90


def _ts(o):
    s = (o or {}).get('ts_utc') or ''
    try:
        return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        return datetime.datetime.now(datetime.timezone.utc)


if OUT.exists():
    try:
        old = json.loads(OUT.read_text(encoding='utf-8')).get('items', [])
    except (ValueError, OSError):
        old = []
    fresh_ids = {o.get('id') for o in items}
    edge = datetime.datetime.now(datetime.timezone.utc) - \
        datetime.timedelta(hours=KEEP_HOURS)
    kept = [o for o in old
            if o.get('id') not in fresh_ids        # свежая версия важнее
            and o.get('lon') is not None
            and _ts(o) > edge]                     # сутки — и на выход
    # Пункты из прошлых прогонов собраны прежними правилами. Название места
    # пересобираем: иначе после правки таблицы городов английская страница
    # ещё сутки показывала бы кириллицу — ровно тот срок, на который лента
    # копится. Заголовки не трогаем: их перевода взять неоткуда.
    for o in kept:
        o['tag'] = tri_place(((o.get('tag') or {}).get('ru') or ''))
    before = len(items)
    items = sorted(items + kept, key=_ts, reverse=True)[:KEEP_MAX]
    print(f'  из прошлых прогонов: +{len(items) - before} '
          f'(итого в ленте {len(items)})')

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
        # Прошлая реакция: медиана хода за 30 минут на предыдущих
        # публикациях и число наблюдений. Шаг 2 в «Подходе» на сайте
        # обещает «считаем, как рынок двигался на прошлых публикациях» —
        # и до сих пор ничего не показывал. Число наблюдений обязательно
        # рядом: медиана по четырём случаям и по сорока — это разные
        # утверждения, а выглядят одинаково.
        pr = e.get('past_reaction') or {}
        past = None
        if pr.get('median_atr_30m') is not None and (pr.get('n') or 0) > 0:
            past = {'symbol': pr.get('symbol'),
                    'n': pr.get('n'),
                    'median_atr_30m': pr.get('median_atr_30m')}
        ev.append({'ts_utc': e.get('ts_utc'),
                   'country': tri(*cn) if cn else tri('', '', ''),
                   'title': head,
                   'impact': (e.get('impact') or '').lower() or None,
                   'forecast': e.get('forecast'),
                   'previous': e.get('previous'),
                   'past': past})
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

    # 6.4 Что известно и насколько уверены. Синтез приходит по-русски,
    # как и заголовок брифа, — помечаем язык, а не выдаём русский за
    # перевод (то же правило, что в 4).
    ctx = []
    for c in (brief.get('context') or []):
        text = (c.get('text') or '').strip()
        conf = c.get('confidence')
        if not text:
            continue
        if conf not in CONTEXT_TIERS:
            # Незнакомый уровень доверия — не показываем вовсе. Подписать
            # его «из СМИ» наугад значило бы соврать ровно в том месте,
            # ради которого блок и сделан.
            unknown_conf.add(str(conf))
            continue
        ctx.append({'text': text, 'confidence': conf,
                    'label': tri(*CONTEXT_TIERS[conf]), 'lang': 'ru'})
    if ctx:
        grow['context'] = ctx

# 7. Макро: на чём стоит рынок сегодня. Живые ряды FRED, обновляются сами.
# До сих пор сайт их не показывал вовсе — при том что лежат они в одной
# папке с брифом.
macro_src = load('macro.json') or {}
macro = []
for key, label, why, unit in MACRO_ROWS:
    row = macro_src.get(key)
    if not isinstance(row, dict) or row.get('value') is None:
        missing_macro.append(key)
        continue
    value, delta = row.get('value'), row.get('delta')
    span = None
    if unit == 'pct_change':
        # Ряд индексный: показываем не уровень, а шаг. Без прошлого
        # значения шага нет — ряд пропускаем, а не рисуем ноль.
        if not delta:
            missing_macro.append(key + ' (нет прошлого значения)')
            continue
        base = value - delta
        if not base:
            missing_macro.append(key + ' (нулевая база)')
            continue
        value, delta, unit = round(delta / base * 100, 2), None, '%'
        span = tri('month over month', 'за месяц', 'lunar')
    # Округляем здесь, а не в браузере: 118.0732 у торгово-взвешенного
    # доллара — это точность источника, а не смысл. Два знака хватает
    # каждому из семи рядов.
    macro.append({'key': key, 'label': tri(*label), 'why': tri(*why),
                  'value': round(value, 2), 'span': span,
                  'delta': None if delta is None else round(delta, 2),
                  'date': row.get('date'), 'unit': unit})

payload = {
    'updated': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'grow': grow,
    'macro': macro,
    'macro_updated': macro_src.get('_updated'),
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
if unknown_places:
    # Кириллический город на английской странице — та же ошибка, что
    # английский заголовок на русской, просто её реже замечают
    print(f'  город не в таблице ({len(unknown_places)}): '
          + ', '.join(sorted(unknown_places)[:8]))
print(f'  макро: {len(macro)} из {len(MACRO_ROWS)} рядов, '
      f'контекст: {len(grow.get("context") or [])} уровня, '
      f'календарь с прошлой реакцией: '
      f'{sum(1 for e in (grow.get("brief") or {}).get("events") or [] if e.get("past"))} '
      f'из {len((grow.get("brief") or {}).get("events") or [])}')
if missing_macro:
    # Короткая панель выглядит как задумано и молчит о том, что ряда нет
    print(f'  макро-ряд не пришёл: ' + ', '.join(missing_macro))
if unknown_conf:
    print(f'  незнакомая метка доверия (блок пропущен): '
          + ', '.join(sorted(unknown_conf)))
_news_en = sum(1 for o in items if o['title']['ru'] == o['title']['en'])
if _news_en:
    print(f'  заголовков только на английском: {_news_en} из {len(items)} '
          f'— перевод новостей делается на стороне платформы')
if len(items) < 4:
    # Герой держит 6 нитей; на малой ленте он честно смешает её с демо-данными
    print('  мало событий — на экране будут и демо-строки')

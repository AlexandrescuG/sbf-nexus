#!/usr/bin/env python3
"""Кто из краулеров к нам ходил и куда.

Вопрос «ссылаются ли на нас ИИ-агенты» начинается с более скучного:
приходят ли они вообще. До сих пор ответить было нечем — журнал запросов
у сайта был заглушён целиком, а сам он стоит за туннелем Cloudflare, и
своего access-лога нет. Теперь server.py пишет одну строку на визит
краулера, а этот файл её читает.

Чего эта сводка НЕ доказывает: что за именем стоит настоящий бот.
Представиться GPTBot может кто угодно; проверка идёт по адресу, и делает
её Cloudflare. Поэтому строки здесь — «кто-то представился так».
Обратное утверждение сильнее и надёжнее: если за неделю строк нет вовсе,
значит к нам действительно никто не приходил.

    python3 tools/crawlers.py            # сводка за всё время
    python3 tools/crawlers.py 7          # за последние 7 дней
"""
import collections
import datetime
import pathlib
import sys

LOG = pathlib.Path(__file__).resolve().parent.parent / 'crawlers.log'


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else None
    if not LOG.exists():
        print('журнала ещё нет: %s' % LOG)
        print('он появится после перезапуска сервиса и первого визита бота')
        return
    since = None
    if days:
        since = (datetime.datetime.now(datetime.timezone.utc)
                 - datetime.timedelta(days=days)).strftime('%Y-%m-%d %H:%M:%S')

    by_bot = collections.Counter()
    by_day = collections.Counter()
    by_path = collections.Counter()
    codes = collections.Counter()
    by_ip = collections.Counter()
    seen_pairs = set()          # (имя бота, адрес) — для поиска подделок
    no_ip = 0
    first, last = None, None
    total = 0

    for raw in LOG.read_text(encoding='utf-8', errors='replace').splitlines():
        parts = raw.split('\t')
        if len(parts) < 3:
            continue
        # Два формата строки в одном файле. До 30.09 адрес клиента не
        # писался вовсе: время, бот, запрос, код. Поймали, что под именами
        # ИИ-ботов ходят сканеры уязвимостей, и добавили адрес пятым
        # полем — но старые строки остались, и выбрасывать их незачем.
        # Отличаем по третьему полю: в новом формате там адрес, в старом
        # уже сам запрос («GET /path HTTP/1.1» — всегда с пробелами).
        if len(parts) >= 5 and ' ' not in parts[2]:
            ts, bot, ip, req, code = parts[0], parts[1], parts[2], parts[3], parts[4]
        else:
            ts, bot, req = parts[0], parts[1], parts[2]
            ip = ''
            code = parts[3] if len(parts) > 3 else ''
        if since and ts < since:
            continue
        total += 1
        first = first or ts
        last = ts
        by_bot[bot] += 1
        by_day[ts[:10]] += 1
        codes[code] += 1
        if ip:
            by_ip[ip] += 1
            seen_pairs.add((bot, ip))
        else:
            no_ip += 1
        # В запросе лежит строка вида «GET /path HTTP/1.1»
        bits = req.split(' ')
        by_path[bits[1] if len(bits) > 1 else req] += 1

    if not total:
        print('за выбранный срок визитов краулеров нет')
        return

    print('визитов: %d  с %s по %s' % (total, first, last))
    print('\nпо ботам:')
    for bot, n in by_bot.most_common():
        print('  %-20s %d' % (bot, n))
    print('\nпо дням:')
    for d, n in sorted(by_day.items())[-14:]:
        print('  %s  %s %d' % (d, '▪' * min(40, n), n))
    print('\nсамые частые адреса:')
    for p, n in by_path.most_common(10):
        print('  %-44s %d' % (p[:44], n))
    bad = {c: n for c, n in codes.items() if c and not c.startswith('2')
           and not c.startswith('3')}
    if bad:
        print('\nответы не 2xx/3xx: ' + ', '.join(
            '%s×%d' % (c, n) for c, n in sorted(bad.items())))

    # Адреса. Без них имя бота — только то, чем он назвался: под именами
    # ИИ-ботов в журнал уже приходили сканеры уязвимостей. Много имён с
    # одного адреса — верный признак подделки: настоящие вендоры ходят из
    # своих диапазонов, и один хост не бывает сразу GPTBot и Googlebot.
    if no_ip:
        print('\nстрок без адреса (старый формат журнала): %d' % no_ip)
    if by_ip:
        print('\nсамые частые адреса клиентов:')
        for ip, n in by_ip.most_common(10):
            names = {b for b, i in seen_pairs if i == ip}
            flag = '  ← %d разных имён, похоже на подделку' % len(names) \
                if len(names) > 2 else ''
            print('  %-24s %d%s' % (ip, n, flag))


if __name__ == '__main__':
    main()

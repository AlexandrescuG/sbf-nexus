#!/usr/bin/env python3
"""Видят ли сайт ИИ-агенты — и есть ли им что процитировать.

Три отдельных вопроса, которые легко перепутать:

  1. Пускают ли. robots.txt, коды ответов на агентские User-Agent. Файл
     на диске ничего не доказывает: раздаёт его сервер, и он же может
     его закрыть — так уже вышло со служебными путями.
  2. Видно ли. Краулеры читают HTML и в подавляющем большинстве НЕ
     исполняют JS. Факт, который дорисовывается скриптом, для них не
     существует. Проверяем без JS и ищем в тексте конкретные строки.
  3. Не врут ли ссылки. Объявленные в robots и llms.txt адреса должны
     отвечать: витрина из битых ссылок хуже её отсутствия. Этой
     проверкой уже поймано двое — /partners.html, которой нет вовсе, и
     страницы-шаблоны, отдающиеся неотрендеренными.

Про Cloudflare этот щуп не знает ничего и знать не может: он ходит на
адрес, который ему дали. Если проверять прод, разница между «сервер
отдал» и «Cloudflare пропустил» здесь не видна — смотреть в панели.

    python3 tools/agent-check.py                       # локально
    python3 tools/agent-check.py --base https://sbfconsult.com
"""
import re
import sys
import urllib.error
import urllib.request

BASE = 'http://127.0.0.1:5001'
if '--base' in sys.argv:
    BASE = sys.argv[sys.argv.index('--base') + 1].rstrip('/')

# Кто к нам ходит. Категории — по классификации Cloudflare: одни
# отвечают со ссылкой, другие забирают в обучение, и это разные решения.
AGENTS = [
    ('OAI-SearchBot', 'отвечает со ссылкой',
     'Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)'),
    ('Claude-SearchBot', 'отвечает со ссылкой',
     'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +claudebot@anthropic.com)'),
    ('PerplexityBot', 'отвечает со ссылкой',
     'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'),
    ('ChatGPT-User', 'открывает по просьбе человека',
     'Mozilla/5.0 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)'),
    ('GPTBot', 'забирает в обучение',
     'Mozilla/5.0 (compatible; GPTBot/1.1; +https://openai.com/gptbot)'),
    ('ClaudeBot', 'забирает в обучение',
     'Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)'),
    ('Google-Extended', 'забирает в обучение', 'Google-Extended'),
]

# Факты, которые должны быть в HTML главной БЕЗ всякого JS. Это не
# придирка к вёрстке: именно такие строки ассистент и цитирует, а
# дорисованные скриптом он не увидит.
FACTS = [
    ('LEI', '254900BW4MI5M0006I30'),
    ('название юрлица', 'SBF COMPANY'),
    ('город', 'Кишинёв'),
    ('телефон', '000-520'),
    ('чего не делаем', 'не принимает средства'),
]


def get(url, ua='Mozilla/5.0'):
    req = urllib.request.Request(url, headers={'User-Agent': ua})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception as exc:
        return None, str(exc)


def main():
    bad = []
    print('база: ' + BASE)

    # 1. Пускают ли
    print('\nкто как пускается:')
    for name, role, ua in AGENTS:
        code, _ = get(BASE + '/', ua)
        ok = code == 200
        print('  %-17s %-28s %s%s' % (name, role, code, '' if ok else '   ←'))
        if not ok:
            bad.append(name)

    # 2. Объявления
    print('\nобъявления:')
    for path in ('/robots.txt', '/sitemap.xml', '/llms.txt'):
        code, body = get(BASE + path)
        ok = code == 200 and len(body) > 40
        print('  %-14s %s  %d байт%s' % (path, code, len(body), '' if ok else '   ←'))
        if not ok:
            bad.append(path)

    # 3. Ссылки, которые мы сами объявили. Проверяем ровно то, что
    # написано в наших файлах, а не то, что помним.
    _, robots = get(BASE + '/robots.txt')
    _, llms = get(BASE + '/llms.txt')
    _, smap = get(BASE + '/sitemap.xml')
    urls = set(re.findall(r'https?://[^\s<>"\']+', robots + '\n' + llms))
    urls |= set(re.findall(r'<loc>([^<]+)</loc>', smap))
    # При локальном прогоне пропускаем ТОЛЬКО адреса самого главного
    # домена: локально их нет, а на проде они и так проверяются кодами
    # ответа выше. Платформа и внешние реестры проверяются всегда —
    # именно там и нашлись битая /partners.html и страницы-шаблоны.
    # Первая версия фильтра ловила подстроку «sbfconsult.com» и вместе с
    # главной выкидывала платформу, оставив на проверке один адрес.
    if BASE.startswith('http://127.'):
        urls = {u for u in urls if '//sbfconsult.com' not in u}
    print('\nобъявленные адреса (%d):' % len(urls))
    for u in sorted(urls):
        code, body = get(u)
        # Страница-шаблон отдаётся с кодом 200 и выглядит нормальной,
        # пока не заглянешь в текст: там остаётся синтаксис шаблона.
        raw = bool(re.search(r'\{\{|\{%', body[:4000]))
        ok = code == 200 and not raw
        note = '' if ok else ('   ← шаблон не отрендерен' if raw else '   ←')
        print('  %s  %s%s' % (code, u[:74], note))
        if not ok:
            bad.append(u)

    # 4. Видно ли факты без JS
    code, html = get(BASE + '/')
    text = re.sub(r'<script.*?</script>', ' ', html, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    print('\nфакты в HTML без JS:')
    for name, needle in FACTS:
        ok = needle.lower() in text.lower()
        print('  %-18s %s%s' % (name, 'есть' if ok else 'НЕТ', ''))
        if not ok:
            bad.append(name)

    print()
    if bad:
        print('ПЛОХО: ' + ', '.join(str(x)[:48] for x in bad))
        sys.exit(1)
    print('хорошо: агентов пускают, объявления на месте, факты видны без JS')


if __name__ == '__main__':
    main()

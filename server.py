#!/usr/bin/env python3
"""SBF Nexus static server — раздача сайта, SPA-маршруты, кэш.

Раздаётся КАТАЛОГ РЕПОЗИТОРИЯ, а в нём лежит не только сайт: история git,
исходники инструментов, внутренние заметки, зависимости. Пока фильтра не
было, всё это отдавалось с кодом 200 — `/.git/HEAD`, `/server.py`,
`/CLAUDE.md` с путями по диску, листинги `/tools/`, `/node_modules/`. По
открытому `.git` историю и исходники скачивают целиком. Найдено аудитом
16.09.2026.

Правильнее было бы раздавать отдельную папку сборки, но это переезд всего
деплоя; фильтр закрывает дыру сегодня и не мешает такому переезду потом.
"""
import http.server, sys, os, posixpath, urllib.parse

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
DIR  = os.path.dirname(os.path.abspath(__file__))

# Каталоги, которых на сайте быть не должно ни целиком, ни по одному файлу.
# cons-kz и dist не в списке намеренно: это живые страницы.
BLOCK_DIRS  = {'tools', 'docs', '_archive', 'node_modules', 'hero-preview'}
# Расширения служебных файлов. .json НЕ блокируем — им живёт лента
# первого экрана (hero-feed.json); package.json закрыт по имени.
BLOCK_EXT   = ('.py', '.md', '.log', '.sh', '.lock', '.toml', '.cfg', '.ini')
BLOCK_FILES = {'package.json', 'package-lock.json', 'requirements.txt'}

# Сколько браузеру разрешено держать ответ у себя.
#
# Раньше на всё уходило no-store: каждый визит тянул около мегабайта
# заново, и отключался back/forward-кэш — возврат «назад» перезагружал
# страницу целиком. no-cache этого не делает: браузер держит копию, но
# каждый раз переспрашивает и обычно получает 304 без тела.
#
# Вендор и картинки версий не меняют и живут сутки: их содержимое
# привязано к имени файла, а не ко времени.
LONG_DIRS = ('/vendor/', '/assets/')
LONG_TTL  = 'public, max-age=86400'


class NexusHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def _forbidden(self):
        """Путь ведёт не к сайту, а к его исходникам."""
        raw = urllib.parse.unquote(self.path.split('?')[0].split('#')[0])
        # Нормализуем до сравнения: /js/../server.py и //./git — это те же
        # самые файлы, записанные иначе.
        parts = [p for p in posixpath.normpath(raw).split('/') if p and p != '.']
        if not parts:
            return False
        name = parts[-1].lower()
        return (any(p.startswith('.') or p == '..' for p in parts)
                or any(p in BLOCK_DIRS for p in parts)
                or name in BLOCK_FILES
                or name.endswith(BLOCK_EXT))

    def do_GET(self):
        if self._forbidden():
            return self.send_error(404)
        # SPA-маршруты: путь без расширения, которого нет на диске, отдаёт
        # главную (/ru, /en, /book), дальше разбирается JS.
        path = self.path.split('?')[0].rstrip('/')
        if path and '.' not in os.path.basename(path):
            disk_path = os.path.join(DIR, path.lstrip('/'))
            if not os.path.exists(disk_path):
                self.path = '/index.html'
        super().do_GET()

    def do_HEAD(self):
        if self._forbidden():
            return self.send_error(404)
        super().do_HEAD()

    def list_directory(self, path):
        """Листингов у сайта нет. Каталог без index.html — это 404, а не
        оглавление репозитория."""
        self.send_error(404)
        return None

    def end_headers(self):
        p = self.path.split('?')[0]
        if p.startswith(LONG_DIRS):
            self.send_header('Cache-Control', LONG_TTL)
        else:
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # тишина в логах


print(f'  SBF Nexus → http://localhost:{PORT}  (фильтр служебных путей, SPA)')
# ThreadingHTTPServer, а не HTTPServer: одиночный keep-alive от браузера
# блокировал единственный поток и весь sbfconsult.com переставал отвечать,
# пока клиент не отвалится. Воспроизводилось живым прогоном 28.08.2026.
http.server.ThreadingHTTPServer(('', PORT), NexusHandler).serve_forever()

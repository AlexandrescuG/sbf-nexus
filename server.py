#!/usr/bin/env python3
"""SBF Nexus static server — no-cache headers, 301 для старых адресов, честный 404.

Раньше любой путь без расширения отдавал index.html с кодом 200 (SPA
routing). Для поисковика это soft-404: /blank-2 от старого Wix-сайта
оставался «живой» копией главной. Сайт одностраничный, поэтому вместо
подмены — явная таблица переадресаций, а всё неизвестное получает 404.
"""
import http.server, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
DIR  = os.path.dirname(os.path.abspath(__file__))

# Точные пути → куда отправить (301). Язык — через ?lang=, его читает i18n.js.
REDIRECTS = {
    '/ru': '/?lang=ru', '/en': '/?lang=en', '/ro': '/?lang=ro',
    '/uk': '/?lang=ru', '/be': '/?lang=ru', '/kk': '/?lang=ru',
    '/blank-2': '/risk.html',            # «Правила и условия» старого Wix
    '/index.html': '/',
}
# Префиксы старого Wix-сайта → куда отправить (301).
PREFIX_REDIRECTS = {
    '/service-page/': 'https://lp.sbfconsult.com/edu/',   # старый «курс по трейдингу»
    '/book': 'https://lp.sbfconsult.com/edu/',
}
# Не отдавать никогда: служебное лежит в той же папке, что и сайт.
PRIVATE_PREFIXES = ('/.git', '/_archive', '/node_modules', '/docs', '/tools',
                    '/hero-preview', '/CLAUDE.md', '/README.md', '/server.py',
                    '/dev.sh', '/package.json', '/package-lock.json', '/.sbf-zone',
                    '/.gitignore')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def _redirect(self, target):
        self.send_response(301)
        self.send_header('Location', target)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def _route(self):
        """True — ответ уже отправлен."""
        raw = self.path.split('?')[0]
        path = raw.rstrip('/') or '/'
        if any(path == p or path.startswith(p + '/') or path.startswith(p)
               for p in PRIVATE_PREFIXES):
            self.send_error(404)
            return True
        if path in REDIRECTS:
            self._redirect(REDIRECTS[path])
            return True
        for prefix, target in PREFIX_REDIRECTS.items():
            if raw.startswith(prefix):
                self._redirect(target)
                return True
        return False

    def do_GET(self):
        if not self._route():
            super().do_GET()

    def do_HEAD(self):
        if not self._route():
            super().do_HEAD()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # тишина в логах


if __name__ == '__main__':
    print(f'  SBF Nexus → http://localhost:{PORT}  (no-cache, 301 для старых адресов)')
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()

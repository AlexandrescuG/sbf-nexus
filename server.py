#!/usr/bin/env python3
"""SBF Nexus static server — no-cache headers, SPA routing."""
import http.server, sys, os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
DIR  = os.path.dirname(os.path.abspath(__file__))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def do_GET(self):
        # SPA routing: serve index.html for paths without a file extension
        # (e.g. /ru, /en, /book → all get index.html; JS then redirects)
        path = self.path.split('?')[0].rstrip('/')
        if path and '.' not in os.path.basename(path):
            disk_path = os.path.join(DIR, path.lstrip('/'))
            if not os.path.exists(disk_path):
                self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # тишина в логах

print(f'  SBF Nexus → http://localhost:{PORT}  (no-cache, SPA routing)')
http.server.HTTPServer(('', PORT), NoCacheHandler).serve_forever()

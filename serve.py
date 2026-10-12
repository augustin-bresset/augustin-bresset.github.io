#!/usr/bin/env python3
"""Local preview server.

Like `python3 -m http.server`, but it tells the browser never to reuse a cached file.
Without that, the browser keeps the ES modules it fetched earlier for hours (it has
no expiry to go by, so it guesses one from each file's age), and a plain reload shows
the OLD world after an edit.

    python3 serve.py          # http://127.0.0.1:8137/
    python3 serve.py 9000
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
print(f'http://127.0.0.1:{port}/')
ThreadingHTTPServer(('127.0.0.1', port), NoCache).serve_forever()

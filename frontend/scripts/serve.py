#!/usr/bin/env python3
"""Serve the built web app locally and forward /api calls to the live backend.

The browser only ever talks to this local server, so the backend's cross-site
(CORS) rules never block local testing.

    python3 serve.py                 # http://localhost:8080
    python3 serve.py 9000            # another port
    API=http://127.0.0.1:8000 python3 serve.py   # use a local backend instead
"""
import http.server
import os
import sys
import urllib.error
import urllib.request

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
API = os.environ.get("API", "https://ai-tourism-companion.onrender.com").rstrip("/")
ROOT = os.path.dirname(os.path.abspath(__file__))
HOP_HEADERS = {"host", "connection", "content-length", "transfer-encoding", "origin", "referer", "accept-encoding"}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _proxy(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None
        headers = {k: v for k, v in self.headers.items() if k.lower() not in HOP_HEADERS}
        req = urllib.request.Request(API + self.path, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=120) as res:
                status, res_headers, data = res.status, res.headers, res.read()
        except urllib.error.HTTPError as err:
            status, res_headers, data = err.code, err.headers, err.read()
        except Exception as err:  # backend asleep or offline
            self.send_error(502, f"Backend unreachable: {err}")
            return
        self.send_response(status)
        for key, value in res_headers.items():
            if key.lower() not in HOP_HEADERS and not key.lower().startswith("access-control-"):
                self.send_header(key, value)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _is_api(self):
        return self.path.startswith("/api/") or self.path.split("?")[0] == "/health"

    def do_GET(self):
        if self._is_api():
            self._proxy()
        else:
            super().do_GET()

    def do_POST(self):
        self._proxy()

    def do_PUT(self):
        self._proxy()

    def do_DELETE(self):
        self._proxy()

    def end_headers(self):
        # always load the newest build while testing
        if not self._is_api():
            self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    print(f"UP Heritage Companion: http://localhost:{PORT}  (API -> {API})")
    print("Press Ctrl+C to stop.")
    http.server.ThreadingHTTPServer(("", PORT), Handler).serve_forever()

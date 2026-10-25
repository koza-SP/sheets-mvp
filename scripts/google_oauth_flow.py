#!/usr/bin/env python3
"""
google_oauth_flow.py — Yu専用OAuthクライアント(Desktop app)での認可コードフローを
標準ライブラリのみで実行する。google-auth-oauthlib等の追加インストール不要。

2026-10-25: GTM/GA4/Apps Script(ANYONE_ANONYMOUS webapp)のGoogle側「アプリブロック」を
回避するため、Yu自身がConsole上で作成したOAuthクライアント(テストユーザーにYu自身を
登録済み)を使ってトークンを取得する。

使い方:
  python3 scripts/google_oauth_flow.py

実行すると:
  1. ローカルに一時HTTPサーバーを起動(http://localhost:<port>)
  2. 認可URLをブラウザで開く(Yuがログイン済みのアカウントで許可するだけ)
  3. リダイレクトされたcodeを受け取り、トークンに交換
  4. ~/.config/sheets-mvp-google-token.json に保存(次回以降は自動でrefresh)
"""
import http.server
import json
import os
import socketserver
import ssl
import subprocess
import sys
import threading
import urllib.parse
import urllib.request

try:
    import certifi
    _SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    _SSL_CTX = ssl.create_default_context()

CLIENT_SECRET_FILE = os.path.expanduser(
    "~/Downloads/client_secret_653449305470-hidcp5gefm2f5flcflac5542moghr153.apps.googleusercontent.com.json"
)
TOKEN_FILE = os.path.expanduser("~/.config/sheets-mvp-google-token.json")

SCOPES = [
    "https://www.googleapis.com/auth/script.deployments",
    "https://www.googleapis.com/auth/script.projects",
    "https://www.googleapis.com/auth/script.webapp.deploy",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/tagmanager.edit.containers",
    "https://www.googleapis.com/auth/tagmanager.publish",
    "https://www.googleapis.com/auth/analytics.edit",
    "https://www.googleapis.com/auth/webmasters",
    "https://www.googleapis.com/auth/spreadsheets",
]

_auth_code = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        qs = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(qs)
        if "code" in params:
            _auth_code["code"] = params["code"][0]
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2>認可完了、このタブは閉じて大丈夫です。</h2>".encode("utf-8"))
        else:
            self.send_response(400)
            self.end_headers()

    def log_message(self, fmt, *args):
        pass  # silence default logging


def main():
    with open(CLIENT_SECRET_FILE, encoding="utf-8") as f:
        creds = json.load(f)["installed"]
    client_id = creds["client_id"]
    client_secret = creds["client_secret"]
    auth_uri = creds["auth_uri"]
    token_uri = creds["token_uri"]

    with socketserver.TCPServer(("127.0.0.1", 0), Handler) as httpd:
        port = httpd.server_address[1]
        redirect_uri = f"http://localhost:{port}"

        auth_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "access_type": "offline",
            "prompt": "consent",
        }
        auth_url = f"{auth_uri}?{urllib.parse.urlencode(auth_params)}"

        print(f"[auth] opening browser: {auth_url}")
        subprocess.run(["open", auth_url])

        print("[auth] waiting for redirect callback...")
        thread = threading.Thread(target=httpd.handle_request)
        thread.start()
        thread.join(timeout=180)

        if "code" not in _auth_code:
            print("[auth] ERROR: timed out waiting for authorization")
            sys.exit(1)

        code = _auth_code["code"]

    # exchange code for tokens
    token_params = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    req = urllib.request.Request(
        token_uri,
        data=urllib.parse.urlencode(token_params).encode(),
        method="POST",
    )
    with urllib.request.urlopen(req, context=_SSL_CTX) as resp:
        token_data = json.loads(resp.read().decode())

    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, "w", encoding="utf-8") as f:
        json.dump(
            {
                **token_data,
                "client_id": client_id,
                "client_secret": client_secret,
                "token_uri": token_uri,
            },
            f,
            indent=2,
        )
    os.chmod(TOKEN_FILE, 0o600)
    print(f"[auth] SUCCESS, token saved to {TOKEN_FILE}")


if __name__ == "__main__":
    main()

#!/bin/bash
# go.sh — Yuが実行する唯一のコマンド。
#
# 実行すると:
#   1. Googleログイン画面がブラウザで開く(未ログインの場合のみ)→「許可」をクリック
#   2. Apps Scriptプロジェクトの作成・コード配置・Webアプリデプロイを自動実行
#   3. 発行されたURLを画面に表示
#
# Yuがやることは「このスクリプトを実行する」+「ブラウザで許可ボタンを押す」の2つだけ。
#
# 使い方:
#   bash go.sh

set -e
cd "$(dirname "$0")"

echo "======================================================"
echo " Sheets MVP — Google Apps Script 自動セットアップ"
echo "======================================================"
echo ""
echo "[事前確認] Apps Script APIが有効になっているか確認してください:"
echo "  https://script.google.com/home/usersettings を開き、"
echo "  「Google Apps Script API」のトグルがONになっていることを確認(初回のみ)"
echo ""
read -p "確認できたらEnterキーを押してください... " _

echo ""
echo "[1/4] Googleアカウントへログイン(ブラウザが開きます)..."
npx --yes @google/clasp login || true

cd google-apps-script

echo ""
echo "[2/4] Apps Script プロジェクトを新規作成..."
npx --yes @google/clasp create --type standalone --title "Sheets MVP Backend" --rootDir . 2>&1 || {
  echo "既にプロジェクトが存在する可能性があります。既存の .clasp.json を使って続行します。";
}

echo ""
echo "[3/4] コードをプッシュ..."
npx --yes @google/clasp push --force

echo ""
echo "[4/4] Webアプリとしてデプロイ..."
npx --yes @google/clasp deploy --description "Sheets MVP v1"

echo ""
echo "======================================================"
echo " 完了。以下のコマンドでWeb App URLを確認できます:"
echo "   cd google-apps-script && npx @google/clasp open --webapp"
echo " 表示されたURLをClaudeに伝えてください。"
echo "======================================================"

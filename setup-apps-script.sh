#!/bin/bash
# setup-apps-script.sh — Google Apps Script の作成+デプロイを自動化するスクリプト
#
# 【Yuの作業はこれだけ】
#   1. このスクリプトを実行する前に、1回だけ以下を実行してGoogleアカウントにログインする:
#        npx @google/clasp login
#      → ブラウザが開くのでログイン中のGoogleアカウントで「許可」をクリック
#      → https://script.google.com/home/usersettings を開き
#        「Google Apps Script API」のトグルをONにする(初回のみ、API有効化)
#   2. その後、このスクリプトを実行するだけで、プロジェクト作成・コード配置・
#      デプロイ・Web App URL取得まで全て自動で完了する:
#        bash setup-apps-script.sh
#
# これ以降(clasp loginさえ終われば)は完全に自動化されており、Yuの追加操作は不要。

set -e
cd "$(dirname "$0")/google-apps-script"

echo "[1/4] clasp ログイン状態を確認..."
if ! npx --yes @google/clasp login --status 2>/dev/null; then
  echo "未ログインです。先に 'npx @google/clasp login' を実行してください。"
  exit 1
fi

echo "[2/4] Apps Script プロジェクトを新規作成..."
npx --yes @google/clasp create --type standalone --title "Sheets MVP Backend" --rootDir .

echo "[3/4] コードをプッシュ..."
npx --yes @google/clasp push --force

echo "[4/4] Webアプリとしてデプロイ..."
DEPLOY_OUTPUT=$(npx --yes @google/clasp deploy --description "Sheets MVP v1")
echo "$DEPLOY_OUTPUT"

echo ""
echo "デプロイ完了。Web App URLを確認するには:"
echo "  npx @google/clasp open --webapp"
echo "または https://script.google.com を開いてプロジェクトから確認してください。"

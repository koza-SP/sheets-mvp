# Sheets MVP — 最小疎通ストア

Yu `/goal`指示(2026-09-26)「スプレッドシートベースの動的サーバーレス + 静的ファイルのファイリング構造による実質サーバーレスを構築し、外部世界公開までの手続きを圧倒的速度で通す」への対応。`japan-global-ec`本体(PostgreSQL+Prisma+Next.js)とは完全に独立した、別の最小構成プロジェクト。

## アーキテクチャ

```
[ブラウザ]
   │
   ├─ GET  /index.html               (静的ファイル、Vercelがそのまま配信)
   ├─ GET  /data/products.json       (静的ファイル = "ファイリング構造による実質サーバーレス"、将来Googleスプレッドシートの公開CSVに差替可能)
   │
   ├─ POST /api/checkout             (Vercel Serverless Function、Stripe Checkout Session作成)
   │        └→ Stripe (test mode、japan-global-ec本体と同じtestアカウント acct_1U3E3G0KGFuk6pVo を再利用)
   │
   └─ Stripeからのredirect後 ──→ Stripe Webhook ──→ /api/stripe-webhook
                                                        └→ Google Apps Script Web App (= "スプレッドシートベースの動的サーバーレスDB"書込口)
                                                             └→ Googleスプレッドシート「Orders」シートに1行追加
```

## セットアップ手順(疎通させるための全手順)

### 1. 依存関係インストール(完了済み)
```bash
npm install
```

### 2. Vercel環境変数の設定(必須、以下3つ)

| 変数名 | 値 | 備考 |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_51U3...`(japan-global-ec本体の`.env.local`と同じ値) | 新規Stripeアカウント作成は不要、既存test鍵を再利用 |
| `STRIPE_WEBHOOK_SECRET_MVP` | Stripeダッシュボードで本プロジェクト用エンドポイントを新規登録して取得 | 未設定でも動くが署名検証がスキップされる(疎通確認フェーズの暫定) |
| `APPS_SCRIPT_WEBAPP_URL` | `google-apps-script/Code.gs`の手順でYuがデプロイして得るURL | **これだけはYuの手動作業が必須**(後述) |

### 3. Googleスプレッドシート側のセットアップ(Yu作業、1回のみ)

`google-apps-script/Code.gs`のファイル冒頭コメントに詳細手順を記載。要約:

1. Googleスプレッドシート新規作成、シート名を「Orders」に変更
2. 拡張機能→Apps Script を開き、`Code.gs`の内容を貼り付けて保存
3. デプロイ→新しいデプロイ→ウェブアプリ→アクセス「全員」→デプロイ
4. 発行されたURLを`APPS_SCRIPT_WEBAPP_URL`としてVercelに設定

### 4. デプロイ

```bash
npx vercel deploy --temporary --yes
```
(`--temporary`によりVercelアカウントへのログイン無しで即座に公開URLを取得できる。後でYuのアカウントに「claim」して恒久化可能)

### 5. E2E動作確認

1. 公開URLを開く→商品3件が表示されることを確認
2. 「購入」ボタン→Stripeのtest checkoutページへ遷移することを確認
3. test card(`4242 4242 4242 4242`、任意の未来日付/CVC)で決済
4. `/?success=1`にリダイレクトされることを確認
5. (Apps Script接続済みなら)Googleスプレッドシートの「Orders」シートに1行追加されていることを確認

## 現状ステータス(2026-09-26)

- [x] 静的商品一覧ページ
- [x] Stripe Checkout連携(test鍵再利用)
- [x] Apps Script書込コード作成済み(Yuのデプロイ待ち)
- [ ] Vercelデプロイ+公開URL取得
- [ ] E2E実機確認(test決済1回)
- [ ] Google Apps Script実デプロイ(Yu作業)

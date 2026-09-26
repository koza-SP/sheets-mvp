# Sheets MVP — 最小疎通ストア(サーバー無し構成)

Yu `/goal`指示(2026-09-26)「スプレッドシートベースの動的サーバーレス + 静的ファイルのファイリング構造による実質サーバーレスを構築し、外部世界公開までの手続きを圧倒的速度で通す」への対応。`japan-global-ec`本体(PostgreSQL+Prisma+Next.js)とは完全に独立した、別の最小構成プロジェクト。

## アーキテクチャ(2026-09-26改訂版、Vercel完全撤廃)

初版はVercel Serverless Functionを使う構成だったが、**Yuのアカウント紐付け作業(claim)が必須になってしまい「外部世界公開までの手続きを全て通す」を完結できなかった**ため、サーバーを一切使わない構成に作り直した。

```
[ブラウザ]
   │
   ├─ GitHub Pages(静的ファイルのみ、恒久URL、アカウント作業不要 ※既存gh認証を利用して公開済み)
   │     ├─ index.html
   │     └─ data/products.json  ← "ファイリング構造による実質サーバーレス"、将来Googleスプレッドシート公開CSVに差替可能
   │
   ├─ 「購入」ボタン = Stripe Payment Link(https://buy.stripe.com/test_...)への直リンク
   │     └→ Stripe側で恒久ホストされるcheckoutページ(サーバー不要、API一発で作成済み)
   │
   └─ 決済完了 → Stripe Webhook → Google Apps Script Web App(URLがそのままWebhookエンドポイント)
                                       └→ Googleスプレッドシート「Orders」シートに1行追加
                                          (= "スプレッドシートベースの動的サーバーレスDB")
```

**このバージョンでは中間サーバーが一切存在しない**(静的ファイル + Stripeホスト型ページ + Google Apps Script のみ)。

## セットアップ状況(2026-09-26時点)

| # | 項目 | ステータス |
|---|---|---|
| 1 | 静的サイト(商品一覧) | ✅完了 |
| 2 | Stripe Payment Link 3件作成(test mode、既存test鍵`acct_1U3E3G0KGFuk6pVo`利用) | ✅完了、`public/data/products.json`に埋込済 |
| 3 | GitHub Pages公開 | 実施中(このREADME更新と同じcommitで対応) |
| 4 | Google Apps Scriptデプロイ | **Yu作業待ち**(下記手順) |
| 5 | Stripe Webhookエンドポイント登録 | Yuがステップ4のURLを教えてくれ次第、Claudeが代行(Stripe API経由、ダッシュボード操作不要) |

## Yu作業(残り1つだけ、所要10分)

`google-apps-script/Code.gs`のファイル冒頭コメントに詳細手順を記載。要約:

1. Googleスプレッドシート新規作成、シート名を「Orders」に変更
2. 拡張機能→Apps Script を開き、`Code.gs`の内容を貼り付け
3. `SHARED_SECRET`の値を任意の文字列に変更(メモしておく)
4. デプロイ→新しいデプロイ→ウェブアプリ→アクセス「全員」→デプロイ
5. 発行されたURLの末尾に`?secret=<3で決めた文字列>`を付けたものをClaudeに伝える

→ これでClaudeがStripe API経由でWebhook登録を代行し、全工程が完了する。

## Payment Link一覧(test mode、既に有効)

| 商品 | URL |
|---|---|
| 宇治抹茶パウダー 100g | https://buy.stripe.com/test_cNi5kvgP63iWcOCdzRew800 |
| 南部鉄瓶(小) | https://buy.stripe.com/test_6oU7sD6asdXA6qefHZew801 |
| 有田焼 湯呑みセット | https://buy.stripe.com/test_9B6cMXfL24n06qefHZew802 |

test card: `4242 4242 4242 4242`、任意の未来日付/CVC/郵便番号で決済可能。

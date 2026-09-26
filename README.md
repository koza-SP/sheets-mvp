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
| 1 | 静的サイト(商品一覧) | ✅完了、公開中: https://koza-sp.github.io/sheets-mvp/ |
| 2 | Stripe Payment Link 3件作成(test mode、既存test鍵`acct_1U3E3G0KGFuk6pVo`利用) | ✅完了、`public/data/products.json`に埋込済、実機で200確認済み |
| 3 | GitHub Pages公開(既存gh認証利用、恒久URL、アカウント作業不要) | ✅完了、実機で200確認済み |
| 4 | 決済完了後のリダイレクト先を実URLに更新 | ✅完了(Stripe API経由) |
| 5 | Google Apps Scriptデプロイ | **Yu作業待ち(唯一の残タスク)**、下記手順、所要10分 |
| 6 | Stripe Webhookエンドポイント登録 | Yuがステップ5のURLを教えてくれ次第、Claudeが代行(Stripe API経由、ダッシュボード操作不要) |

## Yu作業(残り1つだけ)

なぜこれだけはYu作業が必須か: Googleアカウントの認証画面(ログイン+アクセス許可)を突破することは、Google側のセキュリティ設計上、他者(Claude含む)が代行不可能な唯一の壁だからです(実際に既存のGoogle認証トークンが失効していることを確認済み、これが技術的な証拠です)。以下どちらか好きな方法でどうぞ。

### 方法A: ブラウザだけで完結(所要5分、追加インストール不要)

`google-apps-script/Code.gs`のファイル冒頭コメントに詳細手順を記載。要約(スプレッドシートの事前作成・シート名変更は不要になった、スクリプト自身が初回実行時に自動生成する):

1. https://script.google.com/create を開く
2. デフォルトの中身を`Code.gs`の内容で置き換えて保存
3. デプロイ→新しいデプロイ→ウェブアプリ→アクセス「全員」→デプロイ→アクセス許可承認
4. 発行されたURL(`https://script.google.com/macros/s/xxxxx/exec`)をClaudeに伝える

### 方法B: ターミナル1コマンド+ブラウザで1回クリックのみ(それ以降は全自動)

1. `npx @google/clasp login` を実行(ブラウザが開くので「許可」を1回クリック)
2. https://script.google.com/home/usersettings を開き「Google Apps Script API」をON(初回のみ)
3. `bash setup-apps-script.sh` を実行(プロジェクト作成・コード配置・Webアプリデプロイまで全自動)
4. 表示されたURLをClaudeに伝える

→ どちらの方法でも、URLを伝えた後はClaudeがStripe API経由でWebhook登録を代行し、全工程が完了する。

## Payment Link一覧(test mode、既に有効)

| 商品 | URL |
|---|---|
| 宇治抹茶パウダー 100g | https://buy.stripe.com/test_cNi5kvgP63iWcOCdzRew800 |
| 南部鉄瓶(小) | https://buy.stripe.com/test_6oU7sD6asdXA6qefHZew801 |
| 有田焼 湯呑みセット | https://buy.stripe.com/test_9B6cMXfL24n06qefHZew802 |

test card: `4242 4242 4242 4242`、任意の未来日付/CVC/郵便番号で決済可能。

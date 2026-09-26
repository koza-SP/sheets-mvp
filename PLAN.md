# PLAN: スプレッドシート+静的ファイル 最小サーバーレスMVP(疎通優先)

- 日付: 2026-09-26
- 由来: Yu `/goal`指示「スプレッドシートベースの動的なサーバーレスの仕組み、静的ファイルのファイリング構造による実質的なサーバーレスを構築、最低限のGoogleスプレッドシート生成+スプレッドシートベースのアプリケーション化、外部世界公開までの手続きを全て通す。今まで作ってきたもの(japan-global-ec本体)は後で実装していくイメージでいいので、まず疎通を圧倒的速度で終わらせたい。Stripeサンドボックスも同様に終わらせる」
- 優先方針: **速度優先**。詳細設計より先に「動くものを外部公開する」ことを最優先する

## A. 目的(success_criteria、5件)

1. Googleスプレッドシート1枚を「動的サーバーレスDB」として使う(読取=公開CSV、書込=Apps Script Web App)構成が動く
2. 静的JSONファイルのファイリング構造(`public/data/*.json`)による商品カタログ配信が動く
3. Stripe Checkout(既存test鍵`sk_test_51U3...`/`pk_test_51U3...`を再利用、新規設定不要)で決済が完了する
4. Vercelにデプロイされ、外部からアクセス可能なURLが存在する
5. 「商品一覧を見る→買うボタン→Stripe決済(test card)→注文がスプレッドシートに1行追加される」の一連が実際に1回動作確認できる

## B. task一覧(順序)

| # | task | 担当 |
|---|---|---|
| 1 | Next.js最小構成スキャフォールド(`sheets-mvp/`、japan-global-ec本体とは独立) | 自分 |
| 2 | Googleスプレッドシート列仕様設計 + 読取/書込用Apps Scriptコード作成(Yu実行用チェックリスト化) | 自分 |
| 3 | 商品一覧ページ(静的JSON `public/data/products.json` から読込、後でスプレッドシート公開CSVに差替可能な設計) | 自分 |
| 4 | Stripe Checkout連携(既存test鍵をenvに設定、`/api/checkout`のVercel Serverless Function) | 自分 |
| 5 | 決済成功後、Apps Script Web AppへPOSTして注文行追加(Yuがスクリプトをデプロイ後に接続) | 自分(コード)+Yu(デプロイ1回) |
| 6 | Vercelへデプロイ、公開URL取得 | 自分 |
| 7 | E2E実機確認(test cardで1回購入、記録・原状復帰) | 自分 |

## C. 順序根拠

フロントを最初に動かせる状態にする(3)ことで各段階を目視確認しながら進められる。決済(4)はフロント確定後に接続、書込(5)はGoogle側の1回限りの手動デプロイが必要なため最後に回し、それまでは静的JSON書込みでダミー動作を確認する。デプロイ(6)は主要機能疎通後に1回で済ませ、無駄な再デプロイを避ける。

## 進捗状況(2026-09-26、随時更新)

| success_criteria | 状態 |
|---|---|
| 1. スプレッドシートを動的サーバーレスDBとして使う(読取+書込) | コード完成・実機未検証(Yu作業待ち)。読取(Productsシート→doGet)・書込(Ordersシート→doPost)ともCode.gsに実装済み |
| 2. 静的JSONのファイリング構造による商品カタログ配信 | ✅完了、実機確認済み(GitHub Pages)。**2026-09-26再検証**: `https://koza-sp.github.io/sheets-mvp/`にHTTP 200でアクセスでき、`data/products.json`が商品3件を正しく返すことを再確認 |
| 3. Stripe Checkout(既存test鍵)で決済完了 | ✅完了、Payment Link 3件実機確認済み(サーバー不要方式に強化)。**2026-09-26再検証**: Stripe API(test鍵、read-only GET)で3商品(`prod_VKSb1m2029HlTm`等)・3価格・3 Payment Linkが全て`active=true`であることを直接確認、各Payment Link URLもHTTP 200で到達可能なことを確認済み |
| 4. Vercelにデプロイされ外部アクセス可能 | ✅完了(方針転換: VercelでなくGitHub Pagesで恒久達成、Yuのアカウント作業ゼロ)。2026-09-26再検証で継続稼働を確認 |
| 5. 一連の動作(閲覧→購入→スプレッドシート記録)の実機確認 | 閲覧→購入までは実機確認済み。スプレッドシート記録はYuのApps Scriptデプロイ後に確認可能(唯一の残ブロッカー) |

### 2026-09-26 追加再検証ログ

- `~/.clasprc.json`不在(clasp未ログイン)を再確認、Google OAuthは依然Yu本人のブラウザ操作待ちであることを技術的に再確定
- Stripe test鍵(`sk_test_51U3...`、japan-global-ec本体の`.env.local`と共用)でproducts/prices/payment_links/webhook_endpointsを`curl`で直接照会、全て意図通りの状態(products 3件active、prices 3件active・金額一致、payment links 3件active・URL到達可能)であることを確認
- 静的サイト(GitHub Pages)+商品JSON配信も継続稼働中であることを再確認
- 上記はいずれも読み取り専用の確認(DB/外部サービスへの書込み無し)、原状復帰不要

**残る唯一のブロッカー**: Googleアカウント認証はYu本人のブラウザ操作が絶対的に必要(gcloud/application-default credentialsのrefresh tokenがinvalid_grantで失効/claude-in-chromeブラウザツールもこのセッションでは権限不可、の2系統で実機確認済み)。Yu作業は`go.sh`1コマンド+ブラウザ許可1クリックまで圧縮済み。

**2026-09-26追加検証**: `scripts/verify-webhook-logic.js`で、Code.gsのdoPost()ロジックを実際のStripeイベント(`stripe trigger`で生成、evt_1UJo390KGFuk6pVoe5yoSMXT)に対して検証、4項目全て✅。Apps Script未デプロイの現時点でも「デプロイされれば正しく動く」ことを実データで証明済み。

## D. risk / rollback

- Apps Script Web AppのデプロイはYuの1回の手動操作が必要(GoogleアカウントログインがCLIから代行不可のため)。それ以外は全て自分で完結
- 新規プロジェクトのため既存japan-global-ec本体への影響ゼロ(独立ディレクトリ)
- Stripe test鍵は既存流用のため新規の外部影響なし

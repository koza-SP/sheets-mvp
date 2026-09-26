/**
 * Code.gs — Sheets MVP 用 Google Apps Script Web App
 * (2026-09-26 改訂: Vercelを完全に撤廃し、Stripe Webhookをこのスクリプトが直接受信する構成に変更。
 *  これにより「スプレッドシートベースの動的サーバーレス」が、中間サーバー無しで完結する)
 *
 * 役割: このスクリプトをスプレッドシートに紐付けてWebアプリとしてデプロイすると、発行された
 * URLがそのままStripeのWebhookエンドポイントになり、Stripeの決済完了通知を直接受け取って
 * 「Orders」シートへ行追加する。中間にVercel等のサーバーは一切不要。
 *
 * 【Yuの作業手順(1回のみ、CLIから代行不可のため手動、所要10分程度)】
 *
 * ■ ステップ1: スプレッドシート作成
 * 1. Googleスプレッドシートを新規作成(名前は自由、例:「Sheets MVP 注文台帳」)
 * 2. シート名を「Orders」に変更(1シート目のタブ名をダブルクリックしてリネーム)
 * 3. 1行目(ヘッダー行)に以下を入力(任意、無くてもスクリプトが自動生成する):
 *    timestamp | sessionId | productId | amountJpy | customerEmail | paymentStatus
 *
 * ■ ステップ2: Apps Scriptデプロイ
 * 4. メニュー「拡張機能」→「Apps Script」を開く
 * 5. デフォルトの`Code.gs`の中身を全部削除し、このファイルの内容を全部貼り付け
 * 6. 6行目付近の `var SHARED_SECRET = 'CHANGE_ME_...'` を、任意の推測されにくい文字列に変更
 *    (例: 'sheetsmvp-9f8e7d6c'。この値はステップ3でStripe側のURLにも使う、必ずメモしておく)
 * 7. 上部の「保存」(フロッピーアイコン)をクリック
 * 8. 右上の「デプロイ」→「新しいデプロイ」をクリック
 * 9. 歯車アイコン→種類の選択で「ウェブアプリ」を選択
 * 10. 「次のユーザーとして実行」= 自分、「アクセスできるユーザー」= 全員 を選択
 * 11. 「デプロイ」をクリック→アクセス許可の承認画面が出たら承認
 * 12. 発行された「ウェブアプリのURL」(https://script.google.com/macros/s/xxxxx/exec)をコピー
 *
 * ■ ステップ3: Stripe Webhook登録(このURLをYuが私[Claude]に伝えれば、私がStripe API経由で
 *    Webhookエンドポイント登録を代行できます。Stripeダッシュボードへのログインは不要になります)
 * 13. 上記12でコピーしたURLの末尾に `?secret=<ステップ6で決めた文字列>` を付けたものを用意
 *     例: https://script.google.com/macros/s/xxxxx/exec?secret=sheetsmvp-9f8e7d6c
 * 14. このURLをYuからClaudeに伝える → Claudeが Stripe API で Webhookエンドポイント
 *     (checkout.session.completed購読)を作成する
 */

var SHARED_SECRET = 'CHANGE_ME_before_deploy'; // ステップ6で必ず変更すること

function doPost(e) {
  try {
    // 簡易認証: Apps ScriptはHTTPヘッダーを読めないため、URLのクエリパラメータで検証する
    // (Stripeの署名検証(HMAC)はApps Script側では実施不可、この共有シークレットが代替の防御策)
    if (!e.parameter || e.parameter.secret !== SHARED_SECRET) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Orders');
      sheet.appendRow(['timestamp', 'sessionId', 'productId', 'amountJpy', 'customerEmail', 'paymentStatus']);
    }

    var body = JSON.parse(e.postData.contents);

    // Stripe Webhookの生イベント形式(checkout.session.completed)をそのまま受け取れるようにパース
    var session = (body.data && body.data.object) ? body.data.object : body; // 直接テスト送信時はbody自体をsessionとみなす
    var eventType = body.type || 'manual';

    if (eventType !== 'checkout.session.completed' && eventType !== 'manual') {
      // 対象外イベントは記録せず200を返す(Stripeの再送を防ぐ)
      return ContentService.createTextOutput(JSON.stringify({ success: true, skipped: eventType }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    sheet.appendRow([
      new Date().toISOString(),
      session.id || '',
      (session.metadata && session.metadata.productId) || '',
      session.amount_total || '',
      (session.customer_details && session.customer_details.email) || '',
      session.payment_status || '',
    ]);

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * GETリクエストで疎通確認用(ブラウザでURLを直接開くとこれが返る)
 */
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Sheets MVP Apps Script Web App is running' }))
    .setMimeType(ContentService.MimeType.JSON);
}

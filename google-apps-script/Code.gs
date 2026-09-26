/**
 * Code.gs — Sheets MVP 用 Google Apps Script Web App
 *
 * 役割: このスクリプトをスプレッドシートに紐付けてWebアプリとしてデプロイすると、
 * 発行されたURLへのPOSTリクエストが「Orders」シートへの行追加として書き込まれる。
 * これが「スプレッドシートベースの動的サーバーレスDB」の書込口になる。
 *
 * 【Yuの作業手順(1回のみ、CLIから代行不可のため手動)】
 * 1. Googleスプレッドシートを新規作成(名前は自由、例:「Sheets MVP 注文台帳」)
 * 2. シート名を「Orders」に変更(1シート目のタブ名をダブルクリックしてリネーム)
 * 3. 1行目(ヘッダー行)に以下を入力:
 *    timestamp | sessionId | productId | productName | amountJpy | customerEmail | paymentStatus
 * 4. メニュー「拡張機能」→「Apps Script」を開く
 * 5. デフォルトの`Code.gs`の中身を全部削除し、このファイルの内容を全部貼り付け
 * 6. 上部の「保存」(フロッピーアイコン)をクリック
 * 7. 右上の「デプロイ」→「新しいデプロイ」をクリック
 * 8. 歯車アイコン→種類の選択で「ウェブアプリ」を選択
 * 9. 「次のユーザーとして実行」= 自分、「アクセスできるユーザー」= 全員 を選択
 * 10. 「デプロイ」をクリック→アクセス許可の承認画面が出たら承認
 * 11. 発行された「ウェブアプリのURL」(https://script.google.com/macros/s/xxxxx/exec)をコピー
 * 12. このURLを Vercel の環境変数 `APPS_SCRIPT_WEBAPP_URL` に設定する
 *     (Vercelダッシュボード → プロジェクト → Settings → Environment Variables)
 *
 * これで、Stripe決済完了時にこのスプレッドシートへ自動的に注文が1行追加されるようになる。
 */

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Orders');
    if (!sheet) {
      // Ordersシートが無ければ自動作成(ヘッダー行付き)
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Orders');
      sheet.appendRow(['timestamp', 'sessionId', 'productId', 'productName', 'amountJpy', 'customerEmail', 'paymentStatus']);
    }

    var data = JSON.parse(e.postData.contents);

    sheet.appendRow([
      data.timestamp || new Date().toISOString(),
      data.sessionId || '',
      data.productId || '',
      data.productName || '',
      data.amountJpy || '',
      data.customerEmail || '',
      data.paymentStatus || '',
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

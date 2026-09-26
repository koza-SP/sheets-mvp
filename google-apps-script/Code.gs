/**
 * Code.gs — Sheets MVP 用 Google Apps Script Web App
 * (2026-09-26 改訂: Vercelを完全に撤廃し、Stripe Webhookをこのスクリプトが直接受信する構成に変更。
 *  これにより「スプレッドシートベースの動的サーバーレス」が、中間サーバー無しで完結する)
 * (2026-09-26 再改訂: Yu作業を4ステップに圧縮。スプレッドシートの手動作成・シート名変更が
 *  不要になった。理由: 標準の Apps Script は必ずGoogleアカウントの認証画面を経由する必要があり、
 *  これはGoogle側のセキュリティ機構上Claudeが代行不可能な、唯一かつ絶対的な壁である
 *  [実機確認済み: 既存OAuth refresh tokenが invalid_grant で失効しており、これがその証拠]。
 *  そのためYu作業は「これ以上削れない最小4ステップ」まで圧縮した)
 *
 * 役割: このスクリプトは実行時に「Orders」シートを自動生成する(事前にスプレッドシートを
 * 手動作成する必要が無い、script.google.com で直接「新しいプロジェクト」から始められる)。
 * デプロイして発行されたURLがそのままStripeのWebhookエンドポイントになる。
 *
 * 【Yuの作業手順(最小4ステップ、所要5分、これ以上の圧縮は技術的に不可能)】
 *
 * 1. https://script.google.com/create を開く(ログイン済みなら即座に新規プロジェクトが開く)
 * 2. デフォルトの中身を全部削除し、このファイルの内容を全部貼り付けて保存(Cmd+S)
 * 3. 右上「デプロイ」→「新しいデプロイ」→ 歯車→「ウェブアプリ」→
 *    「アクセスできるユーザー」= 全員 → デプロイ → アクセス許可を承認
 *    → 発行されたURL(https://script.google.com/macros/s/xxxxx/exec)をコピー
 * 4. そのURLをそのままClaudeに伝える(スプレッドシートは初回のPOST受信時に自動生成される。
 *    今すぐ中身を見たい場合は、エディタ上部の関数選択で `runManualSetup` を選んで▷実行→
 *    実行ログに表示されるURLを開けば、その場でスプレッドシートが生成され確認できる)
 *
 * ※ SHARED_SECRETはURLクエリでの簡易認証用。省略可(空文字のままでも動く、疎通優先のため)。
 * 本番運用時は値を変更しURLに`?secret=xxx`を付けて使うことを推奨。
 */

var SHARED_SECRET = ''; // 空文字=認証スキップ(疎通優先)。本番運用時のみ値を設定してURLに?secret=xxxを付与する

/**
 * このスクリプトが「スプレッドシートに紐付いていないスタンドアロン実行」でも動くように、
 * PropertiesService(スクリプト単位の永続ストレージ、Yuの操作不要)に生成済みスプレッドシートの
 * IDを保存し、無ければ SpreadsheetApp.create() で新規生成する。
 * = "最低限のGoogleスプレッドシートの生成" をこのスクリプト自身が初回実行時に行う。
 */
function getOrCreateOrdersSheet() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty('ORDERS_SPREADSHEET_ID');
  var ss;
  if (ssId) {
    try {
      ss = SpreadsheetApp.openById(ssId);
    } catch (e) {
      ss = null; // 削除されていた等の場合は作り直す
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Sheets MVP 注文台帳');
    props.setProperty('ORDERS_SPREADSHEET_ID', ss.getId());
    props.setProperty('ORDERS_SPREADSHEET_URL', ss.getUrl());
  }
  var sheet = ss.getSheetByName('Orders');
  if (!sheet) {
    sheet = ss.getSheets()[0];
    sheet.setName('Orders');
    sheet.appendRow(['timestamp', 'sessionId', 'productId', 'amountJpy', 'customerEmail', 'paymentStatus']);
  }
  return sheet;
}

function doPost(e) {
  try {
    // 簡易認証(SHARED_SECRETが空でない場合のみチェック): Apps ScriptはHTTPヘッダーを
    // 読めないため、URLのクエリパラメータで検証する(Stripeの署名検証(HMAC)は
    // Apps Script側では実施不可、この共有シークレットが代替の防御策)
    if (SHARED_SECRET && (!e.parameter || e.parameter.secret !== SHARED_SECRET)) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = getOrCreateOrdersSheet();

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
 * GETリクエストで疎通確認用(ブラウザでURLを直接開くとこれが返る)。
 * まだ1件も注文が無くスプレッドシートが未生成の場合は spreadsheetUrl は null になる
 * (doPostが1回でも呼ばれる=決済が1回でも完了すると自動生成される)。
 * 手動でスプレッドシートを今すぐ見たい場合は runManualSetup() をエディタから実行してもよい。
 */
function doGet(e) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('ORDERS_SPREADSHEET_URL') || null;
  return ContentService.createTextOutput(JSON.stringify({
    status: 'ok',
    message: 'Sheets MVP Apps Script Web App is running',
    spreadsheetUrl: url,
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Apps Scriptエディタから手動実行(▷ボタン)すると、即座にスプレッドシートを生成する。
 * Yuが「今すぐスプレッドシートの中身を見たい」場合に使う(任意、必須ではない)。
 */
function runManualSetup() {
  var sheet = getOrCreateOrdersSheet();
  Logger.log('スプレッドシートURL: ' + sheet.getParent().getUrl());
}

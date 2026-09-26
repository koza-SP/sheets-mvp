// api/stripe-webhook.js
// Stripe Webhook受信口。checkout.session.completed を受けたら、
// Googleスプレッドシート側のApps Script Web App(APPS_SCRIPT_WEBAPP_URL)へ
// 注文データをPOSTし、スプレッドシートに1行追記させる(=「動的サーバーレスDB」への書込)。
//
// 前提: Yuが `google-apps-script/Code.gs` の内容をGoogleスプレッドシートの
// 拡張機能 > Apps Script に貼り付け、「デプロイ > 新しいデプロイ > ウェブアプリ」
// で発行したURLを、Vercel環境変数 APPS_SCRIPT_WEBAPP_URL に設定する必要がある
// (この1手順のみ、Yuの手動操作が必須。CLIから代行不可)。
//
// Vercel Node.js runtimeでは raw body が必要なため config.api.bodyParser を無効化。

const Stripe = require('stripe');
const getRawBody = require('raw-body');

module.exports.config = {
  api: { bodyParser: false },
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end('Method not allowed');
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_MVP; // sheets-mvp専用のwebhook secret(japan-global-ec本体とは別のエンドポイントのため別途Stripeダッシュボードでエンドポイント登録が必要)
  const appsScriptUrl = process.env.APPS_SCRIPT_WEBAPP_URL;

  const stripe = new Stripe(stripeSecretKey);
  const rawBody = await getRawBody(req);

  let event;
  try {
    if (webhookSecret) {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } else {
      // webhook secret未設定時は署名検証をスキップ(疎通確認フェーズの暫定措置、本番前に必ずSTRIPE_WEBHOOK_SECRET_MVPを設定すること)
      event = JSON.parse(rawBody.toString());
      console.warn('[stripe-webhook] WARNING: signature verification skipped (STRIPE_WEBHOOK_SECRET_MVP not set)');
    }
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderRow = {
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      productId: session.metadata?.productId || '',
      productName: session.metadata?.productName || '',
      amountJpy: session.amount_total,
      customerEmail: session.customer_details?.email || '',
      paymentStatus: session.payment_status,
    };

    if (appsScriptUrl) {
      try {
        const resp = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderRow),
        });
        console.log('[stripe-webhook] Apps Script write status:', resp.status);
      } catch (err) {
        console.error('[stripe-webhook] Apps Script write failed:', err.message);
        // Stripeへは200を返す(注文自体は成立しているため、書込失敗はログのみで再送に任せない設計。
        // 再送させたい場合は500を返しStripeのリトライに委ねる方針に変更可)
      }
    } else {
      console.warn('[stripe-webhook] APPS_SCRIPT_WEBAPP_URL not set, order not persisted:', orderRow);
    }
  }

  res.status(200).json({ received: true });
};

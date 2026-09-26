#!/usr/bin/env node
/**
 * register-stripe-webhook.js
 *
 * Yuからgoogle-apps-script Web App URLを受け取った瞬間に即実行するための準備済みスクリプト。
 * これにより「YuがURLを教えてくれてから完了までの遅延」をゼロに近づける。
 *
 * 使い方:
 *   STRIPE_SECRET_KEY=sk_test_xxx node scripts/register-stripe-webhook.js <AppsScriptURL>
 *
 * 実行内容:
 *   1. 指定URLをエンドポイントとするStripe Webhookを作成(checkout.session.completed購読)
 *   2. public/data/config.json の appsScriptUrl を更新
 *   3. 作成結果(webhook secret含む)を表示
 */

const Stripe = require('../node_modules/stripe');
const fs = require('fs');
const path = require('path');

async function main() {
  const appsScriptUrl = process.argv[2];
  if (!appsScriptUrl) {
    console.error('使い方: node register-stripe-webhook.js <AppsScriptURL>');
    process.exit(1);
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY 環境変数が未設定です');
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey);

  console.log('[1/2] Stripe Webhookエンドポイントを作成中...');
  const webhookEndpoint = await stripe.webhookEndpoints.create({
    url: appsScriptUrl,
    enabled_events: ['checkout.session.completed'],
    description: 'Sheets MVP — Google Apps Script webhook (2026-09-26作成)',
  });
  console.log('作成完了:', webhookEndpoint.id);
  console.log('Webhook Secret(Apps Script側の署名検証には未使用、参考情報):', webhookEndpoint.secret);

  console.log('[2/2] config.json を更新中...');
  const configPath = path.join(__dirname, '..', 'public', 'data', 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  config.appsScriptUrl = appsScriptUrl;
  config.stripeWebhookId = webhookEndpoint.id;
  config.note = 'Google Apps Script連携済み(2026-09-26)。index.htmlはこのappsScriptUrlから商品データを動的取得する。';
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
  console.log('config.json 更新完了。git commit + push + GitHub Pages再デプロイを忘れずに実施すること。');
}

main().catch((err) => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

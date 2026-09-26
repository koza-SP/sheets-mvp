// api/checkout.js
// Vercel Serverless Function (Node.js runtime、フレームワーク不使用)
// POST { productId } を受け取り、Stripe Checkout Sessionを作成してURLを返す。
// Stripe鍵は japan-global-ec 本体で既に稼働確認済みのtest鍵(acct_1U3E3G0KGFuk6pVo)を
// Vercel環境変数 STRIPE_SECRET_KEY として再利用する(新規Stripeアカウント作成は不要)。

const Stripe = require('stripe');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    res.status(500).json({ error: 'STRIPE_SECRET_KEY 未設定(Vercel環境変数を確認してください)' });
    return;
  }

  const stripe = new Stripe(stripeSecretKey);

  try {
    const { productId } = req.body || {};
    if (!productId) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }

    // 静的JSON(ファイリング構造)から商品データを読む
    const productsPath = path.join(process.cwd(), 'public', 'data', 'products.json');
    const { products } = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    const product = products.find((p) => p.id === productId);
    if (!product) {
      res.status(404).json({ error: 'product not found' });
      return;
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: product.currency || 'jpy',
            product_data: { name: product.name },
            unit_amount: product.stripePriceCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/?success=1`,
      cancel_url: `${origin}/?canceled=1`,
      metadata: {
        productId: product.id,
        productName: product.name,
      },
    });

    res.status(200).json({ url: session.url, id: session.id });
  } catch (err) {
    console.error('[api/checkout] error:', err);
    res.status(500).json({ error: err.message || 'internal error' });
  }
};

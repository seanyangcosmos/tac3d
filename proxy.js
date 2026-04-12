const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const db = new Database(path.join(__dirname, 'tac3d.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS screenings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decision TEXT,
    verdict TEXT,
    tension INTEGER,
    alignment INTEGER,
    convergence INTEGER,
    eligibility_index INTEGER,
    verdict_summary TEXT,
    full_result TEXT,
    access_key TEXT
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    email TEXT,
    access_key TEXT UNIQUE,
    plan TEXT,
    used_count INTEGER DEFAULT 0,
    limit_count INTEGER DEFAULT 3,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    active INTEGER DEFAULT 1
  );
`);

const app = express();

// raw body for stripe webhook
app.use('/api/stripe-webhook', express.raw({ type: 'application/json' }));
app.use(cors());
app.use(express.json());
app.use(express.static('templates'));
app.get('/screener', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'screener.html'));
});
// generate access key
function generateKey(plan) {
  const prefix = plan === 'trial' ? 'TAC-TRIAL' : plan === 'pro' ? 'TAC-PRO' : 'TAC-TEAM';
  const rand = crypto.randomBytes(12).toString('hex').toUpperCase();
  return `${prefix}-${rand.slice(0,4)}-${rand.slice(4,8)}-${rand.slice(8,12)}`;
}

// send email via Resend
async function sendKeyEmail(email, key, plan) {
  const fetch = (await import('node-fetch')).default;
  const planNames = { trial: 'Free Trial', pro: 'Pro', team: 'Team' };
  const limits = { trial: 3, pro: 50, team: 200 };
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'TAC-3D <noreply@tac3d.sycds.com>',
      to: email,
      subject: `Your TAC-3D ${planNames[plan]} Access Key`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:40px 20px">
          <div style="background:#1a56db;padding:16px 24px;border-radius:8px 8px 0 0">
            <span style="color:#fff;font-family:monospace;font-size:14px;font-weight:600;letter-spacing:.1em">TAC-3D</span>
            <span style="color:rgba(255,255,255,.6);font-size:13px;margin-left:12px">Decision Eligibility Screener</span>
          </div>
          <div style="background:#f9f9f9;border:1px solid #e5e7eb;border-top:none;padding:32px 24px;border-radius:0 0 8px 8px">
            <h2 style="font-size:20px;color:#111;margin:0 0 8px">Your ${planNames[plan]} Access Key</h2>
            <p style="color:#666;font-size:14px;margin:0 0 24px">Copy and paste this key into TAC-3D to get started.</p>
            <div style="background:#fff;border:2px dashed #1a56db;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
              <code style="font-family:monospace;font-size:16px;color:#1a56db;font-weight:600;letter-spacing:.05em">${key}</code>
            </div>
            <div style="background:#dbeafe;border-radius:6px;padding:14px 18px;margin-bottom:24px">
              <strong style="color:#1a56db;font-size:13px">Plan: ${planNames[plan]}</strong><br>
              <span style="color:#444;font-size:13px">${limits[plan]} screenings included</span>
            </div>
            <a href="https://tac3d.sycds.com" style="display:inline-block;background:#1a56db;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600">Open TAC-3D →</a>
          </div>
        </div>
      `
    })
  });
}

// FREE TRIAL endpoint
app.post('/api/trial', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  // check if already has trial
  const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'This email already has an access key.' });

  const key = generateKey('trial');
  db.prepare('INSERT INTO users (email, access_key, plan, limit_count) VALUES (?, ?, ?, ?)').run(email, key, 'trial', 3);

  try { await sendKeyEmail(email, key, 'trial'); } catch(e) { console.log('Email error:', e.message); }

  res.json({ success: true, key });
});

// VALIDATE KEY endpoint
app.post('/api/validate-key', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key required' });
  const user = db.prepare('SELECT * FROM users WHERE access_key = ?').get(key);
  if (!user) return res.status(401).json({ error: 'Invalid access key.' });
  if (!user.active) return res.status(401).json({ error: 'This key has been deactivated.' });
  if (user.used_count >= user.limit_count) return res.status(403).json({ error: 'Usage limit reached. Please upgrade your plan.', upgrade: true });
  res.json({ valid: true, plan: user.plan, used: user.used_count, limit: user.limit_count });
});

// CHAT endpoint (with key validation)
app.post('/api/chat', async (req, res) => {
  const key = req.headers['x-access-key'];
  if (!key) return res.status(401).json({ error: 'Access key required.' });

  const user = db.prepare('SELECT * FROM users WHERE access_key = ?').get(key);
  if (!user) return res.status(401).json({ error: 'Invalid access key.' });
  if (!user.active) return res.status(401).json({ error: 'This key has been deactivated.' });
  if (user.used_count >= user.limit_count) return res.status(403).json({ error: 'Usage limit reached. Please upgrade your plan.', upgrade: true });

  const fetch = (await import('node-fetch')).default;
  try {
    const body = {
      model: req.body.model || 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      system: req.body.system,
      messages: req.body.messages,
      tools: [{ type: "web_search_20250305", name: "web_search" }]
    };

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05'
      },
      body: JSON.stringify(body)
    });

    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); }
    catch(e) { return res.status(500).json({ error: 'API returned non-JSON' }); }

    const textContent = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    if (!textContent) {
      return res.status(500).json({ error: 'No text in response. stop_reason: ' + data.stop_reason });
    }

    // increment usage
    db.prepare('UPDATE users SET used_count = used_count + 1 WHERE access_key = ?').run(key);

    // save screening
    try {
      const match = textContent.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        if (result.scores && result.verdict) {
          const decision = (req.body.messages[0] && req.body.messages[0].content || '').substring(0, 500);
          db.prepare(`INSERT INTO screenings (decision, verdict, tension, alignment, convergence, eligibility_index, verdict_summary, full_result, access_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(decision, result.verdict, result.scores.tension, result.scores.alignment, result.scores.convergence, result.scores.eligibility_index, result.verdict_summary || '', JSON.stringify(result), key);
        }
      }
    } catch(e) { console.log('DB save error:', e.message); }

    res.json({ content: [{ type: 'text', text: textContent }] });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// HISTORY endpoint (key-scoped)
app.get('/api/history', (req, res) => {
  const key = req.headers['x-access-key'];
  try {
    const rows = key
      ? db.prepare('SELECT * FROM screenings WHERE access_key = ? ORDER BY created_at DESC LIMIT 50').all(key)
      : db.prepare('SELECT * FROM screenings ORDER BY created_at DESC LIMIT 50').all();
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// USAGE endpoint
app.get('/api/usage', (req, res) => {
  const key = req.headers['x-access-key'];
  if (!key) return res.status(401).json({ error: 'Key required' });
  const user = db.prepare('SELECT plan, used_count, limit_count FROM users WHERE access_key = ?').get(key);
  if (!user) return res.status(401).json({ error: 'Invalid key' });
  res.json(user);
});

// STRIPE WEBHOOK
app.post('/api/stripe-webhook', async (req, res) => {
  const fetch = (await import('node-fetch')).default;
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.log('Webhook error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    const priceId = session.metadata?.price_id;

    const planMap = {
      'price_1TLHuhPzaDhTbSXM5jUv8y1u': { plan: 'pro', limit: 50 },
      'price_1TLHvYPzaDhTbSXMVYPAc5QR': { plan: 'team', limit: 200 }
    };
    const planInfo = planMap[priceId] || { plan: 'pro', limit: 50 };

    if (email) {
      // deactivate old trial key if exists
      db.prepare('UPDATE users SET active = 0 WHERE email = ? AND plan = ?').run(email, 'trial');

      const key = generateKey(planInfo.plan);
      db.prepare('INSERT OR REPLACE INTO users (email, access_key, plan, limit_count, stripe_customer_id) VALUES (?, ?, ?, ?, ?)')
        .run(email, key, planInfo.plan, planInfo.limit, session.customer);

      try { await sendKeyEmail(email, key, planInfo.plan); } catch(e) { console.log('Email error:', e.message); }
    }
  }

  res.json({ received: true });
});

// STRIPE CHECKOUT SESSION
app.post('/api/create-checkout', async (req, res) => {
  const { priceId, email } = req.body;
  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { price_id: priceId },
      success_url: 'https://tac3d.sycds.com?success=1',
      cancel_url: 'https://tac3d.sycds.com?canceled=1'
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Proxy running on port 3000'));

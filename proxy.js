const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tac3d.db'));

// init table
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
    full_result TEXT
  )
`);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('templates'));

app.post('/api/chat', async (req, res) => {
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

    // save to DB if first round (has scores)
    try {
      const match = textContent.match(/\{[\s\S]*\}/);
      if (match) {
        const result = JSON.parse(match[0]);
        if (result.scores && result.verdict) {
          const decision = (req.body.messages[0] && req.body.messages[0].content || '').substring(0, 500);
          db.prepare(`
            INSERT INTO screenings (decision, verdict, tension, alignment, convergence, eligibility_index, verdict_summary, full_result)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            decision,
            result.verdict,
            result.scores.tension,
            result.scores.alignment,
            result.scores.convergence,
            result.scores.eligibility_index,
            result.verdict_summary || '',
            JSON.stringify(result)
          );
        }
      }
    } catch(e) { console.log('DB save error:', e.message); }

    res.json({ content: [{ type: 'text', text: textContent }] });

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// history endpoint
app.get('/api/history', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM screenings ORDER BY created_at DESC LIMIT 50').all();
    res.json(rows);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('Proxy running on port 3000'));

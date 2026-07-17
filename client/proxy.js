const express = require('express');
const fetch = require('node-fetch');
const config = require('./config.json');

const app = express();
app.use(express.json({ limit: '5mb' }));

let stats = { received: 0, sent: 0, errors: 0 };

app.post('/ingest', async (req, res) => {
  stats.received++;
  const payload = Array.isArray(req.body) ? req.body : [req.body];

  try {
    const response = await fetch(`${config.server}/api/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[proxy] servidor respondeu ${response.status}: ${text}`);
      stats.errors++;
      return res.status(502).json({ error: 'servidor rejeitou', detail: text });
    }

    const data = await response.json();
    stats.sent++;
    console.log(`[proxy] ${data.inserted || payload.length} registros enviados`);
    res.json({ ok: true, forwarded: data.inserted || payload.length });
  } catch (err) {
    stats.errors++;
    console.error(`[proxy] erro ao enviar: ${err.message}`);
    res.status(502).json({ error: 'falha ao conectar com o servidor', detail: err.message });
  }
});

app.get('/stats', (req, res) => {
  res.json(stats);
});

const PORT = config.proxyPort || 3456;
app.listen(PORT, () => {
  console.log(`[proxy] rodando em http://localhost:${PORT}`);
  console.log(`[proxy] encaminhando pra ${config.server}/api/ingest`);
});

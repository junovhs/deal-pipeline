// Server-side proxy to TypeSafe Jev (DEC-07). The API key lives only in the
// JEV_API_KEY environment variable on Vercel and never reaches the browser.
// Only the deal-matching question shapes are forwarded.
const ALLOWED = /^(status|match|adds_w\d{1,3})$/;
const MAX_BYTES = 60_000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.JEV_API_KEY;
  if (!key) return res.status(503).json({ error: 'JEV_API_KEY is not set on the server' });

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const { state, questions } = body;
  if (!state || !questions || typeof questions !== 'object') return res.status(400).json({ error: 'state and questions are required' });
  if (!Object.keys(questions).every(id => ALLOWED.test(id))) return res.status(400).json({ error: 'unexpected question' });
  const payload = JSON.stringify({ model: 'jev-latest', state, questions });
  if (payload.length > MAX_BYTES) return res.status(413).json({ error: 'request too large' });

  const upstream = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: payload,
  });
  const json = await upstream.json().catch(() => ({ error: 'bad upstream response' }));
  return res.status(upstream.status).json(json);
}

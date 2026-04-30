import { getAuthedEmail } from './_auth.js';
import { checkAndIncrementRateLimit } from './_rateLimit.js';
import { logAuthEvent } from './_authLog.js';

const REQUESTS_PER_DAY = parseInt(process.env.RATE_LIMIT_PER_DAY || '80');
const MAX_TOKENS       = parseInt(process.env.MAX_TOKENS        || '1500');

export default async function handler(req, res) {
  // Kein CORS-Header gesetzt → Same-Origin-only.
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check — signiertes Cookie via _auth.js
  const authedEmail = getAuthedEmail(req);
  if (!authedEmail) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Persistent rate limit — geteilt mit Copilot über Supabase-Tabelle copilot_rate_limits
  const limit = await checkAndIncrementRateLimit(authedEmail, REQUESTS_PER_DAY);
  if (!limit.allowed) {
    await logAuthEvent(req, { event: 'rate_limited', email: authedEmail });
    return res.status(429).json({
      error: 'rate_limit',
      message: `Tageslimit erreicht. Noch ${limit.resetInMinutes} Minuten bis zum Reset.`,
    });
  }

  // Cap max_tokens — verhindert dass ein Request das ganze Budget frisst
  const body = { ...req.body };
  if (!body.max_tokens || body.max_tokens > MAX_TOKENS) {
    body.max_tokens = MAX_TOKENS;
  }

  // Proxy to Anthropic
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    res.setHeader('X-RateLimit-Remaining', limit.remaining);
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'API error', detail: err.message });
  }
}

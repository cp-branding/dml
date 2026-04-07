// ─── In-memory rate limiter ───────────────────────────────────────────────────
// Resets on server restart (Vercel Serverless: alle ~15min bei Inaktivität).
// Für persistentes Limiting → Upstash Redis ergänzen (siehe Kommentar unten).
const rateLimitMap = new Map();

const REQUESTS_PER_DAY = parseInt(process.env.RATE_LIMIT_PER_DAY || '80');
const MAX_TOKENS       = parseInt(process.env.MAX_TOKENS        || '1500');
const WINDOW_MS        = 24 * 60 * 60 * 1000; // 24h

function getRateLimitKey(req) {
  // Prefer email over IP — more accurate per-user limiting
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/mk_user=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  // Fallback to IP
  const forwarded = req.headers['x-forwarded-for'];
  return forwarded ? forwarded.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
}

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: REQUESTS_PER_DAY - 1 };
  }

  if (entry.count >= REQUESTS_PER_DAY) {
    const resetIn = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000 / 60);
    return { allowed: false, resetInMinutes: resetIn };
  }

  entry.count++;
  return { allowed: true, remaining: REQUESTS_PER_DAY - entry.count };
}
// ─────────────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const cookie = req.headers.cookie || '';
  const sessionValid = cookie.includes(`mk_session=${process.env.SESSION_SECRET}`);
  if (!sessionValid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Rate limit check
  const key = getRateLimitKey(req);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
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

// ─── Upgrade auf persistentes Limiting mit Upstash Redis ─────────────────────
// Falls du wirklich viele User hast und Serverless-Restarts ein Problem werden:
//
// 1. npm install @upstash/ratelimit @upstash/redis
// 2. Upstash-Account anlegen (kostenlos bis 10k req/day): upstash.com
// 3. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN als Env Vars eintragen
// 4. rateLimitMap oben ersetzen durch:
//
//    import { Ratelimit } from '@upstash/ratelimit';
//    import { Redis } from '@upstash/redis';
//    const ratelimit = new Ratelimit({
//      redis: Redis.fromEnv(),
//      limiter: Ratelimit.slidingWindow(80, '1 d'),
//    });
//    const { success, remaining } = await ratelimit.limit(key);
// ─────────────────────────────────────────────────────────────────────────────

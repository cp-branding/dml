// api/video-status.js
// GET  → prüft ob User das Video gesehen hat
// POST → markiert Video als gesehen (mit Zeitstempel)

import { serialize, parse } from 'cookie';

function getEmailFromSession(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.session;
  if (!token) return null;

  try {
    const [payload, sig] = token.split('.');
    const secret = process.env.SESSION_SECRET || 'fallback-secret';
    const expected = require('crypto').createHmac('sha256', secret).update(payload).digest('hex');
    if (sig !== expected) return null;
    const { email } = JSON.parse(Buffer.from(payload, 'base64').toString());
    return email || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const email = getEmailFromSession(req);
  if (!email) return res.status(401).json({ error: 'Nicht eingeloggt' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service Role Key (nicht anon!)

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase nicht konfiguriert' });
  }

  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  // ── GET: Hat dieser User das Video gesehen? ──
  if (req.method === 'GET') {
    const url = `${supabaseUrl}/rest/v1/video_completions?email=eq.${encodeURIComponent(email)}&select=watched_at&limit=1`;
    const r = await fetch(url, { headers });
    const data = await r.json();
    const seen = Array.isArray(data) && data.length > 0;
    return res.status(200).json({ seen, watched_at: seen ? data[0].watched_at : null });
  }

  // ── POST: Video als gesehen markieren ──
  if (req.method === 'POST') {
    const url = `${supabaseUrl}/rest/v1/video_completions`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        'Prefer': 'resolution=merge-duplicates', // upsert: kein Duplikat wenn schon vorhanden
      },
      body: JSON.stringify({
        email,
        watched_at: new Date().toISOString(),
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

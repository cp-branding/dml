// api/video-status.js
// GET  → prüft ob User das Video gesehen hat
// POST → markiert Video als gesehen (mit Zeitstempel)

import { getAuthedEmail } from './_auth.js';

export default async function handler(req, res) {
  const email = getAuthedEmail(req);
  if (!email) return res.status(401).json({ error: 'Nicht eingeloggt' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  const headers = {
    'Content-Type': 'application/json',
    'apikey': supabaseKey,
    'Authorization': `Bearer ${supabaseKey}`,
  };

  if (req.method === 'GET') {
    const url = `${supabaseUrl}/rest/v1/video_completions?email=eq.${encodeURIComponent(email)}&select=watched_at&limit=1`;
    const r = await fetch(url, { headers });
    const data = await r.json();
    const seen = Array.isArray(data) && data.length > 0;
    return res.status(200).json({ seen, watched_at: seen ? data[0].watched_at : null });
  }

  if (req.method === 'POST') {
    const url = `${supabaseUrl}/rest/v1/video_completions`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ email, watched_at: new Date().toISOString() }),
    });
    if (!r.ok) {
      const err = await r.text();
      return res.status(500).json({ error: err });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

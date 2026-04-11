// api/login.js
// Nach erfolgreichem Login → Weiterleitung zur Onboarding-Seite
// Die Onboarding-Seite prüft selbst, ob das Video schon gesehen wurde (Cookie)

import { serialize } from 'cookie';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  // USERS aus Env laden (JSON-Array)
  let users = [];
  try {
    users = JSON.parse(process.env.USERS || '[]');
  } catch {
    return res.status(500).json({ error: 'Konfigurationsfehler' });
  }

  const user = users.find(
    u => u.email === email && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  }

  // Session-Cookie setzen
  const secret  = process.env.SESSION_SECRET || 'fallback-secret';
  const payload = Buffer.from(JSON.stringify({ email: user.email, ts: Date.now() })).toString('base64');
  const sig     = require('crypto').createHmac('sha256', secret).update(payload).digest('hex');
  const token   = `${payload}.${sig}`;

  res.setHeader('Set-Cookie', serialize('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 Tage
    path: '/',
  }));

  // ✅ Immer zur Onboarding-Seite — die leitet weiter wenn Video schon gesehen
  return res.status(200).json({ redirect: '/onboarding.html' });
}

// api/login.js
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  let users = [];
  try {
    users = JSON.parse(process.env.USERS || '[]');
  } catch {
    return res.status(500).json({ error: 'Konfigurationsfehler' });
  }

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'E-Mail oder Passwort falsch.' });
  }

  const secret  = process.env.SESSION_SECRET || 'fallback-secret';
  const payload = Buffer.from(JSON.stringify({ email: user.email, ts: Date.now() })).toString('base64');
  const sig     = require('crypto').createHmac('sha256', secret).update(payload).digest('hex');
  const token   = `${payload}.${sig}`;

  // Kein externes 'cookie' Paket — manuell serialisiert
  const cookieStr = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', cookieStr);

  return res.status(200).json({ redirect: '/onboarding.html' });
}

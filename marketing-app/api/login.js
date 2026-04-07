// USERS env var format (JSON array):
// [{"email":"max@beispiel.de","password":"geheim123"},{"email":"anna@firma.de","password":"sicher456"}]
//
// In Vercel: Settings → Environment Variables → USERS → JSON einfügen

function getUsers() {
  try {
    return JSON.parse(process.env.USERS || '[]');
  } catch {
    return [];
  }
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Ungültige Email.' });
  }

  const users = getUsers();
  const normalizedEmail = email.toLowerCase().trim();
  const user = users.find(
    u => u.email.toLowerCase() === normalizedEmail && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Email oder Passwort falsch.' });
  }

  const encodedEmail = encodeURIComponent(normalizedEmail);

  res.setHeader('Set-Cookie', [
    `mk_session=${process.env.SESSION_SECRET}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`,
    `mk_user=${encodedEmail}; Path=/; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`
  ]);

  return res.status(200).json({ ok: true });
}

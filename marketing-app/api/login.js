export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body;

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Ungültige Email.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=email,password&limit=1`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!r.ok) return res.status(500).json({ error: 'Datenbankfehler.' });

  const rows = await r.json();
  const user = rows[0];

  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Email oder Passwort falsch.' });
  }

  const encodedEmail = encodeURIComponent(normalizedEmail);

  res.setHeader('Set-Cookie', [
    `mk_session=${process.env.SESSION_SECRET}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`,
    `mk_user=${encodedEmail}; Path=/; Secure; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}`
  ]);

  return res.status(200).json({ ok: true });
}

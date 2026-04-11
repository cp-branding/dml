export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=email,password&limit=1`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    }
  );
  if (!r.ok) {
    return res.status(500).json({ error: 'DB error' });
  }
  const rows = await r.json();
  const user = rows[0];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOpts = `Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [
    `mk_session=${process.env.SESSION_SECRET}; ${cookieOpts}`,
    `mk_user_email=${encodeURIComponent(user.email)}; ${cookieOpts}`
  ]);

  // ✅ Zur Onboarding-Seite — die prüft ob Video schon gesehen wurde
  return res.status(200).json({ redirect: '/onboarding.html' });
}

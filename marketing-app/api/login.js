export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
 
  const { email, password } = req.body;
 
  // Parse USERS env var: [{"email":"...","password":"..."},...]
  let users = [];
  try {
    users = JSON.parse(process.env.USERS || '[]');
  } catch {
    return res.status(500).json({ error: 'Server configuration error' });
  }
 
  const user = users.find(
    u => u.email === email && u.password === password
  );
 
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
 
  const isProd = process.env.NODE_ENV === 'production';
  const cookieOpts = `Path=/; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
 
  // Set session cookie (auth token)
  // Set email cookie (readable by auth.js to identify the user)
  res.setHeader('Set-Cookie', [
    `mk_session=${process.env.SESSION_SECRET}; ${cookieOpts}`,
    `mk_user_email=${encodeURIComponent(user.email)}; ${cookieOpts}`
  ]);
 
  return res.status(200).json({ ok: true });
}
 

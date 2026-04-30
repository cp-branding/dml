import { buildAuthCookie } from './_auth.js';
import { verifyPassword, hashPassword, isHashed } from './_password.js';
import { isLocked, recordFailure, clearAttempts } from './_loginAttempts.js';
import { logAuthEvent } from './_authLog.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const email = typeof body.email === 'string' ? body.email : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (email.length > 320 || password.length > 200) {
    return res.status(400).json({ error: 'Ungültige Eingabe.' });
  }
  if (!email || !email.includes('@') || !password) {
    return res.status(400).json({ error: 'Email und Passwort erforderlich.' });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Brute-Force-Lockout-Check VOR DB-Abfrage
  const lock = await isLocked(normalizedEmail);
  if (lock.locked) {
    await logAuthEvent(req, { event: 'lockout', email: normalizedEmail });
    return res.status(429).json({
      error: 'too_many_attempts',
      message: `Zu viele Fehlversuche. Bitte in ${lock.retryInMinutes} Minuten erneut versuchen.`,
    });
  }

  const sbHeaders = {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  };

  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}&select=email,password&limit=1`,
    { headers: sbHeaders }
  );
  if (!r.ok) {
    return res.status(500).json({ error: 'DB error' });
  }
  const rows = await r.json();
  const user = rows[0];

  if (!user || !(await verifyPassword(password, user.password))) {
    await recordFailure(normalizedEmail);
    await logAuthEvent(req, { event: 'login_failed', email: normalizedEmail });
    return res.status(401).json({ error: 'Email oder Passwort falsch.' });
  }

  // Erfolgreicher Login → alte Failure-Records aufräumen
  await clearAttempts(normalizedEmail);
  await logAuthEvent(req, { event: 'login_success', email: normalizedEmail });

  // Auto-Migration: Klartext → Hash beim ersten Login. Fehler hier blockieren den Login NICHT.
  if (!isHashed(user.password)) {
    try {
      const newHash = await hashPassword(password);
      await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(normalizedEmail)}`,
        {
          method: 'PATCH',
          headers: { ...sbHeaders, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ password: newHash }),
        }
      );
    } catch {
      // ignore — User ist eingeloggt, Hash-Update beim nächsten Mal
    }
  }

  res.setHeader('Set-Cookie', buildAuthCookie(normalizedEmail));
  return res.status(200).json({ redirect: '/onboarding.html' });
}

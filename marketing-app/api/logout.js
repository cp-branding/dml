import { clearAuthCookie, getAuthedEmail } from './_auth.js';
import { logAuthEvent } from './_authLog.js';

export default async function handler(req, res) {
  const email = getAuthedEmail(req);
  if (email) {
    await logAuthEvent(req, { event: 'logout', email });
  }
  // mk_session/mk_user_email sind Legacy — sicherheitshalber auch entfernen.
  res.setHeader('Set-Cookie', [
    clearAuthCookie(),
    'mk_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
    'mk_user_email=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0',
  ]);
  res.redirect(302, '/login');
}

// Auth-Audit-Logging gegen Supabase.
// SQL-Schema siehe: supabase/copilot_auth_log.sql (im Copilot-Repo)

const APP_NAME = 'dml-kurs';

function getIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string') return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || null;
}

function getUserAgent(req) {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' ? ua.slice(0, 500) : null;
}

export async function logAuthEvent(req, { event, email = null }) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/copilot_auth_log`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({
        event,
        email,
        ip: getIp(req),
        user_agent: getUserAgent(req),
        app: APP_NAME,
        created_at: new Date().toISOString(),
      }),
    });
  } catch {
    // ignore
  }
}

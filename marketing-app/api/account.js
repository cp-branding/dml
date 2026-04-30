// DSGVO-Endpoints für den eingeloggten User.
//
// GET    /api/account → liefert alle eigenen Daten als JSON-Download (Art. 20 DSGVO).
// DELETE /api/account → löscht Account und alle eigenen Daten in allen Tabellen (Art. 17 DSGVO).
//
// Auth-Log (copilot_auth_log) bleibt erhalten — berechtigtes Interesse (Art. 6 Abs. 1 lit. f),
// 30-Tage-Retention dort. Wird in der Datenschutzerklärung erwähnt.

import { getAuthedEmail, clearAuthCookie } from './_auth.js';
import { logAuthEvent } from './_authLog.js';

// Tabellen mit user-bezogenen Daten. Spalten-Map: welche Spalte enthält die Email.
// Wir betreffen ALLE User-Tabellen aus Copilot UND Kurs (gleicher Datenbestand, gleiche Email-Identität).
const USER_TABLES = [
  { table: 'copilot_profiles',          col: 'user_email' },
  { table: 'copilot_sessions',          col: 'user_email' },
  { table: 'copilot_profile_summaries', col: 'user_email' },
  { table: 'user_progress',             col: 'user_email' },     // DML-Kurs
  { table: 'video_completions',         col: 'email' },          // DML-Kurs
  { table: 'copilot_login_attempts',    col: 'email' },
  { table: 'copilot_rate_limits',       col: 'email' },
  // users wird zuletzt gelöscht (FK-Reihenfolge spielt hier keine Rolle, da kein FK existiert)
];

function sbHeaders() {
  return {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function fetchAllForUser(email) {
  const out = { email, exported_at: new Date().toISOString(), data: {} };
  // users-Profil zuerst (ohne Password-Hash)
  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=email,created_at`,
      { headers: sbHeaders() }
    );
    if (r.ok) out.data.users = await r.json();
  } catch { out.data.users = []; }

  for (const { table, col } of USER_TABLES) {
    try {
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(email)}&select=*`,
        { headers: sbHeaders() }
      );
      out.data[table] = r.ok ? await r.json() : { error: 'fetch_failed', status: r.status };
    } catch (e) {
      out.data[table] = { error: 'fetch_threw', detail: String(e?.message || e) };
    }
  }
  return out;
}

async function deleteAllForUser(email) {
  const errors = [];
  for (const { table, col } of USER_TABLES) {
    try {
      const r = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE', headers: sbHeaders() }
      );
      if (!r.ok) errors.push({ table, status: r.status });
    } catch (e) {
      errors.push({ table, error: String(e?.message || e) });
    }
  }
  // users zuletzt
  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: sbHeaders() }
    );
    if (!r.ok) errors.push({ table: 'users', status: r.status });
  } catch (e) {
    errors.push({ table: 'users', error: String(e?.message || e) });
  }
  return errors;
}

export default async function handler(req, res) {
  const email = getAuthedEmail(req);
  if (!email) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    const payload = await fetchAllForUser(email);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="marketing-copilot-export-${email.replace(/[^a-z0-9._-]/gi, '_')}.json"`
    );
    return res.status(200).json(payload);
  }

  if (req.method === 'DELETE') {
    const errors = await deleteAllForUser(email);
    await logAuthEvent(req, { event: 'account_deleted', email });

    // Cookie wegnehmen, damit das Frontend automatisch zum Login redirected
    res.setHeader('Set-Cookie', clearAuthCookie());

    if (errors.length > 0) {
      // Teil-Löschung — Fehler dem User mitteilen, damit er manuell nachhaken kann.
      return res.status(207).json({ ok: false, errors });
    }
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

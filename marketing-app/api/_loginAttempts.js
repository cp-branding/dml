// Brute-Force-Schutz: zählt Failures pro email über die letzten WINDOW_MINUTES.
// SQL-Schema siehe: supabase/copilot_login_attempts.sql

const MAX_FAILURES = 5;
const WINDOW_MINUTES = 15;

function sbHeaders() {
  return {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Prüft, ob die email aktuell für Login gesperrt ist.
// Returns { locked: bool, retryInMinutes: number }.
// Bei DB-Fehler: { locked: false } — kein Lockout, damit ein DB-Ausfall den Login nicht blockiert.
export async function isLocked(email) {
  const sinceIso = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/copilot_login_attempts` +
    `?email=eq.${encodeURIComponent(email)}` +
    `&attempted_at=gte.${encodeURIComponent(sinceIso)}` +
    `&select=attempted_at` +
    `&order=attempted_at.asc`;
  try {
    const r = await fetch(url, { headers: sbHeaders() });
    if (!r.ok) return { locked: false };
    const rows = await r.json();
    if (!Array.isArray(rows) || rows.length < MAX_FAILURES) return { locked: false };
    const oldestInWindow = new Date(rows[0].attempted_at).getTime();
    const unlockAt = oldestInWindow + WINDOW_MINUTES * 60 * 1000;
    const retryInMinutes = Math.max(1, Math.ceil((unlockAt - Date.now()) / 60 / 1000));
    return { locked: true, retryInMinutes };
  } catch {
    return { locked: false };
  }
}

export async function recordFailure(email) {
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/copilot_login_attempts`, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email, attempted_at: new Date().toISOString() }),
    });
  } catch {
    // ignore — Failure-Tracking darf den Login-Pfad nicht crashen
  }
}

export async function clearAttempts(email) {
  try {
    await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/copilot_login_attempts?email=eq.${encodeURIComponent(email)}`,
      { method: 'DELETE', headers: sbHeaders() }
    );
  } catch {
    // ignore — Cleanup-Fehler ist nicht kritisch
  }
}

// Persistentes Rate-Limit gegen Supabase (geteilt zwischen Copilot + DML-Kurs).
// SQL-Schema siehe: supabase/copilot_rate_limits.sql
//
// Pattern: zähle Zeilen mit email=X in den letzten 24h.
// Bei < max → erlaube + lege neue Zeile an.
// Bei ≥ max → 429.

const WINDOW_HOURS = 24;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

function sbHeaders() {
  return {
    'apikey': process.env.SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Prüft Limit und legt bei Erlaubnis eine neue Zeile an.
// Returns { allowed, remaining, resetInMinutes }.
// Bei DB-Fehler: { allowed: true } — Rate-Limit darf den Chat nicht blockieren.
export async function checkAndIncrementRateLimit(email, max) {
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const url =
    `${process.env.SUPABASE_URL}/rest/v1/copilot_rate_limits` +
    `?email=eq.${encodeURIComponent(email)}` +
    `&called_at=gte.${encodeURIComponent(sinceIso)}` +
    `&select=called_at` +
    `&order=called_at.asc`;

  let rows;
  try {
    const r = await fetch(url, { headers: sbHeaders() });
    if (!r.ok) return { allowed: true, remaining: max - 1, resetInMinutes: 0 };
    rows = await r.json();
    if (!Array.isArray(rows)) rows = [];
  } catch {
    return { allowed: true, remaining: max - 1, resetInMinutes: 0 };
  }

  if (rows.length >= max) {
    const oldestInWindow = new Date(rows[0].called_at).getTime();
    const unlockAt = oldestInWindow + WINDOW_MS;
    const resetInMinutes = Math.max(1, Math.ceil((unlockAt - Date.now()) / 60 / 1000));
    return { allowed: false, remaining: 0, resetInMinutes };
  }

  // Increment: neue Zeile schreiben (Fehler hier nicht-blockierend)
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/copilot_rate_limits`, {
      method: 'POST',
      headers: { ...sbHeaders(), 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email, called_at: new Date().toISOString() }),
    });
  } catch {
    // ignore
  }

  return {
    allowed: true,
    remaining: Math.max(0, max - rows.length - 1),
    resetInMinutes: 0,
  };
}

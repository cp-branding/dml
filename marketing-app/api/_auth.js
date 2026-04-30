// Zentrale Auth-Helper für alle API-Endpoints.
// Cookie-Schema: mk_auth = base64url(email).base64url(issuedAtMs).hmacSha256
// Der HMAC bindet email+issuedAt an SESSION_SECRET → Cookie-Manipulation = HMAC stimmt nicht → 401.

import crypto from 'crypto';

const COOKIE_NAME = 'mk_auth';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage
const MAX_AGE_MS = MAX_AGE_SECONDS * 1000;

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}
function b64urlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8');
}

function sign(email, issuedAtMs) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET fehlt');
  return crypto
    .createHmac('sha256', secret)
    .update(`${email}.${issuedAtMs}`)
    .digest('base64url');
}

// Verwendet timingSafeEqual gegen Timing-Attacks beim HMAC-Vergleich.
function safeEqual(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function buildAuthCookie(email) {
  const issuedAt = Date.now();
  const sig = sign(email, issuedAt);
  const value = `${b64url(email)}.${b64url(String(issuedAt))}.${sig}`;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${MAX_AGE_SECONDS}`;
}

export function clearAuthCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

// Liest und verifiziert die Auth aus dem Request-Cookie.
// Returns email (lowercased) wenn gültig, sonst null.
export function getAuthedEmail(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  const parts = match[1].split('.');
  if (parts.length !== 3) return null;

  let email, issuedAtStr;
  try {
    email = b64urlDecode(parts[0]);
    issuedAtStr = b64urlDecode(parts[1]);
  } catch {
    return null;
  }

  const issuedAt = parseInt(issuedAtStr, 10);
  if (!Number.isFinite(issuedAt)) return null;

  // Ablauf
  if (Date.now() - issuedAt > MAX_AGE_MS) return null;

  // HMAC verifizieren
  const expectedSig = sign(email, issuedAt);
  if (!safeEqual(parts[2], expectedSig)) return null;

  return email;
}

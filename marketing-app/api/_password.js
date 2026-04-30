// Passwort-Hashing mit Node-built-in scrypt (kein npm-Package nötig).
// Format: $scrypt$N=16384,r=8,p=1$<saltB64>$<hashB64>
// verifyPassword akzeptiert auch Klartext (Übergangsphase) — siehe isHashed.

import crypto from 'crypto';

const N = 16384;   // CPU/memory cost — empfohlen ≥ 2^14 für Login
const r = 8;
const p = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;
const HASH_PREFIX = '$scrypt$';

export function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(HASH_PREFIX);
}

export function hashPassword(plain) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LEN);
    crypto.scrypt(plain, salt, KEY_LEN, { N, r, p }, (err, derivedKey) => {
      if (err) return reject(err);
      const saltB64 = salt.toString('base64');
      const hashB64 = derivedKey.toString('base64');
      resolve(`${HASH_PREFIX}N=${N},r=${r},p=${p}$${saltB64}$${hashB64}`);
    });
  });
}

// Verifiziert plain gegen stored. Akzeptiert sowohl gehashte als auch Klartext-Werte.
// Bei Klartext: timingSafeEqual gegen Timing-Attacks.
export function verifyPassword(plain, stored) {
  if (typeof stored !== 'string' || !stored) return Promise.resolve(false);

  if (!isHashed(stored)) {
    // Legacy-Klartext-Vergleich (Übergangsphase)
    const a = Buffer.from(plain);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return Promise.resolve(false);
    return Promise.resolve(crypto.timingSafeEqual(a, b));
  }

  // Format: $scrypt$N=...,r=...,p=...$<salt>$<hash>
  const parts = stored.split('$');
  if (parts.length !== 5) return Promise.resolve(false);
  const params = parts[2];
  const saltB64 = parts[3];
  const expectedHashB64 = parts[4];

  const paramMap = Object.fromEntries(
    params.split(',').map(kv => kv.split('=').map(s => s.trim()))
  );
  const Np = parseInt(paramMap.N, 10);
  const rp = parseInt(paramMap.r, 10);
  const pp = parseInt(paramMap.p, 10);
  if (!Np || !rp || !pp) return Promise.resolve(false);

  return new Promise((resolve, reject) => {
    crypto.scrypt(plain, Buffer.from(saltB64, 'base64'), KEY_LEN, { N: Np, r: rp, p: pp }, (err, derivedKey) => {
      if (err) return reject(err);
      const a = derivedKey;
      const b = Buffer.from(expectedHashB64, 'base64');
      if (a.length !== b.length) return resolve(false);
      resolve(crypto.timingSafeEqual(a, b));
    });
  });
}

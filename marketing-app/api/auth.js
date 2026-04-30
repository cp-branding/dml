import { getAuthedEmail } from './_auth.js';

export default function handler(req, res) {
  const email = getAuthedEmail(req);
  if (email) {
    return res.status(200).json({ authenticated: true, email });
  }
  return res.status(401).json({ authenticated: false });
}

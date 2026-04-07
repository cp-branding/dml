export default function handler(req, res) {
  const cookie = req.headers.cookie || '';
  const sessionValid = cookie.includes(`mk_session=${process.env.SESSION_SECRET}`);

  if (sessionValid) {
    return res.status(200).json({ authenticated: true });
  } else {
    return res.status(401).json({ authenticated: false });
  }
}

export default function handler(req, res) {
  res.setHeader('Set-Cookie', 'mk_session=; Path=/; HttpOnly; Secure; Max-Age=0');
  res.redirect(302, '/login');
}

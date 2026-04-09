export default function handler(req, res) {
  const cookie = req.headers.cookie || '';
 
  // Parse cookies into a key-value map
  const cookies = Object.fromEntries(
    cookie.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
 
  const sessionValid = cookies['mk_session'] === process.env.SESSION_SECRET;
 
  if (sessionValid) {
    return res.status(200).json({
      authenticated: true,
      email: cookies['mk_user_email'] || ''
    });
  } else {
    return res.status(401).json({ authenticated: false });
  }
}
 

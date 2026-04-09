export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const cookies = req.headers.cookie || '';
  if (!cookies.includes(`mk_session=${process.env.SESSION_SECRET}`))
    return res.status(401).json({ error: 'Unauthorized' });

  // ✅ Correct cookie name: mk_user_email
  const emailMatch = cookies.match(/mk_user_email=([^;]+)/);
  if (!emailMatch) return res.status(401).json({ error: 'No user cookie' });
  const userEmail = decodeURIComponent(emailMatch[1]);

  const r = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/user_progress?user_email=eq.${encodeURIComponent(userEmail)}&select=module_key,summary_text,chat_msgs,answer_count`,
    {
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
      }
    }
  );

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: 'DB error', detail: err });
  }

  const rows = await r.json();
  const summaries = {}, chats = {};

  for (const row of rows) {
    if (row.summary_text) summaries[row.module_key] = row.summary_text;
    if (row.chat_msgs?.length) {
      chats[row.module_key] = { msgs: row.chat_msgs, answerCount: row.answer_count };
    }
  }

  return res.status(200).json({ summaries, chats });
}

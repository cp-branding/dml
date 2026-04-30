import { getAuthedEmail } from './_auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const userEmail = getAuthedEmail(req);
  if (!userEmail) return res.status(401).json({ error: 'Unauthorized' });

  const { moduleKey, summaryText, chatMsgs, answerCount } = req.body;
  if (!moduleKey) return res.status(400).json({ error: 'moduleKey required' });

  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/user_progress?on_conflict=user_email,module_key`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      user_email: userEmail,
      module_key: String(moduleKey),
      summary_text: summaryText || null,
      chat_msgs: chatMsgs || [],
      answer_count: answerCount || 0,
      updated_at: new Date().toISOString()
    })
  });

  if (!r.ok) {
    const err = await r.text();
    return res.status(500).json({ error: 'DB error', detail: err });
  }

  return res.status(200).json({ ok: true });
}

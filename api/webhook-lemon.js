const crypto = require('crypto');

// Raw body 필요 — Vercel body parser 비활성화
module.exports.config = { api: { bodyParser: false } };

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await getRawBody(req);

  // 서명 검증
  const secret = process.env.LEMON_WEBHOOK_SECRET || '';
  if (secret) {
    const sig = req.headers['x-signature'] || '';
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sig !== hmac) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
  }

  let data;
  try { data = JSON.parse(rawBody); } catch(e) {
    return res.status(400).json({ error: 'parse_fail' });
  }

  const eventName = data?.meta?.event_name;
  const customerEmail = data?.data?.attributes?.user_email || data?.meta?.custom_data?.email || '';
  const orderId = String(data?.data?.id || '');
  const productName = data?.data?.attributes?.first_order_item?.product_name || data?.meta?.custom_data?.product || '';
  const variantName = data?.data?.attributes?.first_order_item?.variant_name || '';

  // 플랜 결정
  let plan = 'free';
  const pn = (productName + ' ' + variantName).toLowerCase();
  if (pn.includes('max')) plan = 'max';
  else if (pn.includes('pro')) plan = 'pro';
  else if (pn.includes('lifetime') || pn.includes('early')) plan = 'lifetime';

  // 만료일 결정
  let expiresAt = null;
  if (plan !== 'lifetime') {
    const d = new Date();
    if (pn.includes('year')) d.setFullYear(d.getFullYear() + 1);
    else d.setMonth(d.getMonth() + 1);
    expiresAt = d.toISOString();
  }

  if (!customerEmail) {
    return res.status(400).json({ error: 'no_email' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dtwgrxsepotwbpaqssgm.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'no_service_key' });
  }

  try {
    // 이메일로 유저 찾기
    let userId = null;
    const allUsersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1000`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });
    if (allUsersRes.ok) {
      const allUsers = await allUsersRes.json();
      const users = allUsers.users || allUsers;
      const match = Array.isArray(users) ? users.find(u => u.email === customerEmail) : null;
      if (match) userId = match.id;
    }

    if (['order_created', 'subscription_created', 'subscription_updated'].includes(eventName)) {
      const targetUserId = userId || '00000000-0000-0000-0000-000000000000';
      const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          user_id: targetUserId,
          plan,
          lemon_order_id: orderId,
          lemon_customer_email: customerEmail,
          activated_at: new Date().toISOString(),
          expires_at: expiresAt
        })
      });
      if (!upsertRes.ok) {
        const err = await upsertRes.text();
        return res.status(502).json({ error: 'upsert_fail', detail: err.slice(0, 500) });
      }
    }

    if (['subscription_cancelled', 'subscription_expired'].includes(eventName)) {
      if (userId) {
        await fetch(`${SUPABASE_URL}/rest/v1/user_plans?user_id=eq.${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({ plan: 'free' })
        });
      }
    }

    return res.status(200).json({ ok: true, event: eventName, plan, email: customerEmail });
  } catch (err) {
    return res.status(500).json({ error: 'server_error', message: err.message });
  }
};

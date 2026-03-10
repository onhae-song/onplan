const crypto = require('crypto');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Verify webhook signature (optional but recommended)
  const secret = process.env.LEMON_WEBHOOK_SECRET || '';
  if (secret) {
    const sig = req.headers['x-signature'] || '';
    const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
    if (sig !== hmac) {
      return res.status(401).json({ error: 'invalid_signature' });
    }
  }

  let data = req.body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch(e) {
      return res.status(400).json({ error: 'parse_fail' });
    }
  }

  const eventName = data?.meta?.event_name;
  const customerEmail = data?.data?.attributes?.user_email || data?.meta?.custom_data?.email || '';
  const orderId = String(data?.data?.id || '');
  const productName = data?.data?.attributes?.first_order_item?.product_name || data?.meta?.custom_data?.product || '';
  const variantName = data?.data?.attributes?.first_order_item?.variant_name || '';
  const status = data?.data?.attributes?.status || '';

  // Determine plan from product name
  let plan = 'free';
  const pn = (productName + ' ' + variantName).toLowerCase();
  if (pn.includes('max')) plan = 'max';
  else if (pn.includes('pro')) plan = 'pro';
  else if (pn.includes('lifetime') || pn.includes('early')) plan = 'lifetime';

  // Determine expiry
  let expiresAt = null;
  if (plan === 'lifetime') {
    expiresAt = null; // never expires
  } else if (pn.includes('year')) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    expiresAt = d.toISOString();
  } else {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    expiresAt = d.toISOString();
  }

  if (!customerEmail) {
    return res.status(400).json({ error: 'no_email' });
  }

  // 2. Connect to Supabase with service_role key
  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dtwgrxsepotwbpaqssgm.supabase.co';
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'no_service_key' });
  }

  try {
    // Find user by email
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=1`, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY
      }
    });

    // Search all users for matching email
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

    if (eventName === 'order_created' || eventName === 'subscription_created' || eventName === 'subscription_updated') {
      if (userId) {
        // Upsert user plan
        const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify({
            user_id: userId,
            plan: plan,
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
      } else {
        // User not registered yet — store pending activation
        const pendingRes = await fetch(`${SUPABASE_URL}/rest/v1/user_plans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY
          },
          body: JSON.stringify({
            user_id: '00000000-0000-0000-0000-000000000000',
            plan: plan,
            lemon_order_id: orderId,
            lemon_customer_email: customerEmail,
            activated_at: new Date().toISOString(),
            expires_at: expiresAt
          })
        });
      }
    }

    if (eventName === 'subscription_cancelled' || eventName === 'subscription_expired') {
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

import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  WHATSAPP_VERIFY_TOKEN?: string;
  WHATSAPP_ACCESS_TOKEN?: string;
};

export const whatsappApi = new Hono<{ Bindings: Bindings }>();

// WhatsApp webhook verification (GET)
whatsappApi.get('/webhook', async (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  
  const verifyToken = c.env.WHATSAPP_VERIFY_TOKEN || 'handy-beaver-webhook';
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('WhatsApp webhook verified');
    return c.text(challenge || '', 200);
  }
  
  return c.text('Forbidden', 403);
});

// WhatsApp webhook messages (POST)
whatsappApi.post('/webhook', async (c) => {
  try {
    const body = await c.req.json();
    console.log('WhatsApp webhook received:', JSON.stringify(body));
    
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    
    if (!value?.messages) {
      return c.json({ success: true, message: 'No messages' });
    }
    
    for (const message of value.messages) {
      const from = message.from; // Phone number
      const text = message.text?.body || message.caption || '[Media]';
      const timestamp = message.timestamp;
      
      // Find or create customer by phone
      let customer = await c.env.DB.prepare(
        'SELECT id FROM customers WHERE phone LIKE ?'
      ).bind(`%${from.slice(-10)}%`).first<{ id: number }>();
      
      if (!customer) {
        // Create customer with phone-based email
        const result = await c.env.DB.prepare(`
          INSERT INTO customers (email, name, phone, status, created_at, updated_at)
          VALUES (?, ?, ?, 'lead', unixepoch(), unixepoch())
        `).bind(
          `${from}@whatsapp.handybeaver.co`,
          `WhatsApp ${from}`,
          from
        ).run();
        customer = { id: result.meta.last_row_id as number };
      }
      
      // Save message
      await c.env.DB.prepare(`
        INSERT INTO messages (customer_id, sender, content, source, created_at)
        VALUES (?, 'customer', ?, 'whatsapp', ?)
      `).bind(customer.id, text, parseInt(timestamp) || Math.floor(Date.now() / 1000)).run();
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Send WhatsApp message
whatsappApi.post('/send', async (c) => {
  const { phone, message } = await c.req.json();
  
  if (!c.env.WHATSAPP_ACCESS_TOKEN) {
    return c.json({ success: false, error: 'WhatsApp not configured' }, 400);
  }
  
  // WhatsApp Business API phone number ID from config
  const phoneNumberId = '1016449968218067';
  
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: message },
      }),
    }
  );
  
  const result = await response.json();
  
  if (response.ok) {
    return c.json({ success: true, messageId: result.messages?.[0]?.id });
  }
  
  return c.json({ success: false, error: result.error?.message }, 400);
});

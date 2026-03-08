import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSession } from '../lib/auth';

type Bindings = {
  DB: D1Database;
  SQUARE_APPLICATION_ID?: string;
  SQUARE_ACCESS_TOKEN?: string;
  SQUARE_ENVIRONMENT?: string;
  DISCORD_WEBHOOK_NOTIFICATIONS?: string;
};

export const paymentsApi = new Hono<{ Bindings: Bindings }>();

const SQUARE_API_BASE = 'https://connect.squareup.com/v2';
const SQUARE_SANDBOX_BASE = 'https://connect.squareupsandbox.com/v2';

function getSquareBase(env: Bindings): string {
  return env.SQUARE_ENVIRONMENT === 'sandbox' ? SQUARE_SANDBOX_BASE : SQUARE_API_BASE;
}

// Get payment configuration for frontend
paymentsApi.get('/config', async (c) => {
  if (!c.env.SQUARE_APPLICATION_ID) {
    return c.json({ error: 'Square not configured' }, 500);
  }
  
  return c.json({
    application_id: c.env.SQUARE_APPLICATION_ID,
    location_id: 'main', // TODO: Get from Square API
    environment: c.env.SQUARE_ENVIRONMENT || 'production',
  });
});

// Create payment for invoice
paymentsApi.post('/create', async (c) => {
  const { invoice_id, source_id, amount_cents, customer_email } = await c.req.json();
  
  if (!c.env.SQUARE_ACCESS_TOKEN) {
    return c.json({ error: 'Square not configured' }, 500);
  }
  
  if (!source_id || !amount_cents) {
    return c.json({ error: 'source_id and amount_cents required' }, 400);
  }
  
  // Get location ID (first location)
  const locationsRes = await fetch(`${getSquareBase(c.env)}/locations`, {
    headers: {
      'Authorization': `Bearer ${c.env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  
  const locationsData = await locationsRes.json() as any;
  const locationId = locationsData.locations?.[0]?.id;
  
  if (!locationId) {
    return c.json({ error: 'No Square location found' }, 500);
  }
  
  // Create payment
  const paymentRes = await fetch(`${getSquareBase(c.env)}/payments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.SQUARE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'Square-Version': '2024-01-18',
    },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      source_id,
      amount_money: {
        amount: amount_cents,
        currency: 'USD',
      },
      location_id: locationId,
      buyer_email_address: customer_email,
      note: invoice_id ? `Invoice #${invoice_id}` : 'The Handy Beaver Payment',
    }),
  });
  
  const paymentData = await paymentRes.json() as any;
  
  if (!paymentRes.ok || paymentData.errors) {
    return c.json({ 
      error: 'Payment failed', 
      details: paymentData.errors 
    }, 400);
  }
  
  const payment = paymentData.payment;
  const now = Math.floor(Date.now() / 1000);
  
  // Record payment in DB
  if (invoice_id) {
    // Update invoice
    await c.env.DB.prepare(`
      UPDATE invoices 
      SET amount_paid = amount_paid + ?, 
          status = CASE WHEN amount_paid + ? >= total THEN 'paid' ELSE 'partial' END,
          paid_at = ?,
          updated_at = ?
      WHERE id = ?
    `).bind(amount_cents / 100, amount_cents / 100, now, now, invoice_id).run();
    
    // Get customer ID from invoice
    const invoice = await c.env.DB.prepare(
      'SELECT customer_id FROM invoices WHERE id = ?'
    ).bind(invoice_id).first<{ customer_id: number }>();
    
    if (invoice) {
      // Record payment
      await c.env.DB.prepare(`
        INSERT INTO payments (customer_id, invoice_id, amount, method, square_payment_id, status, created_at)
        VALUES (?, ?, ?, 'card', ?, 'completed', ?)
      `).bind(invoice.customer_id, invoice_id, amount_cents / 100, payment.id, now).run();
    }
  }
  
  // Notify Discord
  if (c.env.DISCORD_WEBHOOK_NOTIFICATIONS) {
    await fetch(c.env.DISCORD_WEBHOOK_NOTIFICATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '💰 Payment Received!',
          color: 0x00FF00,
          fields: [
            { name: 'Amount', value: `$${(amount_cents / 100).toFixed(2)}`, inline: true },
            { name: 'Invoice', value: invoice_id ? `#${invoice_id}` : 'Direct payment', inline: true },
            { name: 'Square ID', value: payment.id, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  }
  
  return c.json({
    success: true,
    payment_id: payment.id,
    status: payment.status,
    amount: amount_cents / 100,
  });
});

// Get payment link for invoice
paymentsApi.get('/link/:invoice_id', async (c) => {
  const invoiceId = c.req.param('invoice_id');
  
  const invoice = await c.env.DB.prepare(`
    SELECT i.*, c.email, c.name 
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).bind(invoiceId).first<any>();
  
  if (!invoice) {
    return c.json({ error: 'Invoice not found' }, 404);
  }
  
  const amountDue = invoice.total - (invoice.amount_paid || 0);
  
  return c.json({
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number,
    customer_name: invoice.name,
    customer_email: invoice.email,
    total: invoice.total,
    amount_paid: invoice.amount_paid || 0,
    amount_due: amountDue,
    status: invoice.status,
    payment_url: `https://handybeaver.co/pay/${invoiceId}`,
  });
});

// Customer payment history
paymentsApi.get('/history', async (c) => {
  const token = getCookie(c, 'hb_session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  
  const customer = await getSession(c.env.DB, token);
  if (!customer) return c.json({ error: 'Unauthorized' }, 401);
  
  const payments = await c.env.DB.prepare(`
    SELECT p.*, i.invoice_number
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    WHERE p.customer_id = ?
    ORDER BY p.created_at DESC
    LIMIT 20
  `).bind(customer.id).all();
  
  return c.json(payments);
});

// Admin: List all payments
paymentsApi.get('/admin/list', async (c) => {
  // TODO: Add admin auth check
  
  const payments = await c.env.DB.prepare(`
    SELECT p.*, i.invoice_number, c.name as customer_name
    FROM payments p
    LEFT JOIN invoices i ON p.invoice_id = i.id
    LEFT JOIN customers c ON p.customer_id = c.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all();
  
  return c.json(payments);
});

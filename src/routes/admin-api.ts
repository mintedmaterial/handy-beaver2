import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  ADMIN_API_KEY?: string;
  DISCORD_WEBHOOK_NOTIFICATIONS?: string;
};

export const adminApi = new Hono<{ Bindings: Bindings }>();

// Admin auth middleware
adminApi.use('*', async (c, next) => {
  const apiKey = c.req.header('Authorization')?.replace('Bearer ', '');
  const adminCookie = getCookie(c, 'hb_admin');
  
  if (!apiKey && !adminCookie) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Verify API key or admin session
  if (apiKey && c.env.ADMIN_API_KEY && apiKey !== c.env.ADMIN_API_KEY) {
    return c.json({ error: 'Invalid API key' }, 401);
  }
  
  if (adminCookie) {
    const [githubId] = adminCookie.split(':');
    const admin = await c.env.DB.prepare(
      'SELECT * FROM admins WHERE github_id = ?'
    ).bind(githubId).first();
    
    if (!admin) {
      return c.json({ error: 'Invalid session' }, 401);
    }
    
    c.set('admin', admin);
  }
  
  await next();
});

// ============ CUSTOMERS ============

adminApi.get('/customers', async (c) => {
  const customers = await c.env.DB.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM bookings WHERE customer_id = c.id) as job_count,
      (SELECT SUM(amount) FROM payments WHERE customer_id = c.id AND status = 'completed') as total_paid
    FROM customers c
    ORDER BY c.created_at DESC
    LIMIT 100
  `).all();
  
  return c.json(customers);
});

adminApi.get('/customers/search', async (c) => {
  const query = c.req.query('q') || '';
  
  const customers = await c.env.DB.prepare(`
    SELECT * FROM customers 
    WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(`%${query}%`, `%${query}%`, `%${query}%`).all();
  
  return c.json(customers);
});

// Create customer manually
adminApi.post('/customers', async (c) => {
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  if (!data.name || !data.email) {
    return c.json({ error: 'Name and email required' }, 400);
  }
  
  // Check if customer exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM customers WHERE email = ?'
  ).bind(data.email).first();
  
  if (existing) {
    return c.json({ error: 'Customer with this email already exists', id: existing.id }, 409);
  }
  
  const result = await c.env.DB.prepare(`
    INSERT INTO customers (name, email, phone, address, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.name,
    data.email,
    data.phone || null,
    data.address || null,
    data.status || 'lead',
    data.notes || null,
    now,
    now
  ).run();
  
  return c.json({ success: true, id: result.meta.last_row_id });
});

// Update customer
adminApi.patch('/customers/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  const updates: string[] = [];
  const values: any[] = [];
  
  const fields = ['name', 'email', 'phone', 'address', 'status', 'notes'];
  for (const field of fields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(data[field]);
    }
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await c.env.DB.prepare(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  return c.json({ success: true });
});

adminApi.get('/customers/:id', async (c) => {
  const id = c.req.param('id');
  
  const [customer, bookings, messages, payments] = await Promise.all([
    c.env.DB.prepare('SELECT * FROM customers WHERE id = ?').bind(id).first(),
    c.env.DB.prepare('SELECT * FROM bookings WHERE customer_id = ? ORDER BY created_at DESC').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50').bind(id).all(),
    c.env.DB.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC').bind(id).all(),
  ]);
  
  if (!customer) {
    return c.json({ error: 'Customer not found' }, 404);
  }
  
  return c.json({
    ...customer,
    bookings: bookings.results,
    messages: messages.results,
    payments: payments.results,
  });
});

// ============ QUOTES ============

adminApi.post('/quotes', async (c) => {
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  // Calculate totals
  const laborTotal = data.labor_rate * (data.estimated_hours || 1);
  const helperTotal = data.helper_needed ? (data.helper_rate || 0) : 0;
  const materialsTotal = data.materials_estimate || 0;
  const equipmentTotal = data.equipment_estimate || 0;
  
  const subtotal = laborTotal + helperTotal + materialsTotal + equipmentTotal;
  const discountAmount = subtotal * ((data.discount_percent || 0) / 100);
  const total = subtotal - discountAmount;
  
  const validUntil = now + ((data.valid_days || 14) * 24 * 60 * 60);
  
  const result = await c.env.DB.prepare(`
    INSERT INTO quotes (
      customer_id, booking_id, labor_type, labor_rate, estimated_hours,
      helper_needed, helper_type, helper_rate, materials_estimate, equipment_estimate,
      discount_percent, discount_reason, subtotal, total, status, valid_until, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
  `).bind(
    data.customer_id,
    data.booking_id || null,
    data.labor_type,
    data.labor_rate,
    data.estimated_hours || null,
    data.helper_needed ? 1 : 0,
    data.helper_type || null,
    data.helper_rate || null,
    materialsTotal,
    equipmentTotal,
    data.discount_percent || 0,
    data.discount_reason || null,
    subtotal,
    total,
    validUntil,
    data.notes || null,
    now,
    now
  ).run();
  
  return c.json({ success: true, id: result.meta.last_row_id, total });
});

// Quote preview HTML (for viewing and printing)
adminApi.get('/quotes/:id/preview', async (c) => {
  const id = c.req.param('id');
  
  const quote = await c.env.DB.prepare(`
    SELECT q.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address
    FROM quotes q
    JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).bind(id).first<any>();
  
  if (!quote) {
    return c.text('Quote not found', 404);
  }
  
  const validDate = quote.valid_until ? new Date(quote.valid_until * 1000).toLocaleDateString() : 'N/A';
  const createdDate = quote.created_at ? new Date(quote.created_at * 1000).toLocaleDateString() : 'N/A';
  
  const laborTotal = (quote.labor_rate || 0) * (quote.estimated_hours || 1);
  const helperTotal = quote.helper_needed ? (quote.helper_rate || 0) : 0;
  
  const html = `
    <div class="quote-document" style="padding: 2rem; font-family: Georgia, serif;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #8B4513; padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
        <div>
          <h1 style="color: #8B4513; margin: 0; font-size: 2rem;">🦫 The Handy Beaver</h1>
          <p style="margin: 0.5rem 0 0; color: #666;">Traveling Craftsman & Maintenance Services</p>
          <p style="margin: 0.25rem 0; color: #666; font-size: 0.9rem;">SE Oklahoma | contact@handybeaver.co</p>
        </div>
        <div style="text-align: right;">
          <h2 style="margin: 0; color: #8B4513;">QUOTE</h2>
          <p style="margin: 0.5rem 0 0; font-size: 0.9rem;">Date: ${createdDate}</p>
          <p style="margin: 0.25rem 0; font-size: 0.9rem;">Valid Until: ${validDate}</p>
          <span style="display: inline-block; padding: 4px 12px; background: ${quote.status === 'accepted' ? '#d1fae5' : quote.status === 'sent' ? '#dbeafe' : '#f3f4f6'}; border-radius: 12px; font-size: 0.8rem; text-transform: uppercase;">${quote.status}</span>
        </div>
      </div>
      
      <!-- Customer Info -->
      <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
        <h3 style="margin: 0 0 0.5rem; color: #333;">Prepared For:</h3>
        <p style="margin: 0; font-weight: 600;">${quote.customer_name}</p>
        <p style="margin: 0.25rem 0; color: #666;">${quote.customer_email}</p>
        ${quote.customer_phone ? `<p style="margin: 0.25rem 0; color: #666;">${quote.customer_phone}</p>` : ''}
        ${quote.address ? `<p style="margin: 0.25rem 0; color: #666;">${quote.address}</p>` : ''}
      </div>
      
      <!-- Line Items -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
        <thead>
          <tr style="background: #8B4513; color: white;">
            <th style="padding: 0.75rem; text-align: left;">Description</th>
            <th style="padding: 0.75rem; text-align: right;">Qty</th>
            <th style="padding: 0.75rem; text-align: right;">Rate</th>
            <th style="padding: 0.75rem; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">Labor (${quote.labor_type || 'Standard'})</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">${quote.estimated_hours || 1}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">$${(quote.labor_rate || 0).toFixed(2)}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">$${laborTotal.toFixed(2)}</td>
          </tr>
          ${quote.helper_needed ? `
          <tr>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">Helper (${quote.helper_type || 'Standard'})</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">1</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">$${(quote.helper_rate || 0).toFixed(2)}</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">$${(quote.helper_rate || 0).toFixed(2)}</td>
          </tr>
          ` : ''}
          ${quote.materials_estimate ? `
          <tr>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">Materials (estimate)</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">-</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">-</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">$${quote.materials_estimate.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${quote.equipment_estimate ? `
          <tr>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee;">Equipment Rental</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">-</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">-</td>
            <td style="padding: 0.75rem; border-bottom: 1px solid #eee; text-align: right;">$${quote.equipment_estimate.toFixed(2)}</td>
          </tr>
          ` : ''}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 0.75rem; text-align: right; font-weight: 600;">Subtotal:</td>
            <td style="padding: 0.75rem; text-align: right;">$${quote.subtotal?.toFixed(2) || '0.00'}</td>
          </tr>
          ${quote.discount_percent ? `
          <tr>
            <td colspan="3" style="padding: 0.75rem; text-align: right; color: #059669;">Discount (${quote.discount_percent}%${quote.discount_reason ? ' - ' + quote.discount_reason : ''}):</td>
            <td style="padding: 0.75rem; text-align: right; color: #059669;">-$${((quote.subtotal || 0) * quote.discount_percent / 100).toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr style="background: #f9f9f9;">
            <td colspan="3" style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.1rem;">TOTAL:</td>
            <td style="padding: 1rem; text-align: right; font-weight: 700; font-size: 1.25rem; color: #8B4513;">$${quote.total?.toFixed(2) || '0.00'}</td>
          </tr>
        </tfoot>
      </table>
      
      ${quote.notes ? `
      <div style="background: #fff8dc; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.5rem; color: #8B4513;">Notes:</h4>
        <p style="margin: 0; white-space: pre-wrap;">${quote.notes}</p>
      </div>
      ` : ''}
      
      <!-- Footer -->
      <div style="border-top: 1px solid #eee; padding-top: 1rem; font-size: 0.85rem; color: #666;">
        <p><strong>Terms:</strong> Quote valid for 14 days. 50% deposit required to schedule. Materials purchased separately by customer. Payment due upon completion.</p>
        <p style="margin-top: 1rem; text-align: center;">
          <strong>Accept this quote:</strong> Reply to this email or call/text to confirm.
        </p>
      </div>
    </div>
  `;
  
  return c.html(html);
});

// Quote PDF (uses browser print)
adminApi.get('/quotes/:id/pdf', async (c) => {
  const id = c.req.param('id');
  
  const quote = await c.env.DB.prepare(`
    SELECT q.*, c.name as customer_name, c.email as customer_email
    FROM quotes q
    JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).bind(id).first<any>();
  
  if (!quote) {
    return c.text('Quote not found', 404);
  }
  
  // Return printable HTML page
  const previewRes = await fetch(c.req.url.replace('/pdf', '/preview'));
  const previewHtml = await previewRes.text();
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quote - ${quote.customer_name}</title>
      <style>
        @media print {
          body { margin: 0; }
          @page { margin: 1in; }
        }
      </style>
    </head>
    <body onload="window.print()">
      ${previewHtml}
    </body>
    </html>
  `;
  
  return c.html(html);
});

adminApi.post('/quotes/:id/send', async (c) => {
  const id = c.req.param('id');
  const now = Math.floor(Date.now() / 1000);
  
  // Update quote status
  await c.env.DB.prepare(`
    UPDATE quotes SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?
  `).bind(now, now, id).run();
  
  // Get quote with customer
  const quote = await c.env.DB.prepare(`
    SELECT q.*, c.email, c.name FROM quotes q
    JOIN customers c ON q.customer_id = c.id
    WHERE q.id = ?
  `).bind(id).first();
  
  // TODO: Send email via Cloudflare Email
  
  return c.json({ success: true, message: `Quote sent to ${quote?.email}` });
});

// ============ INVOICES ============

adminApi.get('/invoices', async (c) => {
  const status = c.req.query('status');
  
  let query = `
    SELECT i.*, c.name as customer_name, c.email as customer_email
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
  `;
  
  if (status === 'unpaid') {
    query += ` WHERE i.status IN ('sent', 'partial', 'overdue')`;
  }
  
  query += ` ORDER BY i.created_at DESC LIMIT 50`;
  
  const invoices = await c.env.DB.prepare(query).all();
  return c.json(invoices);
});

adminApi.post('/invoices', async (c) => {
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  const subtotal = (data.labor_amount || 0) + (data.helper_amount || 0) + 
                   (data.materials_amount || 0) + (data.equipment_amount || 0) -
                   (data.discount_amount || 0);
  const taxAmount = subtotal * ((data.tax_rate || 0) / 100);
  const total = subtotal + taxAmount;
  
  const dueDate = now + ((data.due_days || 14) * 24 * 60 * 60);
  
  // Generate invoice number
  const count = await c.env.DB.prepare('SELECT COUNT(*) as count FROM invoices').first<{count: number}>();
  const invoiceNumber = `HB-${new Date().getFullYear()}-${String((count?.count || 0) + 1).padStart(4, '0')}`;
  
  const result = await c.env.DB.prepare(`
    INSERT INTO invoices (
      customer_id, booking_id, quote_id, invoice_number,
      labor_amount, helper_amount, materials_amount, equipment_amount, discount_amount,
      subtotal, tax_rate, tax_amount, total, status, due_date, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)
  `).bind(
    data.customer_id,
    data.booking_id || null,
    data.quote_id || null,
    invoiceNumber,
    data.labor_amount || 0,
    data.helper_amount || 0,
    data.materials_amount || 0,
    data.equipment_amount || 0,
    data.discount_amount || 0,
    subtotal,
    data.tax_rate || 0,
    taxAmount,
    total,
    dueDate,
    data.notes || null,
    now,
    now
  ).run();
  
  return c.json({ success: true, id: result.meta.last_row_id, invoice_number: invoiceNumber, total });
});

adminApi.post('/invoices/:id/send', async (c) => {
  const id = c.req.param('id');
  const now = Math.floor(Date.now() / 1000);
  
  await c.env.DB.prepare(`
    UPDATE invoices SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?
  `).bind(now, now, id).run();
  
  const invoice = await c.env.DB.prepare(`
    SELECT i.*, c.email, c.name FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).bind(id).first();
  
  // TODO: Send email via Cloudflare Email
  
  return c.json({ success: true, message: `Invoice sent to ${invoice?.email}` });
});

// ============ BOOKINGS/JOBS ============

adminApi.get('/bookings', async (c) => {
  const status = c.req.query('status');
  
  let query = `
    SELECT b.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
  `;
  
  if (status) {
    query += ` WHERE b.status = '${status}'`;
  }
  
  query += ` ORDER BY b.created_at DESC LIMIT 50`;
  
  const bookings = await c.env.DB.prepare(query).all();
  return c.json(bookings);
});

adminApi.patch('/bookings/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  const updates: string[] = [];
  const values: any[] = [];
  
  if (data.status) {
    updates.push('status = ?');
    values.push(data.status);
  }
  if (data.scheduled_date) {
    updates.push('scheduled_date = ?');
    values.push(data.scheduled_date);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    values.push(data.notes);
  }
  
  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);
  
  await c.env.DB.prepare(
    `UPDATE bookings SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();
  
  return c.json({ success: true });
});

adminApi.post('/bookings/:id/notes', async (c) => {
  const bookingId = c.req.param('id');
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  const admin = c.get('admin');
  
  await c.env.DB.prepare(`
    INSERT INTO job_notes (booking_id, admin_id, content, note_type, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(bookingId, admin?.id || null, data.content, data.note_type || 'general', now).run();
  
  return c.json({ success: true });
});

adminApi.get('/bookings/:id/notes', async (c) => {
  const bookingId = c.req.param('id');
  
  const notes = await c.env.DB.prepare(`
    SELECT jn.*, a.github_username as admin_name
    FROM job_notes jn
    LEFT JOIN admins a ON jn.admin_id = a.id
    WHERE jn.booking_id = ?
    ORDER BY jn.created_at DESC
  `).bind(bookingId).all();
  
  return c.json(notes);
});

// ============ SCHEDULE ============

adminApi.get('/schedule', async (c) => {
  const days = parseInt(c.req.query('days') || '7');
  const now = Math.floor(Date.now() / 1000);
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);
  
  const bookings = await c.env.DB.prepare(`
    SELECT b.*, c.name as customer_name, c.phone as customer_phone, c.address
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    WHERE b.status IN ('confirmed', 'in_progress')
    AND b.scheduled_date IS NOT NULL
    AND b.scheduled_date <= ?
    ORDER BY b.scheduled_date ASC
  `).bind(endDate.toISOString().split('T')[0]).all();
  
  return c.json(bookings);
});

// ============ MESSAGES ============

// Get all messages/conversations
adminApi.get('/messages', async (c) => {
  const source = c.req.query('source'); // 'customer', 'agent', 'webhook', 'whatsapp'
  const customerId = c.req.query('customer_id');
  const unreadOnly = c.req.query('unread') === 'true';
  
  let query = `
    SELECT m.*, c.name as customer_name, c.email as customer_email
    FROM messages m
    LEFT JOIN customers c ON m.customer_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  
  if (source) {
    query += ` AND m.source = ?`;
    params.push(source);
  }
  if (customerId) {
    query += ` AND m.customer_id = ?`;
    params.push(customerId);
  }
  if (unreadOnly) {
    query += ` AND m.read_at IS NULL AND m.sender != 'business'`;
  }
  
  query += ` ORDER BY m.created_at DESC LIMIT 100`;
  
  const messages = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(messages);
});

// Get conversation threads (grouped by customer)
adminApi.get('/messages/threads', async (c) => {
  const threads = await c.env.DB.prepare(`
    SELECT 
      c.id as customer_id,
      c.name as customer_name,
      c.email as customer_email,
      c.phone as customer_phone,
      COUNT(m.id) as message_count,
      SUM(CASE WHEN m.read_at IS NULL AND m.sender != 'business' THEN 1 ELSE 0 END) as unread_count,
      MAX(m.created_at) as last_message_at,
      (SELECT content FROM messages WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM customers c
    JOIN messages m ON m.customer_id = c.id
    GROUP BY c.id
    ORDER BY last_message_at DESC
    LIMIT 50
  `).all();
  
  return c.json(threads);
});

// Mark messages as read
adminApi.patch('/messages/:id/read', async (c) => {
  const id = c.req.param('id');
  const now = Math.floor(Date.now() / 1000);
  
  await c.env.DB.prepare(
    'UPDATE messages SET read_at = ? WHERE id = ?'
  ).bind(now, id).run();
  
  return c.json({ success: true });
});

// Mark all messages from customer as read
adminApi.patch('/messages/customer/:customerId/read-all', async (c) => {
  const customerId = c.req.param('customerId');
  const now = Math.floor(Date.now() / 1000);
  
  await c.env.DB.prepare(
    'UPDATE messages SET read_at = ? WHERE customer_id = ? AND read_at IS NULL'
  ).bind(now, customerId).run();
  
  return c.json({ success: true });
});

adminApi.post('/messages', async (c) => {
  const data = await c.req.json();
  const now = Math.floor(Date.now() / 1000);
  
  await c.env.DB.prepare(`
    INSERT INTO messages (customer_id, booking_id, sender, content, created_at)
    VALUES (?, ?, 'business', ?, ?)
  `).bind(data.customer_id, data.booking_id || null, data.content, now).run();
  
  // TODO: Send email if data.send_email is true
  
  return c.json({ success: true });
});

// ============ SUMMARY ============

adminApi.get('/summary', async (c) => {
  const [
    pendingQuotes,
    unpaidInvoices,
    todaysJobs,
    unreadMessages,
    recentActivity
  ] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").first<{count: number}>(),
    c.env.DB.prepare("SELECT COUNT(*) as count, SUM(total - amount_paid) as total FROM invoices WHERE status IN ('sent', 'partial', 'overdue')").first<{count: number, total: number}>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM bookings 
      WHERE status IN ('confirmed', 'in_progress') 
      AND scheduled_date = date('now')
    `).first<{count: number}>(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM messages WHERE sender = 'customer' AND read_at IS NULL").first<{count: number}>(),
    c.env.DB.prepare(`
      SELECT 'booking' as type, title as description, created_at 
      FROM bookings ORDER BY created_at DESC LIMIT 5
    `).all(),
  ]);
  
  return c.json({
    pending_quotes: pendingQuotes?.count || 0,
    unpaid_invoices: {
      count: unpaidInvoices?.count || 0,
      total: unpaidInvoices?.total || 0,
    },
    todays_jobs: todaysJobs?.count || 0,
    unread_messages: unreadMessages?.count || 0,
    recent_activity: recentActivity.results,
  });
});

// ============ CONTENT ============

adminApi.post('/content/blog', async (c) => {
  const data = await c.req.json();
  
  // Get job details and notes
  let jobDetails = null;
  let notes: any[] = [];
  
  if (data.job_id) {
    jobDetails = await c.env.DB.prepare(`
      SELECT b.*, c.name as customer_name 
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.id = ?
    `).bind(data.job_id).first();
    
    const notesResult = await c.env.DB.prepare(
      'SELECT * FROM job_notes WHERE booking_id = ? ORDER BY created_at ASC'
    ).bind(data.job_id).all();
    notes = notesResult.results as any[];
  }
  
  // TODO: Use Workers AI to generate blog post
  const blogDraft = `
# ${data.topic || jobDetails?.title || 'Project Update'}

${data.notes || notes.map((n: any) => n.content).join('\n\n')}

---

*Need similar work done? Contact The Handy Beaver for a free quote!*
  `.trim();
  
  return c.json({ draft: blogDraft });
});

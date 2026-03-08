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

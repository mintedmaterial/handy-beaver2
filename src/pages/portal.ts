import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { siteConfig } from '../../config/site.config';

const { business, theme } = siteConfig;

// Portal layout (customer-facing, different from admin)
const portalLayout = (title: string, content: string, customer?: any) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ${business.name} Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: ${theme.colors.primary};
      --secondary: ${theme.colors.secondary};
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .portal-nav {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .portal-nav .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .portal-nav .brand img { width: 40px; height: 40px; border-radius: 50%; }
    .portal-nav .user {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .portal-layout {
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: calc(100vh - 60px);
    }
    .sidebar {
      background: white;
      border-right: 1px solid #e5e5e5;
      padding: 1.5rem 0;
    }
    .sidebar a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      color: #333;
      text-decoration: none;
      border-left: 3px solid transparent;
      transition: all 0.2s;
    }
    .sidebar a:hover { background: #f9f9f9; }
    .sidebar a.active {
      background: #fff5f0;
      border-left-color: var(--primary);
      color: var(--primary);
      font-weight: 600;
    }
    .main-content {
      padding: 2rem;
      max-width: 1200px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      margin-bottom: 1.5rem;
    }
    .card h2 { color: var(--primary); margin-bottom: 1rem; }
    .btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-secondary { background: #e5e7eb; color: #333; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; text-transform: capitalize; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-sent { background: #dbeafe; color: #1e40af; }
    .badge-accepted { background: #d1fae5; color: #065f46; }
    .badge-paid { background: #d1fae5; color: #065f46; }
    .badge-confirmed { background: #dbeafe; color: #1e40af; }
    .badge-in_progress { background: #ede9fe; color: #6b21a8; }
    .badge-completed { background: #d1fae5; color: #065f46; }
    .table { width: 100%; border-collapse: collapse; }
    .table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
    .table th { font-weight: 600; color: #666; font-size: 0.85rem; }
    .empty { text-align: center; padding: 3rem; color: #666; }
    
    @media (max-width: 768px) {
      .portal-layout { grid-template-columns: 1fr; }
      .sidebar { display: flex; overflow-x: auto; padding: 0.5rem; border-right: none; border-bottom: 1px solid #e5e5e5; }
      .sidebar a { padding: 0.5rem 1rem; border-left: none; border-bottom: 2px solid transparent; white-space: nowrap; }
      .sidebar a.active { border-bottom-color: var(--primary); }
    }
  </style>
</head>
<body>
  <nav class="portal-nav">
    <div class="brand">
      <img src="/api/assets/beaver-avatar.png" alt="Beaver">
      <span>My Account</span>
    </div>
    <div class="user">
      <span>👋 ${customer?.name || 'Customer'}</span>
      <a href="/portal/logout" style="color: rgba(255,255,255,0.8);">Logout</a>
    </div>
  </nav>
  
  <div class="portal-layout">
    <aside class="sidebar">
      <a href="/portal">🏠 Dashboard</a>
      <a href="/portal/quotes">💰 My Quotes</a>
      <a href="/portal/invoices">📄 Invoices</a>
      <a href="/portal/jobs">🛠️ Job History</a>
      <a href="/portal/messages">💬 Messages</a>
    </aside>
    
    <main class="main-content">
      ${content}
    </main>
  </div>
</body>
</html>
`;

// Portal auth middleware
export const requirePortalAuth = async (c: Context, next: () => Promise<void>) => {
  const sessionToken = getCookie(c, 'hb_portal');
  
  if (!sessionToken) {
    return c.redirect('/portal/login');
  }
  
  // Verify session
  const session = await c.env.DB.prepare(`
    SELECT cs.*, c.* FROM customer_sessions cs
    JOIN customers c ON cs.customer_id = c.id
    WHERE cs.token = ? AND cs.expires_at > ?
  `).bind(sessionToken, Math.floor(Date.now() / 1000)).first<any>();
  
  if (!session) {
    return c.redirect('/portal/login');
  }
  
  c.set('customer', session);
  await next();
};

// Login page
export const portalLoginPage = async (c: Context) => {
  const error = c.req.query('error');
  const success = c.req.query('success');
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login | ${business.name} Portal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #8B4513 0%, #D2691E 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .login-card {
      background: white;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    }
    .logo { text-align: center; margin-bottom: 2rem; }
    .logo img { width: 80px; height: 80px; border-radius: 50%; }
    .logo h1 { font-size: 1.5rem; color: #8B4513; margin-top: 1rem; }
    .logo p { color: #666; font-size: 0.9rem; }
    .form-group { margin-bottom: 1.5rem; }
    .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }
    .form-group input { width: 100%; padding: 0.875rem 1rem; border: 2px solid #e5e5e5; border-radius: 8px; font-size: 1rem; }
    .form-group input:focus { outline: none; border-color: #8B4513; }
    .btn-login { width: 100%; padding: 1rem; background: #8B4513; color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; }
    .btn-login:hover { background: #6d360f; }
    .alert { padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
    .alert-error { background: #fee2e2; color: #991b1b; }
    .alert-success { background: #d1fae5; color: #065f46; }
    .help { text-align: center; margin-top: 1.5rem; color: #666; font-size: 0.9rem; }
    .help a { color: #8B4513; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo">
      <img src="/api/assets/beaver-avatar.png" alt="${business.name}">
      <h1>Customer Portal</h1>
      <p>View your quotes, invoices, and job history</p>
    </div>
    
    ${error ? '<div class="alert alert-error">Invalid or expired link. Please request a new one.</div>' : ''}
    ${success ? '<div class="alert alert-success">Check your email! We sent you a login link.</div>' : ''}
    
    <form action="/portal/login" method="POST">
      <div class="form-group">
        <label for="email">Email Address</label>
        <input type="email" id="email" name="email" placeholder="you@example.com" required>
      </div>
      
      <button type="submit" class="btn-login">Send Magic Link ✨</button>
    </form>
    
    <p class="help">
      No account? Contact us at <a href="mailto:${business.email}">${business.email}</a>
    </p>
  </div>
</body>
</html>
  `;
  
  return c.html(html);
};

// Dashboard
export const portalDashboard = async (c: Context) => {
  const customer = c.get('customer');
  const db = c.env.DB;
  
  const [quotes, invoices, jobs] = await Promise.all([
    db.prepare(`
      SELECT COUNT(*) as count, SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as pending
      FROM quotes WHERE customer_id = ?
    `).bind(customer.customer_id).first<any>(),
    db.prepare(`
      SELECT COUNT(*) as count, 
        SUM(CASE WHEN status IN ('sent', 'partial') THEN total - amount_paid ELSE 0 END) as outstanding
      FROM invoices WHERE customer_id = ?
    `).bind(customer.customer_id).first<any>(),
    db.prepare(`
      SELECT COUNT(*) as count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      FROM bookings WHERE customer_id = ?
    `).bind(customer.customer_id).first<any>(),
  ]);
  
  const recentActivity = await db.prepare(`
    SELECT 'quote' as type, 'Quote received' as title, total as amount, status, created_at
    FROM quotes WHERE customer_id = ?
    UNION ALL
    SELECT 'invoice' as type, invoice_number as title, total as amount, status, created_at
    FROM invoices WHERE customer_id = ?
    ORDER BY created_at DESC LIMIT 5
  `).bind(customer.customer_id, customer.customer_id).all<any>();
  
  const content = `
    <h1 style="margin-bottom: 1.5rem;">Welcome back, ${customer.name?.split(' ')[0]}! 👋</h1>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
      <div class="card" style="text-align: center;">
        <div style="font-size: 2.5rem; color: var(--primary);">${quotes?.pending || 0}</div>
        <div style="color: #666;">Pending Quotes</div>
        <a href="/portal/quotes" style="color: var(--secondary); font-size: 0.9rem;">View all →</a>
      </div>
      <div class="card" style="text-align: center;">
        <div style="font-size: 2.5rem; color: ${invoices?.outstanding > 0 ? '#dc2626' : 'var(--primary)'};">$${(invoices?.outstanding || 0).toLocaleString()}</div>
        <div style="color: #666;">Outstanding Balance</div>
        ${invoices?.outstanding > 0 ? `<a href="/portal/invoices" class="btn btn-primary" style="margin-top: 0.5rem; font-size: 0.85rem;">Pay Now</a>` : ''}
      </div>
      <div class="card" style="text-align: center;">
        <div style="font-size: 2.5rem; color: var(--primary);">${jobs?.completed || 0}</div>
        <div style="color: #666;">Jobs Completed</div>
        <a href="/portal/jobs" style="color: var(--secondary); font-size: 0.9rem;">View history →</a>
      </div>
    </div>
    
    <div class="card">
      <h2>Recent Activity</h2>
      ${recentActivity.results?.length ? `
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${recentActivity.results.map((a: any) => `
              <tr>
                <td>
                  ${a.type === 'quote' ? '💰' : '📄'} ${a.title}
                </td>
                <td>$${a.amount?.toLocaleString() || '-'}</td>
                <td><span class="badge badge-${a.status}">${a.status}</span></td>
                <td>${new Date(a.created_at * 1000).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="empty">No recent activity</div>'}
    </div>
    
    <div class="card">
      <h2>Need Help?</h2>
      <p style="color: #666; margin-bottom: 1rem;">Have a question about a quote or invoice? We're here to help!</p>
      <a href="/portal/messages" class="btn btn-primary">Send a Message</a>
      <a href="tel:${business.phone}" class="btn btn-secondary" style="margin-left: 0.5rem;">📞 Call Us</a>
    </div>
  `;
  
  return c.html(portalLayout('Dashboard', content, customer));
};

// Quotes list
export const portalQuotes = async (c: Context) => {
  const customer = c.get('customer');
  
  const quotes = await c.env.DB.prepare(`
    SELECT * FROM quotes
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).bind(customer.customer_id).all<any>();
  
  const content = `
    <h1 style="margin-bottom: 1.5rem;">My Quotes</h1>
    
    <div class="card">
      ${quotes.results?.length ? `
        <table class="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Total</th>
              <th>Status</th>
              <th>Valid Until</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${quotes.results.map((q: any) => `
              <tr>
                <td>${q.labor_type || 'Work Quote'}</td>
                <td><strong>$${q.total?.toLocaleString()}</strong></td>
                <td><span class="badge badge-${q.status}">${q.status}</span></td>
                <td>${q.valid_until ? new Date(q.valid_until * 1000).toLocaleDateString() : '-'}</td>
                <td>
                  <a href="/portal/quotes/${q.id}" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">View</a>
                  ${q.status === 'sent' ? `<a href="/portal/quotes/${q.id}/accept" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem; margin-left: 0.5rem;">Accept</a>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="empty">No quotes yet. Contact us for a free estimate!</div>'}
    </div>
  `;
  
  return c.html(portalLayout('My Quotes', content, customer));
};

// Invoices list
export const portalInvoices = async (c: Context) => {
  const customer = c.get('customer');
  
  const invoices = await c.env.DB.prepare(`
    SELECT * FROM invoices
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).bind(customer.customer_id).all<any>();
  
  const content = `
    <h1 style="margin-bottom: 1.5rem;">My Invoices</h1>
    
    <div class="card">
      ${invoices.results?.length ? `
        <table class="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.results.map((inv: any) => `
              <tr>
                <td><strong>${inv.invoice_number || 'DRAFT'}</strong></td>
                <td>$${inv.total?.toLocaleString()}</td>
                <td>$${(inv.amount_paid || 0).toLocaleString()}</td>
                <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
                <td>${inv.due_date ? new Date(inv.due_date * 1000).toLocaleDateString() : '-'}</td>
                <td>
                  <a href="/portal/invoices/${inv.id}" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">View</a>
                  ${['sent', 'partial', 'overdue'].includes(inv.status) ? `<a href="/pay/${inv.id}" class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.85rem; margin-left: 0.5rem;">Pay</a>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="empty">No invoices yet.</div>'}
    </div>
  `;
  
  return c.html(portalLayout('My Invoices', content, customer));
};

// Jobs list
export const portalJobs = async (c: Context) => {
  const customer = c.get('customer');
  
  const jobs = await c.env.DB.prepare(`
    SELECT * FROM bookings
    WHERE customer_id = ?
    ORDER BY created_at DESC
  `).bind(customer.customer_id).all<any>();
  
  const content = `
    <h1 style="margin-bottom: 1.5rem;">Job History</h1>
    
    <div class="card">
      ${jobs.results?.length ? `
        <table class="table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${jobs.results.map((job: any) => `
              <tr>
                <td>
                  <strong>${job.title || job.service_type}</strong>
                  ${job.description ? `<br><small style="color:#666">${job.description.slice(0, 50)}...</small>` : ''}
                </td>
                <td><span class="badge badge-${job.status}">${job.status?.replace('_', ' ')}</span></td>
                <td>${job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString() : 'TBD'}</td>
                <td>
                  <a href="/portal/jobs/${job.id}" class="btn btn-secondary" style="padding: 0.5rem 1rem; font-size: 0.85rem;">Details</a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : '<div class="empty">No jobs yet. Request a quote to get started!</div>'}
    </div>
  `;
  
  return c.html(portalLayout('Job History', content, customer));
};

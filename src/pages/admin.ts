import { Context } from 'hono';
import { layout } from '../lib/html';
import { Admin } from '../lib/auth';
import { siteConfig } from '../../config/site.config';

// Admin dashboard layout (different from public site)
export const adminLayout = (title: string, content: string, activePage: string = 'dashboard', admin?: Admin) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Admin - ${siteConfig.business.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .admin-nav {
      background: #2C1810;
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .admin-nav .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .admin-nav .brand img { width: 40px; height: 40px; border-radius: 50%; }
    .admin-nav .user {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .admin-nav .user img { width: 32px; height: 32px; border-radius: 50%; }
    .admin-layout {
      display: grid;
      grid-template-columns: 250px 1fr;
      min-height: calc(100vh - 60px);
    }
    .sidebar {
      background: white;
      border-right: 1px solid #e5e5e5;
      padding: 1rem 0;
    }
    .sidebar a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      color: #333;
      text-decoration: none;
      border-left: 3px solid transparent;
    }
    .sidebar a:hover { background: #f9f9f9; }
    .sidebar a.active {
      background: #fff5f0;
      border-left-color: #8B4513;
      color: #8B4513;
      font-weight: 600;
    }
    .sidebar .divider {
      height: 1px;
      background: #e5e5e5;
      margin: 1rem 0;
    }
    .main-content {
      padding: 2rem;
      overflow-y: auto;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 1.5rem;
    }
    .card h2 {
      color: #8B4513;
      margin-bottom: 1rem;
      font-size: 1.25rem;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat .value { font-size: 2rem; font-weight: bold; color: #8B4513; }
    .stat .label { color: #666; font-size: 0.9rem; }
    .table {
      width: 100%;
      border-collapse: collapse;
    }
    .table th, .table td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid #e5e5e5;
    }
    .table th { font-weight: 600; color: #666; font-size: 0.85rem; text-transform: uppercase; }
    .table tr:hover { background: #f9f9f9; }
    .badge {
      display: inline-block;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .badge-confirmed { background: #d1fae5; color: #065f46; }
    .badge-completed { background: #dbeafe; color: #1e40af; }
    .badge-lead { background: #e5e7eb; color: #374151; }
    .badge-customer { background: #d1fae5; color: #065f46; }
    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #8B4513; color: white; }
    .btn-secondary { background: #e5e7eb; color: #374151; }
    .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
  </style>
</head>
<body>
  <nav class="admin-nav">
    <div class="brand">
      <img src="/api/assets/beaver-avatar.png" alt="Beaver">
      <span>${siteConfig.business.name} Admin</span>
    </div>
    <div class="user">
      <span>${admin?.name || admin?.github_username || 'Admin'}</span>
      <img src="${admin?.avatar_url || '/api/assets/beaver-avatar.png'}" alt="Avatar">
      <a href="/api/auth/logout" style="color: #ccc; margin-left: 1rem;">Logout</a>
    </div>
  </nav>
  
  <div class="admin-layout">
    <aside class="sidebar">
      <a href="/admin" class="${activePage === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>
      <a href="/admin/quotes" class="${activePage === 'quotes' ? 'active' : ''}">💰 Quotes</a>
      <a href="/admin/jobs" class="${activePage === 'jobs' ? 'active' : ''}">🛠️ Jobs</a>
      <a href="/admin/customers" class="${activePage === 'customers' ? 'active' : ''}">👥 Customers</a>
      <a href="/admin/messages" class="${activePage === 'messages' ? 'active' : ''}">💬 Messages</a>
      <div class="divider"></div>
      <a href="/admin/visualizer" class="${activePage === 'visualizer' ? 'active' : ''}">✨ AI Visualizer</a>
      <a href="/admin/invoices" class="${activePage === 'invoices' ? 'active' : ''}">📄 Invoices</a>
      <a href="/admin/gallery" class="${activePage === 'gallery' ? 'active' : ''}">🖼️ Gallery</a>
      <div class="divider"></div>
      <a href="/admin/settings" class="${activePage === 'settings' ? 'active' : ''}">⚙️ Settings</a>
      <a href="/" target="_blank">🌐 View Site</a>
    </aside>
    
    <main class="main-content">
      ${content}
    </main>
  </div>
</body>
</html>
`;

export const adminDashboard = async (c: Context) => {
  const admin = c.get('admin') as Admin;
  const db = c.env.DB;
  
  // Fetch stats
  const [customers, pendingQuotes, activeJobs, unpaidInvoices, recentBookings, recentMessages] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM customers').first<{count: number}>(),
    db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'pending'").first<{count: number}>(),
    db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status IN ('confirmed', 'in_progress')").first<{count: number}>(),
    db.prepare("SELECT COUNT(*) as count FROM payments WHERE status = 'pending'").first<{count: number}>(),
    db.prepare(`
      SELECT b.*, c.name as customer_name, c.email as customer_email
      FROM bookings b
      JOIN customers c ON b.customer_id = c.id
      ORDER BY b.created_at DESC
      LIMIT 10
    `).all(),
    db.prepare(`
      SELECT m.*, c.name as customer_name
      FROM messages m
      JOIN customers c ON m.customer_id = c.id
      WHERE m.sender = 'customer'
      ORDER BY m.created_at DESC
      LIMIT 5
    `).all(),
  ]);
  
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  const content = `
    <h1 style="margin-bottom: 1.5rem; color: #333;">Dashboard</h1>
    
    <div class="stat-grid">
      <div class="stat">
        <div class="value">${customers?.count || 0}</div>
        <div class="label">Total Customers</div>
      </div>
      <div class="stat">
        <div class="value">${pendingQuotes?.count || 0}</div>
        <div class="label">Pending Quotes</div>
      </div>
      <div class="stat">
        <div class="value">${activeJobs?.count || 0}</div>
        <div class="label">Active Jobs</div>
      </div>
      <div class="stat">
        <div class="value">${unpaidInvoices?.count || 0}</div>
        <div class="label">Unpaid Invoices</div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
      <div class="card">
        <h2>Recent Quote Requests</h2>
        <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Service</th>
              <th>Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${(recentBookings.results as any[])?.length > 0 ? (recentBookings.results as any[]).map((b: any) => `
              <tr>
                <td>
                  <strong>${b.customer_name}</strong><br>
                  <small style="color: #666;">${b.customer_email}</small>
                </td>
                <td>${b.service_type || 'General'}</td>
                <td>${formatDate(b.created_at)}</td>
                <td><span class="badge badge-${b.status}">${b.status}</span></td>
                <td>
                  <a href="/admin/jobs/${b.id}" class="btn btn-sm btn-secondary">View</a>
                  ${b.status === 'pending' ? `<a href="/admin/quotes/create?booking=${b.id}" class="btn btn-sm btn-primary">Quote</a>` : ''}
                </td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align: center; color: #666;">No quote requests yet</td></tr>'}
          </tbody>
        </table>
      </div>
      
      <div class="card">
        <h2>Recent Messages</h2>
        ${(recentMessages.results as any[])?.length > 0 ? `
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${(recentMessages.results as any[]).map((m: any) => `
              <div style="padding: 0.75rem; background: #f9f9f9; border-radius: 6px;">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${m.customer_name}</div>
                <div style="color: #666; font-size: 0.9rem;">${m.content?.substring(0, 100)}${m.content?.length > 100 ? '...' : ''}</div>
                <div style="color: #999; font-size: 0.8rem; margin-top: 0.5rem;">${formatDate(m.created_at)}</div>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: #666; text-align: center;">No messages yet</p>'}
        <a href="/admin/messages" class="btn btn-secondary" style="width: 100%; text-align: center; margin-top: 1rem;">
          View All Messages
        </a>
      </div>
    </div>
    
    <div class="card" style="margin-top: 1.5rem;">
      <h2>Quick Actions</h2>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <a href="/admin/quotes/create" class="btn btn-primary">Create Quote</a>
        <a href="/admin/invoices/create" class="btn btn-secondary">Create Invoice</a>
        <a href="/admin/customers" class="btn btn-secondary">View Customers</a>
        <a href="/admin/jobs" class="btn btn-secondary">Manage Jobs</a>
      </div>
    </div>
  `;
  
  return c.html(adminLayout('Dashboard', content, admin));
};

export const adminCustomers = async (c: Context) => {
  const admin = c.get('admin') as Admin;
  const db = c.env.DB;
  
  const customers = await db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM bookings WHERE customer_id = c.id) as job_count,
      (SELECT SUM(amount) FROM payments WHERE customer_id = c.id AND status = 'completed') as total_paid
    FROM customers c
    ORDER BY c.created_at DESC
    LIMIT 100
  `).all();
  
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h1 style="color: #333;">Customers</h1>
      <div style="display: flex; gap: 1rem;">
        <input type="text" placeholder="Search customers..." style="padding: 0.5rem 1rem; border: 1px solid #ddd; border-radius: 6px; width: 250px;">
      </div>
    </div>
    
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Customer</th>
            <th>Contact</th>
            <th>Status</th>
            <th>Jobs</th>
            <th>Total Spent</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${(customers.results as any[])?.length > 0 ? (customers.results as any[]).map((c: any) => `
            <tr>
              <td><strong>${c.name || 'Unknown'}</strong></td>
              <td>
                ${c.email}<br>
                <small style="color: #666;">${c.phone || 'No phone'}</small>
              </td>
              <td><span class="badge badge-${c.status || 'lead'}">${c.status || 'lead'}</span></td>
              <td>${c.job_count || 0}</td>
              <td>$${(c.total_paid || 0).toFixed(2)}</td>
              <td>${formatDate(c.created_at)}</td>
              <td>
                <a href="/admin/customers/${c.id}" class="btn btn-sm btn-secondary">View</a>
              </td>
            </tr>
          `).join('') : '<tr><td colspan="7" style="text-align: center; color: #666;">No customers yet</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  
  return c.html(adminLayout('Customers', content, admin));
};

export const adminQuotes = async (c: Context) => {
  const admin = c.get('admin') as Admin;
  const db = c.env.DB;
  
  const quotes = await db.prepare(`
    SELECT q.*, c.name as customer_name, c.email as customer_email
    FROM quotes q
    JOIN customers c ON q.customer_id = c.id
    ORDER BY q.created_at DESC
    LIMIT 50
  `).all();
  
  const formatDate = (ts: number) => new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h1 style="color: #333;">Quotes</h1>
      <a href="/admin/quotes/create" class="btn btn-primary">Create Quote</a>
    </div>
    
    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>Quote #</th>
            <th>Customer</th>
            <th>Total</th>
            <th>Status</th>
            <th>Created</th>
            <th>Valid Until</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${(quotes.results as any[])?.length > 0 ? (quotes.results as any[]).map((q: any) => `
            <tr>
              <td>#${q.id}</td>
              <td>
                <strong>${q.customer_name}</strong><br>
                <small style="color: #666;">${q.customer_email}</small>
              </td>
              <td><strong>$${(q.total || 0).toFixed(2)}</strong></td>
              <td><span class="badge badge-${q.status}">${q.status}</span></td>
              <td>${formatDate(q.created_at)}</td>
              <td>${q.valid_until ? formatDate(q.valid_until) : '-'}</td>
              <td>
                <a href="/admin/quotes/${q.id}" class="btn btn-sm btn-secondary">View</a>
                ${q.status === 'draft' ? `<a href="/admin/quotes/${q.id}/send" class="btn btn-sm btn-primary">Send</a>` : ''}
              </td>
            </tr>
          `).join('') : '<tr><td colspan="7" style="text-align: center; color: #666;">No quotes yet</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  
  return c.html(adminLayout('Quotes', content, admin));
};

export const adminMessages = async (c: Context) => {
  const admin = c.get('admin') as Admin;
  const db = c.env.DB;
  
  // Get conversations grouped by customer
  const conversations = await db.prepare(`
    SELECT 
      c.id as customer_id,
      c.name as customer_name,
      c.email as customer_email,
      (SELECT COUNT(*) FROM messages WHERE customer_id = c.id AND read_at IS NULL AND sender = 'customer') as unread_count,
      (SELECT content FROM messages WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE customer_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
    FROM customers c
    WHERE EXISTS (SELECT 1 FROM messages WHERE customer_id = c.id)
    ORDER BY last_message_at DESC
    LIMIT 50
  `).all();
  
  const formatDate = (ts: number) => {
    const date = new Date(ts * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 86400000) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  
  const content = `
    <h1 style="margin-bottom: 1.5rem; color: #333;">Messages</h1>
    
    <div class="card">
      ${(conversations.results as any[])?.length > 0 ? `
        <div style="display: flex; flex-direction: column;">
          ${(conversations.results as any[]).map((conv: any) => `
            <a href="/admin/messages/${conv.customer_id}" style="
              display: flex;
              padding: 1rem;
              border-bottom: 1px solid #e5e5e5;
              text-decoration: none;
              color: inherit;
              ${conv.unread_count > 0 ? 'background: #fffbeb;' : ''}
            ">
              <div style="flex: 1;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                  <strong>${conv.customer_name}</strong>
                  <span style="color: #999; font-size: 0.85rem;">${conv.last_message_at ? formatDate(conv.last_message_at) : ''}</span>
                </div>
                <div style="color: #666; font-size: 0.9rem;">
                  ${conv.last_message?.substring(0, 80) || 'No messages'}${conv.last_message?.length > 80 ? '...' : ''}
                </div>
              </div>
              ${conv.unread_count > 0 ? `
                <span style="
                  background: #8B4513;
                  color: white;
                  padding: 0.25rem 0.5rem;
                  border-radius: 12px;
                  font-size: 0.75rem;
                  margin-left: 1rem;
                  align-self: center;
                ">${conv.unread_count}</span>
              ` : ''}
            </a>
          `).join('')}
        </div>
      ` : '<p style="text-align: center; color: #666; padding: 2rem;">No conversations yet</p>'}
    </div>
  `;
  
  return c.html(adminLayout('Messages', content, admin));
};

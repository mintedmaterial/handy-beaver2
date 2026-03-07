import { Context } from 'hono';
import { layout } from '../lib/html';
import { Customer } from '../lib/auth';

export const portalPage = async (c: Context) => {
  const customer = c.get('customer') as Customer;
  
  // Fetch customer's bookings, quotes, messages
  const bookings = await c.env.DB.prepare(`
    SELECT * FROM bookings 
    WHERE customer_id = ? 
    ORDER BY created_at DESC 
    LIMIT 10
  `).bind(customer.id).all();
  
  const quotes = await c.env.DB.prepare(`
    SELECT * FROM quotes 
    WHERE customer_id = ? 
    ORDER BY created_at DESC 
    LIMIT 10
  `).bind(customer.id).all();
  
  const messages = await c.env.DB.prepare(`
    SELECT * FROM messages 
    WHERE customer_id = ? 
    ORDER BY created_at DESC 
    LIMIT 20
  `).bind(customer.id).all();
  
  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#10b981',
      in_progress: '#3b82f6',
      completed: '#22c55e',
      cancelled: '#ef4444',
      draft: '#9ca3af',
      sent: '#f59e0b',
      accepted: '#22c55e',
      declined: '#ef4444',
    };
    return `<span style="
      background: ${colors[status] || '#9ca3af'};
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      text-transform: uppercase;
    ">${status}</span>`;
  };
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const content = `
    <section style="padding: 2rem;">
      <div class="container">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <div>
            <h1 style="font-family: 'Playfair Display', serif; color: var(--accent); font-size: 2rem; margin: 0;">
              Welcome back, ${customer.name}!
            </h1>
            <p style="color: var(--secondary); margin: 0.5rem 0 0;">${customer.email}</p>
          </div>
          <div style="display: flex; gap: 1rem; align-items: center;">
            <a href="/portal/profile" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
              Edit Profile
            </a>
            <a href="/api/auth/logout" class="btn" style="padding: 0.5rem 1rem; background: #666; color: white;">
              Logout
            </a>
          </div>
        </div>
        
        <!-- Stats -->
        <div class="grid grid-4" style="margin-bottom: 2rem;">
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; color: var(--primary); font-weight: bold;">${customer.total_jobs}</div>
            <div style="color: #666;">Completed Jobs</div>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; color: var(--primary); font-weight: bold;">
              $${customer.total_spent.toFixed(0)}
            </div>
            <div style="color: #666;">Total Spent</div>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; color: var(--primary); font-weight: bold;">
              ${(bookings.results as any[])?.filter((b: any) => b.status === 'pending').length || 0}
            </div>
            <div style="color: #666;">Pending Requests</div>
          </div>
          <div class="card" style="text-align: center;">
            <div style="font-size: 2rem; color: var(--primary); font-weight: bold;">
              ${(quotes.results as any[])?.filter((q: any) => q.status === 'sent').length || 0}
            </div>
            <div style="color: #666;">Open Quotes</div>
          </div>
        </div>
        
        <!-- Quick Actions -->
        <div class="card" style="margin-bottom: 2rem;">
          <h3 style="color: var(--primary); margin-bottom: 1rem;">Quick Actions</h3>
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <a href="/contact" class="btn btn-primary">Request New Quote</a>
            <a href="/visualize" class="btn btn-secondary">AI Visualizer</a>
            <a href="/agent" class="btn btn-secondary">Chat with Us</a>
            <a href="/portal/payments" class="btn btn-secondary">Make Payment</a>
          </div>
        </div>
        
        <div class="grid grid-2">
          <!-- Bookings -->
          <div class="card">
            <h3 style="color: var(--primary); margin-bottom: 1rem;">Your Projects</h3>
            ${(bookings.results as any[])?.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${(bookings.results as any[]).map((b: any) => `
                  <div style="padding: 1rem; background: #f9f9f9; border-radius: 8px; border-left: 4px solid var(--primary);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                      <div>
                        <strong>${b.title}</strong>
                        <p style="color: #666; font-size: 0.9rem; margin: 0.25rem 0;">
                          ${b.service_type || 'General'} • ${b.scheduled_date || 'Not scheduled'}
                        </p>
                      </div>
                      ${statusBadge(b.status)}
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="color: #666; text-align: center; padding: 2rem;">
                No projects yet. <a href="/contact" style="color: var(--primary);">Request a quote</a> to get started!
              </p>
            `}
          </div>
          
          <!-- Quotes -->
          <div class="card">
            <h3 style="color: var(--primary); margin-bottom: 1rem;">Your Quotes</h3>
            ${(quotes.results as any[])?.length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                ${(quotes.results as any[]).map((q: any) => `
                  <div style="padding: 1rem; background: #f9f9f9; border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <strong>$${q.total?.toFixed(2) || '0.00'}</strong>
                        <p style="color: #666; font-size: 0.9rem; margin: 0;">
                          ${formatDate(q.created_at)}
                        </p>
                      </div>
                      <div style="display: flex; gap: 0.5rem; align-items: center;">
                        ${statusBadge(q.status)}
                        ${q.status === 'sent' ? `
                          <a href="/portal/quotes/${q.id}" class="btn btn-primary" style="padding: 0.25rem 0.75rem; font-size: 0.85rem;">
                            View
                          </a>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <p style="color: #666; text-align: center; padding: 2rem;">
                No quotes yet.
              </p>
            `}
          </div>
        </div>
        
        <!-- Messages -->
        <div class="card" style="margin-top: 2rem;">
          <h3 style="color: var(--primary); margin-bottom: 1rem;">Recent Messages</h3>
          ${(messages.results as any[])?.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
              ${(messages.results as any[]).map((m: any) => `
                <div style="
                  padding: 0.75rem 1rem;
                  background: ${m.sender === 'customer' ? 'var(--primary)' : '#f9f9f9'};
                  color: ${m.sender === 'customer' ? 'white' : '#333'};
                  border-radius: ${m.sender === 'customer' ? '12px 12px 0 12px' : '12px 12px 12px 0'};
                  align-self: ${m.sender === 'customer' ? 'flex-end' : 'flex-start'};
                  max-width: 80%;
                ">
                  <p style="margin: 0;">${m.content}</p>
                  <small style="opacity: 0.7;">${formatDate(m.created_at)}</small>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="color: #666; text-align: center; padding: 2rem;">
              No messages yet. <a href="/agent" style="color: var(--primary);">Start a conversation</a>!
            </p>
          `}
          <div style="margin-top: 1rem;">
            <a href="/agent" class="btn btn-secondary" style="width: 100%; text-align: center;">
              Open Chat →
            </a>
          </div>
        </div>
      </div>
    </section>
  `;
  
  return c.html(layout('Customer Portal', content, 'portal'));
};

export const loginPage = (c: Context) => {
  const error = c.req.query('error');
  const success = c.req.query('success');
  
  const content = `
    <section style="min-height: calc(100vh - 200px); display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <div class="card" style="max-width: 400px; width: 100%;">
        <div style="text-align: center; margin-bottom: 2rem;">
          <img src="/api/assets/beaver-avatar.png" alt="Handy Beaver" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 1rem;">
          <h1 style="font-family: 'Playfair Display', serif; color: var(--primary); margin: 0;">Customer Portal</h1>
          <p style="color: #666; margin: 0.5rem 0 0;">Sign in with your email</p>
        </div>
        
        ${error ? `
          <div style="background: #fee2e2; color: #dc2626; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            ${error === 'invalid' ? 'Invalid or expired link. Please try again.' : 'An error occurred. Please try again.'}
          </div>
        ` : ''}
        
        ${success ? `
          <div style="background: #dcfce7; color: #16a34a; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
            ✓ Check your email! We've sent you a login link.
          </div>
        ` : ''}
        
        <form action="/api/auth/magic-link" method="POST" style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Email Address</label>
            <input 
              type="email" 
              name="email" 
              required
              placeholder="your@email.com"
              style="width: 100%; padding: 0.75rem; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem;"
            >
          </div>
          
          <button type="submit" class="btn btn-primary" style="width: 100%;">
            Send Login Link
          </button>
        </form>
        
        <div style="text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 0.9rem; margin: 0;">
            New customer? <a href="/contact" style="color: var(--primary);">Request a quote</a> first.
          </p>
        </div>
      </div>
    </section>
  `;
  
  return c.html(layout('Login', content));
};

export const adminLoginPage = (c: Context) => {
  const githubClientId = c.env.GITHUB_CLIENT_ID;
  const callbackUrl = `${new URL(c.req.url).origin}/api/auth/github/callback`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${githubClientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=user:email`;
  
  const content = `
    <section style="min-height: calc(100vh - 200px); display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <div class="card" style="max-width: 400px; width: 100%; text-align: center;">
        <img src="/api/assets/beaver-avatar.png" alt="Handy Beaver" style="width: 80px; height: 80px; border-radius: 50%; margin-bottom: 1rem;">
        <h1 style="font-family: 'Playfair Display', serif; color: var(--primary); margin: 0;">Owner Login</h1>
        <p style="color: #666; margin: 0.5rem 0 1.5rem;">Sign in to manage your business</p>
        
        <a href="${githubAuthUrl}" class="btn" style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: 100%;
          background: #24292e;
          color: white;
          padding: 0.75rem;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Sign in with GitHub
        </a>
        
        <p style="color: #999; font-size: 0.85rem; margin-top: 1.5rem;">
          Only authorized owners can access this area.
        </p>
      </div>
    </section>
  `;
  
  return c.html(layout('Admin Login', content));
};

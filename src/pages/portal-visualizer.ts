import { Context } from 'hono';
import { siteConfig } from '../../config/site.config';

const { business, theme } = siteConfig;

// Portal layout for visualizer pages
const portalVisualizerLayout = (title: string, content: string, customer?: any) => `
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
      max-width: 1400px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      margin-bottom: 1.5rem;
    }
    .btn { display: inline-block; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: var(--primary); color: white; }
    .btn-secondary { background: #e5e7eb; color: #333; }
    .btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
    
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }
    .gallery-item {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .gallery-item:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.12);
    }
    .gallery-item img {
      width: 100%;
      height: 200px;
      object-fit: cover;
    }
    .gallery-item .info {
      padding: 1rem;
    }
    .gallery-item .prompt {
      font-size: 0.9rem;
      color: #333;
      margin-bottom: 0.5rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .gallery-item .meta {
      font-size: 0.8rem;
      color: #999;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .gallery-item .actions {
      display: flex;
      gap: 0.5rem;
      padding: 0 1rem 1rem;
    }
    .save-badge {
      background: #d1fae5;
      color: #065f46;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
    }
    .expires-badge {
      background: #fef3c7;
      color: #92400e;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
    }
    
    .tabs {
      display: flex;
      gap: 1rem;
      margin-bottom: 1.5rem;
      border-bottom: 2px solid #eee;
      padding-bottom: 0.5rem;
    }
    .tab {
      padding: 0.5rem 1rem;
      cursor: pointer;
      color: #666;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
    }
    .tab.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
      font-weight: 600;
    }
    
    .usage-bar {
      background: #e5e7eb;
      border-radius: 10px;
      height: 8px;
      overflow: hidden;
      margin: 0.5rem 0;
    }
    .usage-bar .fill {
      background: var(--primary);
      height: 100%;
      transition: width 0.3s;
    }
    
    @media (max-width: 768px) {
      .portal-layout { grid-template-columns: 1fr; }
      .sidebar { display: flex; overflow-x: auto; padding: 0.5rem; border-right: none; border-bottom: 1px solid #e5e5e5; }
      .sidebar a { padding: 0.5rem 1rem; border-left: none; white-space: nowrap; }
      .gallery-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <nav class="portal-nav">
    <div class="brand">
      <img src="/api/assets/beaver-avatar.png" alt="Beaver">
      <span>My Account</span>
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
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
      <a href="/visualize" class="active">✨ AI Visualizer</a>
      <a href="/portal/gallery">🖼️ My Gallery</a>
    </aside>
    
    <main class="main-content">
      ${content}
    </main>
  </div>
</body>
</html>
`;

export const portalGalleryPage = async (c: Context) => {
  const customer = c.get('customer');
  const customerId = customer?.customer_id;
  
  if (!customerId) {
    return c.redirect('/portal/login');
  }
  
  // Get usage stats
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  const usageToday = await c.env.DB.prepare(`
    SELECT COUNT(*) as count FROM visualizer_usage 
    WHERE customer_id = ? AND created_at >= ?
  `).bind(customerId, startOfDay).first<{ count: number }>();
  
  // Get gallery items
  const gallery = await c.env.DB.prepare(`
    SELECT * FROM visualizer_usage 
    WHERE customer_id = ? 
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(customerId).all();
  
  // Calculate days until expiry for each item
  const now = Math.floor(Date.now() / 1000);
  const thirtyDays = 30 * 24 * 60 * 60;
  
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
      <h1 style="color: var(--primary); font-family: 'Playfair Display', serif;">
        🖼️ My Visualizations
      </h1>
      <a href="/visualize" class="btn btn-primary">✨ Create New</a>
    </div>
    
    <!-- Usage Stats -->
    <div class="card" style="display: flex; gap: 2rem; align-items: center;">
      <div style="flex: 1;">
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 0.25rem;">Today's Usage</div>
        <div style="font-size: 1.5rem; font-weight: 600; color: var(--primary);">
          ${usageToday?.count || 0} / ${customer?.status === 'active' ? 10 : 3}
        </div>
        <div class="usage-bar">
          <div class="fill" style="width: ${Math.min(100, ((usageToday?.count || 0) / (customer?.status === 'active' ? 10 : 3)) * 100)}%"></div>
        </div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 0.9rem; color: #666;">Total Saved</div>
        <div style="font-size: 1.5rem; font-weight: 600;">${gallery.results?.length || 0}</div>
      </div>
    </div>
    
    <!-- Gallery -->
    ${gallery.results?.length ? `
      <div class="gallery-grid">
        ${gallery.results.map((item: any) => {
          const createdAt = item.created_at;
          const expiresAt = createdAt + thirtyDays;
          const daysLeft = Math.ceil((expiresAt - now) / 86400);
          const isSaved = item.saved_indefinitely === 1;
          
          return `
            <div class="gallery-item" data-id="${item.id}">
              <img src="${item.result_url || '/api/assets/placeholder.png'}" alt="Visualization" 
                   onerror="this.src='/api/assets/beaver-avatar.png'">
              <div class="info">
                <div class="prompt">${item.prompt?.replace(/^\[(gemini|workers-ai)\]\s*/i, '') || 'No prompt'}</div>
                <div class="meta">
                  <span>${new Date(createdAt * 1000).toLocaleDateString()}</span>
                  ${isSaved 
                    ? '<span class="save-badge">✓ Saved</span>' 
                    : `<span class="expires-badge">${daysLeft}d left</span>`
                  }
                </div>
              </div>
              <div class="actions">
                <a href="${item.result_url}" download class="btn btn-secondary btn-sm" style="flex: 1; text-align: center;">
                  📥 Download
                </a>
                ${!isSaved ? `
                  <button onclick="saveIndefinitely(${item.id})" class="btn btn-primary btn-sm">
                    💾 Keep
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="card" style="text-align: center; padding: 3rem;">
        <div style="font-size: 4rem; margin-bottom: 1rem;">🎨</div>
        <h3 style="color: var(--primary); margin-bottom: 0.5rem;">No visualizations yet</h3>
        <p style="color: #666; margin-bottom: 1.5rem;">Create your first AI visualization to see it here</p>
        <a href="/visualize" class="btn btn-primary">✨ Create Visualization</a>
      </div>
    `}
    
    <script>
      async function saveIndefinitely(id) {
        try {
          const res = await fetch('/api/visualize/save/' + id, { method: 'POST' });
          if (res.ok) {
            location.reload();
          } else {
            alert('Failed to save');
          }
        } catch (e) {
          alert('Error: ' + e.message);
        }
      }
    </script>
  `;
  
  return c.html(portalVisualizerLayout('My Gallery', content, customer));
};

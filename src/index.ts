import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getCookie } from 'hono/cookie';
import { siteConfig } from '../config/site.config';

// Pages
import { homePage } from './pages/home';
import { servicesPage } from './pages/services';
import { aboutPage } from './pages/about';
import { contactPage } from './pages/contact';
import { blogPage, blogPostPage } from './pages/blog';
import { visualizePage } from './pages/visualize';
import { agentPage } from './pages/agent';
import { portalPage, loginPage, adminLoginPage } from './pages/portal';
import { adminDashboard, adminCustomers, adminQuotes, adminMessages } from './pages/admin';
import { galleryPage, galleryCategoryPage } from './pages/gallery';

// Routes
import { authRoutes } from './routes/auth';
import { adminApi } from './routes/admin-api';
import { facebookMonitor } from './routes/facebook-monitor';
import { facebookPosts } from './routes/facebook-posts';
import { portfolioApi } from './routes/portfolio';

// Auth
import { getSession, requireCustomer, requireAdmin } from './lib/auth';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ENVIRONMENT: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  SQUARE_ACCESS_TOKEN?: string;
  GEMINI_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors());

// ============ PUBLIC PAGES ============

app.get('/', homePage);
app.get('/services', servicesPage);
app.get('/about', aboutPage);
app.get('/contact', contactPage);
app.get('/blog', blogPage);
app.get('/blog/:slug', blogPostPage);
app.get('/visualize', visualizePage);
app.get('/agent', agentPage);
app.get('/chat', agentPage); // Alias
app.get('/gallery', galleryPage);
app.get('/gallery/:slug', galleryCategoryPage);

// Auth pages
app.get('/login', loginPage);
app.get('/admin/login', adminLoginPage);

// Protected portal (check session manually for redirect)
app.get('/portal', async (c) => {
  const token = getCookie(c, 'hb_session');
  
  if (!token) {
    return c.redirect('/login');
  }
  
  const customer = await getSession(c.env.DB, token);
  
  if (!customer) {
    return c.redirect('/login?error=invalid');
  }
  
  c.set('customer', customer);
  return portalPage(c);
});

// Admin routes (protected)
app.get('/admin', requireAdmin, adminDashboard);
app.get('/admin/customers', requireAdmin, adminCustomers);
app.get('/admin/quotes', requireAdmin, adminQuotes);
app.get('/admin/messages', requireAdmin, adminMessages);
app.get('/admin/jobs', requireAdmin, async (c) => {
  // Placeholder - will implement full job management
  return c.redirect('/admin');
});
app.get('/admin/invoices', requireAdmin, async (c) => {
  return c.redirect('/admin');
});
app.get('/admin/payments', requireAdmin, async (c) => {
  return c.redirect('/admin');
});
app.get('/admin/settings', requireAdmin, async (c) => {
  return c.redirect('/admin');
});

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: siteConfig.business.name,
    environment: c.env.ENVIRONMENT 
  });
});

// ============ API ROUTES ============

const api = new Hono<{ Bindings: Bindings }>();

// Mount auth routes
api.route('/auth', authRoutes);

// Mount admin API routes
api.route('/admin', adminApi);

// Mount Facebook monitoring routes
api.route('/facebook', facebookMonitor);
api.route('/facebook', facebookPosts);

// Mount portfolio/gallery API routes
api.route('/images/portfolio', portfolioApi);
api.route('/portfolio', portfolioApi);

// Serve assets from R2
api.get('/assets/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.env.IMAGES.get(key);
  
  if (!object) {
    return c.notFound();
  }
  
  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType || 'application/octet-stream');
  headers.set('Cache-Control', 'public, max-age=86400');
  
  return new Response(object.body, { headers });
});

// Contact form submission
api.post('/contact', async (c) => {
  try {
    const formData = await c.req.formData();
    const name = formData.get('name') as string;
    const email = (formData.get('email') as string)?.toLowerCase().trim();
    const phone = formData.get('phone') as string;
    const service_type = formData.get('service_type') as string;
    const description = formData.get('description') as string;
    const address = formData.get('address') as string;
    const promo = formData.get('promo') as string;
    
    // Save customer to D1
    await c.env.DB.prepare(`
      INSERT INTO customers (email, name, phone, address, status, promo_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'lead', ?, unixepoch(), unixepoch())
      ON CONFLICT(email) DO UPDATE SET 
        name = excluded.name,
        phone = COALESCE(excluded.phone, customers.phone),
        address = COALESCE(excluded.address, customers.address),
        promo_code = COALESCE(excluded.promo_code, customers.promo_code),
        updated_at = unixepoch()
    `).bind(email, name, phone, address, promo || null).run();
    
    // Get customer ID
    const customer = await c.env.DB.prepare(
      'SELECT id FROM customers WHERE email = ?'
    ).bind(email).first<{ id: number }>();
    
    if (customer) {
      // Create booking/inquiry
      await c.env.DB.prepare(`
        INSERT INTO bookings (customer_id, title, description, service_type, status, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, unixepoch(), unixepoch())
      `).bind(
        customer.id,
        `Quote Request - ${service_type}`,
        description,
        service_type,
        promo ? `Promo: ${promo}` : null
      ).run();
    }
    
    // TODO: Upload photos to R2
    // TODO: Send Discord notification
    // TODO: Send confirmation email with login link
    
    return c.html(`
      <!DOCTYPE html>
      <html><head><title>Thank You - ${siteConfig.business.name}</title></head>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #2C1810;">
        <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center; max-width: 500px;">
          <div style="font-size: 4rem; margin-bottom: 1rem;">🦫</div>
          <h1 style="color: #8B4513;">Thank You, ${name}!</h1>
          <p style="color: #666; margin: 1rem 0;">
            We've received your quote request and will get back to you within 24 hours.
          </p>
          ${promo ? '<p style="color: #D2691E; font-weight: bold;">✓ Your discount has been applied!</p>' : ''}
          <p style="color: #666; font-size: 0.9rem; margin: 1rem 0;">
            Check your email (${email}) for a link to access your customer portal.
          </p>
          <a href="/" style="display: inline-block; margin-top: 1rem; background: #8B4513; color: white; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none;">
            Back to Home
          </a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Contact form error:', error);
    return c.json({ error: 'Failed to submit form' }, 500);
  }
});

// Bookings (protected)
api.get('/bookings', async (c) => {
  const token = getCookie(c, 'hb_session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  
  const customer = await getSession(c.env.DB, token);
  if (!customer) return c.json({ error: 'Unauthorized' }, 401);
  
  const bookings = await c.env.DB.prepare(
    'SELECT * FROM bookings WHERE customer_id = ? ORDER BY created_at DESC'
  ).bind(customer.id).all();
  
  return c.json(bookings);
});

api.post('/bookings', async (c) => {
  const data = await c.req.json();
  // TODO: Create booking
  return c.json({ success: true, id: 1 });
});

// Messages (protected)
api.get('/messages', async (c) => {
  const token = getCookie(c, 'hb_session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  
  const customer = await getSession(c.env.DB, token);
  if (!customer) return c.json({ error: 'Unauthorized' }, 401);
  
  const messages = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50'
  ).bind(customer.id).all();
  
  return c.json(messages);
});

api.post('/messages', async (c) => {
  const token = getCookie(c, 'hb_session');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);
  
  const customer = await getSession(c.env.DB, token);
  if (!customer) return c.json({ error: 'Unauthorized' }, 401);
  
  const { content, booking_id } = await c.req.json();
  
  await c.env.DB.prepare(`
    INSERT INTO messages (customer_id, booking_id, sender, content, created_at)
    VALUES (?, ?, 'customer', ?, unixepoch())
  `).bind(customer.id, booking_id || null, content).run();
  
  // TODO: Trigger AI response or notify owner
  
  return c.json({ success: true });
});

// Image upload & AI visualization
api.post('/images/upload', async (c) => {
  // TODO: Accept image, store in R2
  return c.json({ success: true, key: 'image-key' });
});

api.post('/images/visualize', async (c) => {
  // TODO: Send image + prompt to Gemini Pro, return visualization
  return c.json({ success: true, visualization_url: '' });
});

// Mount API
app.route('/api', api);

export default app;

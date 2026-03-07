import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { siteConfig } from '../config/site.config';

// Pages
import { homePage } from './pages/home';
import { servicesPage } from './pages/services';
import { aboutPage } from './pages/about';
import { contactPage } from './pages/contact';
import { blogPage, blogPostPage } from './pages/blog';
import { visualizePage } from './pages/visualize';
import { agentPage } from './pages/agent';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  ENVIRONMENT: string;
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

// Placeholder pages (TODO: implement)
app.get('/portal', (c) => c.redirect('/login'));
app.get('/login', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html><head><title>Login - ${siteConfig.business.name}</title></head>
    <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #2C1810;">
      <div style="background: white; padding: 2rem; border-radius: 12px; text-align: center; max-width: 400px;">
        <h1 style="color: #8B4513;">Customer Portal</h1>
        <p style="color: #666;">Portal coming soon! For now, <a href="/contact" style="color: #8B4513;">contact us</a> directly.</p>
        <a href="/" style="display: inline-block; margin-top: 1rem; color: #8B4513;">← Back to Home</a>
      </div>
    </body>
    </html>
  `);
});
app.get('/chat', (c) => c.redirect('/contact'));

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

// Serve assets from R2
api.get('/assets/:key{.+}', async (c) => {
  const key = `assets/${c.req.param('key')}`;
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
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;
    const service_type = formData.get('service_type') as string;
    const description = formData.get('description') as string;
    const address = formData.get('address') as string;
    const promo = formData.get('promo') as string;
    
    // Save to D1
    const result = await c.env.DB.prepare(`
      INSERT INTO customers (email, name, phone, address, created_at, updated_at)
      VALUES (?, ?, ?, ?, unixepoch(), unixepoch())
      ON CONFLICT(email) DO UPDATE SET 
        name = excluded.name,
        phone = excluded.phone,
        address = COALESCE(excluded.address, customers.address),
        updated_at = unixepoch()
    `).bind(email, name, phone, address).run();
    
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
    // TODO: Send confirmation email
    
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

// Auth: Send magic link
api.post('/auth/login', async (c) => {
  const { email } = await c.req.json();
  // TODO: Generate magic token, send email via Resend
  return c.json({ success: true, message: 'Magic link sent' });
});

// Auth: Verify magic link
api.get('/auth/verify', async (c) => {
  const token = c.req.query('token');
  // TODO: Verify token, create session
  return c.json({ success: true });
});

// Bookings
api.get('/bookings', async (c) => {
  const bookings = await c.env.DB.prepare(
    'SELECT * FROM bookings ORDER BY created_at DESC LIMIT 50'
  ).all();
  return c.json(bookings);
});

api.post('/bookings', async (c) => {
  const data = await c.req.json();
  // TODO: Create booking
  return c.json({ success: true, id: 1 });
});

// Messages
api.get('/messages/:bookingId', async (c) => {
  const bookingId = c.req.param('bookingId');
  const messages = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE booking_id = ? ORDER BY created_at ASC'
  ).bind(bookingId).all();
  return c.json(messages);
});

api.post('/messages', async (c) => {
  const data = await c.req.json();
  // TODO: Save message, trigger AI response if needed
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

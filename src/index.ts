import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getCookie } from 'hono/cookie';
import { siteConfig } from '../config/site.config';
import { sendGmail } from './utils/gmail';

// Pages
import { homePage } from './pages/home';
import { servicesPage } from './pages/services';
import { aboutPage } from './pages/about';
import { contactPage } from './pages/contact';
import { blogPage, blogPostPage } from './pages/blog';
import { visualizePage } from './pages/visualize';
import { agentPage } from './pages/agent';
// Old portal imports removed - using new portal pages
import { adminDashboard, adminCustomers, adminQuotes, adminMessages } from './pages/admin';
import { adminVisualizerPage } from './pages/admin-visualizer';
import { adminLoginPage } from './pages/admin-login';
import { portalVisualizerPage, portalGalleryPage } from './pages/portal-visualizer';
import { adminGalleryPage } from './pages/admin-gallery';
import { adminMessagesPage } from './pages/admin-messages';
import { adminCustomersPage } from './pages/admin-customers';
import { adminQuotesPage } from './pages/admin-quotes';
import { adminJobsPage } from './pages/admin-jobs';
import { adminInvoicesPage } from './pages/admin-invoices';
import { portalLoginPage, portalDashboard, portalQuotes, portalQuoteDetail, portalInvoices, portalInvoiceDetail, portalJobs, portalMessages, requirePortalAuth } from './pages/portal';
import { galleryPage, galleryCategoryPage } from './pages/gallery';

// Routes
import { authRoutes } from './routes/auth';
import { adminApi } from './routes/admin-api';
import { facebookMonitor } from './routes/facebook-monitor';
import { facebookPosts } from './routes/facebook-posts';
// Facebook scraping via Browser Rendering
import { facebookSession } from './routes/facebook-session';
import { facebookScraper } from './routes/facebook-scraper';
import { portfolioApi } from './routes/portfolio';
import { paymentsApi } from './routes/payments';
import { voiceApi } from './routes/voice-api';
import { calendarApi } from './routes/calendar-api';
import { paymentPage } from './pages/payment';
import { visualizeApi } from './routes/visualize-api';

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
  SEND_EMAIL?: any; // Cloudflare Email binding
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

// Payment page (public - anyone with link can pay)
app.get('/pay/:invoice_id', paymentPage);

// Auth pages - redirect to portal login
app.get('/login', (c) => c.redirect('/portal/login'));

// Admin login (public)
app.get('/admin/login', adminLoginPage);

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
app.get('/admin/gallery', requireAdmin, adminGalleryPage);
app.get('/admin/visualizer', requireAdmin, adminVisualizerPage);
app.get('/admin/messages', requireAdmin, adminMessagesPage);
app.get('/admin/messages/:customerId', requireAdmin, adminMessagesPage); // Handle direct links
app.get('/admin/customers', requireAdmin, adminCustomersPage);
app.get('/admin/quotes', requireAdmin, adminQuotesPage);
app.get('/admin/jobs', requireAdmin, adminJobsPage);
app.get('/admin/invoices', requireAdmin, adminInvoicesPage);
app.get('/admin/settings', requireAdmin, async (c) => {
  return c.redirect('/admin');
});

// ============ CUSTOMER PORTAL ============
app.get('/portal/login', portalLoginPage);
app.post('/portal/login', async (c) => {
  const { email } = await c.req.parseBody();
  
  // Find customer
  const customer = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE email = ?'
  ).bind(email).first<any>();
  
  if (!customer) {
    return c.redirect('/portal/login?error=not_found');
  }
  
  // Generate magic token
  const token = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + (15 * 60); // 15 minutes
  
  await c.env.DB.prepare(
    'UPDATE customers SET magic_token = ?, token_expires_at = ? WHERE id = ?'
  ).bind(token, expires, customer.id).run();
  
  // Build magic link
  const magicLink = `https://handybeaver.co/portal/verify?token=${token}`;
  
  // Send email via Cloudflare Email Workers
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8B4513, #D2691E); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0;">🦫 The Handy Beaver</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hi ${customer.name?.split(' ')[0] || 'there'}!</h2>
          <p style="color: #666; font-size: 16px;">Click the button below to access your customer portal:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${magicLink}" style="background: #8B4513; color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold;">
              Log In to Portal →
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">This link expires in 15 minutes.</p>
          <p style="color: #999; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
        </div>
        <div style="padding: 20px; text-align: center; color: #999; font-size: 12px;">
          The Handy Beaver | SE Oklahoma<br>
          Traveling Craftsman & Maintenance Services
        </div>
      </div>
    `;
    
    // Send via Gmail API (using existing Google OAuth)
    const result = await sendGmail(
      c.env,
      email as string,
      'Your Login Link 🦫',
      htmlContent,
      'The Handy Beaver'
    );
    
    if (result.success) {
      console.log('Magic link email sent via Gmail to', email);
    } else {
      console.error('Gmail send failed:', result.error);
      // Fallback: log magic link for manual testing
      console.log('Magic link (fallback):', magicLink);
    }
  } catch (e) {
    console.error('Email error:', e);
  }
  
  return c.redirect('/portal/login?success=1');
});

app.get('/portal/verify', async (c) => {
  const token = c.req.query('token');
  
  if (!token) {
    return c.redirect('/portal/login?error=invalid');
  }
  
  const now = Math.floor(Date.now() / 1000);
  
  // Find customer by token
  const customer = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE magic_token = ? AND token_expires_at > ?'
  ).bind(token, now).first<any>();
  
  if (!customer) {
    return c.redirect('/portal/login?error=expired');
  }
  
  // Create session
  const sessionToken = crypto.randomUUID();
  const sessionExpires = now + (7 * 24 * 60 * 60); // 7 days
  
  await c.env.DB.prepare(`
    INSERT INTO customer_sessions (customer_id, token, expires_at, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(customer.id, sessionToken, sessionExpires, now).run();
  
  // Clear magic token
  await c.env.DB.prepare(
    'UPDATE customers SET magic_token = NULL, token_expires_at = NULL WHERE id = ?'
  ).bind(customer.id).run();
  
  // Set cookie and redirect
  c.header('Set-Cookie', `hb_portal=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);
  return c.redirect('/portal');
});

app.get('/portal/logout', (c) => {
  c.header('Set-Cookie', 'hb_portal=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
  return c.redirect('/portal/login');
});

app.get('/portal', requirePortalAuth, portalDashboard);
app.get('/portal/quotes', requirePortalAuth, portalQuotes);
app.get('/portal/quotes/:id', requirePortalAuth, portalQuoteDetail);
app.post('/portal/quotes/:id/accept', requirePortalAuth, async (c) => {
  const quoteId = c.req.param('id');
  const customer = c.get('customer');
  const now = Math.floor(Date.now() / 1000);
  
  // Verify quote belongs to customer and update status
  await c.env.DB.prepare(`
    UPDATE quotes SET status = 'accepted', updated_at = ? 
    WHERE id = ? AND customer_id = ? AND status = 'sent'
  `).bind(now, quoteId, customer.customer_id).run();
  
  return c.redirect('/portal/quotes/' + quoteId);
});
app.post('/portal/quotes/:id/decline', requirePortalAuth, async (c) => {
  const quoteId = c.req.param('id');
  const customer = c.get('customer');
  const now = Math.floor(Date.now() / 1000);
  
  await c.env.DB.prepare(`
    UPDATE quotes SET status = 'declined', updated_at = ? 
    WHERE id = ? AND customer_id = ? AND status = 'sent'
  `).bind(now, quoteId, customer.customer_id).run();
  
  return c.redirect('/portal/quotes');
});
app.get('/portal/invoices', requirePortalAuth, portalInvoices);
app.get('/portal/invoices/:id', requirePortalAuth, portalInvoiceDetail);
app.get('/portal/jobs', requirePortalAuth, portalJobs);
app.get('/portal/messages', requirePortalAuth, portalMessages);
app.post('/portal/messages', requirePortalAuth, async (c) => {
  const customer = c.get('customer');
  const { message } = await c.req.parseBody();
  const now = Math.floor(Date.now() / 1000);
  
  await c.env.DB.prepare(`
    INSERT INTO messages (customer_id, sender, content, source, created_at)
    VALUES (?, 'customer', ?, 'portal', ?)
  `).bind(customer.customer_id, message, now).run();
  
  return c.redirect('/portal/messages');
});
app.get('/portal/visualizer', requirePortalAuth, portalVisualizerPage);
app.get('/portal/gallery', requirePortalAuth, portalGalleryPage);

// Health check
app.get('/health', (c) => {
  return c.json({ 
    status: 'ok', 
    service: siteConfig.business.name,
    environment: c.env.ENVIRONMENT 
  });
});

// Apple Pay domain verification
app.get('/.well-known/apple-developer-merchantid-domain-association', async (c) => {
  // Apple Pay merchant domain verification file for Square
  const verificationData = '{"pspId":"B86BF7F89377552B43F74A2D40F511A41A3B383BF1F8EBF7AD6DF7303BA68601","version":1,"createdOn":1715203876681,"signature":"308006092a864886f70d010702a0803080020101310d300b0609608648016503040201308006092a864886f70d0107010000a080308203e330820388a003020102020816634c8b0e305717300a06082a8648ce3d040302307a312e302c06035504030c254170706c65204170706c69636174696f6e20496e746567726174696f6e204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b3009060355040613025553301e170d3234303432393137343732375a170d3239303432383137343732365a305f3125302306035504030c1c6563632d736d702d62726f6b65722d7369676e5f5543342d50524f4431143012060355040b0c0b694f532053797374656d7331133011060355040a0c0a4170706c6520496e632e310b30090603550406130255533059301306072a8648ce3d020106082a8648ce3d03010703420004c21577edebd6c7b2218f68dd7090a1218dc7b0bd6f2c283d846095d94af4a5411b83420ed811f3407e83331f1c54c3f7eb3220d6bad5d4eff49289893e7c0f13a38202113082020d300c0603551d130101ff04023000301f0603551d2304183016801423f249c44f93e4ef27e6c4f6286c3fa2bbfd2e4b304506082b0601050507010104393037303506082b060105050730018629687474703a2f2f6f6373702e6170706c652e636f6d2f6f63737030342d6170706c65616963613330323082011d0603551d2004820114308201103082010c06092a864886f7636405013081fe3081c306082b060105050702023081b60c81b352656c69616e6365206f6e207468697320636572746966696361746520627920616e7920706172747920617373756d657320616363657074616e6365206f6620746865207468656e206170706c696361626c65207374616e64617264207465726d7320616e6420636f6e646974696f6e73206f66207573652c20636572746966696361746520706f6c69637920616e642063657274696669636174696f6e2070726163746963652073746174656d656e74732e303606082b06010505070201162a687474703a2f2f7777772e6170706c652e636f6d2f6365727469666963617465617574686f726974792f30340603551d1f042d302b3029a027a0258623687474703a2f2f63726c2e6170706c652e636f6d2f6170706c6561696361332e63726c301d0603551d0e041604149457db6fd57481868989762f7e578507e79b5824300e0603551d0f0101ff040403020780300f06092a864886f76364061d04020500300a06082a8648ce3d0403020349003046022100c6f023cb2614bb303888a162983e1a93f1056f50fa78cdb9ba4ca241cc14e25e022100be3cd0dfd16247f6494475380e9d44c228a10890a3a1dc724b8b4cb8889818bc308202ee30820275a0030201020208496d2fbf3a98da97300a06082a8648ce3d0403023067311b301906035504030c124170706c6520526f6f74204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b3009060355040613025553301e170d3134303530363233343633305a170d3239303530363233343633305a307a312e302c06035504030c254170706c65204170706c69636174696f6e20496e746567726174696f6e204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b30090603550406130255533059301306072a8648ce3d020106082a8648ce3d03010703420004f017118419d76485d51a5e25810776e880a2efde7bae4de08dfc4b93e13356d5665b35ae22d097760d224e7bba08fd7617ce88cb76bb6670bec8e82984ff5445a381f73081f4304606082b06010505070101043a3038303606082b06010505073001862a687474703a2f2f6f6373702e6170706c652e636f6d2f6f63737030342d6170706c65726f6f7463616733301d0603551d0e0416041423f249c44f93e4ef27e6c4f6286c3fa2bbfd2e4b300f0603551d130101ff040530030101ff301f0603551d23041830168014bbb0dea15833889aa48a99debebdebafdacb24ab30370603551d1f0430302e302ca02aa0288626687474703a2f2f63726c2e6170706c652e636f6d2f6170706c65726f6f74636167332e63726c300e0603551d0f0101ff0404030201063010060a2a864886f7636406020e04020500300a06082a8648ce3d040302036700306402303acf7283511699b186fb35c356ca62bff417edd90f754da28ebef19c815e42b789f898f79b599f98d5410d8f9de9c2fe0230322dd54421b0a305776c5df3383b9067fd177c2c216d964fc6726982126f54f87a7d1b99cb9b0989216106990f09921d00003182018930820185020101308186307a312e302c06035504030c254170706c65204170706c69636174696f6e20496e746567726174696f6e204341202d20473331263024060355040b0c1d4170706c652043657274696669636174696f6e20417574686f7269747931133011060355040a0c0a4170706c6520496e632e310b3009060355040613025553020816634c8b0e305717300b0609608648016503040201a08193301806092a864886f70d010903310b06092a864886f70d010701301c06092a864886f70d010905310f170d3234303530383231333131365a302806092a864886f70d010934311b3019300b0609608648016503040201a10a06082a8648ce3d040302302f06092a864886f70d010904312204209dbaa2c4dea464986df093cdbd726cab47580e933c43639c2401d71b0bf64fca300a06082a8648ce3d040302044830460221008f5bd0307b0a7438610c92f55a6481dbe087e4e54db53cba22a4625b26f6942b022100bd16046cbdbf44c9a5c7427c749c1b6bd5fcae549c79a02044ed560664e2513c000000000000"}';
  return new Response(verificationData, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
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
// Facebook scraping via Browser Rendering
api.route('/facebook', facebookSession);
api.route('/facebook', facebookScraper);

// Mount portfolio/gallery API routes
api.route('/images/portfolio', portfolioApi);
api.route('/portfolio', portfolioApi);
api.route('/payments', paymentsApi);
api.route('/voice', voiceApi);
api.route('/calendar', calendarApi);
api.route('/visualize', visualizeApi);

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

// Scheduled handler for cron triggers (Facebook group scanning)
async function scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
  console.log('Cron triggered: Facebook group scan');
  
  // Get stored session
  const session = await env.DB.prepare(
    'SELECT cookies FROM facebook_sessions WHERE id = 1'
  ).first<{ cookies: string }>();
  
  if (!session?.cookies) {
    console.log('No Facebook session stored, skipping scan');
    return;
  }
  
  // Trigger internal scan by making a request
  // Note: In production, you'd call the scraper logic directly here
  // For now, we'll notify Discord that the cron ran
  const webhookResult = await env.DB.prepare(
    "SELECT value FROM settings WHERE key = 'discord_webhook'"
  ).first<{ value: string }>().catch(() => null);
  
  // Use settings table or fall back to env var
  const webhookUrl = webhookResult?.value || env.DISCORD_WEBHOOK_NOTIFICATIONS;
  
  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '🕐 Scheduled Facebook group scan triggered. Scanning 6 groups...',
      }),
    });
  }
  
  console.log('Cron completed');
}

// Email handler for inbound emails
async function email(message: any, env: Bindings) {
  const to = message.to;
  const from = message.from;
  const subject = message.headers.get('subject') || '';
  const rawEmail = await new Response(message.raw).text();
  
  console.log(`Inbound email: ${from} -> ${to}, Subject: ${subject}`);
  
  // Store in messages table if we can identify the customer
  const customer = await env.DB.prepare(
    'SELECT * FROM customers WHERE email = ?'
  ).bind(from).first<any>();
  
  if (customer) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(`
      INSERT INTO messages (customer_id, sender, content, source, created_at)
      VALUES (?, 'customer', ?, 'email', ?)
    `).bind(customer.id, `Subject: ${subject}\n\n${rawEmail.slice(0, 2000)}`, now).run();
  }
  
  // Forward to admin for non-portal emails
  if (to.includes('contact@') || to.includes('admin@')) {
    // Already forwarded via Cloudflare Email Routing to serviceflowagi@gmail.com
    console.log('Contact/admin email will be forwarded via CF routing');
  }
}

export default {
  fetch: app.fetch,
  scheduled,
  email,
};

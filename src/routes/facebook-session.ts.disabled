import { Hono } from 'hono';
import puppeteer, { Browser } from '@cloudflare/puppeteer';

type Bindings = {
  DB: D1Database;
  BROWSER: any;
  DISCORD_WEBHOOK_NOTIFICATIONS?: string;
};

export const facebookSession = new Hono<{ Bindings: Bindings }>();

// Store session cookies in D1
async function saveSession(db: D1Database, cookies: any[]) {
  const now = Math.floor(Date.now() / 1000);
  const cookieJson = JSON.stringify(cookies);
  
  // Upsert session
  await db.prepare(`
    INSERT INTO facebook_sessions (id, cookies, created_at, updated_at)
    VALUES (1, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET cookies = ?, updated_at = ?
  `).bind(cookieJson, now, now, cookieJson, now).run();
}

// Get stored session cookies
async function getSession(db: D1Database): Promise<any[] | null> {
  const result = await db.prepare(
    'SELECT cookies FROM facebook_sessions WHERE id = 1'
  ).first<{ cookies: string }>();
  
  if (!result?.cookies) return null;
  return JSON.parse(result.cookies);
}

// Check if session is valid by testing a Facebook page
async function validateSession(browser: Browser, cookies: any[]): Promise<boolean> {
  let page;
  try {
    page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.goto('https://www.facebook.com/me', { waitUntil: 'networkidle0', timeout: 30000 });
    
    // If redirected to login, session is invalid
    const url = page.url();
    const isValid = !url.includes('login') && !url.includes('checkpoint');
    
    await page.close();
    return isValid;
  } catch (e) {
    if (page) await page.close();
    return false;
  }
}

// Start login flow - returns a URL for manual login
facebookSession.post('/login/start', async (c) => {
  const browser = await puppeteer.launch(c.env.BROWSER);
  
  try {
    const page = await browser.newPage();
    
    // Set viewport to look like a real browser
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to Facebook login
    await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle0' });
    
    // Take screenshot for manual login reference
    const screenshot = await page.screenshot({ encoding: 'base64' });
    
    // Store browser session ID for continuation
    const sessionId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    
    await c.env.DB.prepare(`
      INSERT INTO browser_sessions (session_id, status, created_at)
      VALUES (?, 'pending_login', ?)
    `).bind(sessionId, now).run();
    
    await browser.close();
    
    return c.json({
      message: 'Login flow started. Use /login/complete with your cookies.',
      session_id: sessionId,
      screenshot: `data:image/png;base64,${screenshot}`,
      instructions: [
        '1. Log into Facebook in your browser',
        '2. Open DevTools > Application > Cookies > facebook.com',
        '3. Copy all cookies (especially c_user and xs)',
        '4. POST to /api/facebook/login/complete with the cookies'
      ]
    });
  } catch (error: any) {
    await browser.close();
    return c.json({ error: error.message }, 500);
  }
});

// Complete login by storing cookies
facebookSession.post('/login/complete', async (c) => {
  const { cookies } = await c.req.json();
  
  if (!cookies || !Array.isArray(cookies)) {
    return c.json({ error: 'cookies array required' }, 400);
  }
  
  // Validate required cookies
  const hasCUser = cookies.some((c: any) => c.name === 'c_user');
  const hasXs = cookies.some((c: any) => c.name === 'xs');
  
  if (!hasCUser || !hasXs) {
    return c.json({ 
      error: 'Missing required cookies. Need at least c_user and xs.',
      received: cookies.map((c: any) => c.name)
    }, 400);
  }
  
  // Save session
  await saveSession(c.env.DB, cookies);
  
  // Validate the session works
  const browser = await puppeteer.launch(c.env.BROWSER);
  const isValid = await validateSession(browser, cookies);
  await browser.close();
  
  if (!isValid) {
    return c.json({ 
      error: 'Session cookies saved but validation failed. You may need to re-login.',
      stored: true,
      valid: false
    }, 400);
  }
  
  // Notify Discord
  if (c.env.DISCORD_WEBHOOK_NOTIFICATIONS) {
    await fetch(c.env.DISCORD_WEBHOOK_NOTIFICATIONS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embeds: [{
          title: '✅ Facebook Session Connected',
          description: 'Facebook login successful. Group monitoring is now active.',
          color: 0x00FF00,
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  }
  
  return c.json({ 
    success: true, 
    message: 'Facebook session saved and validated!',
    valid: true
  });
});

// Check session status
facebookSession.get('/session/status', async (c) => {
  const cookies = await getSession(c.env.DB);
  
  if (!cookies) {
    return c.json({ 
      logged_in: false, 
      message: 'No session stored. Use /login/start to begin.' 
    });
  }
  
  // Quick validation
  const browser = await puppeteer.launch(c.env.BROWSER);
  const isValid = await validateSession(browser, cookies);
  await browser.close();
  
  return c.json({
    logged_in: true,
    valid: isValid,
    cookie_count: cookies.length,
    message: isValid ? 'Session is active and valid' : 'Session expired, please re-login'
  });
});

// Manual cookie import (simpler flow)
facebookSession.post('/login/cookies', async (c) => {
  const { c_user, xs, datr, fr } = await c.req.json();
  
  if (!c_user || !xs) {
    return c.json({ 
      error: 'c_user and xs cookies are required',
      help: 'Get these from your browser: DevTools > Application > Cookies > facebook.com'
    }, 400);
  }
  
  const cookies = [
    { name: 'c_user', value: c_user, domain: '.facebook.com', path: '/' },
    { name: 'xs', value: xs, domain: '.facebook.com', path: '/' },
  ];
  
  if (datr) cookies.push({ name: 'datr', value: datr, domain: '.facebook.com', path: '/' });
  if (fr) cookies.push({ name: 'fr', value: fr, domain: '.facebook.com', path: '/' });
  
  await saveSession(c.env.DB, cookies);
  
  return c.json({ 
    success: true, 
    message: 'Cookies saved. Use /session/status to validate.',
    cookies_stored: cookies.length
  });
});

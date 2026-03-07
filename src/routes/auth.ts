import { Hono } from 'hono';
import { setCookie, deleteCookie } from 'hono/cookie';
import {
  createMagicLink,
  verifyMagicLink,
  createSession,
  deleteSession,
  exchangeGitHubCode,
  getGitHubUser,
  findOrCreateAdmin,
  generateToken,
} from '../lib/auth';
import { siteConfig } from '../../config/site.config';

type Bindings = {
  DB: D1Database;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  RESEND_API_KEY?: string;
};

export const authRoutes = new Hono<{ Bindings: Bindings }>();

// Send magic link
authRoutes.post('/magic-link', async (c) => {
  const formData = await c.req.formData();
  const email = (formData.get('email') as string)?.toLowerCase().trim();
  
  if (!email) {
    return c.redirect('/login?error=invalid');
  }
  
  // Find or create customer
  let customer = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE email = ?'
  ).bind(email).first<any>();
  
  if (!customer) {
    // Create as lead
    await c.env.DB.prepare(`
      INSERT INTO customers (email, name, status, created_at, updated_at)
      VALUES (?, ?, 'lead', unixepoch(), unixepoch())
    `).bind(email, email.split('@')[0]).run();
    
    customer = await c.env.DB.prepare(
      'SELECT * FROM customers WHERE email = ?'
    ).bind(email).first<any>();
  }
  
  if (!customer) {
    return c.redirect('/login?error=unknown');
  }
  
  // Create magic link
  const token = await createMagicLink(c.env.DB, customer.id);
  const magicUrl = `${new URL(c.req.url).origin}/api/auth/verify?token=${token}`;
  
  // Send email (via Resend if configured, otherwise log)
  if (c.env.RESEND_API_KEY) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${siteConfig.business.name} <${siteConfig.integrations.email.from}>`,
          to: email,
          subject: `Your login link for ${siteConfig.business.name}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #8B4513;">🦫 ${siteConfig.business.name}</h1>
              <p>Hi there!</p>
              <p>Click the button below to sign in to your customer portal:</p>
              <a href="${magicUrl}" style="
                display: inline-block;
                background: #8B4513;
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 8px;
                margin: 16px 0;
              ">Sign In to Portal</a>
              <p style="color: #666; font-size: 14px;">
                This link expires in 30 minutes. If you didn't request this, you can safely ignore this email.
              </p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
              <p style="color: #999; font-size: 12px;">
                ${siteConfig.business.name} • ${siteConfig.business.serviceArea}
              </p>
            </div>
          `,
        }),
      });
    } catch (e) {
      console.error('Email send error:', e);
    }
  } else {
    // Dev mode: log the link
    console.log(`Magic link for ${email}: ${magicUrl}`);
  }
  
  return c.redirect('/login?success=1');
});

// Verify magic link
authRoutes.get('/verify', async (c) => {
  const token = c.req.query('token');
  
  if (!token) {
    return c.redirect('/login?error=invalid');
  }
  
  const customer = await verifyMagicLink(c.env.DB, token);
  
  if (!customer) {
    return c.redirect('/login?error=invalid');
  }
  
  // Create session
  const sessionToken = await createSession(c.env.DB, customer.id);
  
  setCookie(c, 'hb_session', sessionToken, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });
  
  return c.redirect('/portal');
});

// Logout
authRoutes.get('/logout', async (c) => {
  const token = c.req.header('Cookie')?.match(/hb_session=([^;]+)/)?.[1];
  
  if (token) {
    await deleteSession(c.env.DB, token);
  }
  
  deleteCookie(c, 'hb_session');
  deleteCookie(c, 'hb_admin');
  
  return c.redirect('/');
});

// GitHub OAuth callback
authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  
  if (!code) {
    return c.redirect('/admin/login?error=no_code');
  }
  
  // Exchange code for token
  const accessToken = await exchangeGitHubCode(
    c.env.GITHUB_CLIENT_ID,
    c.env.GITHUB_CLIENT_SECRET,
    code
  );
  
  if (!accessToken) {
    return c.redirect('/admin/login?error=token_failed');
  }
  
  // Get GitHub user
  const githubUser = await getGitHubUser(accessToken);
  
  if (!githubUser) {
    return c.redirect('/admin/login?error=user_failed');
  }
  
  // Find or create admin
  const admin = await findOrCreateAdmin(c.env.DB, githubUser);
  
  if (!admin) {
    return c.redirect('/admin/login?error=not_authorized');
  }
  
  // Create admin session cookie
  const now = Math.floor(Date.now() / 1000);
  const signature = generateToken(16);
  const sessionValue = `${admin.github_id}:${now}:${signature}`;
  
  setCookie(c, 'hb_admin', sessionValue, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
  
  return c.redirect('/admin');
});

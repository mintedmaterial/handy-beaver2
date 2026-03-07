import { Context, MiddlewareHandler } from 'hono';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

// Types
export interface Admin {
  id: number;
  github_id: string;
  github_username: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  role: string;
}

export interface Customer {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: string;
  total_jobs: number;
  total_spent: number;
}

export interface Session {
  type: 'admin' | 'customer';
  user: Admin | Customer;
}

// Generate secure random token
export function generateToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    token += chars[randomValues[i] % chars.length];
  }
  return token;
}

// Magic link auth
export async function createMagicLink(
  db: D1Database,
  customerId: number,
  expiresInMinutes = 30
): Promise<string> {
  const token = generateToken(48);
  const expiresAt = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
  
  await db.prepare(`
    INSERT INTO magic_links (customer_id, token, expires_at)
    VALUES (?, ?, ?)
  `).bind(customerId, token, expiresAt).run();
  
  return token;
}

export async function verifyMagicLink(
  db: D1Database,
  token: string
): Promise<Customer | null> {
  const now = Math.floor(Date.now() / 1000);
  
  // Find valid token
  const link = await db.prepare(`
    SELECT ml.*, c.*
    FROM magic_links ml
    JOIN customers c ON ml.customer_id = c.id
    WHERE ml.token = ? AND ml.expires_at > ? AND ml.used_at IS NULL
  `).bind(token, now).first<any>();
  
  if (!link) return null;
  
  // Mark as used
  await db.prepare(`
    UPDATE magic_links SET used_at = ? WHERE token = ?
  `).bind(now, token).run();
  
  // Upgrade customer status if still lead
  if (link.status === 'lead') {
    await db.prepare(`
      UPDATE customers SET status = 'prospect' WHERE id = ?
    `).bind(link.customer_id).run();
  }
  
  return {
    id: link.customer_id,
    email: link.email,
    name: link.name,
    phone: link.phone,
    address: link.address,
    status: link.status === 'lead' ? 'prospect' : link.status,
    total_jobs: link.total_jobs || 0,
    total_spent: link.total_spent || 0,
  };
}

// Session management
export async function createSession(
  db: D1Database,
  customerId: number,
  expiresInDays = 30
): Promise<string> {
  const token = generateToken(64);
  const expiresAt = Math.floor(Date.now() / 1000) + (expiresInDays * 24 * 60 * 60);
  
  await db.prepare(`
    INSERT INTO customer_sessions (customer_id, token, expires_at)
    VALUES (?, ?, ?)
  `).bind(customerId, token, expiresAt).run();
  
  return token;
}

export async function getSession(
  db: D1Database,
  token: string
): Promise<Customer | null> {
  const now = Math.floor(Date.now() / 1000);
  
  const result = await db.prepare(`
    SELECT c.*, cs.last_used
    FROM customer_sessions cs
    JOIN customers c ON cs.customer_id = c.id
    WHERE cs.token = ? AND cs.expires_at > ?
  `).bind(token, now).first<any>();
  
  if (!result) return null;
  
  // Update last used
  await db.prepare(`
    UPDATE customer_sessions SET last_used = ? WHERE token = ?
  `).bind(now, token).run();
  
  return {
    id: result.id,
    email: result.email,
    name: result.name,
    phone: result.phone,
    address: result.address,
    status: result.status,
    total_jobs: result.total_jobs || 0,
    total_spent: result.total_spent || 0,
  };
}

export async function deleteSession(db: D1Database, token: string): Promise<void> {
  await db.prepare(`
    DELETE FROM customer_sessions WHERE token = ?
  `).bind(token).run();
}

// GitHub OAuth helpers
export interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

export async function exchangeGitHubCode(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<string | null> {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    
    const data = await response.json() as any;
    return data.access_token || null;
  } catch (e) {
    console.error('GitHub OAuth error:', e);
    return null;
  }
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Handy-Beaver-App',
      },
    });
    
    if (!response.ok) return null;
    return response.json() as Promise<GitHubUser>;
  } catch (e) {
    console.error('GitHub user fetch error:', e);
    return null;
  }
}

export async function findOrCreateAdmin(
  db: D1Database,
  githubUser: GitHubUser
): Promise<Admin | null> {
  const now = Math.floor(Date.now() / 1000);
  
  // Try to find existing admin
  let admin = await db.prepare(`
    SELECT * FROM admins WHERE github_id = ?
  `).bind(String(githubUser.id)).first<Admin>();
  
  if (admin) {
    // Update last login
    await db.prepare(`
      UPDATE admins SET last_login = ?, avatar_url = ?, name = ?, email = ?
      WHERE github_id = ?
    `).bind(now, githubUser.avatar_url, githubUser.name, githubUser.email, String(githubUser.id)).run();
    
    return { ...admin, avatar_url: githubUser.avatar_url };
  }
  
  // Create new admin (only if first admin or authorized)
  const adminCount = await db.prepare('SELECT COUNT(*) as count FROM admins').first<{count: number}>();
  
  if (adminCount && adminCount.count === 0) {
    // First admin becomes owner
    await db.prepare(`
      INSERT INTO admins (github_id, github_username, email, name, avatar_url, role, last_login)
      VALUES (?, ?, ?, ?, ?, 'owner', ?)
    `).bind(
      String(githubUser.id),
      githubUser.login,
      githubUser.email,
      githubUser.name,
      githubUser.avatar_url,
      now
    ).run();
    
    return await db.prepare(`
      SELECT * FROM admins WHERE github_id = ?
    `).bind(String(githubUser.id)).first<Admin>();
  }
  
  return null; // Not authorized
}

// Middleware
export const requireCustomer: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, 'hb_session');
  
  if (!token) {
    return c.redirect('/login');
  }
  
  const customer = await getSession(c.env.DB, token);
  
  if (!customer) {
    deleteCookie(c, 'hb_session');
    return c.redirect('/login');
  }
  
  c.set('customer', customer);
  await next();
};

export const requireAdmin: MiddlewareHandler = async (c, next) => {
  const token = getCookie(c, 'hb_admin');
  
  if (!token) {
    return c.redirect('/admin/login');
  }
  
  // Verify admin session (stored as github_id:timestamp:signature)
  const [githubId] = token.split(':');
  const admin = await c.env.DB.prepare(`
    SELECT * FROM admins WHERE github_id = ?
  `).bind(githubId).first<Admin>();
  
  if (!admin) {
    deleteCookie(c, 'hb_admin');
    return c.redirect('/admin/login');
  }
  
  c.set('admin', admin);
  await next();
};

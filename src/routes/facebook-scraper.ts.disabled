import { Hono } from 'hono';
import puppeteer from '@cloudflare/puppeteer';
import { isLeadPost, getResponseTemplate, notifyLead } from './facebook-monitor';

type Bindings = {
  DB: D1Database;
  BROWSER: any;
  DISCORD_WEBHOOK_NOTIFICATIONS?: string;
};

export const facebookScraper = new Hono<{ Bindings: Bindings }>();

// Get stored session
async function getSession(db: D1Database): Promise<any[] | null> {
  const result = await db.prepare(
    'SELECT cookies FROM facebook_sessions WHERE id = 1'
  ).first<{ cookies: string }>();
  
  if (!result?.cookies) return null;
  return JSON.parse(result.cookies);
}

// Get configured groups
async function getGroups(): Promise<any[]> {
  // In production, this could come from D1
  // For now, import from config
  const config = {
    groups: [
      { id: "412909228814153", name: "McCurtain County", enabled: true },
      { id: "382445346214454", name: "Broken Bow McCurtain County and Surrounding Area", enabled: true },
      { id: "hochatownpublic", name: "Hochatown", enabled: true },
      { id: "939908112835798", name: "McCurtain County Swap Shop", enabled: true },
      { id: "618696202323805", name: "Paris Texas Swap Shop", enabled: true },
      { id: "779481948731205", name: "HOCHATOWN...what's happenin'", enabled: true },
    ]
  };
  return config.groups.filter(g => g.enabled);
}

// Check if we've already processed this post
async function isPostProcessed(db: D1Database, postUrl: string): Promise<boolean> {
  const result = await db.prepare(
    'SELECT id FROM leads WHERE source_url = ?'
  ).bind(postUrl).first();
  return !!result;
}

// Scrape a single group for posts
async function scrapeGroup(
  browser: any,
  cookies: any[],
  group: any,
  db: D1Database,
  webhookUrl?: string
): Promise<{ posts: number; leads: number; error?: string }> {
  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setCookie(...cookies);
    
    // Navigate to group
    const groupUrl = `https://www.facebook.com/groups/${group.id}`;
    await page.goto(groupUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for posts to load
    await page.waitForSelector('[role="article"]', { timeout: 10000 }).catch(() => null);
    
    // Scroll to load more posts
    await page.evaluate(() => window.scrollBy(0, 1000));
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract posts
    const posts = await page.evaluate(() => {
      const articles = document.querySelectorAll('[role="article"]');
      const results: any[] = [];
      
      articles.forEach((article, index) => {
        if (index > 20) return; // Limit to 20 posts
        
        // Get post text
        const textElement = article.querySelector('[data-ad-preview="message"]') || 
                           article.querySelector('[dir="auto"]');
        const text = textElement?.textContent?.trim() || '';
        
        // Get post URL
        const linkElement = article.querySelector('a[href*="/posts/"]') ||
                           article.querySelector('a[href*="/permalink/"]');
        const url = linkElement?.getAttribute('href') || '';
        
        // Get author
        const authorElement = article.querySelector('h2 a, h3 a, strong a');
        const author = authorElement?.textContent?.trim() || 'Unknown';
        
        if (text && text.length > 20) {
          results.push({
            text: text.substring(0, 1000),
            url: url.startsWith('http') ? url : `https://www.facebook.com${url}`,
            author
          });
        }
      });
      
      return results;
    });
    
    await page.close();
    
    let leadsFound = 0;
    const now = Math.floor(Date.now() / 1000);
    
    // Process each post
    for (const post of posts) {
      // Skip if already processed
      if (await isPostProcessed(db, post.url)) continue;
      
      // Check if it's a lead
      const result = isLeadPost(post.text);
      
      if (result.isLead) {
        leadsFound++;
        
        // Save lead to DB
        await db.prepare(`
          INSERT INTO leads (
            source, source_url, source_group_id, source_group_name,
            source_user_name, content, keywords_matched, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          'facebook',
          post.url,
          group.id,
          group.name,
          post.author,
          post.text,
          JSON.stringify(result.keywords),
          now
        ).run();
        
        // Notify Discord
        if (webhookUrl) {
          const response = getResponseTemplate(result.keywords);
          await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '🎯 New Lead Detected!',
                color: 0x8B4513,
                fields: [
                  { name: 'Group', value: group.name, inline: true },
                  { name: 'Author', value: post.author, inline: true },
                  { name: 'Keywords', value: result.keywords.join(', '), inline: true },
                  { name: 'Post', value: post.text.substring(0, 300) + '...' },
                  { name: 'Link', value: post.url },
                  { name: 'Suggested Response', value: response },
                ],
                footer: { text: 'Reply with ✅ to respond, ❌ to skip' },
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        }
      }
    }
    
    return { posts: posts.length, leads: leadsFound };
    
  } catch (error: any) {
    await page.close();
    return { posts: 0, leads: 0, error: error.message };
  }
}

// Manual scan trigger
facebookScraper.post('/scan', async (c) => {
  const { group_id } = await c.req.json().catch(() => ({}));
  
  const cookies = await getSession(c.env.DB);
  if (!cookies) {
    return c.json({ error: 'No Facebook session. Use /login/cookies first.' }, 400);
  }
  
  const groups = await getGroups();
  const targetGroups = group_id 
    ? groups.filter(g => g.id === group_id)
    : groups;
  
  if (targetGroups.length === 0) {
    return c.json({ error: 'No groups to scan' }, 400);
  }
  
  const browser = await puppeteer.launch(c.env.BROWSER);
  const results: any[] = [];
  const now = Math.floor(Date.now() / 1000);
  
  try {
    for (const group of targetGroups) {
      const startTime = Date.now();
      const result = await scrapeGroup(
        browser, 
        cookies, 
        group, 
        c.env.DB,
        c.env.DISCORD_WEBHOOK_NOTIFICATIONS
      );
      const duration = Date.now() - startTime;
      
      // Log scan
      await c.env.DB.prepare(`
        INSERT INTO group_scan_log (group_id, group_name, posts_found, leads_found, scan_duration_ms, error, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(group.id, group.name, result.posts, result.leads, duration, result.error || null, now).run();
      
      results.push({
        group: group.name,
        ...result,
        duration_ms: duration
      });
    }
  } finally {
    await browser.close();
  }
  
  return c.json({
    success: true,
    scanned: results.length,
    results,
    total_posts: results.reduce((a, r) => a + r.posts, 0),
    total_leads: results.reduce((a, r) => a + r.leads, 0),
  });
});

// Get scan history
facebookScraper.get('/scan/history', async (c) => {
  const history = await c.env.DB.prepare(`
    SELECT * FROM group_scan_log 
    ORDER BY created_at DESC 
    LIMIT 50
  `).all();
  
  return c.json(history);
});

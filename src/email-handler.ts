/**
 * Email Handler for Cloudflare Email Routing
 * 
 * Handles incoming emails to contact@handybeaver.co
 * - Parses sender and content
 * - Creates message in D1
 * - Notifies owner via Discord webhook
 */

import { siteConfig } from '../config/site.config';

interface EmailMessage {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream;
  readonly rawSize: number;
  setReject(reason: string): void;
  forward(rcptTo: string, headers?: Headers): Promise<void>;
}

interface Env {
  DB: D1Database;
  DISCORD_WEBHOOK_NOTIFICATIONS?: string;
  OWNER_EMAIL?: string;
}

export default {
  async email(message: EmailMessage, env: Env): Promise<void> {
    const from = message.from;
    const to = message.to;
    
    // Read email content
    const rawEmail = await new Response(message.raw).text();
    
    // Parse email (basic parsing - could use a library for complex emails)
    const subjectMatch = rawEmail.match(/^Subject: (.+)$/m);
    const subject = subjectMatch ? subjectMatch[1] : 'No Subject';
    
    // Get body (very basic - after headers)
    const bodyStart = rawEmail.indexOf('\r\n\r\n');
    const body = bodyStart > -1 ? rawEmail.substring(bodyStart + 4).trim() : '';
    
    // Extract sender email
    const senderEmail = from.match(/<(.+)>/)
      ? from.match(/<(.+)>/)?.[1]
      : from;
    
    const now = Math.floor(Date.now() / 1000);
    
    try {
      // Find or create customer
      let customer = await env.DB.prepare(
        'SELECT * FROM customers WHERE email = ?'
      ).bind(senderEmail).first<any>();
      
      if (!customer) {
        // Create new customer from email
        await env.DB.prepare(`
          INSERT INTO customers (email, name, status, created_at, updated_at)
          VALUES (?, ?, 'lead', ?, ?)
        `).bind(senderEmail, from.split('<')[0].trim() || senderEmail, now, now).run();
        
        customer = await env.DB.prepare(
          'SELECT * FROM customers WHERE email = ?'
        ).bind(senderEmail).first<any>();
      }
      
      if (customer) {
        // Create message in D1
        await env.DB.prepare(`
          INSERT INTO messages (customer_id, sender, content, created_at)
          VALUES (?, 'customer', ?, ?)
        `).bind(customer.id, `[Email] ${subject}\n\n${body.substring(0, 2000)}`, now).run();
        
        // Send Discord notification
        if (env.DISCORD_WEBHOOK_NOTIFICATIONS) {
          await fetch(env.DISCORD_WEBHOOK_NOTIFICATIONS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              embeds: [{
                title: '📧 New Email Received',
                color: 0x8B4513,
                fields: [
                  { name: 'From', value: from, inline: true },
                  { name: 'Subject', value: subject, inline: true },
                  { name: 'Preview', value: body.substring(0, 200) + (body.length > 200 ? '...' : '') },
                ],
                footer: { text: siteConfig.business.name },
                timestamp: new Date().toISOString(),
              }],
            }),
          });
        }
      }
      
      // Forward to owner's personal email
      if (env.OWNER_EMAIL) {
        await message.forward(env.OWNER_EMAIL);
      }
      
    } catch (error) {
      console.error('Email processing error:', error);
      // Still forward to owner even if DB fails
      if (env.OWNER_EMAIL) {
        await message.forward(env.OWNER_EMAIL);
      }
    }
  },
};

import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  OPENCLAW_GATEWAY_URL?: string;
  OPENCLAW_GATEWAY_TOKEN?: string;
  OPENCLAW_MODEL_ADMIN?: string;
  OPENCLAW_MODEL_CUSTOMER?: string;
};

export const chatApi = new Hono<{ Bindings: Bindings }>();

function extractAssistantText(data: any): string | null {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = Array.isArray(data?.output) ? data.output : [];
  for (const item of output) {
    if (item?.type === 'message' && item?.role === 'assistant') {
      if (typeof item.content === 'string' && item.content.trim()) return item.content.trim();
      if (Array.isArray(item.content)) {
        const joined = item.content
          .map((part: any) => {
            if (typeof part === 'string') return part;
            if (typeof part?.text === 'string') return part.text;
            if (typeof part?.content === 'string') return part.content;
            return '';
          })
          .join('\n')
          .trim();
        if (joined) return joined;
      }
    }
  }

  return null;
}


// Chat with Lil Beaver via OpenClaw Gateway
chatApi.post('/', async (c) => {
  const { mode, context, messages } = await c.req.json();
  
  const gatewayUrl = c.env.OPENCLAW_GATEWAY_URL || 'http://localhost:18789';
  const gatewayToken = c.env.OPENCLAW_GATEWAY_TOKEN;
  const model = mode === 'admin'
    ? (c.env.OPENCLAW_MODEL_ADMIN || 'openclaw:lil-beaver')
    : (c.env.OPENCLAW_MODEL_CUSTOMER || 'openclaw:lil-beaver');
  
  if (!gatewayToken) {
    return c.json({ 
      response: "I'm not connected right now. Please try again later or contact us directly!" 
    });
  }
  
  // Build system instructions based on mode
  let systemInstructions = '';
  
  if (mode === 'admin') {
    systemInstructions = `You are Lil Beaver 🦫, the admin assistant for The Handy Beaver handyman service.
You're chatting with the business owner through the admin portal.

You have FULL admin access and can help with:
- Creating quotes and invoices
- Managing customers
- Checking job status
- Viewing stats and messages
- Scheduling work

Use the admin API tools when needed. Be helpful, friendly, and efficient.
Keep responses concise for mobile chat.`;
  } else {
    // Customer mode - fetch their data for context
    let customerData = '';
    if (context?.customerId) {
      try {
        const customer = await c.env.DB.prepare(`
          SELECT c.*, 
            (SELECT COUNT(*) FROM quotes WHERE customer_id = c.id) as quote_count,
            (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id AND status != 'paid') as unpaid_invoices,
            (SELECT COUNT(*) FROM bookings WHERE customer_id = c.id AND status = 'in_progress') as active_jobs
          FROM customers c WHERE c.id = ?
        `).bind(context.customerId).first<any>();
        
        if (customer) {
          customerData = `
Customer: ${customer.name}
Email: ${customer.email}
Phone: ${customer.phone || 'Not provided'}
Quotes: ${customer.quote_count}
Unpaid invoices: ${customer.unpaid_invoices}
Active jobs: ${customer.active_jobs}`;
        }
        
        // Get recent quotes
        const quotes = await c.env.DB.prepare(`
          SELECT id, total, status, created_at FROM quotes 
          WHERE customer_id = ? ORDER BY created_at DESC LIMIT 3
        `).bind(context.customerId).all<any>();
        
        if (quotes.results?.length) {
          customerData += '\n\nRecent quotes:\n' + quotes.results.map((q: any) => 
            `- Quote #${q.id}: $${q.total} (${q.status})`
          ).join('\n');
        }
        
        // Get unpaid invoices
        const invoices = await c.env.DB.prepare(`
          SELECT id, total, status, due_date FROM invoices 
          WHERE customer_id = ? AND status != 'paid' ORDER BY created_at DESC LIMIT 3
        `).bind(context.customerId).all<any>();
        
        if (invoices.results?.length) {
          customerData += '\n\nUnpaid invoices:\n' + invoices.results.map((inv: any) => 
            `- Invoice #${inv.id}: $${inv.total} (${inv.status})`
          ).join('\n');
        }
      } catch (e) {
        console.error('Failed to fetch customer data:', e);
      }
    }
    
    systemInstructions = `You are Lil Beaver 🦫, the friendly customer assistant for The Handy Beaver handyman service.
You're chatting with a customer through their account portal.

${customerData ? `CUSTOMER CONTEXT:\n${customerData}\n` : ''}

You can help customers with:
- Understanding their quotes and invoices
- Checking job status
- Answering questions about services
- Scheduling callbacks
- General questions about The Handy Beaver

You DO NOT have access to admin tools. If they need something changed (new quote, reschedule, etc.), 
tell them you'll pass it along to the team or they can call directly.

Be warm, friendly, and helpful. Keep responses concise for mobile chat.
Service area: Southeast Oklahoma.`;
  }
  
  // Build the request for OpenClaw Gateway
  const input = [
    { type: 'message', role: 'system', content: systemInstructions },
    ...messages.slice(-10).map((m: any) => ({
      type: 'message',
      role: m.role,
      content: m.content
    }))
  ];
  
  try {
    const response = await fetch(`${gatewayUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${gatewayToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input,
        user: mode === 'admin' ? 'admin-chat' : `customer-${context?.customerId || 'guest'}`,
        metadata: {
          mode,
          customerId: context?.customerId || null,
          portalScoped: mode !== 'admin',
        },
        max_output_tokens: 500,
      }),
    });
    
    if (!response.ok) {
      console.error('Gateway error:', response.status, await response.text());
      return c.json({ 
        response: "I'm having trouble connecting. Try again in a moment!" 
      });
    }
    
    const data = await response.json() as any;
    const assistantText = extractAssistantText(data);

    return c.json({ 
      response: assistantText || "I understood, but I'm not sure how to respond. Can you rephrase?" 
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return c.json({ 
      response: "Connection error. Please try again or call us directly!" 
    });
  }
});

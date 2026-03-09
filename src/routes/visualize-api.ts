import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  GEMINI_API_KEY?: string;
  AI?: any; // Cloudflare Workers AI binding
};

type CustomerSession = {
  customer_id: number;
  status: string;
  email: string;
  name: string;
};

type AdminSession = {
  id: number;
  role: string;
};

// Usage limits by status
const USAGE_LIMITS: Record<string, number> = {
  lead: 3,
  prospect: 3,
  quote: 3,
  active: 10,
  completed: 5,
};

const ADMIN_UNLIMITED = true;

export const visualizeApi = new Hono<{ Bindings: Bindings }>();

// Check usage for a customer
async function getUsageToday(db: D1Database, customerId: number): Promise<number> {
  const startOfDay = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
  
  const result = await db.prepare(`
    SELECT COUNT(*) as count FROM visualizer_usage 
    WHERE customer_id = ? AND created_at >= ?
  `).bind(customerId, startOfDay).first<{ count: number }>();
  
  return result?.count || 0;
}

// Get customer from portal session
async function getPortalCustomer(db: D1Database, token: string): Promise<CustomerSession | null> {
  const now = Math.floor(Date.now() / 1000);
  
  const result = await db.prepare(`
    SELECT cs.customer_id, c.status, c.email, c.name
    FROM customer_sessions cs
    JOIN customers c ON cs.customer_id = c.id
    WHERE cs.token = ? AND cs.expires_at > ?
  `).bind(token, now).first<CustomerSession>();
  
  return result || null;
}

// Get admin from admin session
async function getAdmin(db: D1Database, token: string): Promise<AdminSession | null> {
  const [githubId] = token.split(':');
  const admin = await db.prepare(`
    SELECT id, role FROM admins WHERE github_id = ?
  `).bind(githubId).first<AdminSession>();
  
  return admin || null;
}

// Check usage limits and return status
visualizeApi.get('/status', async (c) => {
  const portalToken = getCookie(c, 'hb_portal');
  const adminToken = getCookie(c, 'hb_admin');
  
  // Admin check first
  if (adminToken) {
    const admin = await getAdmin(c.env.DB, adminToken);
    if (admin) {
      return c.json({
        authorized: true,
        isAdmin: true,
        unlimited: true,
        usedToday: 0,
        remaining: Infinity,
        status: 'admin',
      });
    }
  }
  
  // Customer check
  if (portalToken) {
    const customer = await getPortalCustomer(c.env.DB, portalToken);
    if (customer) {
      const usedToday = await getUsageToday(c.env.DB, customer.customer_id);
      const limit = USAGE_LIMITS[customer.status] || 3;
      
      return c.json({
        authorized: true,
        isAdmin: false,
        unlimited: false,
        usedToday,
        remaining: Math.max(0, limit - usedToday),
        limit,
        status: customer.status,
        name: customer.name,
      });
    }
  }
  
  // Not logged in
  return c.json({
    authorized: false,
    isAdmin: false,
    unlimited: false,
    usedToday: 0,
    remaining: 0,
    status: 'guest',
    message: 'Please sign in or request a quote to use the AI Visualizer',
  });
});

// Generate visualization with Gemini
visualizeApi.post('/generate', async (c) => {
  const portalToken = getCookie(c, 'hb_portal');
  const adminToken = getCookie(c, 'hb_admin');
  
  let customerId: number | null = null;
  let isAdmin = false;
  let customerStatus = 'guest';
  
  // Admin check
  if (adminToken) {
    const admin = await getAdmin(c.env.DB, adminToken);
    if (admin) {
      isAdmin = true;
      // Admin uses ID 0 for tracking
      customerId = 0;
    }
  }
  
  // Customer check
  if (!isAdmin && portalToken) {
    const customer = await getPortalCustomer(c.env.DB, portalToken);
    if (customer) {
      customerId = customer.customer_id;
      customerStatus = customer.status;
      
      // Check usage limit
      const usedToday = await getUsageToday(c.env.DB, customerId);
      const limit = USAGE_LIMITS[customerStatus] || 3;
      
      if (usedToday >= limit) {
        return c.json({
          success: false,
          error: 'Daily limit reached',
          usedToday,
          limit,
        }, 429);
      }
    }
  }
  
  if (customerId === null) {
    return c.json({
      success: false,
      error: 'Please sign in or request a quote to use the AI Visualizer',
    }, 401);
  }
  
  // Parse multipart form
  const formData = await c.req.formData();
  const imageFile = formData.get('image') as File | null;
  const prompt = formData.get('prompt') as string;
  
  if (!imageFile || !prompt) {
    return c.json({
      success: false,
      error: 'Image and prompt are required',
    }, 400);
  }
  
  // Validate image
  if (!imageFile.type.startsWith('image/')) {
    return c.json({
      success: false,
      error: 'Invalid image type',
    }, 400);
  }
  
  if (imageFile.size > 10 * 1024 * 1024) {
    return c.json({
      success: false,
      error: 'Image too large (max 10MB)',
    }, 400);
  }
  
  try {
    // Convert image to base64 (chunked to avoid stack overflow)
    const imageBuffer = await imageFile.arrayBuffer();
    const bytes = new Uint8Array(imageBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
    }
    const imageBase64 = btoa(binary);
    
    // Store input image in R2
    const inputKey = `visualizer/input/${Date.now()}-${crypto.randomUUID()}.${imageFile.type.split('/')[1]}`;
    await c.env.IMAGES.put(inputKey, imageBuffer, {
      httpMetadata: { contentType: imageFile.type },
    });
    
    // Check for Gemini API key
    if (!c.env.GEMINI_API_KEY) {
      // Demo mode - return mock result
      const now = Math.floor(Date.now() / 1000);
      await c.env.DB.prepare(`
        INSERT INTO visualizer_usage (customer_id, image_key, prompt, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(customerId, inputKey, prompt, now).run();
      
      return c.json({
        success: true,
        demo: true,
        message: 'AI visualization coming soon! Your request has been logged.',
        inputUrl: `/api/assets/${inputKey}`,
      });
    }
    
    // Step 1: Enhance prompt via Lil Beaver (Gemini Flash)
    let enhancedPrompt = prompt;
    try {
      const enhanceUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${c.env.GEMINI_API_KEY}`;
      
      const enhanceResponse = await fetch(enhanceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are Lil Beaver, a friendly home improvement expert assistant for The Handy Beaver handyman service. 

Your task: Enhance this customer's visualization request into a detailed, professional prompt for AI image generation. Add specific details about:
- Wood types (cedar, pine, oak, mahogany, etc.)
- Stain/paint terminology (semi-transparent, solid, satin, semi-gloss, matte)
- Color accuracy (use descriptive color names like "dark walnut", "honey oak", "weathered gray")
- Construction details where relevant (board width, railing style, trim profiles)

Keep the customer's intent but make it more specific and detailed. Output ONLY the enhanced prompt, no explanations.

Customer's request: "${prompt}"

Enhanced prompt:`
            }]
          }],
          generationConfig: {
            maxOutputTokens: 200,
            temperature: 0.7,
          },
        }),
      });
      
      if (enhanceResponse.ok) {
        const enhanceResult = await enhanceResponse.json() as any;
        const enhancedText = enhanceResult.candidates?.[0]?.content?.parts?.[0]?.text;
        if (enhancedText) {
          enhancedPrompt = enhancedText.trim();
          console.log('Prompt enhanced:', enhancedPrompt);
        }
      }
    } catch (e) {
      console.error('Prompt enhancement failed, using original:', e);
      // Continue with original prompt
    }
    
    // Step 2: Call Gemini API for image editing
    // Use gemini-2.0-flash-exp-image-generation for image output
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${c.env.GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: `You are a professional home improvement visualization assistant for The Handy Beaver handyman service. Edit this image according to the following detailed request. Keep the original perspective, lighting, and composition as much as possible while applying the requested changes realistically. Request: ${enhancedPrompt}` },
            {
              inline_data: {
                mime_type: imageFile.type,
                data: imageBase64,
              },
            },
          ],
        }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    });
    
    let generatedImageBase64: string | null = null;
    let generationMethod = 'gemini';
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', response.status, errorText);
      
      // Fallback to Cloudflare Workers AI (try multiple models)
      if (c.env.AI) {
        console.log('Gemini failed, trying CF Workers AI fallbacks');
        generationMethod = 'workers-ai';
        
        // Try Flux first (best quality), then Leonardo, then SD
        const models = [
          '@cf/black-forest-labs/flux-1-schnell',
          '@cf/lykon/dreamshaper-8-lcm',
          '@cf/stabilityai/stable-diffusion-xl-base-1.0',
        ];
        
        let cfResult: ArrayBuffer | null = null;
        for (const model of models) {
          try {
            console.log(`Trying model: ${model}`);
            cfResult = await c.env.AI.run(model, {
              prompt: `Professional home improvement photo: ${enhancedPrompt}. Realistic, high quality, natural lighting.`,
            }) as ArrayBuffer;
            if (cfResult) {
              console.log(`Success with model: ${model}`);
              generationMethod = `workers-ai/${model.split('/').pop()}`;
              break;
            }
          } catch (modelErr) {
            console.error(`Model ${model} failed:`, modelErr);
          }
        }
        
        if (cfResult) {
          // CF Workers AI returns ArrayBuffer - use chunked conversion
          const buffer = new Uint8Array(cfResult);
          let cfBinary = '';
          for (let i = 0; i < buffer.length; i += 8192) {
            cfBinary += String.fromCharCode(...buffer.slice(i, i + 8192));
          }
          generatedImageBase64 = btoa(cfBinary);
        } else {
          throw new Error('All CF models failed');
        }
      } else {
        throw new Error('AI generation failed');
      }
    } else {
      const result = await response.json() as any;
      console.log('Gemini response structure:', JSON.stringify({
        hasCandidate: !!result.candidates?.[0],
        partsCount: result.candidates?.[0]?.content?.parts?.length || 0,
        partTypes: result.candidates?.[0]?.content?.parts?.map((p: any) => p.text ? 'text' : p.inline_data ? 'image' : 'unknown') || [],
        finishReason: result.candidates?.[0]?.finishReason,
      }));
      
      // Extract generated image from Gemini response
      for (const part of result.candidates?.[0]?.content?.parts || []) {
        if (part.inline_data?.data) {
          generatedImageBase64 = part.inline_data.data;
          break;
        }
      }
    }
    
    if (!generatedImageBase64) {
      throw new Error('No image generated - Gemini may not support image editing for this request');
    }
    
    // Convert base64 to buffer
    const generatedBuffer = Uint8Array.from(atob(generatedImageBase64), c => c.charCodeAt(0));
    
    // Add watermark (composite beaver avatar in corner)
    // For now, store without watermark - will add in separate PR
    const resultKey = `visualizer/output/${Date.now()}-${crypto.randomUUID()}.jpg`;
    await c.env.IMAGES.put(resultKey, generatedBuffer, {
      httpMetadata: { contentType: 'image/jpeg' },
      customMetadata: {
        prompt,
        customerId: String(customerId),
        watermarked: 'pending', // Will be processed by worker
      },
    });
    
    // Log usage with enhanced prompt
    const now = Math.floor(Date.now() / 1000);
    await c.env.DB.prepare(`
      INSERT INTO visualizer_usage (customer_id, image_key, prompt, result_key, result_url, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(customerId, inputKey, `[${generationMethod}] ${enhancedPrompt}`, resultKey, `/api/assets/${resultKey}`, now).run();
    
    return c.json({
      success: true,
      resultUrl: `/api/assets/${resultKey}`,
      inputUrl: `/api/assets/${inputKey}`,
    });
    
  } catch (error) {
    console.error('Visualization error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Generation failed',
    }, 500);
  }
});

// Save visualization indefinitely (prevent 30-day expiry)
visualizeApi.post('/save/:id', async (c) => {
  const portalToken = getCookie(c, 'hb_portal');
  const id = c.req.param('id');
  
  if (!portalToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const customer = await getPortalCustomer(c.env.DB, portalToken);
  if (!customer) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Verify ownership and update
  const result = await c.env.DB.prepare(`
    UPDATE visualizer_usage 
    SET saved_indefinitely = 1 
    WHERE id = ? AND customer_id = ?
  `).bind(id, customer.customer_id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ error: 'Not found or not yours' }, 404);
  }
  
  return c.json({ success: true });
});

// Get usage history for customer
visualizeApi.get('/history', async (c) => {
  const portalToken = getCookie(c, 'hb_portal');
  const adminToken = getCookie(c, 'hb_admin');
  
  let customerId: number | null = null;
  
  if (adminToken) {
    const admin = await getAdmin(c.env.DB, adminToken);
    if (admin) {
      // Admin can see all - return recent
      const results = await c.env.DB.prepare(`
        SELECT vu.*, c.name, c.email
        FROM visualizer_usage vu
        LEFT JOIN customers c ON vu.customer_id = c.id
        ORDER BY vu.created_at DESC
        LIMIT 50
      `).all();
      
      return c.json({ history: results.results, isAdmin: true });
    }
  }
  
  if (portalToken) {
    const customer = await getPortalCustomer(c.env.DB, portalToken);
    if (customer) {
      customerId = customer.customer_id;
    }
  }
  
  if (!customerId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const results = await c.env.DB.prepare(`
    SELECT * FROM visualizer_usage 
    WHERE customer_id = ?
    ORDER BY created_at DESC
    LIMIT 20
  `).bind(customerId).all();
  
  return c.json({ history: results.results, isAdmin: false });
});

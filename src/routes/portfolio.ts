import { Hono } from 'hono';
import { portfolioManifest, getImagesByCategory, getFeaturedImages, getBeforeAfterPairs, type PortfolioCategory } from '../../config/portfolio-manifest';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
};

export const portfolioApi = new Hono<{ Bindings: Bindings }>();

// ============ PUBLIC API ============

/**
 * Get all portfolio categories
 */
portfolioApi.get('/categories', async (c) => {
  const categories = await c.env.DB.prepare(`
    SELECT * FROM portfolio_categories ORDER BY display_order
  `).all();
  
  return c.json(categories.results || []);
});

/**
 * Get images for a category
 */
portfolioApi.get('/category/:slug', async (c) => {
  const slug = c.req.param('slug') as PortfolioCategory;
  
  // Get from manifest for now (will migrate to DB later)
  const images = getImagesByCategory(slug);
  
  return c.json({
    category: slug,
    images: images.map(img => ({
      ...img,
      url: `/api/images/portfolio/${img.category}/${img.filename}`,
      thumbnailUrl: `/api/images/portfolio/${img.category}/thumb_${img.filename}`,
    }))
  });
});

/**
 * Get featured images for homepage
 */
portfolioApi.get('/featured', async (c) => {
  const images = getFeaturedImages();
  
  return c.json({
    images: images.map(img => ({
      ...img,
      url: `/api/images/portfolio/${img.category}/${img.filename}`,
    }))
  });
});

/**
 * Get before/after pairs
 */
portfolioApi.get('/before-after', async (c) => {
  const pairs = getBeforeAfterPairs();
  
  return c.json({
    pairs: pairs.map(({ before, after }) => ({
      before: {
        ...before,
        url: `/api/images/portfolio/${before.category}/${before.filename}`,
      },
      after: {
        ...after,
        url: `/api/images/portfolio/${after.category}/${after.filename}`,
      }
    }))
  });
});

/**
 * Get full manifest (for admin/debugging)
 */
portfolioApi.get('/manifest', async (c) => {
  return c.json({
    total: portfolioManifest.length,
    categories: [...new Set(portfolioManifest.map(i => i.category))],
    images: portfolioManifest,
  });
});

// ============ IMAGE SERVING ============

/**
 * Serve portfolio image from R2
 * Route: /api/images/portfolio/:category/:filename
 */
portfolioApi.get('/:category/:filename', async (c) => {
  const category = c.req.param('category');
  const filename = c.req.param('filename');
  
  const key = `portfolio/${category}/${filename}`;
  const object = await c.env.IMAGES.get(key);
  
  if (!object) {
    // Return placeholder if image not found
    return c.json({ error: 'Image not found', key }, 404);
  }
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000'); // 1 year cache
  
  return new Response(object.body, { headers });
});

// ============ ADMIN API (requires auth) ============

/**
 * Upload portfolio image to R2
 */
portfolioApi.post('/upload', async (c) => {
  // TODO: Add admin auth middleware
  const formData = await c.req.formData();
  const file = formData.get('file') as unknown;
  const category = formData.get('category') as string;
  
  // Check if file is a File object (has name, type, stream properties)
  if (!file || typeof file === 'string' || !category) {
    return c.json({ error: 'Missing file or category' }, 400);
  }
  
  const fileObj = file as { name: string; type: string; stream: () => ReadableStream };
  const filename = (formData.get('filename') as string) || fileObj.name;
  const key = `portfolio/${category}/${filename}`;
  
  await c.env.IMAGES.put(key, fileObj.stream(), {
    httpMetadata: {
      contentType: fileObj.type,
    },
  });
  
  return c.json({ 
    success: true, 
    key,
    url: `/api/images/portfolio/${category}/${filename}`,
  });
});

/**
 * Bulk upload multiple images
 */
portfolioApi.post('/upload-bulk', async (c) => {
  // TODO: Add admin auth middleware
  const formData = await c.req.formData();
  const category = formData.get('category') as string;
  
  if (!category) {
    return c.json({ error: 'Missing category' }, 400);
  }
  
  const results: Array<{ filename: string; key: string; success: boolean; error?: string }> = [];
  
  for (const [name, value] of formData.entries()) {
    if (name === 'category') continue;
    if (typeof value === 'string') continue;
    
    const file = value as File;
    const filename = file.name;
    const key = `portfolio/${category}/${filename}`;
    
    try {
      await c.env.IMAGES.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type,
        },
      });
      results.push({ filename, key, success: true });
    } catch (error) {
      results.push({ filename, key, success: false, error: String(error) });
    }
  }
  
  return c.json({ 
    success: true, 
    uploaded: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results,
  });
});

/**
 * List all images in R2 bucket (for sync verification)
 */
portfolioApi.get('/r2-list', async (c) => {
  const prefix = c.req.query('prefix') || 'portfolio/';
  const listed = await c.env.IMAGES.list({ prefix });
  
  return c.json({
    count: listed.objects.length,
    objects: listed.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
    })),
  });
});

/**
 * Delete portfolio image
 */
portfolioApi.delete('/:category/:filename', async (c) => {
  // TODO: Add admin auth middleware
  const category = c.req.param('category');
  const filename = c.req.param('filename');
  
  const key = `portfolio/${category}/${filename}`;
  await c.env.IMAGES.delete(key);
  
  return c.json({ success: true, deleted: key });
});

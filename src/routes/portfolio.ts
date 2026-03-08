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
 * Delete portfolio image from R2
 */
portfolioApi.delete('/:category/:filename', async (c) => {
  const category = c.req.param('category');
  const filename = c.req.param('filename');
  
  const key = `portfolio/${category}/${filename}`;
  await c.env.IMAGES.delete(key);
  
  return c.json({ success: true, deleted: key });
});

// ============ CATEGORY CRUD ============

/**
 * Create category
 */
portfolioApi.post('/categories', async (c) => {
  const { name, icon, description } = await c.req.json();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const now = Math.floor(Date.now() / 1000);
  
  // Get max order
  const maxOrder = await c.env.DB.prepare(
    'SELECT MAX(display_order) as max FROM portfolio_categories'
  ).first<{ max: number }>();
  
  await c.env.DB.prepare(`
    INSERT INTO portfolio_categories (name, slug, icon, description, display_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(name, slug, icon || '📁', description || '', (maxOrder?.max || 0) + 1, now).run();
  
  return c.json({ success: true, slug });
});

/**
 * Delete category
 */
portfolioApi.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  
  // Uncategorize images
  await c.env.DB.prepare(
    'UPDATE portfolio_images SET category_id = NULL WHERE category_id = ?'
  ).bind(id).run();
  
  // Delete category
  await c.env.DB.prepare(
    'DELETE FROM portfolio_categories WHERE id = ?'
  ).bind(id).run();
  
  return c.json({ success: true });
});

// ============ IMAGE CRUD WITH DB ============

/**
 * Upload image (stores in R2 + DB)
 */
portfolioApi.post('/images/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as unknown;
  const categoryId = formData.get('category') as string;
  const title = formData.get('title') as string || 'Untitled';
  const description = formData.get('description') as string || '';
  const mediaType = formData.get('media_type') as string || 'image';
  const isBeforeAfter = formData.get('is_before_after') === 'on';
  const baType = formData.get('ba_type') as string;
  
  if (!file || typeof file === 'string') {
    return c.json({ error: 'No file provided' }, 400);
  }
  
  const fileObj = file as { name: string; type: string; arrayBuffer: () => Promise<ArrayBuffer> };
  const ext = fileObj.name.split('.').pop() || 'jpg';
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  
  // Get category slug
  let categorySlug = 'uncategorized';
  if (categoryId) {
    const cat = await c.env.DB.prepare(
      'SELECT slug FROM portfolio_categories WHERE id = ?'
    ).bind(categoryId).first<{ slug: string }>();
    if (cat) categorySlug = cat.slug;
  }
  
  const key = `portfolio/${categorySlug}/${filename}`;
  
  // Upload to R2
  const buffer = await fileObj.arrayBuffer();
  await c.env.IMAGES.put(key, buffer, {
    httpMetadata: { contentType: fileObj.type },
  });
  
  const url = `/api/images/portfolio/${categorySlug}/${filename}`;
  const now = Math.floor(Date.now() / 1000);
  
  // Save to DB
  const result = await c.env.DB.prepare(`
    INSERT INTO portfolio_images (category_id, title, description, url, filename, media_type, is_before_after, ba_type, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    categoryId || null,
    title,
    description,
    url,
    filename,
    mediaType,
    isBeforeAfter ? 1 : 0,
    baType || null,
    now
  ).run();
  
  return c.json({
    success: true,
    id: result.meta.last_row_id,
    url,
    key,
  });
});

/**
 * Delete image from DB and R2
 */
portfolioApi.delete('/images/:id', async (c) => {
  const id = c.req.param('id');
  
  // Get image details
  const image = await c.env.DB.prepare(
    'SELECT * FROM portfolio_images WHERE id = ?'
  ).bind(id).first<any>();
  
  if (!image) {
    return c.json({ error: 'Image not found' }, 404);
  }
  
  // Delete from R2 if we have the key
  if (image.url) {
    const key = image.url.replace('/api/images/', '');
    await c.env.IMAGES.delete(key);
  }
  
  // Delete from DB
  await c.env.DB.prepare(
    'DELETE FROM portfolio_images WHERE id = ?'
  ).bind(id).run();
  
  return c.json({ success: true });
});

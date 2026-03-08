import { Context } from 'hono';
import { layout } from '../lib/html';
import { siteConfig } from '../../config/site.config';
import { portfolioManifest, getFeaturedImages, getBeforeAfterPairs, type PortfolioCategory } from '../../config/portfolio-manifest';

const { business } = siteConfig;

// Category metadata
const categories: Array<{ slug: PortfolioCategory; name: string; icon: string; description: string }> = [
  { slug: 'bathroom-remodels', name: 'Bathroom Remodels', icon: '🛁', description: 'Full bathroom transformations with tile, shiplap, and custom woodwork' },
  { slug: 'specialty-wood', name: 'Specialty Wood', icon: '🪵', description: 'Blue pine, beetle kill, live-edge, and premium woodwork' },
  { slug: 'trim-carpentry', name: 'Trim & Carpentry', icon: '🔨', description: 'Crown molding, door trim, T&G accent walls' },
  { slug: 'flooring', name: 'Flooring', icon: '🏠', description: 'Hardwood installation, repair, and refinishing' },
  { slug: 'stairs-railings', name: 'Stairs & Railings', icon: '🪜', description: 'Custom stairs, modern metal railings' },
  { slug: 'decks-outdoor', name: 'Decks & Outdoor', icon: '🏡', description: 'Deck builds, repairs, staining, and outdoor living' },
  { slug: 'doors', name: 'Door Installation', icon: '🚪', description: 'Entry doors, French doors, and custom trim work' },
];

export const galleryPage = (c: Context) => {
  const featured = getFeaturedImages();
  const beforeAfter = getBeforeAfterPairs();
  
  const content = `
    <section style="padding: 4rem 2rem; text-align: center; background: linear-gradient(180deg, rgba(139, 69, 19, 0.3) 0%, transparent 100%);">
      <h1 class="section-title" style="font-size: 3rem;">Our Work</h1>
      <p class="section-subtitle" style="font-size: 1.25rem;">Quality craftsmanship across Southeast Oklahoma</p>
    </section>
    
    <!-- Before/After Showcase -->
    <section class="container">
      <h2 class="section-title">Transformations</h2>
      <p class="section-subtitle">See the difference quality work makes</p>
      
      <div id="before-after-slider" class="before-after-container">
        ${beforeAfter.length > 0 ? `
          ${beforeAfter.map(({ before, after }) => `
            <div class="before-after-pair" data-pair>
              <div class="ba-card">
                <div class="ba-images">
                  <div class="ba-before">
                    <img src="/api/images/portfolio/${before.category}/${before.filename}" alt="${before.title}" loading="lazy">
                    <span class="ba-label">Before</span>
                  </div>
                  <div class="ba-after">
                    <img src="/api/images/portfolio/${after.category}/${after.filename}" alt="${after.title}" loading="lazy">
                    <span class="ba-label">After</span>
                  </div>
                </div>
                <div class="ba-info">
                  <h3>${after.title}</h3>
                  <p>${after.description}</p>
                </div>
              </div>
            </div>
          `).join('')}
        ` : `
          <div class="card" style="text-align: center; padding: 3rem;">
            <p style="color: #666;">Before/after photos coming soon!</p>
            <p style="color: #999; font-size: 0.9rem; margin-top: 0.5rem;">Check back soon to see our transformations.</p>
          </div>
        `}
      </div>
    </section>
    
    <!-- Category Grid -->
    <section class="container" style="margin-top: 4rem;">
      <h2 class="section-title">Browse by Category</h2>
      
      <div class="grid grid-3">
        ${categories.map(cat => {
          const catImages = portfolioManifest.filter(img => img.category === cat.slug);
          return `
            <a href="/gallery/${cat.slug}" class="category-card card" style="text-decoration: none; display: block;">
              <div style="font-size: 3rem; margin-bottom: 1rem; text-align: center;">${cat.icon}</div>
              <h3 style="color: var(--primary); text-align: center; margin-bottom: 0.5rem;">${cat.name}</h3>
              <p style="color: #666; text-align: center; font-size: 0.9rem; margin-bottom: 1rem;">${cat.description}</p>
              <p style="color: var(--secondary); text-align: center; font-size: 0.85rem;">
                ${catImages.length} photo${catImages.length !== 1 ? 's' : ''} →
              </p>
            </a>
          `;
        }).join('')}
      </div>
    </section>
    
    <!-- Featured Work -->
    <section class="container" style="margin-top: 4rem;">
      <h2 class="section-title">Featured Work</h2>
      <p class="section-subtitle">Our best craftsmanship</p>
      
      <div class="gallery-grid">
        ${featured.map(img => `
          <div class="gallery-item ${img.featured ? 'featured' : ''}" data-category="${img.category}">
            <img 
              src="/api/images/portfolio/${img.category}/${img.filename}" 
              alt="${img.title}"
              loading="lazy"
              onclick="openLightbox(this)"
            >
            <div class="gallery-overlay">
              <h4>${img.title}</h4>
              <p>${img.description}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
    
    <!-- CTA -->
    <section class="container" style="margin-top: 4rem; text-align: center;">
      <div class="card" style="display: inline-block; padding: 2rem 3rem; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white;">
        <h3 style="margin-bottom: 1rem;">Ready for Your Transformation?</h3>
        <p style="margin-bottom: 1.5rem; opacity: 0.9;">Get a free consultation and quote for your project.</p>
        <a href="/contact" class="btn" style="background: white; color: var(--primary);">Request Free Quote →</a>
      </div>
    </section>
    
    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
      <span class="lightbox-close">&times;</span>
      <img id="lightbox-img" src="" alt="">
      <div id="lightbox-caption"></div>
    </div>
    
    <style>
      /* Before/After Styles */
      .before-after-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 2rem;
      }
      .ba-card {
        background: white;
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
      }
      .ba-images {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .ba-before, .ba-after {
        position: relative;
      }
      .ba-before img, .ba-after img {
        width: 100%;
        height: 200px;
        object-fit: cover;
      }
      .ba-label {
        position: absolute;
        bottom: 0.5rem;
        left: 0.5rem;
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        text-transform: uppercase;
      }
      .ba-info {
        padding: 1rem;
      }
      .ba-info h3 {
        color: var(--primary);
        margin: 0 0 0.5rem;
        font-size: 1.1rem;
      }
      .ba-info p {
        color: #666;
        margin: 0;
        font-size: 0.9rem;
      }
      
      /* Category Cards */
      .category-card {
        transition: transform 0.3s, box-shadow 0.3s;
      }
      .category-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
      }
      
      /* Gallery Grid */
      .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
      }
      .gallery-item {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        aspect-ratio: 4/3;
      }
      .gallery-item.featured {
        grid-column: span 2;
        grid-row: span 2;
      }
      .gallery-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s;
      }
      .gallery-item:hover img {
        transform: scale(1.05);
      }
      .gallery-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
        color: white;
        padding: 2rem 1rem 1rem;
        transform: translateY(100%);
        transition: transform 0.3s;
      }
      .gallery-item:hover .gallery-overlay {
        transform: translateY(0);
      }
      .gallery-overlay h4 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
      }
      .gallery-overlay p {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.9;
      }
      
      /* Lightbox */
      .lightbox {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.95);
        z-index: 1000;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }
      .lightbox.active {
        display: flex;
      }
      .lightbox-close {
        position: absolute;
        top: 1rem;
        right: 1.5rem;
        color: white;
        font-size: 2.5rem;
        cursor: pointer;
      }
      #lightbox-img {
        max-width: 90%;
        max-height: 80vh;
        border-radius: 8px;
      }
      #lightbox-caption {
        color: white;
        text-align: center;
        padding: 1rem;
        max-width: 600px;
      }
      
      @media (max-width: 768px) {
        .gallery-item.featured {
          grid-column: span 1;
          grid-row: span 1;
        }
        .ba-images {
          grid-template-columns: 1fr;
        }
      }
    </style>
    
    <script>
      function openLightbox(img) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        
        lightboxImg.src = img.src;
        caption.textContent = img.alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      
      function closeLightbox() {
        document.getElementById('lightbox').classList.remove('active');
        document.body.style.overflow = '';
      }
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
      });
    </script>
  `;
  
  return c.html(layout('Gallery', content, 'gallery'));
};

export const galleryCategoryPage = async (c: Context) => {
  const slug = c.req.param('slug') as PortfolioCategory;
  const category = categories.find(cat => cat.slug === slug);
  
  if (!category) {
    return c.html(layout('Category Not Found', `
      <section class="container" style="text-align: center; padding: 4rem;">
        <h1 style="color: var(--accent);">Category Not Found</h1>
        <p style="color: #888; margin: 1rem 0;">The category you're looking for doesn't exist.</p>
        <a href="/gallery" class="btn btn-secondary">← Back to Gallery</a>
      </section>
    `), 404);
  }
  
  const images = portfolioManifest.filter(img => img.category === slug);
  
  const content = `
    <section style="padding: 4rem 2rem; text-align: center; background: linear-gradient(180deg, rgba(139, 69, 19, 0.3) 0%, transparent 100%);">
      <a href="/gallery" style="color: var(--secondary); text-decoration: none; display: inline-block; margin-bottom: 1rem;">
        ← Back to Gallery
      </a>
      <div style="font-size: 4rem; margin-bottom: 1rem;">${category.icon}</div>
      <h1 class="section-title" style="font-size: 3rem;">${category.name}</h1>
      <p class="section-subtitle" style="font-size: 1.25rem;">${category.description}</p>
    </section>
    
    <section class="container">
      ${images.length > 0 ? `
        <div class="gallery-grid">
          ${images.map(img => `
            <div class="gallery-item ${img.featured ? 'featured' : ''}" data-type="${img.type}">
              <img 
                src="/api/images/portfolio/${img.category}/${img.filename}" 
                alt="${img.title}"
                loading="lazy"
                onclick="openLightbox(this)"
              >
              <div class="gallery-overlay">
                <h4>${img.title}</h4>
                <p>${img.description}</p>
                ${img.type === 'before' || img.type === 'after' ? `<span class="type-badge">${img.type}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="card" style="text-align: center; padding: 3rem;">
          <p style="color: #666;">Photos coming soon!</p>
          <p style="color: #999; font-size: 0.9rem; margin-top: 0.5rem;">We're adding more ${category.name.toLowerCase()} photos.</p>
        </div>
      `}
    </section>
    
    <!-- Related Categories -->
    <section class="container" style="margin-top: 4rem;">
      <h2 class="section-title">More Categories</h2>
      <div class="grid grid-4">
        ${categories.filter(cat => cat.slug !== slug).slice(0, 4).map(cat => `
          <a href="/gallery/${cat.slug}" class="card" style="text-decoration: none; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">${cat.icon}</div>
            <h4 style="color: var(--primary); margin: 0;">${cat.name}</h4>
          </a>
        `).join('')}
      </div>
    </section>
    
    <!-- CTA -->
    <section class="container" style="margin-top: 4rem; text-align: center;">
      <a href="/contact" class="btn btn-primary" style="font-size: 1.25rem;">
        Get a Quote for ${category.name} →
      </a>
    </section>
    
    <!-- Lightbox -->
    <div id="lightbox" class="lightbox" onclick="closeLightbox()">
      <span class="lightbox-close">&times;</span>
      <img id="lightbox-img" src="" alt="">
      <div id="lightbox-caption"></div>
    </div>
    
    <style>
      .gallery-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 1.5rem;
      }
      .gallery-item {
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        aspect-ratio: 4/3;
      }
      .gallery-item.featured {
        grid-column: span 2;
      }
      .gallery-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        transition: transform 0.5s;
      }
      .gallery-item:hover img {
        transform: scale(1.05);
      }
      .gallery-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: linear-gradient(transparent, rgba(0,0,0,0.8));
        color: white;
        padding: 2rem 1rem 1rem;
        transform: translateY(100%);
        transition: transform 0.3s;
      }
      .gallery-item:hover .gallery-overlay {
        transform: translateY(0);
      }
      .gallery-overlay h4 {
        margin: 0 0 0.25rem;
        font-size: 1rem;
      }
      .gallery-overlay p {
        margin: 0;
        font-size: 0.85rem;
        opacity: 0.9;
      }
      .type-badge {
        display: inline-block;
        background: var(--secondary);
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        font-size: 0.7rem;
        text-transform: uppercase;
        margin-top: 0.5rem;
      }
      .lightbox {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.95);
        z-index: 1000;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }
      .lightbox.active {
        display: flex;
      }
      .lightbox-close {
        position: absolute;
        top: 1rem;
        right: 1.5rem;
        color: white;
        font-size: 2.5rem;
        cursor: pointer;
      }
      #lightbox-img {
        max-width: 90%;
        max-height: 80vh;
        border-radius: 8px;
      }
      #lightbox-caption {
        color: white;
        text-align: center;
        padding: 1rem;
        max-width: 600px;
      }
      @media (max-width: 768px) {
        .gallery-item.featured {
          grid-column: span 1;
        }
      }
    </style>
    
    <script>
      function openLightbox(img) {
        const lightbox = document.getElementById('lightbox');
        const lightboxImg = document.getElementById('lightbox-img');
        const caption = document.getElementById('lightbox-caption');
        
        lightboxImg.src = img.src;
        caption.textContent = img.alt;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
      
      function closeLightbox() {
        document.getElementById('lightbox').classList.remove('active');
        document.body.style.overflow = '';
      }
      
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
      });
    </script>
  `;
  
  return c.html(layout(category.name, content, 'gallery'));
};

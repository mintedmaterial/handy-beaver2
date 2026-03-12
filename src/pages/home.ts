import { Context } from 'hono';
import { layout } from '../lib/html';
import { siteConfig } from '../../config/site.config';

const { business, pricing } = siteConfig;

export const homePage = (c: Context) => {
  const content = `
    <style>
      .home-hero-title { font-size: 4rem; }
      .home-hero-tagline { font-size: 1.5rem; }
      .home-pricing-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 0;
      }

      @media (max-width: 900px) {
        .home-hero-title { font-size: 2.75rem; }
      }

      @media (max-width: 600px) {
        .home-hero-title { font-size: 2.1rem; }
        .home-hero-tagline { font-size: 1.1rem; }
        .home-pricing-row {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }
      }
    </style>

    <!-- Hero Section -->
    <section style="
      padding: 6rem 2rem;
      text-align: center;
      background: linear-gradient(180deg, rgba(139, 69, 19, 0.3) 0%, transparent 100%);
    ">
      <img 
        src="/api/assets/beaver-avatar.png" 
        alt="${business.name} mascot"
        style="width: 200px; height: 200px; border-radius: 50%; border: 4px solid var(--secondary); box-shadow: 0 0 40px var(--card-glow);"
      >
      <h1 class="home-hero-title" style="
        font-family: 'Playfair Display', serif;
        color: var(--accent);
        margin: 1.5rem 0;
        text-shadow: 3px 3px 6px rgba(0,0,0,0.5);
      ">${business.name}</h1>
      <p class="home-hero-tagline" style="
        color: var(--secondary);
        max-width: 600px;
        margin: 0 auto 2rem;
      ">${business.tagline}</p>
      <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
        <a href="/contact" class="btn btn-primary" style="font-size: 1.25rem;">Get Free Quote</a>
        <a href="/visualize" class="btn btn-secondary">See Your Project Come to Life ✨</a>
      </div>
    </section>
    
    <!-- Services Preview -->
    <section class="container">
      <h2 class="section-title">What We Do</h2>
      <p class="section-subtitle">Quality craftsmanship for your home</p>
      
      <div class="grid grid-4">
        <div class="card" style="text-align: center;">
          <img src="/api/assets/icons/carpentry.png" alt="Carpentry" style="width: 80px; height: 80px; margin-bottom: 1rem;">
          <h3>Trim Carpentry</h3>
          <p style="color: #666; margin-top: 0.5rem;">Crown molding, baseboards, door frames, and custom woodwork</p>
        </div>
        <div class="card" style="text-align: center;">
          <img src="/api/assets/icons/flooring.png" alt="Flooring" style="width: 80px; height: 80px; margin-bottom: 1rem;">
          <h3>Flooring</h3>
          <p style="color: #666; margin-top: 0.5rem;">Installation, repair, and refinishing for all floor types</p>
        </div>
        <div class="card" style="text-align: center;">
          <img src="/api/assets/icons/deck.png" alt="Deck Repair" style="width: 80px; height: 80px; margin-bottom: 1rem;">
          <h3>Deck Repair</h3>
          <p style="color: #666; margin-top: 0.5rem;">Restoration, board replacement, and sealing</p>
        </div>
        <div class="card" style="text-align: center;">
          <img src="/api/assets/icons/maintenance.png" alt="Maintenance" style="width: 80px; height: 80px; margin-bottom: 1rem;">
          <h3>Maintenance</h3>
          <p style="color: #666; margin-top: 0.5rem;">General repairs and home improvement projects</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 2rem;">
        <a href="/services" class="btn btn-secondary">View All Services →</a>
      </div>
    </section>
    
    <!-- Pricing Section -->
    <section class="container" style="margin-top: 4rem;">
      <h2 class="section-title">Simple, Honest Pricing</h2>
      <p class="section-subtitle">No hidden fees. You pay for materials directly.</p>
      
      <div class="grid grid-2" style="max-width: 800px; margin: 0 auto;">
        <div class="card">
          <h3 style="color: var(--primary); font-size: 1.5rem; margin-bottom: 1rem;">Labor Rates</h3>
          <div class="home-pricing-row" style="border-bottom: 1px solid #eee;">
            <span>Half Day (≤6 hours)</span>
            <span style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">$${pricing.labor.underSixHours}</span>
          </div>
          <div class="home-pricing-row">
            <span>Full Day (6+ hours)</span>
            <span style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">$${pricing.labor.overSixHours}/day</span>
          </div>
        </div>
        
        <div class="card">
          <h3 style="color: var(--primary); font-size: 1.5rem; margin-bottom: 1rem;">Helper Rates</h3>
          <div class="home-pricing-row" style="border-bottom: 1px solid #eee;">
            <span>Half Day (≤6 hours)</span>
            <span style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">$${pricing.helper.underSixHours}</span>
          </div>
          <div class="home-pricing-row">
            <span>Full Day (6+ hours)</span>
            <span style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">$${pricing.helper.overSixHours}/day</span>
          </div>
        </div>
      </div>
      
      <p style="text-align: center; margin-top: 2rem; color: var(--accent); font-style: italic;">
        ${pricing.notes}
      </p>
    </section>
    
    <!-- AI Visualizer Teaser -->
    <section class="container" style="margin-top: 4rem;">
      <div class="card" style="background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; text-align: center; padding: 3rem;">
        <h2 style="font-family: 'Playfair Display', serif; font-size: 2rem; margin-bottom: 1rem;">
          ✨ See Your Project Before We Start
        </h2>
        <p style="max-width: 600px; margin: 0 auto 1.5rem; font-size: 1.1rem;">
          Upload a photo of your space and our AI will show you what your finished project could look like!
        </p>
        <a href="/visualize" class="btn" style="background: white; color: var(--primary);">Try AI Visualizer Free</a>
        <p style="margin-top: 1rem; font-size: 0.85rem; opacity: 0.9;">
          New visitors get 3 free visualizations • Customers get unlimited access
        </p>
      </div>
    </section>
    
    <!-- CTA Section -->
    <section class="container" style="margin-top: 4rem; text-align: center;">
      <h2 class="section-title">Ready to Get Started?</h2>
      <p class="section-subtitle">Contact us for a free consultation and quote</p>
      <a href="/contact" class="btn btn-primary" style="font-size: 1.25rem; padding: 1.25rem 3rem;">
        Request Free Quote 🦫
      </a>
    </section>
  `;
  
  return c.html(layout('Home', content, 'home'));
};

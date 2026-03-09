import { siteConfig } from '../../config/site.config';

const { theme, business } = siteConfig;

export const baseStyles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Open+Sans:wght@400;600&display=swap');
  
  :root {
    --primary: ${theme.colors.primary};
    --secondary: ${theme.colors.secondary};
    --accent: ${theme.colors.accent};
    --bg: ${theme.colors.background};
    --card: ${theme.colors.card};
    --card-glow: ${theme.colors.cardGlow};
  }
  
  body {
    font-family: 'Open Sans', sans-serif;
    background-color: #1a0f0a;
    background-image: url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="wood" patternUnits="userSpaceOnUse" width="100" height="100"><rect fill="#2C1810" width="100" height="100"/><path d="M0 20 Q 50 15, 100 20 M0 40 Q 50 35, 100 40 M0 60 Q 50 55, 100 60 M0 80 Q 50 75, 100 80" stroke="#3d2317" stroke-width="2" fill="none" opacity="0.5"/><path d="M20 0 Q 22 50, 20 100 M50 0 Q 52 50, 50 100 M80 0 Q 78 50, 80 100" stroke="#3d2317" stroke-width="1" fill="none" opacity="0.3"/></pattern></defs><rect fill="url(#wood)" width="100" height="100"/></svg>`)}');
    background-attachment: fixed;
    color: var(--card);
    min-height: 100vh;
  }
  
  /* Navigation */
  nav {
    background: rgba(44, 24, 16, 0.95);
    backdrop-filter: blur(10px);
    padding: 1rem 2rem;
    position: sticky;
    top: 0;
    z-index: 100;
    border-bottom: 2px solid var(--secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .nav-brand {
    display: flex;
    align-items: center;
    gap: 1rem;
    text-decoration: none;
    color: var(--accent);
  }
  
  .nav-brand img {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid var(--secondary);
  }
  
  .nav-brand span {
    font-family: 'Playfair Display', serif;
    font-size: 1.5rem;
    font-weight: 700;
  }
  
  .nav-links {
    display: flex;
    gap: 2rem;
    list-style: none;
  }
  
  .nav-links a {
    color: var(--accent);
    text-decoration: none;
    font-weight: 600;
    transition: color 0.3s;
  }
  
  .nav-links a:hover {
    color: var(--secondary);
  }
  
  /* Cards with white glow */
  .card {
    background: var(--card);
    color: var(--bg);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 
      0 0 20px var(--card-glow),
      0 0 40px var(--card-glow),
      0 10px 40px rgba(0,0,0,0.3);
    transition: transform 0.3s, box-shadow 0.3s;
  }
  
  .card:hover {
    transform: translateY(-5px);
    box-shadow: 
      0 0 30px var(--card-glow),
      0 0 60px var(--card-glow),
      0 15px 50px rgba(0,0,0,0.4);
  }
  
  /* Buttons */
  .btn {
    display: inline-block;
    padding: 1rem 2rem;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-size: 1rem;
    transition: all 0.3s;
  }
  
  .btn-primary {
    background: linear-gradient(135deg, var(--primary), var(--secondary));
    color: var(--card);
  }
  
  .btn-primary:hover {
    transform: scale(1.05);
    box-shadow: 0 5px 20px rgba(139, 69, 19, 0.5);
  }
  
  .btn-secondary {
    background: transparent;
    color: var(--accent);
    border: 2px solid var(--accent);
  }
  
  .btn-secondary:hover {
    background: var(--accent);
    color: var(--bg);
  }
  
  /* Container */
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  /* Grid */
  .grid {
    display: grid;
    gap: 2rem;
  }
  
  .grid-2 { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
  .grid-3 { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
  .grid-4 { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
  
  /* Section headers */
  .section-title {
    font-family: 'Playfair Display', serif;
    font-size: 2.5rem;
    color: var(--accent);
    text-align: center;
    margin-bottom: 1rem;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
  }
  
  .section-subtitle {
    text-align: center;
    color: var(--secondary);
    margin-bottom: 3rem;
  }
  
  /* Promo popup */
  .promo-popup {
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, var(--primary), #6B3410);
    color: var(--card);
    padding: 1.5rem;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    max-width: 350px;
    z-index: 1000;
    animation: slideIn 0.5s ease-out;
    display: none;
  }
  
  .promo-popup.active { display: block; }
  
  .promo-popup h4 {
    font-family: 'Playfair Display', serif;
    font-size: 1.25rem;
    margin-bottom: 0.5rem;
  }
  
  .promo-popup p { font-size: 0.9rem; margin-bottom: 1rem; }
  
  .promo-popup .close {
    position: absolute;
    top: 10px;
    right: 15px;
    background: none;
    border: none;
    color: var(--card);
    font-size: 1.5rem;
    cursor: pointer;
  }
  
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  /* Footer */
  footer {
    background: rgba(44, 24, 16, 0.95);
    padding: 3rem 2rem;
    margin-top: 4rem;
    border-top: 2px solid var(--secondary);
    text-align: center;
  }
  
  footer p { color: var(--accent); }
`;

export const layout = (title: string, content: string, activeNav?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="${business.description}">
  <title>${title} | ${business.name}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <nav>
    <a href="/" class="nav-brand">
      <img src="/api/assets/beaver-avatar.png" alt="${business.name} mascot">
      <span>${business.name}</span>
    </a>
    <ul class="nav-links">
      <li><a href="/" ${activeNav === 'home' ? 'style="color: var(--secondary)"' : ''}>Home</a></li>
      <li><a href="/services" ${activeNav === 'services' ? 'style="color: var(--secondary)"' : ''}>Services</a></li>
      <li><a href="/gallery" ${activeNav === 'gallery' ? 'style="color: var(--secondary)"' : ''}>Gallery</a></li>
      <li><a href="/about" ${activeNav === 'about' ? 'style="color: var(--secondary)"' : ''}>About</a></li>
      <li><a href="/contact" ${activeNav === 'contact' ? 'style="color: var(--secondary)"' : ''}>Contact</a></li>
      <li><a href="/portal" class="btn btn-primary" style="padding: 0.5rem 1rem">Customer Portal</a></li>
    </ul>
  </nav>
  
  ${content}
  
  <!-- Promo Popup -->
  <div id="promo-popup" class="promo-popup">
    <button class="close" onclick="closePromo()">&times;</button>
    <div style="display: flex; align-items: center; gap: 0.75rem;">
      <img src="/api/assets/icons/new-badge.png" alt="New" style="width: 40px; height: 40px;">
      <h4 style="margin: 0;">New Customer Special!</h4>
    </div>
    <p><strong>FREE consultation</strong> + <strong>10% off</strong> your first job!</p>
    <a href="/contact?promo=new10" class="btn btn-secondary" style="width: 100%; text-align: center">Claim Offer</a>
  </div>
  
  <footer>
    <p>&copy; 2026 ${business.name}. Proudly serving ${business.serviceArea}.</p>
    <p style="margin-top: 0.5rem; font-size: 0.85rem; opacity: 0.8">
      📧 ${business.email} | 📍 ${business.serviceArea}
    </p>
  </footer>
  
  <script>
    // Show promo after 5 seconds for new visitors
    setTimeout(() => {
      if (!localStorage.getItem('promoShown')) {
        document.getElementById('promo-popup').classList.add('active');
        localStorage.setItem('promoShown', Date.now());
      }
    }, 5000);
    
    function closePromo() {
      document.getElementById('promo-popup').classList.remove('active');
    }
  </script>
  
  <!-- Lil Beaver Voice Agent Widget -->
  <elevenlabs-convai agent-id="agent_6401kk7jr6ngey2ancnk6nf7kpwy"></elevenlabs-convai>
  <script src="https://unpkg.com/@elevenlabs/convai-widget-embed" async type="text/javascript"></script>
</body>
</html>
`;

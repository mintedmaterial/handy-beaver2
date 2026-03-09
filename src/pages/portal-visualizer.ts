import { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { siteConfig } from '../../config/site.config';

const { business, theme } = siteConfig;

// Get usage limits based on customer status
const getUsageLimits = (status: string) => {
  switch (status) {
    case 'active':
    case 'project':
      return { daily: 10, label: '10 per project' };
    case 'lead':
    case 'prospect':
    case 'quote':
    default:
      return { daily: 3, label: '3 per day' };
  }
};

export const portalVisualizerPage = async (c: Context) => {
  const customer = c.get('customer');
  const db = c.env.DB;
  
  // Get usage limits
  const limits = getUsageLimits(customer?.status || 'lead');
  
  // Get today's usage count
  const today = new Date().toISOString().split('T')[0];
  const usage = await db.prepare(`
    SELECT COUNT(*) as count FROM visualizer_usage 
    WHERE email = ? AND DATE(used_at) = ?
  `).bind(customer?.email, today).first<{ count: number }>();
  
  const usedToday = usage?.count || 0;
  const remaining = Math.max(0, limits.daily - usedToday);
  
  const content = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Visualizer | ${business.name} Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --primary: ${theme.colors.primary};
      --secondary: ${theme.colors.secondary};
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .portal-nav {
      background: linear-gradient(135deg, var(--primary), var(--secondary));
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .portal-nav .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-family: 'Playfair Display', serif;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .portal-nav .brand img { width: 40px; height: 40px; border-radius: 50%; }
    .portal-nav .user {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .portal-layout {
      display: grid;
      grid-template-columns: 220px 1fr;
      min-height: calc(100vh - 60px);
    }
    .sidebar {
      background: white;
      border-right: 1px solid #e5e5e5;
      padding: 1.5rem 0;
    }
    .sidebar a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      color: #333;
      text-decoration: none;
      border-left: 3px solid transparent;
      transition: all 0.2s;
    }
    .sidebar a:hover { background: #f9f9f9; }
    .sidebar a.active {
      background: #fff5f0;
      border-left-color: var(--primary);
      color: var(--primary);
      font-weight: 600;
    }
    .main-content {
      padding: 2rem;
      max-width: 1000px;
    }
    .card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      margin-bottom: 1.5rem;
    }
    .btn {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      font-size: 1rem;
    }
    .btn-primary { background: var(--primary); color: white; }
    .btn-primary:disabled { background: #ccc; cursor: not-allowed; }
    .usage-badge {
      display: inline-block;
      padding: 0.5rem 1rem;
      background: ${remaining > 0 ? '#d1fae5' : '#fee2e2'};
      color: ${remaining > 0 ? '#065f46' : '#991b1b'};
      border-radius: 8px;
      font-weight: 600;
    }
    #drop-zone {
      border: 2px dashed #ccc;
      border-radius: 12px;
      padding: 3rem 2rem;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background: #fafafa;
    }
    #drop-zone:hover, #drop-zone.dragover {
      border-color: var(--primary);
      background: #fff;
    }
    #preview-container { display: none; margin-top: 1rem; text-align: center; }
    #photo-preview { max-width: 100%; max-height: 300px; border-radius: 8px; }
    textarea {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
      resize: vertical;
      font-family: inherit;
    }
    textarea:focus { outline: none; border-color: var(--primary); }
    .result-image {
      width: 100%;
      border-radius: 8px;
      margin-top: 1rem;
    }
    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 2rem;
      color: #666;
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid #e5e5e5;
      border-top-color: var(--primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    @media (max-width: 768px) {
      .portal-layout { grid-template-columns: 1fr; }
      .sidebar { display: flex; overflow-x: auto; padding: 0.5rem; border-right: none; border-bottom: 1px solid #e5e5e5; }
      .sidebar a { padding: 0.5rem 1rem; border-left: none; border-bottom: 2px solid transparent; white-space: nowrap; }
      .sidebar a.active { border-bottom-color: var(--primary); }
    }
  </style>
</head>
<body>
  <nav class="portal-nav">
    <div class="brand">
      <img src="/api/assets/beaver-avatar.png" alt="Beaver">
      <span>My Account</span>
    </div>
    <div class="user">
      <span>👋 ${customer?.name || 'Customer'}</span>
      <a href="/portal/logout" style="color: rgba(255,255,255,0.8);">Logout</a>
    </div>
  </nav>
  
  <div class="portal-layout">
    <aside class="sidebar">
      <a href="/portal">🏠 Dashboard</a>
      <a href="/portal/quotes">💰 My Quotes</a>
      <a href="/portal/invoices">📄 Invoices</a>
      <a href="/portal/jobs">🛠️ Job History</a>
      <a href="/portal/messages">💬 Messages</a>
      <a href="/portal/visualizer" class="active">✨ AI Visualizer</a>
    </aside>
    
    <main class="main-content">
      <h1 style="margin-bottom: 0.5rem; color: var(--primary);">✨ AI Project Visualizer</h1>
      <p style="color: #666; margin-bottom: 1.5rem;">See your finished project before we start</p>
      
      <div class="card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="color: var(--primary); margin: 0;">Generate Visualization</h2>
          <span class="usage-badge">
            ${remaining > 0 ? `${remaining} of ${limits.daily} remaining today` : 'Daily limit reached'}
          </span>
        </div>
        
        <form id="visualize-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">📸 Upload Your Photo</label>
            <div id="drop-zone">
              <div style="font-size: 3rem; margin-bottom: 0.5rem;">📷</div>
              <p style="color: #666; margin-bottom: 0.5rem;">Drag & drop your photo here</p>
              <p style="color: #999; font-size: 0.85rem;">or click to browse</p>
              <input type="file" id="photo-input" accept="image/*" style="display: none;">
            </div>
            <div id="preview-container">
              <img id="photo-preview">
              <button type="button" id="clear-photo" style="margin-top: 0.5rem; color: #999; background: none; border: none; cursor: pointer;">
                ✕ Remove photo
              </button>
            </div>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">🎨 Describe Your Vision</label>
            <textarea 
              id="prompt-input"
              rows="3"
              placeholder="Example: Show this deck with dark walnut stain and new white railings..."
            ></textarea>
            <p style="color: #888; font-size: 0.85rem; margin-top: 0.5rem;">
              💡 Tip: Be specific about colors, materials, and finishes you want to see
            </p>
          </div>
          
          <button 
            type="submit" 
            id="visualize-btn"
            class="btn btn-primary" 
            style="width: 100%;"
            ${remaining <= 0 ? 'disabled' : ''}
          >
            ${remaining > 0 ? '✨ Generate Visualization' : '⚠️ Daily Limit Reached'}
          </button>
        </form>
        
        <div id="result-container" style="display: none; margin-top: 2rem;">
          <h3 style="color: var(--primary); margin-bottom: 1rem;">Your Visualization</h3>
          <div id="result-content">
            <div class="loading">
              <div class="spinner"></div>
              <span>Generating your visualization...</span>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h2 style="color: var(--primary); margin-bottom: 1rem;">💡 Tips for Best Results</h2>
        <ul style="padding-left: 1.5rem; color: #555; line-height: 1.8;">
          <li><strong>Good lighting:</strong> Take photos in daylight for clearest results</li>
          <li><strong>Full view:</strong> Include the whole area you want to transform</li>
          <li><strong>Be specific:</strong> Mention exact colors, wood types, or finishes</li>
          <li><strong>Examples:</strong> "Dark walnut semi-transparent stain", "White semi-gloss trim"</li>
        </ul>
      </div>
    </main>
  </div>

  <script>
    const dropZone = document.getElementById('drop-zone');
    const photoInput = document.getElementById('photo-input');
    const previewContainer = document.getElementById('preview-container');
    const photoPreview = document.getElementById('photo-preview');
    const clearPhoto = document.getElementById('clear-photo');
    const form = document.getElementById('visualize-form');
    const submitBtn = document.getElementById('visualize-btn');
    const resultContainer = document.getElementById('result-container');
    const resultContent = document.getElementById('result-content');
    
    let imageBase64 = null;
    
    // Drag and drop
    dropZone.addEventListener('click', () => photoInput.click());
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    
    photoInput.addEventListener('change', (e) => {
      if (e.target.files.length) handleFile(e.target.files[0]);
    });
    
    clearPhoto.addEventListener('click', () => {
      photoInput.value = '';
      imageBase64 = null;
      previewContainer.style.display = 'none';
      dropZone.style.display = 'block';
    });
    
    function handleFile(file) {
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        imageBase64 = e.target.result;
        photoPreview.src = imageBase64;
        previewContainer.style.display = 'block';
        dropZone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
    
    // Form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const prompt = document.getElementById('prompt-input').value.trim();
      if (!imageBase64 || !prompt) {
        alert('Please upload a photo and describe your vision');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Generating...';
      resultContainer.style.display = 'block';
      resultContent.innerHTML = '<div class="loading"><div class="spinner"></div><span>Generating your visualization...</span></div>';
      
      try {
        const response = await fetch('/api/visualize/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, image: imageBase64 })
        });
        
        const data = await response.json();
        
        if (data.success && data.imageUrl) {
          resultContent.innerHTML = \`
            <img src="\${data.imageUrl}" class="result-image" alt="Generated visualization">
            <div style="margin-top: 1rem; display: flex; gap: 1rem;">
              <a href="\${data.imageUrl}" download="visualization.png" class="btn btn-primary" style="flex: 1; text-align: center; text-decoration: none;">
                📥 Download
              </a>
              <button type="button" onclick="location.reload()" class="btn btn-secondary" style="flex: 1;">
                🔄 New Visualization
              </button>
            </div>
            <p style="text-align: center; color: #888; font-size: 0.85rem; margin-top: 1rem;">
              Like what you see? <a href="/contact" style="color: var(--primary);">Get a free quote</a> to make it real!
            </p>
          \`;
        } else {
          resultContent.innerHTML = \`
            <div style="text-align: center; padding: 2rem; color: #991b1b;">
              <p>⚠️ \${data.error || 'Failed to generate visualization'}</p>
              <button type="button" onclick="location.reload()" class="btn btn-secondary" style="margin-top: 1rem;">
                Try Again
              </button>
            </div>
          \`;
        }
      } catch (err) {
        resultContent.innerHTML = \`
          <div style="text-align: center; padding: 2rem; color: #991b1b;">
            <p>⚠️ Network error. Please try again.</p>
            <button type="button" onclick="location.reload()" class="btn btn-secondary" style="margin-top: 1rem;">
              Try Again
            </button>
          </div>
        \`;
      }
      
      submitBtn.disabled = false;
      submitBtn.textContent = '✨ Generate Visualization';
    });
  </script>
</body>
</html>
  `;
  
  return c.html(content);
};

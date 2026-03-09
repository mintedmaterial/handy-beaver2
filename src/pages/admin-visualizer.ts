import { Context } from 'hono';
import { Admin } from '../lib/auth';
import { siteConfig } from '../../config/site.config';

// Import admin layout helper
const adminLayout = (title: string, content: string, activePage: string, admin?: Admin) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | Admin - ${siteConfig.business.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .admin-nav {
      background: #2C1810;
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .admin-nav .brand {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      font-size: 1.25rem;
      font-weight: 600;
    }
    .admin-nav .brand img { width: 40px; height: 40px; border-radius: 50%; }
    .admin-layout {
      display: grid;
      grid-template-columns: 250px 1fr;
      min-height: calc(100vh - 60px);
    }
    .sidebar {
      background: white;
      border-right: 1px solid #e5e5e5;
      padding: 1rem 0;
    }
    .sidebar a {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
      color: #333;
      text-decoration: none;
      border-left: 3px solid transparent;
    }
    .sidebar a:hover { background: #f9f9f9; }
    .sidebar a.active {
      background: #fff5f0;
      border-left-color: #8B4513;
      color: #8B4513;
      font-weight: 600;
    }
    .sidebar .divider {
      height: 1px;
      background: #e5e5e5;
      margin: 1rem 0;
    }
    .main-content {
      padding: 2rem;
      overflow-y: auto;
    }
    .card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      margin-bottom: 1.5rem;
    }
    .btn {
      display: inline-block;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;
      border: none;
    }
    .btn-primary { background: #8B4513; color: white; }
    .btn-secondary { background: #e5e7eb; color: #374151; }
    .grid { display: grid; gap: 1.5rem; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .grid-3 { grid-template-columns: repeat(3, 1fr); }
    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .stat-value { font-size: 2rem; font-weight: bold; color: #8B4513; }
    .stat-label { color: #666; font-size: 0.9rem; }
    :root { --primary: #8B4513; --secondary: #D2691E; }
  </style>
</head>
<body>
  <nav class="admin-nav">
    <div class="brand">
      <img src="/api/assets/beaver-avatar.png" alt="Beaver">
      <span>${siteConfig.business.name} Admin</span>
    </div>
    <div style="display: flex; align-items: center; gap: 1rem;">
      <span>${admin?.name || admin?.github_username || 'Admin'}</span>
      <a href="/api/auth/logout" style="color: #ccc;">Logout</a>
    </div>
  </nav>
  
  <div class="admin-layout">
    <aside class="sidebar">
      <a href="/admin" class="${activePage === 'dashboard' ? 'active' : ''}">📊 Dashboard</a>
      <a href="/admin/quotes" class="${activePage === 'quotes' ? 'active' : ''}">💰 Quotes</a>
      <a href="/admin/jobs" class="${activePage === 'jobs' ? 'active' : ''}">🛠️ Jobs</a>
      <a href="/admin/customers" class="${activePage === 'customers' ? 'active' : ''}">👥 Customers</a>
      <a href="/admin/messages" class="${activePage === 'messages' ? 'active' : ''}">💬 Messages</a>
      <div class="divider"></div>
      <a href="/admin/visualizer" class="${activePage === 'visualizer' ? 'active' : ''}">✨ AI Visualizer</a>
      <a href="/admin/invoices" class="${activePage === 'invoices' ? 'active' : ''}">📄 Invoices</a>
      <a href="/admin/gallery" class="${activePage === 'gallery' ? 'active' : ''}">🖼️ Gallery</a>
      <div class="divider"></div>
      <a href="/admin/settings" class="${activePage === 'settings' ? 'active' : ''}">⚙️ Settings</a>
      <a href="/" target="_blank">🌐 View Site</a>
    </aside>
    
    <main class="main-content">
      ${content}
    </main>
  </div>
</body>
</html>
`;

export const adminVisualizerPage = async (c: Context) => {
  const admin = c.get('admin') as Admin;
  // Get recent usage stats
  const stats = await c.env.DB.prepare(`
    SELECT 
      COUNT(*) as total_uses,
      COUNT(DISTINCT customer_id) as unique_users,
      COUNT(CASE WHEN created_at >= unixepoch() - 86400 THEN 1 END) as uses_today
    FROM visualizer_usage
  `).first<{ total_uses: number; unique_users: number; uses_today: number }>();
  
  const recentHistory = await c.env.DB.prepare(`
    SELECT vu.*, c.name, c.email
    FROM visualizer_usage vu
    LEFT JOIN customers c ON vu.customer_id = c.id
    ORDER BY vu.created_at DESC
    LIMIT 10
  `).all();
  
  const content = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
      <h1 style="color: var(--primary); font-family: 'Playfair Display', serif;">
        ✨ AI Visualizer (Admin)
      </h1>
      <span style="background: var(--primary); color: white; padding: 0.5rem 1rem; border-radius: 20px; font-size: 0.9rem;">
        👑 Unlimited Access
      </span>
    </div>
    
    <!-- Stats -->
    <div class="grid grid-3" style="margin-bottom: 2rem;">
      <div class="stat-card">
        <div class="stat-value">${stats?.total_uses || 0}</div>
        <div class="stat-label">Total Visualizations</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats?.unique_users || 0}</div>
        <div class="stat-label">Unique Users</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${stats?.uses_today || 0}</div>
        <div class="stat-label">Today</div>
      </div>
    </div>
    
    <div class="grid grid-2" style="gap: 2rem;">
      <!-- Visualizer Form -->
      <div class="card">
        <h2 style="color: var(--primary); margin-bottom: 1.5rem;">Generate Visualization</h2>
        
        <form id="visualize-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
              📸 Upload Photo
            </label>
            <div 
              id="drop-zone"
              style="
                border: 2px dashed #ccc; 
                border-radius: 12px; 
                padding: 2rem; 
                text-align: center;
                cursor: pointer;
                transition: all 0.3s;
                background: #fafafa;
              "
            >
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">📷</div>
              <p style="color: #666;">Click or drag to upload</p>
              <input type="file" id="photo-input" accept="image/*" style="display: none;">
            </div>
            <div id="preview-container" style="display: none; margin-top: 1rem; text-align: center;">
              <img id="photo-preview" style="max-width: 100%; max-height: 200px; border-radius: 8px;">
              <button type="button" id="clear-photo" style="margin-top: 0.5rem; color: #999; background: none; border: none; cursor: pointer;">
                ✕ Clear
              </button>
            </div>
          </div>
          
          <div>
            <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">
              🎨 Describe Changes
            </label>
            <textarea 
              id="prompt-input"
              rows="3"
              placeholder="Example: Show this deck with dark walnut stain and new railings..."
              style="width: 100%; padding: 0.75rem; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem;"
            ></textarea>
          </div>
          
          <button type="submit" id="visualize-btn" class="btn btn-primary" style="width: 100%;">
            ✨ Generate
          </button>
        </form>
        
        <div id="result-container" style="display: none; margin-top: 2rem;">
          <h3 style="color: var(--primary);">Result</h3>
          <div id="result-image" style="margin-top: 1rem;"></div>
          <button type="button" id="download-btn" class="btn btn-secondary" style="margin-top: 1rem; width: 100%;">
            📥 Download
          </button>
        </div>
      </div>
      
      <!-- Recent History -->
      <div class="card">
        <h2 style="color: var(--primary); margin-bottom: 1.5rem;">Recent Activity</h2>
        
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 2px solid #eee;">
                <th style="text-align: left; padding: 0.75rem;">Customer</th>
                <th style="text-align: left; padding: 0.75rem;">Prompt</th>
                <th style="text-align: left; padding: 0.75rem;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${recentHistory.results?.map((row: any) => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="padding: 0.75rem;">
                    ${row.customer_id === 0 ? '👑 Admin' : row.name || row.email || 'Unknown'}
                  </td>
                  <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${row.prompt}
                  </td>
                  <td style="padding: 0.75rem; color: #666; font-size: 0.9rem;">
                    ${new Date(row.created_at * 1000).toLocaleDateString()}
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="3" style="padding: 1rem; color: #999;">No activity yet</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    
    <script>
      let selectedFile = null;
      let resultImageUrl = null;
      
      const dropZone = document.getElementById('drop-zone');
      const photoInput = document.getElementById('photo-input');
      const previewContainer = document.getElementById('preview-container');
      const photoPreview = document.getElementById('photo-preview');
      const clearPhoto = document.getElementById('clear-photo');
      const visualizeBtn = document.getElementById('visualize-btn');
      const resultContainer = document.getElementById('result-container');
      const resultImage = document.getElementById('result-image');
      
      // File handling
      dropZone.addEventListener('click', () => photoInput.click());
      dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--primary)'; });
      dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#ccc'; });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
      });
      
      photoInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
      });
      
      clearPhoto.addEventListener('click', () => {
        photoInput.value = '';
        selectedFile = null;
        previewContainer.style.display = 'none';
        dropZone.style.display = 'block';
      });
      
      function handleFile(file) {
        if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
          alert('Invalid file (must be image under 10MB)');
          return;
        }
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
          photoPreview.src = e.target.result;
          previewContainer.style.display = 'block';
          dropZone.style.display = 'none';
        };
        reader.readAsDataURL(file);
      }
      
      // Form submission
      document.getElementById('visualize-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const prompt = document.getElementById('prompt-input').value.trim();
        if (!selectedFile || !prompt) {
          alert('Please upload a photo and describe your vision');
          return;
        }
        
        visualizeBtn.disabled = true;
        visualizeBtn.textContent = '⏳ Generating...';
        
        try {
          const formData = new FormData();
          formData.append('image', selectedFile);
          formData.append('prompt', prompt);
          
          const res = await fetch('/api/visualize/generate', { method: 'POST', body: formData });
          const result = await res.json();
          
          if (!result.success) throw new Error(result.error);
          
          resultContainer.style.display = 'block';
          resultImageUrl = result.resultUrl;
          
          if (result.demo) {
            resultImage.innerHTML = '<p style="color: #666;">Demo mode - no GEMINI_API_KEY set</p>';
          } else {
            resultImage.innerHTML = '<img src="' + result.resultUrl + '" style="max-width: 100%; border-radius: 8px;">';
          }
        } catch (error) {
          alert('Error: ' + error.message);
        } finally {
          visualizeBtn.disabled = false;
          visualizeBtn.textContent = '✨ Generate';
        }
      });
      
      document.getElementById('download-btn').addEventListener('click', async () => {
        if (!resultImageUrl) return;
        const res = await fetch(resultImageUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'visualization.jpg';
        a.click();
      });
    </script>
  `;
  
  return c.html(adminLayout('AI Visualizer', content, 'visualizer', admin));
};

import { Context } from 'hono';
import { layout } from '../lib/html';

export async function adminGalleryPage(c: Context) {
  // Get existing categories and images
  const categories = await c.env.DB.prepare(`
    SELECT pc.*, COUNT(pi.id) as image_count
    FROM portfolio_categories pc
    LEFT JOIN portfolio_images pi ON pc.id = pi.category_id
    GROUP BY pc.id
    ORDER BY pc.display_order
  `).all<any>();
  
  const recentImages = await c.env.DB.prepare(`
    SELECT pi.*, pc.name as category_name
    FROM portfolio_images pi
    LEFT JOIN portfolio_categories pc ON pi.category_id = pc.id
    ORDER BY pi.created_at DESC
    LIMIT 20
  `).all<any>();
  
  const content = `
    <main class="container" style="padding: 40px 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
        <h1>Gallery Management</h1>
        <a href="/admin" class="btn btn-secondary">← Back to Admin</a>
      </div>
      
      <!-- Upload Section -->
      <div class="card" style="margin-bottom: 30px;">
        <h2 style="margin-bottom: 20px;">Upload Media</h2>
        
        <form id="upload-form" enctype="multipart/form-data">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
            <div>
              <label for="category" style="display: block; margin-bottom: 8px; font-weight: 600;">Category</label>
              <select id="category" name="category" required style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                <option value="">Select category...</option>
                ${categories.results.map((cat: any) => `
                  <option value="${cat.id}">${cat.name}</option>
                `).join('')}
              </select>
            </div>
            
            <div>
              <label for="media-type" style="display: block; margin-bottom: 8px; font-weight: 600;">Media Type</label>
              <select id="media-type" name="media_type" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
                <option value="image">Image</option>
                <option value="video">Video</option>
              </select>
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label for="title" style="display: block; margin-bottom: 8px; font-weight: 600;">Title</label>
            <input type="text" id="title" name="title" required 
                   style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd;"
                   placeholder="e.g., Kitchen flooring - completed">
          </div>
          
          <div style="margin-bottom: 20px;">
            <label for="description" style="display: block; margin-bottom: 8px; font-weight: 600;">Description (optional)</label>
            <textarea id="description" name="description" rows="2"
                      style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #ddd;"
                      placeholder="Brief description of the work..."></textarea>
          </div>
          
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 600;">Upload File</label>
            <div id="drop-zone" style="border: 2px dashed #8B4513; border-radius: 12px; padding: 40px; text-align: center; cursor: pointer; transition: all 0.3s;">
              <input type="file" id="file-input" name="file" accept="image/*,video/*" style="display: none;">
              <div style="font-size: 48px; margin-bottom: 10px;">📁</div>
              <p style="color: #666;">Drag & drop or click to select</p>
              <p style="color: #999; font-size: 0.9em;">Images: JPG, PNG, WebP | Videos: MP4, MOV</p>
            </div>
            <div id="file-preview" style="margin-top: 15px; display: none;"></div>
          </div>
          
          <div style="display: flex; gap: 15px; align-items: center;">
            <label style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" name="is_before_after" id="is-before-after">
              Before/After pair
            </label>
            
            <div id="ba-fields" style="display: none; flex: 1;">
              <select name="ba_type" style="padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
                <option value="before">This is the BEFORE</option>
                <option value="after">This is the AFTER</option>
              </select>
            </div>
          </div>
          
          <button type="submit" class="btn" style="margin-top: 20px; width: 100%;">
            Upload
          </button>
        </form>
        
        <div id="upload-status" style="margin-top: 15px;"></div>
      </div>
      
      <!-- Categories Section -->
      <div class="card" style="margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>Categories</h2>
          <button onclick="showAddCategory()" class="btn btn-secondary">+ Add Category</button>
        </div>
        
        <div id="add-category-form" style="display: none; margin-bottom: 20px; padding: 20px; background: #f9f9f9; border-radius: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 15px; align-items: end;">
            <div>
              <label style="display: block; margin-bottom: 5px;">Name</label>
              <input type="text" id="new-cat-name" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 5px;">Icon (emoji)</label>
              <input type="text" id="new-cat-icon" style="width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #ddd;" placeholder="🔨">
            </div>
            <button onclick="addCategory()" class="btn">Add</button>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #eee;">
              <th style="padding: 12px; text-align: left;">Icon</th>
              <th style="padding: 12px; text-align: left;">Name</th>
              <th style="padding: 12px; text-align: left;">Images</th>
              <th style="padding: 12px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${categories.results.map((cat: any) => `
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px; font-size: 24px;">${cat.icon || '📁'}</td>
                <td style="padding: 12px;">${cat.name}</td>
                <td style="padding: 12px;">${cat.image_count} items</td>
                <td style="padding: 12px; text-align: right;">
                  <a href="/gallery/${cat.slug}" target="_blank" style="margin-right: 10px;">View</a>
                  <button onclick="deleteCategory(${cat.id})" style="color: red; background: none; border: none; cursor: pointer;">Delete</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <!-- Recent Uploads -->
      <div class="card">
        <h2 style="margin-bottom: 20px;">Recent Uploads</h2>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 20px;">
          ${recentImages.results.map((img: any) => `
            <div style="position: relative; border-radius: 12px; overflow: hidden; background: #f5f5f5;">
              ${img.media_type === 'video' ? `
                <video src="${img.url}" style="width: 100%; height: 150px; object-fit: cover;" muted></video>
                <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">🎬 Video</div>
              ` : `
                <img src="${img.url}" alt="${img.title}" style="width: 100%; height: 150px; object-fit: cover;">
              `}
              <div style="padding: 10px;">
                <p style="font-weight: 600; margin-bottom: 5px;">${img.title}</p>
                <p style="font-size: 12px; color: #666;">${img.category_name || 'Uncategorized'}</p>
                <button onclick="deleteImage(${img.id})" style="margin-top: 8px; color: red; background: none; border: none; cursor: pointer; font-size: 12px;">🗑️ Delete</button>
              </div>
            </div>
          `).join('') || '<p style="color: #666;">No images uploaded yet.</p>'}
        </div>
      </div>
    </main>
    
    <script>
      // File upload handling
      const dropZone = document.getElementById('drop-zone');
      const fileInput = document.getElementById('file-input');
      const preview = document.getElementById('file-preview');
      
      dropZone.addEventListener('click', () => fileInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#D2691E';
        dropZone.style.background = 'rgba(139, 69, 19, 0.05)';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#8B4513';
        dropZone.style.background = 'transparent';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileInput.files = e.dataTransfer.files;
        showPreview(e.dataTransfer.files[0]);
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) showPreview(fileInput.files[0]);
      });
      
      function showPreview(file) {
        preview.style.display = 'block';
        if (file.type.startsWith('video/')) {
          preview.innerHTML = '<video src="' + URL.createObjectURL(file) + '" style="max-width: 300px; border-radius: 8px;" controls></video>';
        } else {
          preview.innerHTML = '<img src="' + URL.createObjectURL(file) + '" style="max-width: 300px; border-radius: 8px;">';
        }
      }
      
      // Before/After toggle
      document.getElementById('is-before-after').addEventListener('change', (e) => {
        document.getElementById('ba-fields').style.display = e.target.checked ? 'block' : 'none';
      });
      
      // Upload form
      document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const status = document.getElementById('upload-status');
        status.innerHTML = '<p style="color: #666;">Uploading...</p>';
        
        const formData = new FormData(e.target);
        
        try {
          const res = await fetch('/api/portfolio/upload', {
            method: 'POST',
            body: formData
          });
          
          const data = await res.json();
          
          if (data.success) {
            status.innerHTML = '<p style="color: green;">✅ Uploaded successfully!</p>';
            setTimeout(() => location.reload(), 1000);
          } else {
            status.innerHTML = '<p style="color: red;">❌ ' + (data.error || 'Upload failed') + '</p>';
          }
        } catch (err) {
          status.innerHTML = '<p style="color: red;">❌ Upload failed</p>';
        }
      });
      
      // Category functions
      function showAddCategory() {
        document.getElementById('add-category-form').style.display = 'block';
      }
      
      async function addCategory() {
        const name = document.getElementById('new-cat-name').value;
        const icon = document.getElementById('new-cat-icon').value;
        
        const res = await fetch('/api/portfolio/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, icon })
        });
        
        if (res.ok) location.reload();
      }
      
      async function deleteCategory(id) {
        if (!confirm('Delete this category? Images will be uncategorized.')) return;
        await fetch('/api/portfolio/categories/' + id, { method: 'DELETE' });
        location.reload();
      }
      
      async function deleteImage(id) {
        if (!confirm('Delete this image?')) return;
        await fetch('/api/portfolio/images/' + id, { method: 'DELETE' });
        location.reload();
      }
    </script>
  `;
  
  return c.html(layout('Gallery Management - Admin', content));
}

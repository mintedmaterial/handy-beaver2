import { Context } from 'hono';
import { layout } from '../lib/html';

export const visualizePage = (c: Context) => {
  const content = `
    <section style="padding: 4rem 2rem; text-align: center; background: linear-gradient(180deg, rgba(139, 69, 19, 0.3) 0%, transparent 100%);">
      <h1 class="section-title" style="font-size: 3rem;">✨ AI Project Visualizer</h1>
      <p class="section-subtitle" style="font-size: 1.25rem;">See your finished project before we start</p>
    </section>
    
    <section class="container">
      <div class="grid grid-2" style="align-items: start;">
        <div class="card">
          <h2 style="color: var(--primary); font-family: 'Playfair Display', serif; margin-bottom: 1rem;">
            How It Works
          </h2>
          <ol style="padding-left: 1.25rem; color: #444; line-height: 2;">
            <li>Upload a photo of your current space</li>
            <li>Tell us what changes you're thinking about</li>
            <li>Our AI generates a visualization of the finished result</li>
            <li>Use it to refine your vision before we start work</li>
          </ol>
          
          <div style="margin-top: 2rem; padding: 1rem; background: #f9f9f9; border-radius: 8px;">
            <h4 style="color: var(--primary); margin-bottom: 0.5rem;">💡 Best For:</h4>
            <ul style="padding-left: 1.25rem; color: #666; font-size: 0.95rem;">
              <li>Deck staining color options</li>
              <li>Trim and molding additions</li>
              <li>Flooring material changes</li>
              <li>Paint color visualization</li>
              <li>Before/after comparisons</li>
            </ul>
          </div>
        </div>
        
        <div class="card">
          <div id="visualizer-app">
            <!-- Auth gate - shown when not logged in -->
            <div id="auth-gate" style="display: none; text-align: center; padding: 2rem;">
              <div style="font-size: 4rem; margin-bottom: 1rem;">🔐</div>
              <h3 style="color: var(--primary);">Sign In Required</h3>
              <p style="color: #666; margin: 1rem 0;">
                To use the AI Visualizer, please sign in to your customer portal or request a free quote.
              </p>
              <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
                <a href="/portal/login" class="btn btn-primary">Sign In →</a>
                <a href="/contact" class="btn btn-secondary">Get Free Quote</a>
              </div>
            </div>
            
            <!-- Main visualizer form -->
            <div id="visualizer-form-container">
              <form id="visualize-form" style="display: flex; flex-direction: column; gap: 1.5rem;">
                <div>
                  <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--primary);">
                    📸 Upload Your Photo
                  </label>
                  <div 
                    id="drop-zone"
                    style="
                      border: 2px dashed #ccc; 
                      border-radius: 12px; 
                      padding: 3rem 2rem; 
                      text-align: center;
                      cursor: pointer;
                      transition: all 0.3s;
                      background: #fafafa;
                    "
                  >
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">📷</div>
                    <p style="color: #666; margin-bottom: 0.5rem;">Drag & drop your photo here</p>
                    <p style="color: #999; font-size: 0.85rem;">or click to browse (max 10MB)</p>
                    <input type="file" id="photo-input" accept="image/*" style="display: none;">
                  </div>
                  <div id="preview-container" style="display: none; margin-top: 1rem; text-align: center;">
                    <img id="photo-preview" style="max-width: 100%; max-height: 300px; border-radius: 8px;">
                    <button type="button" id="clear-photo" style="margin-top: 0.5rem; color: #999; background: none; border: none; cursor: pointer;">
                      ✕ Remove photo
                    </button>
                  </div>
                </div>
                
                <div>
                  <label style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--primary);">
                    🎨 Describe Your Vision
                  </label>
                  <textarea 
                    id="prompt-input"
                    rows="3"
                    placeholder="Example: Show this deck with dark walnut stain and new white railings..."
                    style="width: 100%; padding: 0.75rem; border: 2px solid #ddd; border-radius: 8px; font-size: 1rem; resize: vertical;"
                  ></textarea>
                </div>
                
                <div id="usage-info" style="padding: 1rem; background: var(--secondary); color: white; border-radius: 8px; text-align: center;">
                  <span id="usage-text">Loading...</span>
                </div>
                
                <button 
                  type="submit" 
                  id="visualize-btn"
                  class="btn btn-primary" 
                  style="width: 100%;"
                  disabled
                >
                  ✨ Generate Visualization
                </button>
              </form>
            </div>
            
            <div id="result-container" style="display: none; margin-top: 2rem;">
              <h3 style="color: var(--primary); margin-bottom: 1rem;">Your Visualization</h3>
              <div id="result-image" style="background: #f9f9f9; border-radius: 8px; min-height: 200px; display: flex; align-items: center; justify-content: center;">
                <p style="color: #999;">Generating...</p>
              </div>
              <p id="watermark-notice" style="font-size: 0.85rem; color: #999; text-align: center; margin-top: 0.5rem;">
                Images include The Handy Beaver watermark
              </p>
              <div style="margin-top: 1rem; display: flex; gap: 1rem;">
                <button type="button" id="download-btn" class="btn btn-secondary" style="flex: 1;">
                  📥 Download
                </button>
                <button type="button" id="new-btn" class="btn btn-primary" style="flex: 1;">
                  🔄 New Visualization
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <!-- Examples Section -->
    <section class="container" style="margin-top: 4rem;">
      <h2 class="section-title">Example Transformations</h2>
      <p class="section-subtitle">See what's possible with AI visualization</p>
      
      <div class="grid grid-3">
        <div class="card" style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🏡</div>
          <h3 style="color: var(--primary);">Deck Staining</h3>
          <p style="color: #666; font-size: 0.9rem;">
            "Show this weathered deck with a rich mahogany stain"
          </p>
        </div>
        <div class="card" style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🪵</div>
          <h3 style="color: var(--primary);">Crown Molding</h3>
          <p style="color: #666; font-size: 0.9rem;">
            "Add 4-inch crown molding where the wall meets the ceiling"
          </p>
        </div>
        <div class="card" style="text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🏠</div>
          <h3 style="color: var(--primary);">Flooring</h3>
          <p style="color: #666; font-size: 0.9rem;">
            "Replace carpet with light oak hardwood flooring"
          </p>
        </div>
      </div>
    </section>
    
    <!-- CTA -->
    <section class="container" style="margin-top: 4rem; text-align: center;">
      <div class="card" style="display: inline-block; padding: 2rem 3rem;">
        <h3 style="color: var(--primary); margin-bottom: 1rem;">Like What You See?</h3>
        <p style="color: #666; margin-bottom: 1.5rem;">Let's make it real! Get a free quote for your project.</p>
        <a href="/contact" class="btn btn-primary">Request Free Quote →</a>
      </div>
    </section>
    
    <script>
      // State
      let usageStatus = null;
      let selectedFile = null;
      let resultImageUrl = null;
      
      // Elements
      const authGate = document.getElementById('auth-gate');
      const formContainer = document.getElementById('visualizer-form-container');
      const dropZone = document.getElementById('drop-zone');
      const photoInput = document.getElementById('photo-input');
      const previewContainer = document.getElementById('preview-container');
      const photoPreview = document.getElementById('photo-preview');
      const clearPhoto = document.getElementById('clear-photo');
      const usageInfo = document.getElementById('usage-info');
      const usageText = document.getElementById('usage-text');
      const visualizeBtn = document.getElementById('visualize-btn');
      const resultContainer = document.getElementById('result-container');
      const resultImage = document.getElementById('result-image');
      
      // Check auth & usage status on load
      async function checkStatus() {
        try {
          const res = await fetch('/api/visualize/status');
          usageStatus = await res.json();
          
          if (!usageStatus.authorized) {
            // Show auth gate, hide form
            authGate.style.display = 'block';
            formContainer.style.display = 'none';
            return;
          }
          
          // Show form, hide auth gate
          authGate.style.display = 'none';
          formContainer.style.display = 'block';
          
          updateUsageDisplay();
        } catch (e) {
          console.error('Status check failed:', e);
          usageText.innerHTML = '⚠️ Unable to check status';
          usageInfo.style.background = '#dc3545';
        }
      }
      
      function updateUsageDisplay() {
        if (!usageStatus) return;
        
        if (usageStatus.isAdmin || usageStatus.unlimited) {
          usageInfo.style.background = 'var(--primary)';
          usageText.innerHTML = '👑 <strong>Admin Access</strong> - Unlimited visualizations';
          visualizeBtn.disabled = false;
          return;
        }
        
        const remaining = usageStatus.remaining;
        const limit = usageStatus.limit;
        
        if (remaining <= 0) {
          usageInfo.style.background = '#dc3545';
          usageText.innerHTML = '⚠️ <strong>Daily limit reached</strong> (\\${limit}/day)';
          visualizeBtn.disabled = true;
          visualizeBtn.textContent = 'Limit Reached';
        } else {
          usageInfo.style.background = 'var(--secondary)';
          usageText.innerHTML = \`🎨 <strong>\${remaining} of \${limit}</strong> visualizations remaining today\`;
          visualizeBtn.disabled = false;
        }
        
        // Show customer name if available
        if (usageStatus.name) {
          usageText.innerHTML += \`<br><span style="font-size: 0.85rem; opacity: 0.9;">Signed in as \${usageStatus.name}</span>\`;
        }
      }
      
      checkStatus();
      
      // File upload handling
      dropZone.addEventListener('click', () => photoInput.click());
      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary)';
        dropZone.style.background = '#fff';
      });
      dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#ccc';
        dropZone.style.background = '#fafafa';
      });
      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#ccc';
        if (e.dataTransfer.files.length) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
      
      photoInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
          handleFile(e.target.files[0]);
        }
      });
      
      clearPhoto.addEventListener('click', () => {
        photoInput.value = '';
        selectedFile = null;
        previewContainer.style.display = 'none';
        dropZone.style.display = 'block';
      });
      
      function handleFile(file) {
        if (!file.type.startsWith('image/')) {
          alert('Please upload an image file');
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          alert('Image too large (max 10MB)');
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
        visualizeBtn.textContent = '⏳ Generating... (may take 30-60 seconds)';
        
        try {
          const formData = new FormData();
          formData.append('image', selectedFile);
          formData.append('prompt', prompt);
          
          const res = await fetch('/api/visualize/generate', {
            method: 'POST',
            body: formData,
          });
          
          const result = await res.json();
          
          if (!result.success) {
            throw new Error(result.error || 'Generation failed');
          }
          
          // Show result
          resultContainer.style.display = 'block';
          
          if (result.demo) {
            resultImage.innerHTML = \`
              <div style="padding: 2rem; text-align: center;">
                <p style="color: var(--primary); font-weight: bold;">\${result.message}</p>
                <p style="color: #666; margin-top: 1rem;">We've logged your request. Contact us for a consultation!</p>
                <a href="/contact" class="btn btn-primary" style="margin-top: 1rem;">Get Free Quote →</a>
              </div>
            \`;
          } else {
            resultImageUrl = result.resultUrl;
            resultImage.innerHTML = \`
              <img src="\${result.resultUrl}" style="max-width: 100%; border-radius: 8px;">
            \`;
          }
          
          // Refresh usage status
          await checkStatus();
          
        } catch (error) {
          alert('Error: ' + error.message);
        } finally {
          visualizeBtn.disabled = usageStatus?.remaining <= 0;
          visualizeBtn.textContent = '✨ Generate Visualization';
        }
      });
      
      // Download button
      document.getElementById('download-btn').addEventListener('click', async () => {
        if (!resultImageUrl) return;
        
        try {
          const res = await fetch(resultImageUrl);
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'handy-beaver-visualization.jpg';
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('Download failed:', e);
        }
      });
      
      // New visualization button
      document.getElementById('new-btn').addEventListener('click', () => {
        resultContainer.style.display = 'none';
        resultImageUrl = null;
        clearPhoto.click();
        document.getElementById('prompt-input').value = '';
      });
    </script>
  `;
  
  return c.html(layout('AI Project Visualizer', content, 'visualize'));
};

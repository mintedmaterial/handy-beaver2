import { Context } from 'hono';
import { adminLayout } from './admin';
import { siteConfig } from '../../config/site.config';

export const adminQuotesPage = async (c: Context) => {
  const admin = c.get('admin');
  const db = c.env.DB;
  
  // Get quotes with customer info
  const quotes = await db.prepare(`
    SELECT q.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    FROM quotes q
    JOIN customers c ON q.customer_id = c.id
    ORDER BY q.created_at DESC
    LIMIT 50
  `).all<any>();
  
  // Get customers for dropdown
  const customers = await db.prepare(`
    SELECT id, name, email, phone FROM customers ORDER BY name
  `).all<any>();
  
  const content = `
    <div class="admin-quotes">
      <div class="page-header">
        <h1>Quotes</h1>
        <button class="btn-primary" onclick="showNewQuote()">+ New Quote</button>
      </div>
      
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">${quotes.results?.filter((q: any) => q.status === 'draft').length || 0}</span>
          <span class="stat-label">Drafts</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${quotes.results?.filter((q: any) => q.status === 'sent').length || 0}</span>
          <span class="stat-label">Sent</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${quotes.results?.filter((q: any) => q.status === 'accepted').length || 0}</span>
          <span class="stat-label">Accepted</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">$${quotes.results?.reduce((sum: number, q: any) => sum + (q.status === 'accepted' ? q.total : 0), 0).toLocaleString() || 0}</span>
          <span class="stat-label">Value Won</span>
        </div>
      </div>
      
      <div class="quotes-list card">
        <table class="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Description</th>
              <th>Total</th>
              <th>Status</th>
              <th>Valid Until</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="quotes-tbody">
            ${quotes.results?.map((q: any) => `
              <tr>
                <td>
                  <strong>${q.customer_name}</strong><br>
                  <small style="color:#666">${q.customer_email}</small>
                </td>
                <td>${q.labor_type || 'General Work'}</td>
                <td><strong>$${q.total?.toLocaleString()}</strong></td>
                <td><span class="badge badge-${q.status}">${q.status}</span></td>
                <td>${q.valid_until ? new Date(q.valid_until * 1000).toLocaleDateString() : '-'}</td>
                <td class="actions">
                  <button onclick="viewQuote(${q.id})" title="View">👁️</button>
                  <button onclick="printQuote(${q.id})" title="Print/PDF">🖨️</button>
                  ${q.status === 'draft' ? `<button onclick="sendQuote(${q.id})" title="Send">📧</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="6" style="text-align:center;color:#666;">No quotes yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- New Quote Modal -->
    <div class="modal-overlay" id="quote-modal">
      <div class="modal" style="max-width: 700px;">
        <div class="modal-header">
          <h2>Create Quote</h2>
          <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <form id="quote-form" onsubmit="saveQuote(event)">
          <div class="form-row">
            <div class="form-group">
              <label>Customer *</label>
              <select id="q-customer" required>
                <option value="">Select customer...</option>
                ${customers.results?.map((c: any) => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Valid For (days)</label>
              <input type="number" id="q-valid-days" value="14">
            </div>
          </div>
          
          <div class="form-group">
            <label>Project Description</label>
            <input type="text" id="q-description" placeholder="e.g., Bathroom tile installation">
          </div>
          
          <h3 style="margin: 1.5rem 0 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">Labor</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Labor Type</label>
              <select id="q-labor-type">
                <option value="half-day">Half Day (≤6 hrs)</option>
                <option value="full-day">Full Day (6+ hrs)</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div class="form-group">
              <label>Rate ($)</label>
              <input type="number" id="q-labor-rate" value="175" step="0.01">
            </div>
            <div class="form-group">
              <label>Est. Hours/Days</label>
              <input type="number" id="q-hours" value="1" step="0.5">
            </div>
          </div>
          
          <h3 style="margin: 1.5rem 0 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">Helper (Optional)</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>
                <input type="checkbox" id="q-helper" onchange="toggleHelper()"> Add Helper
              </label>
            </div>
            <div class="form-group helper-field" style="display:none;">
              <label>Helper Type</label>
              <select id="q-helper-type">
                <option value="half-day">Half Day</option>
                <option value="full-day">Full Day</option>
              </select>
            </div>
            <div class="form-group helper-field" style="display:none;">
              <label>Helper Rate ($)</label>
              <input type="number" id="q-helper-rate" value="100" step="0.01">
            </div>
          </div>
          
          <h3 style="margin: 1.5rem 0 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">Materials & Equipment</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Materials Estimate ($)</label>
              <input type="number" id="q-materials" value="0" step="0.01">
            </div>
            <div class="form-group">
              <label>Equipment Rental ($)</label>
              <input type="number" id="q-equipment" value="0" step="0.01">
            </div>
          </div>
          
          <h3 style="margin: 1.5rem 0 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">Discount</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Discount (%)</label>
              <input type="number" id="q-discount" value="0" min="0" max="100" onchange="calculateTotal()">
            </div>
            <div class="form-group">
              <label>Discount Reason</label>
              <input type="text" id="q-discount-reason" placeholder="e.g., New customer">
            </div>
          </div>
          
          <div class="form-group">
            <label>Notes</label>
            <textarea id="q-notes" rows="3" placeholder="Additional details, scope of work..."></textarea>
          </div>
          
          <div class="quote-total">
            <span>Estimated Total:</span>
            <strong id="q-total-display">$175.00</strong>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Create Quote</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Quote Preview Modal -->
    <div class="modal-overlay" id="preview-modal">
      <div class="modal" style="max-width: 800px; max-height: 90vh; overflow: auto;">
        <div class="modal-header">
          <h2>Quote Preview</h2>
          <div>
            <button class="btn-secondary btn-sm" onclick="printQuote()">🖨️ Print</button>
            <button class="close-btn" onclick="closePreview()">&times;</button>
          </div>
        </div>
        <div id="quote-preview-content"></div>
      </div>
    </div>
    
    <style>
      .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .btn-primary { background: #8B4513; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600; }
      .btn-secondary { background: #e0e0e0; color: #333; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; }
      .btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
      
      .stats-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
      .stat-card { background: white; padding: 1rem 1.5rem; border-radius: 8px; text-align: center; flex: 1; }
      .stat-value { font-size: 1.5rem; font-weight: 700; color: #8B4513; display: block; }
      .stat-label { font-size: 0.85rem; color: #666; }
      
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
      .table th { font-weight: 600; color: #666; font-size: 0.85rem; }
      .table tr:hover { background: #f9f9f9; }
      .actions button { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
      .actions button:hover { background: #e0e0e0; }
      
      .badge { padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
      .badge-draft { background: #f3f4f6; color: #374151; }
      .badge-sent { background: #dbeafe; color: #1e40af; }
      .badge-accepted { background: #d1fae5; color: #065f46; }
      .badge-declined { background: #fee2e2; color: #991b1b; }
      .badge-expired { background: #fef3c7; color: #92400e; }
      
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 1000; }
      .modal-overlay.active { display: flex; }
      .modal { background: white; border-radius: 12px; width: 100%; max-height: 90vh; overflow-y: auto; }
      .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #eee; }
      .modal-header h2 { margin: 0; }
      .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; }
      .modal form { padding: 1.5rem; }
      
      .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; }
      .form-group { margin-bottom: 1rem; }
      .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }
      .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
      .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
      
      .quote-total { background: #f8f9fa; padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 1.25rem; margin-top: 1rem; }
      .quote-total strong { color: #8B4513; font-size: 1.5rem; }
    </style>
    
    <script>
      function showNewQuote() {
        document.getElementById('quote-form').reset();
        document.getElementById('quote-modal').classList.add('active');
        calculateTotal();
      }
      
      function closeModal() {
        document.getElementById('quote-modal').classList.remove('active');
      }
      
      function closePreview() {
        document.getElementById('preview-modal').classList.remove('active');
      }
      
      function toggleHelper() {
        const show = document.getElementById('q-helper').checked;
        document.querySelectorAll('.helper-field').forEach(el => el.style.display = show ? 'block' : 'none');
        calculateTotal();
      }
      
      function calculateTotal() {
        const laborRate = parseFloat(document.getElementById('q-labor-rate').value) || 0;
        const hours = parseFloat(document.getElementById('q-hours').value) || 1;
        const helperRate = document.getElementById('q-helper').checked ? (parseFloat(document.getElementById('q-helper-rate').value) || 0) : 0;
        const materials = parseFloat(document.getElementById('q-materials').value) || 0;
        const equipment = parseFloat(document.getElementById('q-equipment').value) || 0;
        const discountPct = parseFloat(document.getElementById('q-discount').value) || 0;
        
        const subtotal = (laborRate * hours) + helperRate + materials + equipment;
        const discount = subtotal * (discountPct / 100);
        const total = subtotal - discount;
        
        document.getElementById('q-total-display').textContent = '$' + total.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
      }
      
      // Recalculate on input change
      ['q-labor-rate', 'q-hours', 'q-helper-rate', 'q-materials', 'q-equipment', 'q-discount'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calculateTotal);
      });
      
      async function saveQuote(e) {
        e.preventDefault();
        
        const data = {
          customer_id: document.getElementById('q-customer').value,
          labor_type: document.getElementById('q-labor-type').value,
          labor_rate: parseFloat(document.getElementById('q-labor-rate').value),
          estimated_hours: parseFloat(document.getElementById('q-hours').value),
          helper_needed: document.getElementById('q-helper').checked,
          helper_type: document.getElementById('q-helper-type').value,
          helper_rate: parseFloat(document.getElementById('q-helper-rate').value),
          materials_estimate: parseFloat(document.getElementById('q-materials').value),
          equipment_estimate: parseFloat(document.getElementById('q-equipment').value),
          discount_percent: parseFloat(document.getElementById('q-discount').value),
          discount_reason: document.getElementById('q-discount-reason').value,
          notes: document.getElementById('q-notes').value,
          valid_days: parseInt(document.getElementById('q-valid-days').value),
        };
        
        const res = await fetch('/api/admin/quotes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await res.json();
        if (result.success) {
          closeModal();
          location.reload();
        } else {
          alert(result.error || 'Failed to create quote');
        }
      }
      
      async function viewQuote(id) {
        const res = await fetch('/api/admin/quotes/' + id + '/preview');
        const html = await res.text();
        document.getElementById('quote-preview-content').innerHTML = html;
        document.getElementById('preview-modal').classList.add('active');
      }
      
      function printQuote(id) {
        if (id) {
          window.open('/api/admin/quotes/' + id + '/pdf', '_blank');
        } else {
          window.print();
        }
      }
      
      async function sendQuote(id) {
        if (!confirm('Send this quote to the customer?')) return;
        
        const res = await fetch('/api/admin/quotes/' + id + '/send', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          location.reload();
        } else {
          alert(result.error || 'Failed to send quote');
        }
      }
    </script>
  `;
  
  return c.html(adminLayout('Quotes', content, 'quotes', admin));
};

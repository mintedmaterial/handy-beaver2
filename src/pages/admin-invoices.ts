import { Context } from 'hono';
import { adminLayout } from './admin';

export const adminInvoicesPage = async (c: Context) => {
  const admin = c.get('admin');
  const db = c.env.DB;
  
  // Get invoices with customer info
  const invoices = await db.prepare(`
    SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    ORDER BY i.created_at DESC
    LIMIT 50
  `).all<any>();
  
  // Get customers for dropdown
  const customers = await db.prepare(`
    SELECT id, name, email, phone FROM customers ORDER BY name
  `).all<any>();
  
  // Get jobs that can be invoiced (completed, no invoice yet)
  const invoiceableJobs = await db.prepare(`
    SELECT b.*, c.name as customer_name
    FROM bookings b
    JOIN customers c ON b.customer_id = c.id
    LEFT JOIN invoices i ON i.booking_id = b.id
    WHERE b.status = 'completed' AND i.id IS NULL
    ORDER BY b.created_at DESC
  `).all<any>();
  
  const stats = {
    draft: invoices.results?.filter((i: any) => i.status === 'draft').length || 0,
    sent: invoices.results?.filter((i: any) => i.status === 'sent').length || 0,
    paid: invoices.results?.filter((i: any) => i.status === 'paid').length || 0,
    overdue: invoices.results?.filter((i: any) => i.status === 'overdue').length || 0,
    totalOutstanding: invoices.results?.reduce((sum: number, i: any) => 
      sum + (['sent', 'partial', 'overdue'].includes(i.status) ? (i.total - (i.amount_paid || 0)) : 0), 0) || 0,
  };
  
  const content = `
    <div class="admin-invoices">
      <div class="page-header">
        <h1>Invoices</h1>
        <button class="btn-primary" onclick="showNewInvoice()">+ New Invoice</button>
      </div>
      
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-value">${stats.draft}</span>
          <span class="stat-label">Drafts</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${stats.sent}</span>
          <span class="stat-label">Sent</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">${stats.paid}</span>
          <span class="stat-label">Paid</span>
        </div>
        <div class="stat-card stat-overdue">
          <span class="stat-value">${stats.overdue}</span>
          <span class="stat-label">Overdue</span>
        </div>
        <div class="stat-card stat-outstanding">
          <span class="stat-value">$${stats.totalOutstanding.toLocaleString()}</span>
          <span class="stat-label">Outstanding</span>
        </div>
      </div>
      
      ${invoiceableJobs.results?.length ? `
      <div class="card alert-card">
        <h3>🔔 Jobs Ready to Invoice</h3>
        <p>${invoiceableJobs.results.length} completed job(s) without invoices:</p>
        <div class="ready-jobs">
          ${invoiceableJobs.results.map((j: any) => `
            <div class="ready-job">
              <span>${j.title || j.service_type} - ${j.customer_name}</span>
              <button onclick="createFromJob(${j.id}, ${j.customer_id})" class="btn-sm btn-primary">Create Invoice</button>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      <div class="invoices-list card">
        <table class="table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Paid</th>
              <th>Status</th>
              <th>Due Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${invoices.results?.map((inv: any) => `
              <tr>
                <td><strong>${inv.invoice_number || 'DRAFT'}</strong></td>
                <td>
                  ${inv.customer_name}<br>
                  <small style="color:#666">${inv.customer_email}</small>
                </td>
                <td><strong>$${inv.total?.toLocaleString()}</strong></td>
                <td>$${(inv.amount_paid || 0).toLocaleString()}</td>
                <td><span class="badge badge-${inv.status}">${inv.status}</span></td>
                <td>${inv.due_date ? new Date(inv.due_date * 1000).toLocaleDateString() : '-'}</td>
                <td class="actions">
                  <button onclick="viewInvoice(${inv.id})" title="View">👁️</button>
                  <button onclick="printInvoice(${inv.id})" title="Print/PDF">🖨️</button>
                  ${inv.status === 'draft' ? `<button onclick="sendInvoice(${inv.id})" title="Send">📧</button>` : ''}
                  ${['sent', 'partial', 'overdue'].includes(inv.status) ? `<button onclick="copyPaymentLink(${inv.id})" title="Copy Payment Link">🔗</button>` : ''}
                </td>
              </tr>
            `).join('') || '<tr><td colspan="7" style="text-align:center;color:#666;">No invoices yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- New Invoice Modal -->
    <div class="modal-overlay" id="invoice-modal">
      <div class="modal" style="max-width: 700px;">
        <div class="modal-header">
          <h2>Create Invoice</h2>
          <button class="close-btn" onclick="closeModal()">&times;</button>
        </div>
        <form id="invoice-form" onsubmit="saveInvoice(event)">
          <input type="hidden" id="inv-job-id">
          
          <div class="form-row">
            <div class="form-group">
              <label>Customer *</label>
              <select id="inv-customer" required>
                <option value="">Select customer...</option>
                ${customers.results?.map((c: any) => `<option value="${c.id}">${c.name} (${c.email})</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Due In (days)</label>
              <input type="number" id="inv-due-days" value="14">
            </div>
          </div>
          
          <h3 class="section-title">Line Items</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label>Labor ($)</label>
              <input type="number" id="inv-labor" value="0" step="0.01" onchange="calculateInvoiceTotal()">
            </div>
            <div class="form-group">
              <label>Helper ($)</label>
              <input type="number" id="inv-helper" value="0" step="0.01" onchange="calculateInvoiceTotal()">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Materials ($)</label>
              <input type="number" id="inv-materials" value="0" step="0.01" onchange="calculateInvoiceTotal()">
            </div>
            <div class="form-group">
              <label>Equipment ($)</label>
              <input type="number" id="inv-equipment" value="0" step="0.01" onchange="calculateInvoiceTotal()">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label>Discount ($)</label>
              <input type="number" id="inv-discount" value="0" step="0.01" onchange="calculateInvoiceTotal()">
            </div>
            <div class="form-group">
              <label>Tax Rate (%)</label>
              <input type="number" id="inv-tax" value="0" step="0.01" onchange="calculateInvoiceTotal()">
            </div>
          </div>
          
          <div class="form-group">
            <label>Notes</label>
            <textarea id="inv-notes" rows="3" placeholder="Work completed, special notes..."></textarea>
          </div>
          
          <div class="invoice-total">
            <div class="total-row"><span>Subtotal:</span><span id="inv-subtotal">$0.00</span></div>
            <div class="total-row"><span>Tax:</span><span id="inv-tax-amount">$0.00</span></div>
            <div class="total-row total-final"><span>Total:</span><strong id="inv-total">$0.00</strong></div>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button type="submit" class="btn-primary">Create Invoice</button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Invoice Preview Modal -->
    <div class="modal-overlay" id="preview-modal">
      <div class="modal" style="max-width: 800px; max-height: 90vh; overflow: auto;">
        <div class="modal-header">
          <h2>Invoice Preview</h2>
          <div>
            <button class="btn-secondary btn-sm" onclick="printInvoice()">🖨️ Print</button>
            <button class="close-btn" onclick="closePreview()">&times;</button>
          </div>
        </div>
        <div id="invoice-preview-content"></div>
      </div>
    </div>
    
    <style>
      .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
      .btn-primary { background: #8B4513; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight: 600; }
      .btn-secondary { background: #e0e0e0; color: #333; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer; }
      .btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
      
      .stats-row { display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
      .stat-card { background: white; padding: 1rem 1.5rem; border-radius: 8px; text-align: center; flex: 1; min-width: 100px; }
      .stat-value { font-size: 1.5rem; font-weight: 700; color: #8B4513; display: block; }
      .stat-label { font-size: 0.8rem; color: #666; text-transform: uppercase; }
      .stat-overdue { border-left: 3px solid #ef4444; }
      .stat-outstanding { border-left: 3px solid #f59e0b; }
      
      .alert-card { background: #fff8dc; border-left: 4px solid #f59e0b; }
      .alert-card h3 { margin: 0 0 0.5rem; color: #92400e; }
      .ready-jobs { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem; }
      .ready-job { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: white; border-radius: 6px; }
      
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { padding: 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
      .table th { font-weight: 600; color: #666; font-size: 0.85rem; }
      .table tr:hover { background: #f9f9f9; }
      .actions button { background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
      .actions button:hover { background: #e0e0e0; }
      
      .badge { padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
      .badge-draft { background: #f3f4f6; color: #374151; }
      .badge-sent { background: #dbeafe; color: #1e40af; }
      .badge-paid { background: #d1fae5; color: #065f46; }
      .badge-partial { background: #fef3c7; color: #92400e; }
      .badge-overdue { background: #fee2e2; color: #991b1b; }
      
      .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; justify-content: center; align-items: center; z-index: 1000; }
      .modal-overlay.active { display: flex; }
      .modal { background: white; border-radius: 12px; width: 100%; max-height: 90vh; overflow-y: auto; }
      .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; border-bottom: 1px solid #eee; }
      .close-btn { background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #666; }
      .modal form { padding: 1.5rem; }
      
      .section-title { margin: 1.5rem 0 1rem; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; color: #666; font-size: 0.9rem; }
      .form-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
      .form-group { margin-bottom: 1rem; }
      .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #333; }
      .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; }
      .modal-actions { display: flex; gap: 1rem; justify-content: flex-end; margin-top: 1.5rem; }
      
      .invoice-total { background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-top: 1rem; }
      .total-row { display: flex; justify-content: space-between; padding: 0.25rem 0; }
      .total-final { border-top: 2px solid #ddd; margin-top: 0.5rem; padding-top: 0.5rem; font-size: 1.1rem; }
      .total-final strong { color: #8B4513; }
    </style>
    
    <script>
      function showNewInvoice() {
        document.getElementById('invoice-form').reset();
        document.getElementById('inv-job-id').value = '';
        calculateInvoiceTotal();
        document.getElementById('invoice-modal').classList.add('active');
      }
      
      function createFromJob(jobId, customerId) {
        document.getElementById('invoice-form').reset();
        document.getElementById('inv-job-id').value = jobId;
        document.getElementById('inv-customer').value = customerId;
        document.getElementById('inv-labor').value = 175; // Default half-day
        calculateInvoiceTotal();
        document.getElementById('invoice-modal').classList.add('active');
      }
      
      function closeModal() {
        document.getElementById('invoice-modal').classList.remove('active');
      }
      
      function closePreview() {
        document.getElementById('preview-modal').classList.remove('active');
      }
      
      function calculateInvoiceTotal() {
        const labor = parseFloat(document.getElementById('inv-labor').value) || 0;
        const helper = parseFloat(document.getElementById('inv-helper').value) || 0;
        const materials = parseFloat(document.getElementById('inv-materials').value) || 0;
        const equipment = parseFloat(document.getElementById('inv-equipment').value) || 0;
        const discount = parseFloat(document.getElementById('inv-discount').value) || 0;
        const taxRate = parseFloat(document.getElementById('inv-tax').value) || 0;
        
        const subtotal = labor + helper + materials + equipment - discount;
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;
        
        document.getElementById('inv-subtotal').textContent = '$' + subtotal.toFixed(2);
        document.getElementById('inv-tax-amount').textContent = '$' + tax.toFixed(2);
        document.getElementById('inv-total').textContent = '$' + total.toFixed(2);
      }
      
      async function saveInvoice(e) {
        e.preventDefault();
        
        const data = {
          customer_id: document.getElementById('inv-customer').value,
          booking_id: document.getElementById('inv-job-id').value || null,
          labor_amount: parseFloat(document.getElementById('inv-labor').value) || 0,
          helper_amount: parseFloat(document.getElementById('inv-helper').value) || 0,
          materials_amount: parseFloat(document.getElementById('inv-materials').value) || 0,
          equipment_amount: parseFloat(document.getElementById('inv-equipment').value) || 0,
          discount_amount: parseFloat(document.getElementById('inv-discount').value) || 0,
          tax_rate: parseFloat(document.getElementById('inv-tax').value) || 0,
          notes: document.getElementById('inv-notes').value,
          due_days: parseInt(document.getElementById('inv-due-days').value) || 14,
        };
        
        const res = await fetch('/api/admin/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await res.json();
        if (result.success) {
          closeModal();
          location.reload();
        } else {
          alert(result.error || 'Failed to create invoice');
        }
      }
      
      async function viewInvoice(id) {
        const res = await fetch('/api/admin/invoices/' + id + '/preview');
        const html = await res.text();
        document.getElementById('invoice-preview-content').innerHTML = html;
        document.getElementById('preview-modal').classList.add('active');
      }
      
      function printInvoice(id) {
        if (id) {
          window.open('/api/admin/invoices/' + id + '/pdf', '_blank');
        } else {
          window.print();
        }
      }
      
      async function sendInvoice(id) {
        if (!confirm('Send this invoice to the customer?')) return;
        
        const res = await fetch('/api/admin/invoices/' + id + '/send', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          location.reload();
        } else {
          alert(result.error || 'Failed to send invoice');
        }
      }
      
      function copyPaymentLink(id) {
        const url = window.location.origin + '/pay/' + id;
        navigator.clipboard.writeText(url).then(() => {
          alert('Payment link copied!\\n' + url);
        });
      }
    </script>
  `;
  
  return c.html(adminLayout('Invoices', content, 'invoices', admin));
};

// Invoice detail page
export const adminInvoiceDetail = async (c: Context) => {
  const admin = c.get('admin');
  const invoiceId = c.req.param('id');
  
  const invoice = await c.env.DB.prepare(`
    SELECT i.*, c.name as customer_name, c.email as customer_email, c.phone as customer_phone, c.address
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).bind(invoiceId).first<any>();
  
  if (!invoice) {
    return c.notFound();
  }
  
  // Get related job if exists
  let job = null;
  if (invoice.booking_id) {
    job = await c.env.DB.prepare(`SELECT * FROM bookings WHERE id = ?`).bind(invoice.booking_id).first<any>();
  }
  
  // Get payments
  const payments = await c.env.DB.prepare(`
    SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC
  `).bind(invoiceId).all<any>();
  
  const statusColors: Record<string, string> = {
    draft: '#6b7280',
    sent: '#3b82f6',
    paid: '#10b981',
    partial: '#f59e0b',
    overdue: '#ef4444',
    cancelled: '#6b7280',
  };
  
  const formatDate = (ts: number) => ts ? new Date(ts * 1000).toLocaleDateString() : '-';
  const formatMoney = (amt: number) => amt ? `$${Number(amt).toFixed(2)}` : '$0.00';
  
  const balance = (invoice.total || 0) - (invoice.amount_paid || 0);
  const paymentUrl = `${c.req.url.split('/admin')[0]}/pay/${invoice.id}`;
  
  const content = `
    <div class="invoice-detail">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <a href="/admin/invoices" style="color: #666; text-decoration: none;">← Back to Invoices</a>
          <h1 style="margin: 0.5rem 0;">Invoice ${invoice.invoice_number || '#' + invoice.id}</h1>
          <span style="background: ${statusColors[invoice.status] || '#6b7280'}; color: white; padding: 4px 12px; border-radius: 4px;">${invoice.status}</span>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          ${invoice.status === 'draft' ? `<button class="btn-primary" onclick="sendInvoice()">Send to Customer</button>` : ''}
          <button class="btn-secondary" onclick="copyPaymentLink()">Copy Payment Link</button>
          <button class="btn-secondary" onclick="downloadPdf()">Download PDF</button>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
        <div>
          <div class="card" style="padding: 1.5rem; background: #1a1a1a; border-radius: 8px; margin-bottom: 1rem;">
            <h3 style="margin-top: 0;">Invoice Details</h3>
            
            <table style="width: 100%; border-collapse: collapse;">
              ${invoice.labor_amount ? `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem 0;">Labor</td>
                <td style="padding: 0.75rem 0; text-align: right;">${formatMoney(invoice.labor_amount)}</td>
              </tr>
              ` : ''}
              ${invoice.helper_amount ? `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem 0;">Helper</td>
                <td style="padding: 0.75rem 0; text-align: right;">${formatMoney(invoice.helper_amount)}</td>
              </tr>
              ` : ''}
              ${invoice.materials_amount ? `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem 0;">Materials</td>
                <td style="padding: 0.75rem 0; text-align: right;">${formatMoney(invoice.materials_amount)}</td>
              </tr>
              ` : ''}
              ${invoice.equipment_amount ? `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem 0;">Equipment</td>
                <td style="padding: 0.75rem 0; text-align: right;">${formatMoney(invoice.equipment_amount)}</td>
              </tr>
              ` : ''}
              ${invoice.discount_amount ? `
              <tr style="border-bottom: 1px solid #333; color: #10b981;">
                <td style="padding: 0.75rem 0;">Discount</td>
                <td style="padding: 0.75rem 0; text-align: right;">-${formatMoney(invoice.discount_amount)}</td>
              </tr>
              ` : ''}
              ${invoice.tax_amount ? `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem 0;">Tax (${invoice.tax_rate}%)</td>
                <td style="padding: 0.75rem 0; text-align: right;">${formatMoney(invoice.tax_amount)}</td>
              </tr>
              ` : ''}
              <tr style="font-weight: 600;">
                <td style="padding: 0.75rem 0;">Total</td>
                <td style="padding: 0.75rem 0; text-align: right;">${formatMoney(invoice.total)}</td>
              </tr>
              ${invoice.amount_paid ? `
              <tr style="color: #10b981;">
                <td style="padding: 0.75rem 0;">Amount Paid</td>
                <td style="padding: 0.75rem 0; text-align: right;">-${formatMoney(invoice.amount_paid)}</td>
              </tr>
              ` : ''}
              ${balance > 0 ? `
              <tr style="font-size: 1.25rem; font-weight: 700; color: #f97316;">
                <td style="padding: 1rem 0;">Balance Due</td>
                <td style="padding: 1rem 0; text-align: right;">${formatMoney(balance)}</td>
              </tr>
              ` : ''}
            </table>
            
            ${invoice.notes ? `
            <div style="margin-top: 1.5rem; padding: 1rem; background: #111; border-radius: 6px;">
              <strong>Notes:</strong>
              <p style="margin: 0.5rem 0 0; white-space: pre-wrap;">${invoice.notes}</p>
            </div>
            ` : ''}
            
            <div style="margin-top: 1rem; color: #666; font-size: 0.9rem;">
              <p>Created: ${formatDate(invoice.created_at)}</p>
              ${invoice.due_date ? `<p>Due: ${formatDate(invoice.due_date)}</p>` : ''}
              ${invoice.sent_at ? `<p>Sent: ${formatDate(invoice.sent_at)}</p>` : ''}
            </div>
          </div>
          
          <div class="card" style="padding: 1.5rem; background: #1a1a1a; border-radius: 8px;">
            <h3 style="margin-top: 0;">Payment History</h3>
            ${payments.results?.length ? `
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="color: #888; border-bottom: 1px solid #333;">
                  <th style="padding: 0.5rem; text-align: left;">Date</th>
                  <th style="padding: 0.5rem; text-align: left;">Type</th>
                  <th style="padding: 0.5rem; text-align: right;">Amount</th>
                  <th style="padding: 0.5rem; text-align: left;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${payments.results.map((p: any) => `
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 0.5rem;">${formatDate(p.created_at)}</td>
                  <td style="padding: 0.5rem;">${p.type}</td>
                  <td style="padding: 0.5rem; text-align: right;">${formatMoney(p.amount)}</td>
                  <td style="padding: 0.5rem;">${p.status}</td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            ` : '<p style="color: #666;">No payments yet.</p>'}
            
            ${balance > 0 ? `
            <button class="btn-primary" style="margin-top: 1rem;" onclick="recordPayment()">Record Payment</button>
            ` : ''}
          </div>
        </div>
        
        <div>
          <div class="card" style="padding: 1.5rem; background: #1a1a1a; border-radius: 8px; margin-bottom: 1rem;">
            <h3 style="margin-top: 0;">Customer</h3>
            <p><strong>${invoice.customer_name}</strong></p>
            <p><a href="mailto:${invoice.customer_email}">${invoice.customer_email}</a></p>
            <p><a href="tel:${invoice.customer_phone}">${invoice.customer_phone || '-'}</a></p>
            <p>${invoice.address || '-'}</p>
            <a href="/admin/customers/${invoice.customer_id}" class="btn-secondary" style="margin-top: 0.5rem; display: inline-block;">View Customer</a>
          </div>
          
          ${job ? `
          <div class="card" style="padding: 1.5rem; background: #1a1a1a; border-radius: 8px; margin-bottom: 1rem;">
            <h3 style="margin-top: 0;">Related Job</h3>
            <p><strong>${job.title}</strong></p>
            <p>Status: ${job.status}</p>
            <a href="/admin/jobs/${job.id}" class="btn-secondary" style="margin-top: 0.5rem; display: inline-block;">View Job</a>
          </div>
          ` : ''}
          
          <div class="card" style="padding: 1.5rem; background: #1a1a1a; border-radius: 8px;">
            <h3 style="margin-top: 0;">Payment Link</h3>
            <input type="text" value="${paymentUrl}" readonly style="width: 100%; padding: 0.5rem; background: #111; border: 1px solid #333; border-radius: 4px; color: #fff; margin-bottom: 0.5rem;">
            <button class="btn-secondary" style="width: 100%;" onclick="copyPaymentLink()">Copy Link</button>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      async function sendInvoice() {
        if (!confirm('Send this invoice to ${invoice.customer_email}?')) return;
        const res = await fetch('/api/admin/invoices/${invoice.id}/send', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
          location.reload();
        } else {
          alert(result.error || 'Failed to send');
        }
      }
      
      function copyPaymentLink() {
        navigator.clipboard.writeText('${paymentUrl}').then(() => {
          alert('Payment link copied!');
        });
      }
      
      function downloadPdf() {
        window.open('/api/admin/invoices/${invoice.id}/pdf', '_blank');
      }
      
      function recordPayment() {
        const amount = prompt('Enter payment amount:', '${balance.toFixed(2)}');
        if (!amount) return;
        fetch('/api/admin/invoices/${invoice.id}/payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: parseFloat(amount), type: 'manual' })
        }).then(() => location.reload());
      }
    </script>
  `;
  
  return c.html(adminLayout(`Invoice ${invoice.invoice_number || '#' + invoice.id}`, content, 'invoices', admin));
};

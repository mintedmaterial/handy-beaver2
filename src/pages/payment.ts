import { Context } from 'hono';
import { layout } from '../lib/html';

export async function paymentPage(c: Context) {
  const invoiceId = c.req.param('invoice_id');
  
  // Get invoice details
  const invoice = await c.env.DB.prepare(`
    SELECT i.*, c.email, c.name, c.phone
    FROM invoices i
    JOIN customers c ON i.customer_id = c.id
    WHERE i.id = ?
  `).bind(invoiceId).first<any>();
  
  if (!invoice) {
    return c.html(layout('Invoice Not Found', `
      <main class="container" style="text-align: center; padding: 100px 20px;">
        <h1>Invoice Not Found</h1>
        <p>This invoice doesn't exist or has been removed.</p>
        <a href="/" class="btn">Return Home</a>
      </main>
    `));
  }
  
  const amountDue = invoice.total - (invoice.amount_paid || 0);
  const isPaid = invoice.status === 'paid';
  
  const content = `
    <main class="container" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
      <div class="card" style="text-align: center;">
        <div style="margin-bottom: 30px;">
          <img src="/api/assets/lil-beaver-mascot.png" alt="Lil Beaver" style="width: 80px; height: 80px; border-radius: 50%;">
        </div>
        
        <h1 style="margin-bottom: 10px;">Invoice ${invoice.invoice_number}</h1>
        <p style="color: #666; margin-bottom: 30px;">The Handy Beaver</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <table style="width: 100%; text-align: left;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Customer</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd; text-align: right;">${invoice.name}</td>
            </tr>
            ${invoice.notes ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Description</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd; text-align: right;">${invoice.notes}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Labor</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd; text-align: right;">$${(invoice.labor_amount || 0).toFixed(2)}</td>
            </tr>
            ${invoice.helper_amount ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Helper</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd; text-align: right;">$${invoice.helper_amount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${invoice.materials_amount ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Materials</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd; text-align: right;">$${invoice.materials_amount.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${invoice.discount_amount ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd;"><strong>Discount</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #ddd; text-align: right; color: green;">-$${invoice.discount_amount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 10px 0; font-size: 1.2em;"><strong>Total</strong></td>
              <td style="padding: 10px 0; font-size: 1.2em; text-align: right;"><strong>$${invoice.total.toFixed(2)}</strong></td>
            </tr>
            ${invoice.amount_paid > 0 ? `
            <tr>
              <td style="padding: 10px 0; color: green;"><strong>Paid</strong></td>
              <td style="padding: 10px 0; color: green; text-align: right;">-$${invoice.amount_paid.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-size: 1.3em;"><strong>Balance Due</strong></td>
              <td style="padding: 10px 0; font-size: 1.3em; text-align: right;"><strong>$${amountDue.toFixed(2)}</strong></td>
            </tr>
            ` : ''}
          </table>
        </div>
        
        ${isPaid ? `
          <div style="background: #d4edda; color: #155724; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="margin: 0;">✅ Paid in Full</h2>
            <p style="margin: 10px 0 0 0;">Thank you for your payment!</p>
          </div>
        ` : `
          <div id="payment-section">
            <h2 style="margin-bottom: 20px;">Pay Now</h2>
            
            <form id="payment-form">
              <div id="card-container" style="margin-bottom: 20px; min-height: 100px;"></div>
              
              <button id="card-button" type="submit" class="btn" style="width: 100%; padding: 15px; font-size: 1.1em;">
                Pay $${amountDue.toFixed(2)}
              </button>
            </form>
            
            <div id="payment-status" style="margin-top: 20px; display: none;"></div>
          </div>
          
          <script src="https://sandbox.web.squarecdn.com/v1/square.js"></script>
          <script>
            const invoiceId = '${invoiceId}';
            const amountCents = ${Math.round(amountDue * 100)};
            
            async function initializePayment() {
              // Get Square config
              const configRes = await fetch('/api/payments/config');
              const config = await configRes.json();
              
              if (config.error) {
                document.getElementById('payment-section').innerHTML = 
                  '<p style="color: red;">Payment system not available. Please contact us directly.</p>';
                return;
              }
              
              const payments = Square.payments(config.application_id, config.location_id);
              const card = await payments.card();
              await card.attach('#card-container');
              
              document.getElementById('payment-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const button = document.getElementById('card-button');
                button.disabled = true;
                button.textContent = 'Processing...';
                
                try {
                  const result = await card.tokenize();
                  
                  if (result.status === 'OK') {
                    const paymentRes = await fetch('/api/payments/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        invoice_id: invoiceId,
                        source_id: result.token,
                        amount_cents: amountCents,
                      }),
                    });
                    
                    const paymentData = await paymentRes.json();
                    
                    if (paymentData.success) {
                      document.getElementById('payment-section').innerHTML = 
                        '<div style="background: #d4edda; color: #155724; padding: 20px; border-radius: 8px;">' +
                        '<h2>✅ Payment Successful!</h2>' +
                        '<p>Thank you for your payment. A receipt has been sent to your email.</p>' +
                        '</div>';
                    } else {
                      throw new Error(paymentData.error || 'Payment failed');
                    }
                  } else {
                    throw new Error(result.errors?.[0]?.message || 'Card validation failed');
                  }
                } catch (error) {
                  document.getElementById('payment-status').style.display = 'block';
                  document.getElementById('payment-status').innerHTML = 
                    '<p style="color: red;">Payment failed: ' + error.message + '</p>';
                  button.disabled = false;
                  button.textContent = 'Pay $${amountDue.toFixed(2)}';
                }
              });
            }
            
            initializePayment();
          </script>
        `}
        
        <p style="margin-top: 30px; color: #666; font-size: 0.9em;">
          Questions? Contact us at <a href="mailto:contact@handybeaver.co">contact@handybeaver.co</a>
        </p>
      </div>
    </main>
  `;
  
  return c.html(layout(`Invoice ${invoice.invoice_number} - The Handy Beaver`, content));
}

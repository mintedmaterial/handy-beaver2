# Handy Beaver Business Skill

Tools for managing The Handy Beaver business operations.

## API Base URL

Production: `https://handybeaver.co/api`
Dev: `https://handy-beaver.srvcflo.workers.dev/api`

## Authentication

Admin operations require the admin session cookie or API key.
Customer operations use customer session tokens.

---

## Admin Tools (Discord Mode)

### 1. List Customers

```bash
curl -s "https://handybeaver.co/api/admin/customers" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

### 2. Get Customer Details

```bash
curl -s "https://handybeaver.co/api/admin/customers/{id}" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

**Response includes:** name, email, phone, address, total jobs, total spent, all bookings, all messages

### 3. Search Customers

```bash
curl -s "https://handybeaver.co/api/admin/customers/search?q={query}" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

### 4. Create Quote

```bash
curl -X POST "https://handybeaver.co/api/admin/quotes" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "booking_id": 1,
    "labor_type": "full_day",
    "labor_rate": 300,
    "estimated_hours": 8,
    "helper_needed": true,
    "helper_type": "half_day",
    "helper_rate": 100,
    "materials_estimate": 150,
    "discount_percent": 10,
    "discount_reason": "New customer",
    "notes": "Deck staining - customer providing stain",
    "valid_days": 14
  }' | jq
```

### 5. Send Quote

```bash
curl -X POST "https://handybeaver.co/api/admin/quotes/{id}/send" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

Sends email to customer with quote details and accept/decline links.

### 6. Create Invoice

```bash
curl -X POST "https://handybeaver.co/api/admin/invoices" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "booking_id": 1,
    "quote_id": 1,
    "labor_amount": 300,
    "helper_amount": 100,
    "materials_amount": 150,
    "notes": "Deck staining completed 3/8/2026",
    "due_days": 14
  }' | jq
```

### 7. Send Invoice

```bash
curl -X POST "https://handybeaver.co/api/admin/invoices/{id}/send" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

### 8. List Unpaid Invoices

```bash
curl -s "https://handybeaver.co/api/admin/invoices?status=unpaid" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

### 9. Get Schedule

```bash
curl -s "https://handybeaver.co/api/admin/schedule?days=7" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

Returns jobs scheduled for the next N days.

### 10. Add Job Note

```bash
curl -X POST "https://handybeaver.co/api/admin/bookings/{id}/notes" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Completed first coat of stain. Customer happy with color choice.",
    "note_type": "work_log"
  }' | jq
```

Note types: `general`, `work_log`, `materials`, `issue`, `followup`

### 11. Update Job Status

```bash
curl -X PATCH "https://handybeaver.co/api/admin/bookings/{id}" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "scheduled_date": "2026-03-15"
  }' | jq
```

Statuses: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`

### 12. Send Customer Message

```bash
curl -X POST "https://handybeaver.co/api/admin/messages" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "content": "Just confirming our appointment for tomorrow at 9am. See you then!",
    "send_email": true
  }' | jq
```

### 13. Draft Blog Post

```bash
curl -X POST "https://handybeaver.co/api/admin/content/blog" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": 1,
    "topic": "Deck restoration project",
    "notes": "Replaced 12 boards, sanded entire deck, applied two coats of semi-transparent stain",
    "include_images": true
  }' | jq
```

Returns a draft blog post based on job details and notes.

### 14. Get Daily Summary

```bash
curl -s "https://handybeaver.co/api/admin/summary" \
  -H "Authorization: Bearer $ADMIN_API_KEY" | jq
```

Returns: pending quotes, unpaid invoices, scheduled jobs, new messages, recent activity.

---

## Customer Tools (Website Mode)

### 1. Get Services

```bash
curl -s "https://handybeaver.co/api/services" | jq
```

### 2. Get Pricing

```bash
curl -s "https://handybeaver.co/api/pricing" | jq
```

### 3. Submit Quote Request

```bash
curl -X POST "https://handybeaver.co/api/contact" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "service_type": "deck_repair",
    "description": "Need to replace some rotted boards on my deck",
    "address": "123 Main St, Idabel, OK",
    "promo": "new10"
  }' | jq
```

### 4. Check My Bookings (logged in)

```bash
curl -s "https://handybeaver.co/api/bookings" \
  -H "Cookie: hb_session=xxx" | jq
```

### 5. Send Message (logged in)

```bash
curl -X POST "https://handybeaver.co/api/messages" \
  -H "Cookie: hb_session=xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "What time are you arriving tomorrow?",
    "booking_id": 1
  }' | jq
```

### 6. AI Visualizer

```bash
curl -X POST "https://handybeaver.co/api/images/visualize" \
  -H "Content-Type: application/json" \
  -d '{
    "image_url": "https://...",
    "prompt": "Show this deck with dark walnut stain"
  }' | jq
```

Rate limited: 3 free for guests, unlimited for customers.

---

## Webhooks (Notifications)

The worker sends webhooks to Discord for:

- `quote_request` - New quote request submitted
- `customer_message` - Customer sent a message
- `invoice_paid` - Invoice was paid
- `quote_accepted` - Customer accepted a quote

Configure webhook URL in worker secrets: `DISCORD_WEBHOOK_NOTIFICATIONS`

---

---

## Facebook Group Lead Monitoring (Browser-Based)

Since Facebook's Graph API restricts group access, we use browser automation (Puppeteer/Playwright) similar to Twitter automation.

### Target Groups (SE Oklahoma)

Configure in `/home/flo/handy-beaver/config/facebook-groups.json`:

```json
{
  "groups": [
    { "id": "123456789", "name": "Idabel Community", "check_interval_min": 30 },
    { "id": "987654321", "name": "SE Oklahoma Buy/Sell/Trade", "check_interval_min": 30 }
  ]
}
```

### Keyword Detection

Posts matching these patterns trigger lead detection:

**High Intent:**
- "looking for", "need someone", "recommendations for", "anyone know"
- Combined with: flooring, trim, deck, handyman, carpenter, repair, maintenance

**Service Keywords:**
- flooring, floors, LVP, hardwood, tile, carpet
- trim, baseboards, crown molding, casing
- deck, porch, staining, boards
- handyman, odd jobs, home repair, maintenance
- carpenter, finish work, woodwork

### Response Templates

**Generic (rotate):**
```
Hey! I do this kind of work in SE Oklahoma — flooring, trim, deck repair, maintenance. Check out handybeaver.co for pricing and a free quote! 🦫
```

**Flooring-specific:**
```
I handle flooring! LVP, hardwood, tile — $175/half day or $300/full day, you just cover materials. More at handybeaver.co 🦫
```

**Trim/Carpentry:**
```
Finish carpentry is my specialty! Crown, base, casing, built-ins. Based in SE Oklahoma. See handybeaver.co for details 🦫
```

### Lead Logging

When a lead is detected:
1. Log to D1 `leads` table (post URL, user, content, timestamp)
2. Notify Discord webhook with post preview
3. Track if response was sent

### Running the Monitor

```bash
# On Minte's PC (logged into Facebook)
ssh Minte@100.84.133.97 "cd C:\Users\Minte\handy-beaver-automation && node monitor-groups.js"
```

---

## Knowledge Base (Quick Reference)

### Services Offered

| Service | Description |
|---------|-------------|
| **Trim Carpentry** | Crown molding, baseboards, door/window casing, built-ins |
| **Flooring** | LVP, hardwood, tile, carpet removal, subfloor repair |
| **Deck Work** | Repair, board replacement, staining, sealing |
| **General Maintenance** | Odd jobs, repairs, honey-do lists |

### Pricing

| Type | Half Day (≤6 hrs) | Full Day |
|------|-------------------|----------|
| **Labor** | $175 | $300 |
| **Helper** | $100 | $225 |

**Note:** Customer pays all materials, consumables, and equipment rental.

### Service Area

Southeast Oklahoma — roughly within 1 hour of Idabel.

### Scheduling

- Check `/api/admin/schedule` for availability
- Typical lead time: 1-2 weeks
- Emergency/rush jobs: case-by-case

### Common Questions

**Q: Do you provide materials?**
A: No, customer purchases materials. I can advise on what's needed and quantities.

**Q: What's included in the rate?**
A: Labor and basic tools. Specialty tools/equipment rental is additional.

**Q: Do you do free estimates?**
A: Yes! Submit a request at handybeaver.co/contact or message me directly.

**Q: What areas do you serve?**
A: Southeast Oklahoma — Idabel, Broken Bow, Hugo, Antlers, and surrounding areas.

---

## Environment Variables

```bash
# Required
ADMIN_API_KEY=<generated key for admin API access>
DISCORD_WEBHOOK_NOTIFICATIONS=<webhook URL for notifications>

# Optional
FACEBOOK_PAGE_ID=<for auto-posting>
FACEBOOK_PAGE_ACCESS_TOKEN=<for auto-posting>
SQUARE_ACCESS_TOKEN=<for payments>
GEMINI_API_KEY=<for AI visualizer>
```

# TOOLS.md — Lil Beaver Local Config

## Admin API Access

**API Key:** `59iVEDwyCvfRxcKmCJnYEl1bdx2dI5mo`
**Base URL:** `https://handybeaver.co`

When making API calls, always include:
```
Authorization: Bearer 59iVEDwyCvfRxcKmCJnYEl1bdx2dI5mo
Content-Type: application/json
```

---

## Business Info

- **Business:** The Handy Beaver
- **Owner:** Minte (colt)
- **Phone:** +1 (555) 797-2503
- **Email:** contact@handybeaver.co
- **Website:** https://handybeaver.co
- **Facebook:** Handy Beaver Co (Page ID: 1040910635768535)

## API Endpoints

Base URL: `https://handybeaver.co`

### Customer Operations
```
GET  /api/admin/customers          — List customers
POST /api/admin/customers          — Create customer
GET  /api/admin/customers/:id      — Get customer details
```

### Quotes & Bookings
```
GET  /api/admin/quotes             — List quotes
POST /api/admin/quotes             — Create quote
GET  /api/admin/bookings           — List bookings
POST /api/admin/bookings           — Create booking
```

### Invoices & Payments
```
GET  /api/admin/invoices           — List invoices
POST /api/admin/invoices           — Create invoice
GET  /pay/:invoice_id              — Customer payment page
```

### Messages & Leads
```
GET  /api/admin/messages           — List contact messages
GET  /api/admin/leads              — List Facebook leads
```

## Discord

- **Admin Channel:** #lil-beaver-admin (1479913371326353590)
- **Webhook:** (configured in worker)

## ElevenLabs Voice Agent

- **Agent ID:** agent_6401kk7jr6ngey2ancnk6nf7kpwy
- **Branch ID:** agtbrch_0001kk7m1ss5frqbjb5rnegzyw7z
- **Voice:** (select warm, friendly voice)

## WhatsApp Business

- **Business ID:** 913321228338423
- **Phone Number ID:** 1016449968218067
- **Phone Number:** +1 (555) 797-2503
- **Account Name:** The Handy Beaver Co (Colt Cogburn)

## Service Categories

1. **Bathroom Remodels** — Tile, fixtures, vanities
2. **Flooring** — LVP, hardwood, tile installation
3. **Custom Woodwork** — Bars, countertops, built-ins
4. **Deck & Outdoor** — Staining, repairs, builds
5. **General Maintenance** — Repairs, handyman work
6. **New Construction** — Tiny homes, cabins

## Common Questions

**Q: What areas do you serve?**
A: SE Oklahoma — McCurtain County, Broken Bow, Hochatown, Idabel. We also serve Paris, TX area.

**Q: How much does it cost?**
A: Labor is $175 for jobs up to 6 hours, $300/day for longer. Helper rate is $100 (≤6 hrs) or $225/day. Materials are purchased by the customer.

**Q: How do I schedule?**
A: Fill out the contact form on our website, call us, or message on Facebook. We'll get back to you within 24 hours.

**Q: Do you do free estimates?**
A: Yes! We provide free consultations and estimates for most projects.

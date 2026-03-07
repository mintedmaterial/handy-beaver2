# The Handy Beaver - Agent Architecture

## Overview

The Handy Beaver uses a **two-agent system** to handle different user types:

1. **Lil Beaver (Admin Agent)** - Discord-based assistant for the business owner
2. **Customer Agent** - Website chat assistant for customers

---

## 1. Lil Beaver - Admin Agent (Discord)

**Purpose:** Help Minte manage the business from anywhere via Discord

**Channel:** `#lil-beaver-admin` (private, owner only)

### Capabilities

| Action | Command | Description |
|--------|---------|-------------|
| Create Quote | `@LilBeaver quote for [customer]` | Generate a quote from conversation |
| Send Invoice | `@LilBeaver invoice [customer] [amount]` | Create and send invoice |
| Check Schedule | `@LilBeaver schedule` | View upcoming jobs |
| Customer Lookup | `@LilBeaver customer [name/email]` | Pull customer file |
| Log Work | `@LilBeaver log work [job]: [description]` | Add work notes for blog |
| Draft Content | `@LilBeaver draft blog about [topic]` | Generate blog content |
| Add Images | `@LilBeaver add image to [job]` | Upload project images |
| Notify Customer | `@LilBeaver notify [customer]: [message]` | Send message to customer |
| Today's Summary | `@LilBeaver summary` | Daily business overview |

### Notifications Received

- New quote requests
- Customer messages
- Invoice payments
- Appointment requests
- Low/urgent priority flags

### Tools Available

```typescript
interface AdminAgentTools {
  // Database Access
  getCustomer(id: number): Customer;
  getBooking(id: number): Booking;
  getQuote(id: number): Quote;
  getInvoice(id: number): Invoice;
  
  // Create/Update
  createQuote(customerId: number, data: QuoteData): Quote;
  createInvoice(customerId: number, data: InvoiceData): Invoice;
  addJobNote(bookingId: number, note: string): void;
  updateJobStatus(bookingId: number, status: string): void;
  
  // Communications
  sendCustomerEmail(customerId: number, subject: string, body: string): void;
  sendSMS(phone: string, message: string): void;
  
  // Content
  draftBlogPost(topic: string, workNotes: string[]): string;
  uploadProjectImage(bookingId: number, imageUrl: string): void;
  
  // Analytics
  getDailySummary(): Summary;
  getUnpaidInvoices(): Invoice[];
  getPendingQuotes(): Quote[];
}
```

---

## 2. Customer Agent (Website)

**Purpose:** Handle customer inquiries on the website

**Location:** `/agent` page and chat widget

### Capabilities

| Action | Trigger | Description |
|--------|---------|-------------|
| Answer Questions | General inquiry | Provide service info, pricing |
| Collect Lead Info | New visitor | Name, email, project description |
| Schedule Consultation | "Schedule" request | Forward to owner via Discord |
| Show Pricing | "How much" questions | Display pricing structure |
| AI Visualizer | "Show me" / "Visualize" | Link to AI visualizer |
| Status Check | Logged-in customer | Show project status |

### Access Levels

**Guest (not logged in):**
- Answer general questions
- Collect contact info
- 3 free AI visualizations
- Cannot access account info

**Logged-in Customer:**
- Full conversation history
- Project status updates
- Unlimited AI visualizations
- Direct messaging to owner
- Payment portal access

### Tools Available

```typescript
interface CustomerAgentTools {
  // Read-only
  getServices(): Service[];
  getPricing(): PricingInfo;
  getAvailability(): TimeSlot[];
  
  // Lead capture
  createLead(name: string, email: string, phone?: string): Customer;
  createQuoteRequest(customerId: number, description: string): Booking;
  
  // For logged-in customers only
  getMyBookings(): Booking[];
  getMyMessages(): Message[];
  sendMessage(content: string): Message;
  
  // AI Visualizer
  generateVisualization(imageUrl: string, prompt: string): string;
  getVisualizationCount(): number; // For rate limiting guests
}
```

---

## Integration Points

### Discord → Worker

```
Discord Message
    ↓
OpenClaw Gateway (Lil Beaver agent)
    ↓
Parse intent + extract parameters
    ↓
Call Worker API endpoint
    ↓
Return result to Discord
```

### Website → Worker

```
Chat Message
    ↓
/api/agent/chat endpoint
    ↓
Workers AI (process intent)
    ↓
Execute tools if needed
    ↓
Return response to chat
```

### Shared Database

Both agents read/write to the same D1 database:
- `customers`
- `bookings`
- `quotes`
- `invoices`
- `messages`
- `job_notes`
- `agent_conversations`
- `agent_actions`

---

## Cloudflare Email Routing

**Documentation:** https://developers.cloudflare.com/email-routing/

### Setup

1. **Custom domain email:** `contact@handybeaver.app`
2. **Route to:** Worker endpoint `/api/email/inbound`
3. **Worker parses email** and triggers actions

### Email → Agent Flow

```
Customer replies to email
    ↓
Cloudflare Email Routing
    ↓
Worker /api/email/inbound
    ↓
Parse sender, content
    ↓
Create message in D1
    ↓
Notify owner via Discord
    ↓
Agent processes if auto-reply needed
```

---

## Discord Channel Setup

**Server:** Atlas Dev Server

**Channels needed:**

| Channel | Purpose | Who |
|---------|---------|-----|
| `#lil-beaver-admin` | Admin agent interaction | Minte only |
| `#handy-beaver-notifications` | Business notifications | Minte + Flo |
| `#handy-beaver-logs` | System logs | Dev team |

---

## Environment Variables

```bash
# Discord
DISCORD_WEBHOOK_QUOTES=<webhook for quote notifications>
DISCORD_WEBHOOK_MESSAGES=<webhook for customer messages>
DISCORD_CHANNEL_ADMIN=<channel ID for Lil Beaver>

# Email
CLOUDFLARE_EMAIL_DOMAIN=handybeaver.app

# AI
WORKERS_AI_MODEL=@cf/meta/llama-3.1-8b-instruct
GEMINI_API_KEY=<for visualizations>
```

---

## Next Steps

1. [ ] Create `#lil-beaver-admin` channel in Discord
2. [ ] Set up OpenClaw agent config for Lil Beaver
3. [ ] Implement Worker API endpoints for agent tools
4. [ ] Configure Cloudflare Email Routing
5. [ ] Deploy and test both agents

# AI Visualizer Portal Integration Spec

**Branch:** `feature/ai-visualizer-portal`  
**Created:** 2026-03-09  
**Status:** In Progress

## Overview

Move AI Visualizer behind client/admin portals with usage limits and watermarking.

## Requirements

### 1. Access Control (Auth Required)

Remove `/visualize` from public navigation. Visualizer requires:
- **Option A:** Completed lead/quote form (email captured)
- **Option B:** Existing account (client portal login)
- **Option C:** Admin access

### 2. Usage Tiers

| User Type | Daily Limit | Notes |
|-----------|-------------|-------|
| Lead/Quote (pipeline) | 3/day | Email verified via form submission |
| Project Client | 10/project | Active project status in DB |
| Ongoing Client | 10/project | Per project basis |
| Admin | Unlimited | No restrictions |

**Server-side tracking required** — no more localStorage.

### 3. Watermarking

All generated images must include watermark:
- **Asset:** `/api/assets/beaver-avatar.png`
- **Position:** Bottom right corner (or bottom left)
- **Size:** ~10-15% of image width
- **Opacity:** Semi-transparent (~70%)

Can be done:
- Post-processing via canvas/sharp
- Or as part of Gemini prompt (less reliable)

### 4. Database Schema Updates

```sql
-- Usage tracking table
CREATE TABLE IF NOT EXISTS visualizer_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  user_id INTEGER, -- nullable, links to users table if logged in
  project_id INTEGER, -- nullable, for project-tier tracking
  used_at TEXT DEFAULT CURRENT_TIMESTAMP,
  image_url TEXT,
  prompt TEXT
);

-- Index for daily limit checks
CREATE INDEX idx_usage_email_date ON visualizer_usage(email, used_at);
```

### 5. Prompt Enhancement (Lil Beaver)

Before image generation, run user prompt through Lil Beaver to enhance with:
- Proper wood types (cedar, pine, oak, mahogany)
- Stain/paint terminology (semi-transparent, solid, satin, semi-gloss)
- Construction details (board width, railing style, trim profiles)
- Color accuracy (hex codes or standard paint names)

**Example:**
```
User: "make the deck darker"
Lil Beaver: "Apply a dark walnut semi-transparent deck stain to the 
horizontal deck boards, preserving natural wood grain texture. The existing 
white railings should remain crisp white with semi-gloss finish. Maintain 
the current board spacing and railing post positions."
```

Use Gemini Flash for prompt enhancement (fast + cheap).

### 6. API Endpoints

- `POST /api/images/visualize` — Generate visualization
  - Requires auth token OR valid lead email
  - Checks usage limits before generating
  - **Step 1:** Enhance prompt via Lil Beaver (Gemini Flash)
  - **Step 2:** Generate image (Gemini primary → CF Workers AI fallback)
  - **Step 3:** Watermark result
  - Returns watermarked image URL
  - Stores in R2

- `GET /api/visualizer/usage` — Check remaining uses
  - Returns `{ remaining: number, tier: string, limit: number }`

### 6. UI Changes

1. Remove `/visualize` from main nav (or redirect to portal)
2. Add visualizer to client portal dashboard
3. Add visualizer to admin panel (no limits shown)
4. Show usage remaining based on server response
5. Prompt for quote/signup if not authenticated

### 7. Portal Integration Points

**Client Portal (`/portal`):**
- Add "AI Visualizer" card/button
- Show usage: "3 of 10 remaining this project"

**Admin Panel (`/admin`):**
- Add visualizer access
- No usage display (unlimited)
- Option to view all generation history

---

## Image Generation Models

**Primary:** Gemini (already configured via `GEMINI_API_KEY`)
- Use `gemini-2.0-flash-exp` for image generation
- Prompt enhancement uses `gemini-1.5-flash` (text only, fast)

**Fallback:** Cloudflare Workers AI
- `@cf/stabilityai/stable-diffusion-xl-base-1.0` or similar
- Triggered if Gemini fails/times out

## Implementation Order

1. [ ] Database schema update (add `visualizer_usage` table)
2. [ ] API endpoint `/api/visualizer/usage`
3. [ ] Prompt enhancement function (Lil Beaver via Gemini Flash)
4. [ ] Image generation with Gemini → CF fallback
5. [ ] Watermark processing (canvas or sharp)
6. [ ] Wire up `/api/images/visualize` with full pipeline
7. [ ] Update visualize page to check auth/usage
8. [ ] Add to client portal
9. [ ] Add to admin panel
10. [ ] Remove from public nav / add redirect

---

## Social Media Integration (Sage - @SageAgent)

After visualizer is working:

1. **Lil Beaver posts (2x/day):**
   - Use existing project images from R2
   - Regenerate with AI as marketing mockups
   - Post to Facebook/Instagram via Postiz

2. **Home improvement tips (1x/day):**
   - Helpful facts about repairs, maintenance
   - Seasonal content (spring cleaning, winter prep)

3. **Inbox response:**
   - Monitor Facebook/Instagram DMs via Business Suite
   - Respond as Lil Beaver persona

---

## Testing

1. Test on `handy-beaver.srvcflo.workers.dev` before production
2. Verify usage limits work correctly
3. Confirm watermark appears on all generated images
4. Test admin bypass

---

## Notes

- Gemini API key already configured (`GEMINI_API_KEY` secret)
- R2 bucket `handy-beaver-images` available for storage
- Browser binding available if needed for canvas processing

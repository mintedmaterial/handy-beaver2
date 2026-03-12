# Calendar & Scheduling Enhancement Plan

This app now has a baseline **admin calendar screen** (`/admin/calendar`) and API support for:
- Listing in-app scheduled bookings (`/api/calendar/bookings`)
- Listing Google Calendar events (`/api/calendar/events`)
- One-click booking sync to Google (`/api/calendar/sync/:booking_id`)

## Next recommended upgrades

1. **Two-way sync worker (cron)**
   - Add a scheduled Worker task that pulls Google updates every 5–10 minutes.
   - Match events to bookings by `GoogleCalendarEventId` metadata.
   - Update booking date/status/notes when events move or cancel.

2. **Use dedicated service calendar**
   - Create a dedicated Google calendar (e.g., `jobs@...`) instead of `primary`.
   - Store `GOOGLE_CALENDAR_ID` and route all API calls there.

3. **Write structured calendar fields**
   - Add `google_event_id`, `google_event_link`, `calendar_sync_state`, `calendar_last_synced_at` columns to `bookings`.
   - Stop parsing sync data out of freeform notes once migration is complete.

4. **Conflict prevention in booking flow**
   - Before confirming a booking, check both app bookings and Google events for overlap.
   - Return blocked windows + next available slots.

5. **Technician assignment readiness**
   - Add `assigned_to` (or crew table) and create per-tech calendars if business scales.

6. **Webhook-first sync**
   - Use Google Calendar watch channels + webhook endpoint for near real-time sync instead of only polling.

## Why this helps

- Admin sees one source of truth in-app.
- Google remains available for agent workflows and phone-native calendar usage.
- You avoid double-booking and can scale scheduling without leaving the app.

## Messaging Center v2 — Phased Build Plan

This is a very large scope (inbox management, rich compose, template library of 75+ entries, notifications matrix, BridgeMind AI, role permissions, mobile gestures, accessibility). Shipping it all in one turn would produce a shallow result across every area. I'll build it in **4 phases**, each independently usable and verifiable, on the shared `/messaging` route so every role (Planner, Vendor, Guest, Admin, Internal, and future vendor sub-roles) gets the same interface with role-gated capabilities.

### Phase 1 — Data model + Inbox v2 (this turn)

**Database (single migration):**
- `conversations` — id, owner_id, title, type (internal/vendor/guest/payment/system), is_pinned, is_muted, is_favorite, is_archived, archived_at, deleted_at (30-day trash), labels text[], last_message_at, unread_count
- `conversation_participants` — conversation_id, user_id, role, joined_at
- `messages` — id, conversation_id, sender_id, body, attachments jsonb, status (sent/delivered/read), created_at, read_at
- `message_templates` — id, owner_id (nullable = global), category, title, body, variables text[], is_favorite, usage_count, last_used_at, is_archived
- Extend `notification_preferences` with: category (messages/ai/event/payments/team/system), channel (in_app/push/email/sms/calendar), frequency (instant/hourly/daily/weekly/off), quiet_hours_start, quiet_hours_end
- Seed 75+ templates covering: Guest (RSVP, save-the-date, travel, thank-you, dietary, timeline), Vendor (deposit, contract, timeline, walkthrough, load-in), Internal (mentions, weekly sync, decisions needed), Payment (invoice, receipt, past-due), Emergency (weather, venue change), Marketing (announcements), etc.
- RLS: participants can read; owner can archive/delete; templates readable by all authenticated, editable by owner

**Inbox UI:**
- Left rail: search with filters (Unread, Archived, Vendors, Guests, Internal, Payments, Scheduled, Attachments, Favorites), grouped by Today/Yesterday/This Week/Earlier
- Rows: avatar, participant + role badge, last message preview, timestamp, unread count, status dot, pin/favorite/mute icons
- Hover actions (desktop): Archive, Delete, Pin, Mark Unread, Mute, Favorite, Export
- Swipe actions (mobile): Archive left, Delete right (via touch handlers)
- Bulk selection mode with Archive / Delete / Mark Read-Unread / Assign Labels
- Tabs: Inbox · Archive · Trash (30-day recovery, Restore action)

### Phase 2 — Compose v2 + Rich Editor + Attachments

- Recipient chip input with contact search (queries profiles + participants), To/CC/BCC (CC/BCC collapsed)
- Reply / Reply All / Forward
- Rich text (bold, italic, underline, bullets, numbered, links) via lightweight contenteditable — no heavy editor dep
- Emoji picker (popover with curated set, no extra package)
- Drag-and-drop + file input, storage bucket `message-attachments`, per-file progress + preview + validation (25MB/file, PDF/img/docx/xlsx/pptx/mp4/mp3/zip)
- "Attach from MelaBridge" picker (contracts, invoices, timelines, seating, guest lists, galleries) — reads existing project resources
- Schedule: calendar + time + timezone + recurrence (none/daily/weekly/monthly) + "suggested send time"
- Save Draft / Preview / Schedule / Send Now / Cancel — all wired to backend
- Side panel: BridgeMind AI with Draft / Rewrite / Shorten / Expand / Friendly / Professional / Luxury / Urgent / Translate (Lovable AI Gateway, google/gemini-3-flash-preview via `createServerFn`)

### Phase 3 — Template Library v2 + Notifications v2

- Template library page: category tabs, search, filters, favorites, collections, recently used
- Card shows usage count, last edited, variables, category badge; actions: Preview / Edit / Duplicate / Share / Archive / Delete / Favorite / Version History
- BridgeMind Template Builder: prompt → generated template saved to library
- Notifications settings redesigned into 6 category groups (Messages, AI, Event Activity, Payments, Team, System) × 5 channels (In-App, Push, Email, SMS, Calendar), each with frequency + description
- Quiet Hours picker, Enable/Disable All, Reset to Defaults, Test Notification, notification history feed, per-event overrides, BridgeMind recommendations

### Phase 4 — AI polish, permissions, a11y, QA

- BridgeMind assists: suggested recipients/templates/attachments, conversation summarization, action-item extraction, unanswered detection, follow-up suggestions, payment reminder nudges — all as server functions
- Role gating via `useRole()`: Guests see only planner threads; Vendors see planner + team-authorized threads; Internal gets @mentions; Admin sees moderation surface
- Keyboard navigation (j/k, e archive, # delete, r reply), aria roles, focus rings, contrast pass
- Loading skeletons, empty states, success toasts, error boundaries
- Playwright pass across role sessions to verify no dead controls

### Technical notes

- All AI calls go through `createServerFn` + Lovable AI Gateway (`google/gemini-3-flash-preview`) — no client-side keys
- Storage bucket `message-attachments` (private, RLS by participant)
- Existing `scheduled_messages` and `notification_preferences` tables extended, not replaced
- Route stays `/messaging` — same shell for all roles; permissions gate features, not the page

### Starting now with Phase 1

I'll ship the migration + Inbox v2 in this turn. Reply "continue" after each phase to move to the next, or tell me to reorder/skip anything.

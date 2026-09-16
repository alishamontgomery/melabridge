---
name: Lead-gen terminology pass
description: Full audit replacing booking/contract/deposit/delivery language with lead-generation CRM language across the vendor portal
---

## Core model
MelaBridge is a lead-generation platform, NOT a booking marketplace.
- Vendors receive inquiries (leads) through their MelaBridge listing
- All conversations, proposals, and agreements happen DIRECTLY between vendor and client, outside the platform
- MelaBridge does NOT process payments, contracts, or deliverables

## Stage label changes (booking-stages.ts — display labels only, DB keys unchanged)
- "Contract Sent" → "Proposal Sent"
- "Contract Signed" → "Proposal Accepted"
- "Deposit Paid" → "Payment Arranged"
- "Booked" → "Confirmed"
- "In Progress" → "Event Day"
- CONFIRMATION_RULES labels updated to match

## Nav label changes (app-shell.tsx)
- Vendor nav: "Bookings" → "Leads"
- Vendor nav: "Booking Rules" → "Availability"
- Planner nav: "Bookings" → "My Vendors"

## Page/section renames
- bookings.index.tsx: "Client bookings" → "Lead Pipeline" (vendor); "Vendor bookings" → "My Vendors" (planner)
- bookings.$id.tsx: "Booking not found" → "Lead not found"; "All bookings" → "All leads"; "Cancel booking" → "Archive lead"
- vendor-portal.tsx: "Booked" status → "Confirmed"; description updated to remove booking language
- calendar.requests.tsx: "Booking Requests" → "Availability requests"
- vendor-settings.tsx: "Booking confirmation rules" → "Lead confirmation settings"
- settings.tsx: notification category labels updated
- calendar.dashboard.tsx: "confirmed bookings" → "confirmed events"
- calendar.settings.tsx: "booking requests" → "availability requests"
- marketplace.tsx: "Save to bookings" → "Save vendor"; "Saved to your bookings" → "Vendor saved to your list"

## bookings.$id.tsx — CRM reframing
- "Send quote" card → "Log quote sent" with explanation copy about off-platform communication
- "Deposit required" field removed entirely from quote card
- "Record deposit" card → "Log payment received" with explicit note that MelaBridge does NOT process payments
- Removed `depositReq` state variable and `depositCopy`/`depositTarget` computed values
- `waiting` variable always null (removed "Waiting for deposit/contract signature" logic)
- Toast messages: "Booking cancelled" → "Lead archived"; "Booking reopened" → "Lead reopened"

## Vendor dashboard (vendor.tsx)
- StatusBadge map: "Contract sent" → "Proposal sent", "Signed" → "Proposal accepted", "Deposit paid" → "Payment arranged", "Booked" → "Confirmed", "approved" → "Confirmed"
- Notification label: "booking requests" → "inquiries"
- MelaAssist prompts: "booking inquiry" → "inquiry"

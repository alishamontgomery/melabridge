/**
 * Deterministic starter templates per event type.
 *
 * Used two ways:
 * - As the fallback when the AI plan generation fails or is unavailable,
 *   so the workspace is NEVER blank after an event is created.
 * - As guidance shipped to the AI prompt (so its output stays sized to the
 *   event type).
 *
 * Everything is expressed as "days before event day" so it works even when
 * the event date changes later. Runsheet times are relative to a target
 * start hour so they render regardless of whether the user set one.
 */

export type TaskTemplate = {
  title: string;
  description?: string;
  priority: "low" | "medium" | "high" | "urgent";
  days_before: number;
  category?: string;
};

export type BudgetTemplate = {
  category: string;
  label: string;
  /** Fraction of total budget (0..1). Line items must sum to <= 1. */
  share: number;
  notes?: string;
};

export type RunsheetTemplate = {
  /** Minutes offset from event start (negative = setup before start). */
  offset_min: number;
  duration_min: number;
  title: string;
  owner?: string;
  notes?: string;
};

export type VendorNeedTemplate = {
  category: string;
  status: "required" | "recommended" | "optional";
  priority: number;
  notes?: string;
};

export type EventTemplate = {
  tasks: TaskTemplate[];
  budget: BudgetTemplate[];
  runsheet: RunsheetTemplate[];
  vendors: VendorNeedTemplate[];
};

// ---------- BIRTHDAY ----------
const BIRTHDAY: EventTemplate = {
  tasks: [
    { title: "Choose theme and color palette", priority: "high", days_before: 45, category: "Planning" },
    { title: "Set date and confirm venue availability", priority: "urgent", days_before: 45, category: "Venue" },
    { title: "Book venue if needed", priority: "high", days_before: 40, category: "Venue" },
    { title: "Draft guest list", priority: "high", days_before: 35, category: "Guests" },
    { title: "Send invitations", priority: "high", days_before: 28, category: "Guests" },
    { title: "Order birthday cake", priority: "high", days_before: 21, category: "Food" },
    { title: "Plan food and drinks menu", priority: "medium", days_before: 21, category: "Food" },
    { title: "Book entertainment or DJ", priority: "medium", days_before: 21, category: "Entertainment" },
    { title: "Order decorations and balloons", priority: "medium", days_before: 14, category: "Decor" },
    { title: "Purchase tableware and utensils", priority: "medium", days_before: 14, category: "Rentals" },
    { title: "Plan games and activities", priority: "low", days_before: 14, category: "Entertainment" },
    { title: "Purchase party favors", priority: "low", days_before: 10, category: "Favors" },
    { title: "Track RSVPs and follow up", priority: "medium", days_before: 10, category: "Guests" },
    { title: "Confirm all vendors", priority: "high", days_before: 7, category: "Vendors" },
    { title: "Buy candles and lighter", priority: "low", days_before: 5, category: "Supplies" },
    { title: "Arrange photo area or photo booth", priority: "low", days_before: 5, category: "Photography" },
    { title: "Pick up or confirm cake delivery", priority: "urgent", days_before: 1, category: "Food" },
    { title: "Set up venue and decorate", priority: "urgent", days_before: 0, category: "Setup" },
    { title: "Set up gift table", priority: "medium", days_before: 0, category: "Setup" },
    { title: "Complete day-of setup checklist", priority: "urgent", days_before: 0, category: "Setup" },
    { title: "Cleanup and pack up", priority: "medium", days_before: 0, category: "Teardown" },
    { title: "Send thank-you messages", priority: "low", days_before: -3, category: "Follow-up" },
  ],
  budget: [
    { category: "Venue", label: "Venue rental", share: 0.25 },
    { category: "Food & Beverage", label: "Food and drinks", share: 0.22 },
    { category: "Cake & Desserts", label: "Birthday cake and desserts", share: 0.08 },
    { category: "Decor", label: "Balloons and decorations", share: 0.10 },
    { category: "Entertainment", label: "DJ or entertainer", share: 0.12 },
    { category: "Photography", label: "Photography or photo booth", share: 0.08 },
    { category: "Invitations", label: "Invitations and stationery", share: 0.03 },
    { category: "Rentals", label: "Tableware and rentals", share: 0.05 },
    { category: "Favors", label: "Party favors", share: 0.04 },
    { category: "Contingency", label: "Miscellaneous / buffer", share: 0.03 },
  ],
  runsheet: [
    { offset_min: -120, duration_min: 60, title: "Vendor arrival & venue setup", owner: "Host" },
    { offset_min: -60, duration_min: 30, title: "Decorations, balloons, table settings", owner: "Host" },
    { offset_min: -30, duration_min: 15, title: "Sound & photo checks", owner: "Entertainment" },
    { offset_min: -15, duration_min: 15, title: "Final walk-through" },
    { offset_min: 0, duration_min: 30, title: "Guests arrive & welcome drinks" },
    { offset_min: 30, duration_min: 45, title: "Food service" },
    { offset_min: 75, duration_min: 30, title: "Games & activities" },
    { offset_min: 105, duration_min: 20, title: "Cake cutting & speeches" },
    { offset_min: 125, duration_min: 60, title: "Open floor, music, mingling" },
    { offset_min: 185, duration_min: 15, title: "Gift opening (optional)" },
    { offset_min: 200, duration_min: 20, title: "Guests depart, hand out favors" },
    { offset_min: 220, duration_min: 60, title: "Teardown & cleanup" },
  ],
  vendors: [
    { category: "Venue", status: "recommended", priority: 1 },
    { category: "Bakery", status: "required", priority: 1, notes: "Birthday cake" },
    { category: "Catering", status: "recommended", priority: 2 },
    { category: "Decor / Balloons", status: "required", priority: 2 },
    { category: "Entertainment", status: "recommended", priority: 3, notes: "DJ, host, or activity" },
    { category: "Photography", status: "recommended", priority: 3 },
    { category: "Photo Booth", status: "optional", priority: 4 },
  ],
};

// ---------- WEDDING ----------
const WEDDING: EventTemplate = {
  tasks: [
    { title: "Set wedding date and confirm both families", priority: "urgent", days_before: 300 },
    { title: "Set overall budget and split by category", priority: "urgent", days_before: 300 },
    { title: "Draft guest list (bride + groom sides)", priority: "high", days_before: 280 },
    { title: "Book venue for ceremony", priority: "urgent", days_before: 270 },
    { title: "Book venue for reception", priority: "urgent", days_before: 270 },
    { title: "Hire wedding planner or coordinator", priority: "high", days_before: 260 },
    { title: "Book photographer", priority: "high", days_before: 240 },
    { title: "Book videographer", priority: "high", days_before: 240 },
    { title: "Book caterer & confirm menu tasting", priority: "high", days_before: 210 },
    { title: "Book florist", priority: "high", days_before: 200 },
    { title: "Book DJ / band", priority: "high", days_before: 200 },
    { title: "Book officiant / priest / pandit", priority: "high", days_before: 200 },
    { title: "Send save-the-dates", priority: "high", days_before: 180 },
    { title: "Choose wedding party (bridesmaids/groomsmen)", priority: "medium", days_before: 180 },
    { title: "Shop for wedding outfits", priority: "high", days_before: 160 },
    { title: "Book hair & makeup artist", priority: "medium", days_before: 150 },
    { title: "Book transportation for wedding party", priority: "medium", days_before: 140 },
    { title: "Book accommodation blocks for out-of-town guests", priority: "medium", days_before: 130 },
    { title: "Order wedding invitations", priority: "high", days_before: 120 },
    { title: "Choose rings", priority: "high", days_before: 120 },
    { title: "Register for gifts", priority: "low", days_before: 120 },
    { title: "Plan honeymoon and book travel", priority: "medium", days_before: 100 },
    { title: "Send wedding invitations", priority: "high", days_before: 90 },
    { title: "Order wedding cake / desserts", priority: "medium", days_before: 90 },
    { title: "Book rentals (tables, chairs, mandap, linens)", priority: "medium", days_before: 90 },
    { title: "Plan sangeet / mehndi / rehearsal dinner", priority: "medium", days_before: 75 },
    { title: "Order decor items and centerpieces", priority: "medium", days_before: 60 },
    { title: "Finalize ceremony program", priority: "high", days_before: 60 },
    { title: "Finalize reception timeline", priority: "high", days_before: 45 },
    { title: "Follow up on RSVPs", priority: "high", days_before: 45 },
    { title: "Order welcome bags for out-of-town guests", priority: "low", days_before: 45 },
    { title: "Marriage license application", priority: "urgent", days_before: 30 },
    { title: "Final dress / suit fitting", priority: "high", days_before: 30 },
    { title: "Confirm all vendor contracts & arrival times", priority: "urgent", days_before: 21 },
    { title: "Create seating chart", priority: "high", days_before: 21 },
    { title: "Finalize menu counts with caterer", priority: "high", days_before: 14 },
    { title: "Prepare vendor tips and payment envelopes", priority: "high", days_before: 7 },
    { title: "Rehearsal ceremony walkthrough", priority: "urgent", days_before: 2 },
    { title: "Deliver welcome bags to hotel", priority: "medium", days_before: 1 },
    { title: "Ceremony setup & decor", priority: "urgent", days_before: 0 },
    { title: "Wedding day execution", priority: "urgent", days_before: 0 },
    { title: "Return rentals", priority: "medium", days_before: -3 },
    { title: "Send thank-you cards", priority: "medium", days_before: -30 },
  ],
  budget: [
    { category: "Venue", label: "Ceremony & reception venue", share: 0.30 },
    { category: "Catering", label: "Food & beverage service", share: 0.22 },
    { category: "Photography", label: "Photographer", share: 0.08 },
    { category: "Videography", label: "Videographer", share: 0.05 },
    { category: "Florals", label: "Florals, mandap, centerpieces", share: 0.08 },
    { category: "Music", label: "DJ / band / live musicians", share: 0.05 },
    { category: "Attire", label: "Bridal & groom outfits", share: 0.07 },
    { category: "Hair & Makeup", label: "Hair and makeup artists", share: 0.03 },
    { category: "Cake & Desserts", label: "Wedding cake & sweets", share: 0.02 },
    { category: "Invitations", label: "Save-the-dates & invitations", share: 0.02 },
    { category: "Transportation", label: "Wedding party transport", share: 0.02 },
    { category: "Rentals", label: "Tables, chairs, linens, mandap", share: 0.03 },
    { category: "Favors", label: "Guest favors & welcome bags", share: 0.01 },
    { category: "Contingency", label: "Buffer / miscellaneous", share: 0.02 },
  ],
  runsheet: [
    { offset_min: -240, duration_min: 60, title: "Vendor arrivals & load-in", owner: "Planner" },
    { offset_min: -180, duration_min: 90, title: "Bridal hair & makeup", owner: "H&M team" },
    { offset_min: -180, duration_min: 60, title: "Ceremony setup: mandap / arch / seating", owner: "Decor" },
    { offset_min: -120, duration_min: 60, title: "Groom prep & photography", owner: "Photographer" },
    { offset_min: -90, duration_min: 60, title: "Florist installs bouquets & centerpieces", owner: "Florist" },
    { offset_min: -60, duration_min: 30, title: "First look & couple portraits", owner: "Photographer" },
    { offset_min: -30, duration_min: 30, title: "Guest arrivals & welcome drinks", owner: "Ushers" },
    { offset_min: 0, duration_min: 60, title: "Ceremony", owner: "Officiant" },
    { offset_min: 60, duration_min: 45, title: "Family & group photos", owner: "Photographer" },
    { offset_min: 60, duration_min: 45, title: "Cocktail hour", owner: "Bar" },
    { offset_min: 105, duration_min: 15, title: "Guests seated for reception", owner: "Ushers" },
    { offset_min: 120, duration_min: 15, title: "Grand entrance & first dance", owner: "DJ" },
    { offset_min: 135, duration_min: 60, title: "Dinner service", owner: "Catering" },
    { offset_min: 195, duration_min: 30, title: "Speeches & toasts", owner: "MC" },
    { offset_min: 225, duration_min: 15, title: "Cake cutting", owner: "Catering" },
    { offset_min: 240, duration_min: 90, title: "Open dance floor", owner: "DJ" },
    { offset_min: 330, duration_min: 15, title: "Send-off", owner: "Planner" },
    { offset_min: 345, duration_min: 90, title: "Teardown & load-out", owner: "Planner" },
  ],
  vendors: [
    { category: "Venue", status: "required", priority: 1 },
    { category: "Catering", status: "required", priority: 1 },
    { category: "Photography", status: "required", priority: 1 },
    { category: "Videography", status: "recommended", priority: 2 },
    { category: "Florist", status: "required", priority: 2 },
    { category: "DJ / Music", status: "required", priority: 2 },
    { category: "Officiant / Priest", status: "required", priority: 1 },
    { category: "Hair & Makeup", status: "required", priority: 2 },
    { category: "Bakery", status: "required", priority: 2, notes: "Wedding cake" },
    { category: "Transportation", status: "recommended", priority: 3 },
    { category: "Rentals", status: "recommended", priority: 3 },
    { category: "Decor", status: "recommended", priority: 3 },
    { category: "Wedding Planner", status: "recommended", priority: 2 },
    { category: "Mehndi Artist", status: "optional", priority: 4 },
  ],
};

// ---------- CORPORATE ----------
const CORPORATE: EventTemplate = {
  tasks: [
    { title: "Define event goals and success metrics", priority: "urgent", days_before: 120 },
    { title: "Set budget and get approvals", priority: "urgent", days_before: 110 },
    { title: "Pick venue and confirm availability", priority: "high", days_before: 100 },
    { title: "Book venue", priority: "urgent", days_before: 90 },
    { title: "Book AV production team", priority: "high", days_before: 75 },
    { title: "Confirm keynote and speakers", priority: "high", days_before: 75 },
    { title: "Book catering", priority: "high", days_before: 60 },
    { title: "Order branded signage and swag", priority: "medium", days_before: 45 },
    { title: "Launch registration / RSVP page", priority: "high", days_before: 45 },
    { title: "Send invitations", priority: "high", days_before: 40 },
    { title: "Build agenda and run-of-show", priority: "high", days_before: 30 },
    { title: "Brief speakers and share slide deck template", priority: "medium", days_before: 21 },
    { title: "Print name badges and materials", priority: "medium", days_before: 10 },
    { title: "Final vendor walkthrough", priority: "urgent", days_before: 5 },
    { title: "Event day execution", priority: "urgent", days_before: 0 },
    { title: "Send thank-you and feedback survey", priority: "medium", days_before: -3 },
    { title: "Reconcile invoices and expenses", priority: "medium", days_before: -14 },
  ],
  budget: [
    { category: "Venue", label: "Venue rental & AV package", share: 0.30 },
    { category: "Catering", label: "Meals, breaks, beverages", share: 0.22 },
    { category: "AV / Production", label: "Stage, sound, lighting, tech crew", share: 0.15 },
    { category: "Speakers", label: "Speaker fees & travel", share: 0.10 },
    { category: "Marketing", label: "Signage, branding, swag", share: 0.08 },
    { category: "Registration", label: "Platform & badges", share: 0.03 },
    { category: "Photography", label: "Event photography / video", share: 0.05 },
    { category: "Transportation", label: "Shuttles & VIP transport", share: 0.04 },
    { category: "Contingency", label: "Buffer", share: 0.03 },
  ],
  runsheet: [
    { offset_min: -180, duration_min: 90, title: "AV load-in & stage setup", owner: "Production" },
    { offset_min: -90, duration_min: 45, title: "Speaker sound check", owner: "Production" },
    { offset_min: -45, duration_min: 30, title: "Registration opens", owner: "Ops" },
    { offset_min: 0, duration_min: 15, title: "Opening remarks", owner: "MC" },
    { offset_min: 15, duration_min: 60, title: "Keynote session", owner: "Speaker" },
    { offset_min: 75, duration_min: 30, title: "Networking break", owner: "Catering" },
    { offset_min: 105, duration_min: 90, title: "Panel discussions", owner: "MC" },
    { offset_min: 195, duration_min: 60, title: "Lunch", owner: "Catering" },
    { offset_min: 255, duration_min: 90, title: "Breakout sessions", owner: "Ops" },
    { offset_min: 345, duration_min: 30, title: "Closing keynote", owner: "Speaker" },
    { offset_min: 375, duration_min: 60, title: "Networking reception", owner: "Bar" },
    { offset_min: 435, duration_min: 90, title: "Teardown", owner: "Production" },
  ],
  vendors: [
    { category: "Venue", status: "required", priority: 1 },
    { category: "AV / Production", status: "required", priority: 1 },
    { category: "Catering", status: "required", priority: 1 },
    { category: "Photography", status: "recommended", priority: 2 },
    { category: "Videography / Live Stream", status: "recommended", priority: 2 },
    { category: "Signage & Print", status: "recommended", priority: 3 },
    { category: "Transportation", status: "optional", priority: 4 },
    { category: "Swag / Gifting", status: "optional", priority: 4 },
  ],
};

// ---------- GENERIC (fallback) ----------
const GENERIC: EventTemplate = {
  tasks: [
    { title: "Confirm date, venue, and headcount", priority: "urgent", days_before: 60 },
    { title: "Set budget and category splits", priority: "high", days_before: 55 },
    { title: "Build guest list", priority: "high", days_before: 45 },
    { title: "Send invitations", priority: "high", days_before: 30 },
    { title: "Book food & beverage", priority: "high", days_before: 30 },
    { title: "Book entertainment or music", priority: "medium", days_before: 25 },
    { title: "Order decor & signage", priority: "medium", days_before: 20 },
    { title: "Follow up on RSVPs", priority: "medium", days_before: 14 },
    { title: "Confirm all vendors and arrival times", priority: "urgent", days_before: 7 },
    { title: "Finalize run-of-show", priority: "high", days_before: 3 },
    { title: "Event day setup and execution", priority: "urgent", days_before: 0 },
    { title: "Cleanup and vendor payouts", priority: "medium", days_before: 0 },
    { title: "Thank-you follow-ups", priority: "low", days_before: -5 },
  ],
  budget: [
    { category: "Venue", label: "Venue rental", share: 0.28 },
    { category: "Food & Beverage", label: "Food and drinks", share: 0.28 },
    { category: "Entertainment", label: "Music / entertainment", share: 0.12 },
    { category: "Decor", label: "Decor and signage", share: 0.10 },
    { category: "Photography", label: "Photography / video", share: 0.08 },
    { category: "Invitations", label: "Invitations & stationery", share: 0.03 },
    { category: "Rentals", label: "Tables, chairs, linens", share: 0.06 },
    { category: "Contingency", label: "Buffer / miscellaneous", share: 0.05 },
  ],
  runsheet: [
    { offset_min: -120, duration_min: 60, title: "Vendor arrivals & setup", owner: "Host" },
    { offset_min: -60, duration_min: 45, title: "Decor & final walk-through" },
    { offset_min: -15, duration_min: 15, title: "Team huddle & briefing" },
    { offset_min: 0, duration_min: 30, title: "Guests arrive & welcome" },
    { offset_min: 30, duration_min: 60, title: "Program / activities" },
    { offset_min: 90, duration_min: 45, title: "Food service" },
    { offset_min: 135, duration_min: 60, title: "Open floor / music" },
    { offset_min: 195, duration_min: 15, title: "Closing remarks" },
    { offset_min: 210, duration_min: 60, title: "Teardown & cleanup" },
  ],
  vendors: [
    { category: "Venue", status: "recommended", priority: 1 },
    { category: "Catering", status: "recommended", priority: 1 },
    { category: "Entertainment", status: "recommended", priority: 2 },
    { category: "Decor", status: "recommended", priority: 2 },
    { category: "Photography", status: "optional", priority: 3 },
    { category: "Rentals", status: "optional", priority: 3 },
  ],
};

const TEMPLATES: Record<string, EventTemplate> = {
  wedding: WEDDING,
  birthday: BIRTHDAY,
  "birthday party": BIRTHDAY,
  corporate: CORPORATE,
  "corporate event": CORPORATE,
  gala: CORPORATE,
  fundraiser: CORPORATE,
  conference: CORPORATE,
  "baby shower": BIRTHDAY,
  "bridal shower": BIRTHDAY,
  "engagement": WEDDING,
  "engagement party": WEDDING,
  anniversary: BIRTHDAY,
  graduation: BIRTHDAY,
  reunion: BIRTHDAY,
  "school event": BIRTHDAY,
  "community event": BIRTHDAY,
  sangeet: WEDDING,
  mehndi: WEDDING,
  festival: BIRTHDAY,
};

export function getEventTemplate(eventType: string | null | undefined): EventTemplate {
  if (!eventType) return GENERIC;
  const key = eventType.trim().toLowerCase();
  return TEMPLATES[key] ?? GENERIC;
}

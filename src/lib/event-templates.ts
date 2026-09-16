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
import { EVENT_TEMPLATE_EXPANSIONS } from "./event-template-expansions";

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
    { category: "Contingency", label: "Contingency reserve", share: 0.03 },
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
  ...EVENT_TEMPLATE_EXPANSIONS,
};

export function getEventTemplate(eventType: string | null | undefined): EventTemplate {
  if (!eventType) return GENERIC;
  const key = eventType.trim().toLowerCase();
  return TEMPLATES[key] ?? GENERIC;
}

// ---------- SHOPPING LISTS ----------
export type ShoppingTemplate = { category: string; item: string; quantity?: string; notes?: string };

const SHOPPING_WEDDING: ShoppingTemplate[] = [
  { category: "Ceremony", item: "Marriage certificate holder", quantity: "1" },
  { category: "Ceremony", item: "Ring pillow or box", quantity: "1" },
  { category: "Ceremony", item: "Aisle flower petals", quantity: "As needed" },
  { category: "Reception", item: "Guest book & pens", quantity: "1 book, 3 pens" },
  { category: "Reception", item: "Card / gift box", quantity: "1" },
  { category: "Reception", item: "Table numbers & holders", quantity: "1 per table" },
  { category: "Reception", item: "Place cards", quantity: "1 per guest" },
  { category: "Reception", item: "Cake knife & server set", quantity: "1" },
  { category: "Reception", item: "Toast flutes", quantity: "1 per head-table seat" },
  { category: "Attire", item: "Emergency kit (pins, tape, stain pen)", quantity: "1" },
  { category: "Attire", item: "Comfortable second pair of shoes", quantity: "1" },
  { category: "Favors", item: "Guest favors", quantity: "1 per guest" },
  { category: "Welcome", item: "Welcome bag contents", quantity: "1 per hotel room" },
  { category: "Day-of", item: "Tips envelopes labeled per vendor", quantity: "1 per vendor" },
];

const SHOPPING_BIRTHDAY: ShoppingTemplate[] = [
  { category: "Decor", item: "Balloons + helium", quantity: "1 arch or 30 balloons" },
  { category: "Decor", item: "Banner or backdrop", quantity: "1" },
  { category: "Decor", item: "Centerpieces", quantity: "1 per table" },
  { category: "Cake", item: "Candles + lighter", quantity: "1 set" },
  { category: "Cake", item: "Cake stand & knife", quantity: "1" },
  { category: "Tableware", item: "Plates, cups, napkins, cutlery", quantity: "1.25× guest count" },
  { category: "Tableware", item: "Tablecloths", quantity: "1 per table" },
  { category: "Activities", item: "Games or activity supplies", quantity: "As planned" },
  { category: "Favors", item: "Party favors / goodie bags", quantity: "1 per guest" },
  { category: "Photo", item: "Photo backdrop / props", quantity: "1 set" },
];

const SHOPPING_CORPORATE: ShoppingTemplate[] = [
  { category: "Registration", item: "Printed name badges + lanyards", quantity: "1 per attendee" },
  { category: "Registration", item: "Check-in table signage", quantity: "1" },
  { category: "Materials", item: "Printed agendas / programs", quantity: "1 per attendee" },
  { category: "Materials", item: "Notepads & pens", quantity: "1 per attendee" },
  { category: "Branding", item: "Branded backdrop / step & repeat", quantity: "1" },
  { category: "Branding", item: "Signage (directional, room names)", quantity: "As needed" },
  { category: "Swag", item: "Attendee gifts / swag", quantity: "1 per attendee" },
  { category: "AV", item: "Presenter clickers + spare batteries", quantity: "2 sets" },
  { category: "Catering", item: "Water bottles for stage / speakers", quantity: "1 per speaker slot" },
];

const SHOPPING_GENERIC: ShoppingTemplate[] = [
  { category: "Decor", item: "Basic decor / centerpieces", quantity: "1 per table" },
  { category: "Tableware", item: "Plates, cups, napkins, cutlery", quantity: "1.25× guest count" },
  { category: "Signage", item: "Welcome sign", quantity: "1" },
  { category: "Day-of", item: "Trash bags & cleanup supplies", quantity: "1 pack" },
  { category: "Day-of", item: "First aid kit", quantity: "1" },
  { category: "Photo", item: "Backup phone charger / cables", quantity: "2" },
];

const SHOPPING_BY_KEY: Record<string, ShoppingTemplate[]> = {
  wedding: SHOPPING_WEDDING,
  sangeet: SHOPPING_WEDDING,
  mehndi: SHOPPING_WEDDING,
  engagement: SHOPPING_WEDDING,
  "engagement party": SHOPPING_WEDDING,
  birthday: SHOPPING_BIRTHDAY,
  "birthday party": SHOPPING_BIRTHDAY,
  "baby shower": SHOPPING_BIRTHDAY,
  "bridal shower": SHOPPING_BIRTHDAY,
  anniversary: SHOPPING_BIRTHDAY,
  graduation: SHOPPING_BIRTHDAY,
  reunion: SHOPPING_BIRTHDAY,
  festival: SHOPPING_BIRTHDAY,
  "school event": SHOPPING_BIRTHDAY,
  "community event": SHOPPING_BIRTHDAY,
  "private celebration": SHOPPING_BIRTHDAY,
  corporate: SHOPPING_CORPORATE,
  "corporate event": SHOPPING_CORPORATE,
  gala: SHOPPING_CORPORATE,
  fundraiser: SHOPPING_CORPORATE,
  conference: SHOPPING_CORPORATE,
};

export function getShoppingTemplate(eventType: string | null | undefined): ShoppingTemplate[] {
  if (!eventType) return SHOPPING_GENERIC;
  return SHOPPING_BY_KEY[eventType.trim().toLowerCase()] ?? SHOPPING_GENERIC;
}

// ---------- INVITATION GUIDANCE ----------
const INVITE_BY_KEY: Record<string, string> = {
  wedding:
    "Send Save-the-Dates about 6 months out (digital is fine), then formal invitations about 10 weeks before. Include ceremony + reception times, dress code, RSVP link, hotel block, and a wedding website URL. Follow up personally with anyone who hasn't RSVP'd 3 weeks out.",
  birthday:
    "Send digital invitations 3–4 weeks in advance (Paperless Post, Punchbowl, or a simple RSVP link). Include theme, drop-off / pick-up expectations for kids' events, and any allergy notes. Send a reminder 3 days before.",
  corporate:
    "Open registration 6–8 weeks out with a branded landing page + calendar hold. Send a personalized reminder 2 weeks out, a logistics email (parking, badges, agenda) 3 days out, and a same-day 'we're excited to see you' note.",
  "baby shower":
    "Send invitations 4–6 weeks in advance. Include the registry link, dress code, and whether it's co-ed. Send a reminder 1 week out with parking and any planned games.",
  graduation:
    "Send invitations 3–4 weeks out. Confirm the venue's guest cap first — many ceremonies limit tickets. For the party, follow up 1 week out with parking + timing.",
  gala:
    "Send formal invitations 8 weeks out with an early-bird ticket tier. Follow up with sponsors individually and send a final registration push 1 week out.",
  fundraiser:
    "Announce 8 weeks out with a compelling ask and matching-gift info. Send tiered email sequences (announce → early-bird close → last week → last day). Personal outreach converts best.",
  "bridal shower":
    "Send invitations 6–8 weeks out with the registry link, RSVP deadline, dress guidance, and whether the shower is co-ed. Follow up 10 days before with parking, dietary, and gift-opening details.",
  "engagement party":
    "Send invitations 6–8 weeks out with the RSVP deadline, dress code, parking, and whether guests should expect a cash bar or hosted drinks. Send a final logistics note one week before.",
  "anniversary celebration":
    "Send invitations 8–10 weeks out with the milestone being celebrated, RSVP deadline, dress code, and meal details. Ask guests to submit memories or photos before the tribute deadline.",
  "retirement party":
    "Send invitations 6–8 weeks out with RSVP and dietary questions. Include parking and accessibility information, and ask invitees to submit a short memory or photo for the honoree's tribute.",
  "holiday party":
    "Send invitations 6–8 weeks out with the holiday theme, RSVP deadline, dress code, gift-exchange rules, dietary questions, and transportation or parking details. Send one reminder one week before.",
  "fundraiser or gala":
    "Open registration 8–12 weeks out with the mission story, ticket levels, sponsor recognition, dress code, accessibility, and parking. Send a final reminder one week before and a donor follow-up after the event.",
  "conference or networking event":
    "Open registration 8–12 weeks out with the agenda, speaker list, ticket deadline, parking or transit, accessibility, and dietary questions. Send logistics and calendar reminders two weeks and three days before.",
  "school event or prom":
    "Open ticket sales 8–10 weeks out with permission requirements, dress code, arrival and pickup rules, parking, accessibility, and the RSVP deadline. Send students and families a final safety and logistics reminder one week before.",
  quinceañera:
    "Send save-the-dates about 6 months out, then formal invitations 10–12 weeks before with ceremony and reception locations, RSVP deadline, dress guidance, and transportation details. Confirm church and family requirements separately.",
  "dinner party":
    "Send invitations 3–4 weeks out with the menu style, RSVP deadline, dietary questions, dress guidance, parking, and accessibility details. Confirm final portions and seating one week before.",
};

export function getInvitationGuidance(eventType: string | null | undefined): string {
  const fallback =
    "Send invitations 4–6 weeks in advance with a clear RSVP deadline. Include date, time, location, dress code, and any special notes (gifts, dietary preferences). Send one reminder 1 week before to boost response rates.";
  if (!eventType) return fallback;
  const key = eventType.trim().toLowerCase();
  return INVITE_BY_KEY[key] ?? fallback;
}


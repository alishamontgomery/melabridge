// Category-specific structured fields for the package builder.
// Rendered as an additional section for service categories that benefit from
// structured package details. Fields remain optional so vendors are never
// forced to answer irrelevant questions.
//
// Field kinds:
//  number          – numeric input with optional unit suffix
//  chips           – multi-select chip list from a fixed options array
//  toggle          – boolean switch
//  text            – single-line text input
//  backdrop_picker – selects URLs from the vendor's uploaded portfolio photos

export type CatFieldKind =
  | "number"
  | "chips"
  | "toggle"
  | "text"
  | "backdrop_picker";

export type CatFieldDef = {
  key: string;
  label: string;
  kind: CatFieldKind;
  /** chips: selectable options */
  options?: string[];
  /** number | text: placeholder shown inside input */
  placeholder?: string;
  /** number: unit label shown inside the right edge of the input */
  suffix?: string;
  /** Show this field only when another field equals a specific value */
  showWhen?: { key: string; value: unknown };
};

export type CategoryFieldSpec = {
  fields: CatFieldDef[];
  /** Up to 3 field keys whose values appear as summary chips on the package card. */
  summaryKeys: string[];
};

// ---------------------------------------------------------------------------
// Specs — 11 special vendor categories
// ---------------------------------------------------------------------------

const CATEGORY_FIELD_SPECS: Record<string, CategoryFieldSpec> = {

  // ── Venue ──────────────────────────────────────────────────────────────────
  Venue: {
    fields: [
      {
        key: "min_guests",
        label: "Minimum guests",
        kind: "number",
        placeholder: "50",
        suffix: "guests",
      },
      {
        key: "max_guests",
        label: "Maximum guests",
        kind: "number",
        placeholder: "300",
        suffix: "guests",
      },
      {
        key: "hours_included",
        label: "Hours included",
        kind: "number",
        placeholder: "8",
        suffix: "hrs",
      },
      {
        key: "space_types",
        label: "Space types",
        kind: "chips",
        options: [
          "Indoor",
          "Outdoor",
          "Tented",
          "Rooftop",
          "Garden",
          "Waterfront",
          "Ballroom",
          "Private dining",
        ],
      },
      {
        key: "catering_policy",
        label: "Catering policy",
        kind: "chips",
        options: [
          "In-house catering",
          "Outside catering allowed",
          "Alcohol license included",
          "BYOB allowed",
        ],
      },
    ],
    summaryKeys: ["max_guests", "space_types"],
  },

  // ── DJ ─────────────────────────────────────────────────────────────────────
  DJ: {
    fields: [
      {
        key: "hours_included",
        label: "Hours included",
        kind: "number",
        placeholder: "6",
        suffix: "hrs",
      },
      {
        key: "travel_radius_km",
        label: "Travel radius",
        kind: "number",
        placeholder: "50",
        suffix: "km",
      },
      {
        key: "set_types",
        label: "Event coverage",
        kind: "chips",
        options: [
          "Ceremony",
          "Cocktail hour",
          "Reception",
          "After-party",
          "Dinner hour",
        ],
      },
    ],
    summaryKeys: ["hours_included", "set_types"],
  },

  // ── Photo Booth ─────────────────────────────────────────────────────────────
  "Photo Booth": {
    fields: [
      {
        key: "hours_included",
        label: "Hours of rental",
        kind: "number",
        placeholder: "3",
        suffix: "hrs",
      },
      {
        key: "booth_style",
        label: "Booth style",
        kind: "chips",
        options: [
          "Open air",
          "Enclosed",
          "Mirror booth",
          "360° video",
          "Boomerang / GIF",
          "AI photo booth",
          "Selfie station",
        ],
      },
      {
        key: "print_sizes",
        label: "Print sizes offered",
        kind: "chips",
        options: [
          "2×6 strip",
          "4×6",
          "5×7",
          "6×8",
          "8×10",
          "Digital only",
          "Custom format",
        ],
      },
      {
        key: "prints_unlimited",
        label: "Unlimited prints per session",
        kind: "toggle",
      },
      {
        key: "backdrop_from_profile",
        label: "Available backdrops (from your profile uploads)",
        kind: "backdrop_picker",
      },
      {
        key: "custom_backdrop_available",
        label: "Custom backdrop available on request",
        kind: "toggle",
      },
      {
        key: "custom_backdrop_details",
        label: "Custom backdrop details / pricing",
        kind: "text",
        placeholder: "e.g. Custom printed vinyl, pricing on request",
        showWhen: { key: "custom_backdrop_available", value: true },
      },
    ],
    summaryKeys: ["hours_included", "booth_style"],
  },

  // ── Balloon Artist ──────────────────────────────────────────────────────────
  "Balloon Artist": {
    fields: [
      {
        key: "setup_types",
        label: "Installation styles",
        kind: "chips",
        options: [
          "Arch",
          "Column",
          "Bouquet",
          "Ceiling installation",
          "Table arrangement",
          "Backdrop",
          "Garland",
          "Balloon wall",
        ],
      },
      {
        key: "setup_hours",
        label: "Setup hours included",
        kind: "number",
        placeholder: "2",
        suffix: "hrs",
      },
      {
        key: "delivery_setup_included",
        label: "Delivery & setup included",
        kind: "toggle",
      },
      {
        key: "latex_free",
        label: "Latex-free options available",
        kind: "toggle",
      },
    ],
    summaryKeys: ["setup_types", "delivery_setup_included"],
  },

  // ── Caterer ─────────────────────────────────────────────────────────────────
  Caterer: {
    fields: [
      {
        key: "service_style",
        label: "Service style",
        kind: "chips",
        options: [
          "Buffet",
          "Plated dinner",
          "Food stations",
          "Cocktail style",
          "Family style",
          "Grazing table",
        ],
      },
      {
        key: "min_guests",
        label: "Minimum guests",
        kind: "number",
        placeholder: "30",
        suffix: "guests",
      },
      {
        key: "max_guests",
        label: "Maximum guests",
        kind: "number",
        placeholder: "300",
        suffix: "guests",
      },
      {
        key: "dietary_options",
        label: "Dietary options",
        kind: "chips",
        options: [
          "Halal",
          "Vegan",
          "Vegetarian",
          "Gluten-free",
          "Kosher",
          "Nut-free",
          "Dairy-free",
        ],
      },
      {
        key: "bar_service",
        label: "Bar service included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["service_style", "max_guests"],
  },

  // ── Bartender ───────────────────────────────────────────────────────────────
  Bartender: {
    fields: [
      {
        key: "service_style",
        label: "Bar service style",
        kind: "chips",
        options: [
          "Full bar",
          "Beer & wine",
          "Signature cocktails",
          "Mocktail service",
          "Champagne service",
        ],
      },
      {
        key: "min_guests",
        label: "Minimum guests",
        kind: "number",
        placeholder: "30",
        suffix: "guests",
      },
      {
        key: "max_guests",
        label: "Maximum guests",
        kind: "number",
        placeholder: "200",
        suffix: "guests",
      },
      {
        key: "hours_included",
        label: "Hours included",
        kind: "number",
        placeholder: "5",
        suffix: "hrs",
      },
      {
        key: "staff_count",
        label: "Bartenders included",
        kind: "number",
        placeholder: "2",
        suffix: "staff",
      },
      {
        key: "alcohol_provided",
        label: "Alcohol included",
        kind: "toggle",
      },
      {
        key: "bar_setup_included",
        label: "Bar setup included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["service_style", "max_guests", "hours_included"],
  },

  // ── Hair & Makeup ───────────────────────────────────────────────────────────
  "Hair & Makeup": {
    fields: [
      {
        key: "service_types",
        label: "Service types",
        kind: "chips",
        options: [
          "Bridal hair",
          "Bridal makeup",
          "Event hair",
          "Event makeup",
          "Blowout",
          "Touch-ups",
          "Trial session",
        ],
      },
      {
        key: "people_served",
        label: "People included",
        kind: "number",
        placeholder: "1",
        suffix: "people",
      },
      {
        key: "hours_included",
        label: "Hours included",
        kind: "number",
        placeholder: "3",
        suffix: "hrs",
      },
      {
        key: "on_site",
        label: "On-site service",
        kind: "toggle",
      },
      {
        key: "trial_included",
        label: "Trial included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["service_types", "people_served", "hours_included"],
  },

  // ── Baker ───────────────────────────────────────────────────────────────────
  Baker: {
    fields: [
      {
        key: "num_tiers",
        label: "Number of tiers",
        kind: "number",
        placeholder: "3",
      },
      {
        key: "num_servings",
        label: "Number of servings",
        kind: "number",
        placeholder: "100",
      },
      {
        key: "flavours",
        label: "Flavours",
        kind: "chips",
        options: [
          "Vanilla",
          "Chocolate",
          "Red velvet",
          "Lemon",
          "Carrot",
          "Funfetti",
          "Marble",
          "Custom",
        ],
      },
      {
        key: "dietary_options",
        label: "Dietary options",
        kind: "chips",
        options: [
          "Gluten-free",
          "Vegan",
          "Nut-free",
          "Dairy-free",
          "Egg-free",
        ],
      },
      {
        key: "delivery_setup",
        label: "Delivery & setup included",
        kind: "toggle",
      },
      {
        key: "tasting_consultation",
        label: "Tasting consultation included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["num_tiers", "num_servings"],
  },

  // ── Food Truck ──────────────────────────────────────────────────────────────
  "Food Truck": {
    fields: [
      {
        key: "hours_on_site",
        label: "Hours on-site",
        kind: "number",
        placeholder: "4",
        suffix: "hrs",
      },
      {
        key: "min_guests",
        label: "Minimum guests",
        kind: "number",
        placeholder: "50",
        suffix: "guests",
      },
      {
        key: "travel_radius_km",
        label: "Travel radius",
        kind: "number",
        placeholder: "40",
        suffix: "km",
      },
      {
        key: "menu_style",
        label: "Cuisine style",
        kind: "chips",
        options: [
          "Tacos & Mexican",
          "BBQ",
          "Gourmet burgers",
          "Mediterranean",
          "Asian fusion",
          "Desserts & sweets",
          "Pizza",
          "Brunch",
          "Vegan",
        ],
      },
    ],
    summaryKeys: ["hours_on_site", "menu_style"],
  },

  // ── Officiant ───────────────────────────────────────────────────────────────
  Officiant: {
    fields: [
      {
        key: "ceremony_types",
        label: "Ceremony types",
        kind: "chips",
        options: [
          "Civil",
          "Religious-inspired",
          "Non-denominational",
          "Interfaith",
          "South Asian",
          "Renewal of vows",
          "Elopement",
        ],
      },
      {
        key: "travel_radius_km",
        label: "Travel radius",
        kind: "number",
        placeholder: "80",
        suffix: "km",
      },
      {
        key: "rehearsal_included",
        label: "Rehearsal included",
        kind: "toggle",
      },
      {
        key: "vow_writing_assistance",
        label: "Vow writing assistance",
        kind: "toggle",
      },
    ],
    summaryKeys: ["ceremony_types"],
  },

  // ── MC ──────────────────────────────────────────────────────────────────────
  MC: {
    fields: [
      {
        key: "hours_included",
        label: "Hours included",
        kind: "number",
        placeholder: "5",
        suffix: "hrs",
      },
      {
        key: "style",
        label: "Hosting style",
        kind: "chips",
        options: [
          "Formal & elegant",
          "Upbeat & energetic",
          "Bilingual",
          "Comedy-forward",
          "Heartfelt",
        ],
      },
      {
        key: "coordination_call_included",
        label: "Pre-event coordination call included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["hours_included", "style"],
  },

  // ── Security ────────────────────────────────────────────────────────────────
  Security: {
    fields: [
      {
        key: "num_guards",
        label: "Number of guards",
        kind: "number",
        placeholder: "2",
      },
      {
        key: "hours",
        label: "Hours on-site",
        kind: "number",
        placeholder: "8",
        suffix: "hrs",
      },
      {
        key: "armed_unarmed",
        label: "Guard type",
        kind: "chips",
        options: ["Unarmed", "Armed"],
      },
      {
        key: "event_types",
        label: "Event types",
        kind: "chips",
        options: [
          "Private party",
          "Corporate event",
          "Outdoor festival",
          "VIP event",
          "Wedding",
        ],
      },
      {
        key: "parking_monitoring",
        label: "Parking monitoring included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["num_guards", "hours"],
  },

  // ── Transportation ──────────────────────────────────────────────────────────
  Transportation: {
    fields: [
      {
        key: "vehicle_types",
        label: "Vehicle types",
        kind: "chips",
        options: [
          "Sedan",
          "SUV limo",
          "Stretch limo",
          "Sprinter van",
          "Party bus",
          "Classic car",
          "Coach bus",
          "Trolley",
        ],
      },
      {
        key: "hours_included",
        label: "Hours included",
        kind: "number",
        placeholder: "4",
        suffix: "hrs",
      },
      {
        key: "passenger_capacity",
        label: "Passenger capacity",
        kind: "number",
        placeholder: "14",
      },
      {
        key: "decoration",
        label: "Decoration included",
        kind: "toggle",
      },
      {
        key: "champagne_service",
        label: "Champagne service included",
        kind: "toggle",
      },
    ],
    summaryKeys: ["vehicle_types", "hours_included"],
  },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Look up the field spec for a vendor category (case-insensitive). Returns null for categories without a spec. */
export function getCategorySpec(
  category: string | null | undefined
): CategoryFieldSpec | null {
  if (!category) return null;
  const aliases: Record<string, string> = {
    catering: "Caterer",
    bartender: "Bartender",
    bartending: "Bartender",
    "hair stylist": "Hair & Makeup",
    hairstylist: "Hair & Makeup",
  };
  const normalized = category.trim().toLowerCase();
  const canonical = aliases[normalized] ?? category.trim();
  const key = Object.keys(CATEGORY_FIELD_SPECS).find(
    (k) => k.toLowerCase() === canonical.toLowerCase()
  );
  return key ? CATEGORY_FIELD_SPECS[key] : null;
}

/** Format category field values into 0–3 human-readable summary strings for the package card. */
export function formatCategoryFieldSummary(
  categoryFields: Record<string, unknown>,
  spec: CategoryFieldSpec
): string[] {
  const chips: string[] = [];

  for (const key of spec.summaryKeys) {
    const val = categoryFields[key];
    if (val == null || val === "" || val === false) continue;

    const fieldDef = spec.fields.find((f) => f.key === key);
    if (!fieldDef) continue;

    if (fieldDef.kind === "number") {
      const n = Number(val);
      if (!isNaN(n) && n > 0) {
        if (key === "max_guests") chips.push(`Up to ${n} guests`);
        else if (key === "min_guests") chips.push(`Min ${n} guests`);
        else if (key === "num_guards") chips.push(`${n} guard${n !== 1 ? "s" : ""}`);
        else if (key === "num_tiers") chips.push(`${n}-tier`);
        else if (key === "num_servings") chips.push(`${n} servings`);
        else if (key === "passenger_capacity") chips.push(`${n} passengers`);
        else if (fieldDef.suffix) chips.push(`${n} ${fieldDef.suffix}`);
        else chips.push(String(n));
      }
    } else if (fieldDef.kind === "chips") {
      const arr = Array.isArray(val) ? (val as string[]) : [];
      if (arr.length > 0) {
        chips.push(arr.slice(0, 2).join(" · "));
      }
    } else if (fieldDef.kind === "toggle" && val === true) {
      chips.push(fieldDef.label);
    } else if (fieldDef.kind === "backdrop_picker") {
      const arr = Array.isArray(val) ? (val as string[]) : [];
      if (arr.length > 0) {
        chips.push(`${arr.length} backdrop${arr.length !== 1 ? "s" : ""}`);
      }
    } else if (fieldDef.kind === "text") {
      if (typeof val === "string" && val.trim()) {
        chips.push(val.trim().slice(0, 30));
      }
    }

    if (chips.length >= 3) break;
  }

  return chips;
}

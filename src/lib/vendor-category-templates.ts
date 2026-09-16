// Vendor-category-specific content for the package builder wizard.
// Each category defines grouped feature chips, pre-priced add-on suggestions,
// duration options, and copy hints. The main route (vendor-packages.tsx) uses
// this to drive the multi-step wizard UI.

export type FeatureGroup = {
  group: string;
  items: string[];
};

export type AddOnTemplate = {
  name: string;
  defaultPrice?: number; // USD dollars (not cents)
};

export type CategoryTemplate = {
  displayName: string;
  emoji: string;
  /** Tailwind gradient classes applied to package card header accent bar */
  accentClass: string;
  featureGroups: FeatureGroup[];
  addOns: AddOnTemplate[];
  durationOptions: string[];
  descriptionHint: string;
  priceHint: string;
};

// ---------------------------------------------------------------------------
// Templates — 21 vendor categories
// ---------------------------------------------------------------------------

const CATEGORY_TEMPLATES: Record<string, CategoryTemplate> = {
  Venue: {
    displayName: "Venue",
    emoji: "🏛️",
    accentClass: "from-slate-600 to-slate-900",
    featureGroups: [
      {
        group: "Spaces",
        items: [
          "Ceremony space",
          "Reception hall",
          "Outdoor patio",
          "Cocktail lounge",
          "Bridal suite",
          "Groom's suite",
          "Garden area",
        ],
      },
      {
        group: "Amenities",
        items: [
          "Ample parking",
          "Handicap accessible",
          "Air conditioning",
          "Heating",
          "Wi-Fi",
          "Coat check",
        ],
      },
      {
        group: "Equipment",
        items: [
          "Tables & chairs",
          "Dance floor",
          "Bar setup",
          "Stage / podium",
          "AV system",
          "Projector & screen",
        ],
      },
      {
        group: "Services",
        items: [
          "On-site coordinator",
          "Catering kitchen",
          "Security included",
          "Valet parking available",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour", defaultPrice: 300 },
      { name: "Venue coordinator", defaultPrice: 400 },
      { name: "Valet parking", defaultPrice: 250 },
      { name: "Security guard", defaultPrice: 200 },
      { name: "Extra setup time (1 hr)", defaultPrice: 150 },
      { name: "Cleanup crew", defaultPrice: 300 },
    ],
    durationOptions: [
      "4 hours",
      "5 hours",
      "6 hours",
      "8 hours",
      "10 hours",
      "Full day (12 hrs)",
      "Custom",
    ],
    descriptionHint:
      "Describe the atmosphere, style, and layout of your venue. Mention capacity, flexibility, and what makes it special for celebrations.",
    priceHint: "Starting price per rental period",
  },

  DJ: {
    displayName: "DJ",
    emoji: "🎧",
    accentClass: "from-violet-600 to-purple-900",
    featureGroups: [
      {
        group: "Sound",
        items: [
          "PA sound system",
          "Wireless microphones",
          "Subwoofers",
        ],
      },
      {
        group: "Lighting",
        items: [
          "Dance floor lighting",
          "LED up-lighting",
          "Pin spotting",
          "Monogram gobo",
          "Fog machine",
          "Confetti cannon",
        ],
      },
      {
        group: "Services",
        items: [
          "MC services",
          "Music consultation",
          "Online request portal",
          "Timeline coordination",
          "Do-not-play list",
          "Bilingual MC",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour", defaultPrice: 150 },
      { name: "Full LED up-lighting", defaultPrice: 200 },
      { name: "Photo booth integration", defaultPrice: 350 },
      { name: "Fog machine", defaultPrice: 75 },
      { name: "Confetti cannon", defaultPrice: 100 },
      { name: "Second wireless mic", defaultPrice: 50 },
    ],
    durationOptions: [
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "8 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your DJ style, energy level, and music range. Mention genres, event types you specialise in, and how you keep the dance floor packed.",
    priceHint: "Price for the base package duration",
  },

  Photographer: {
    displayName: "Photographer",
    emoji: "📷",
    accentClass: "from-amber-500 to-orange-700",
    featureGroups: [
      {
        group: "Coverage",
        items: [
          "Getting-ready coverage",
          "Ceremony coverage",
          "First look session",
          "Cocktail hour coverage",
          "Reception coverage",
        ],
      },
      {
        group: "Deliverables",
        items: [
          "Edited digital photos",
          "High-resolution files",
          "Online gallery (1 year)",
          "Print release",
          "USB drive",
          "Same-day preview (5 photos)",
        ],
      },
      {
        group: "Sessions",
        items: [
          "Engagement session",
          "Bridal session",
          "Rehearsal dinner coverage",
        ],
      },
      {
        group: "Extras",
        items: [
          "Second shooter",
          "Travel within 50 miles",
          "Rush editing (2 weeks)",
          "Online proofing gallery",
        ],
      },
    ],
    addOns: [
      { name: "Second shooter", defaultPrice: 350 },
      { name: "Printed album (20 pages)", defaultPrice: 500 },
      { name: "Canvas print 16×20", defaultPrice: 200 },
      { name: "Extra hour", defaultPrice: 300 },
      { name: "Engagement session", defaultPrice: 300 },
      { name: "Rush delivery (1 week)", defaultPrice: 200 },
    ],
    durationOptions: [
      "4 hours",
      "6 hours",
      "8 hours",
      "10 hours",
      "Full day",
      "Custom",
    ],
    descriptionHint:
      "Describe your photography style (documentary, editorial, fine art, etc.), how you put clients at ease, and what sets your work apart.",
    priceHint: "Starting price for base coverage",
  },

  Videographer: {
    displayName: "Videographer",
    emoji: "🎬",
    accentClass: "from-red-600 to-rose-900",
    featureGroups: [
      {
        group: "Coverage",
        items: [
          "Getting-ready footage",
          "Ceremony highlights",
          "Full ceremony",
          "Reception highlights",
          "Full reception",
          "Aerial drone footage",
        ],
      },
      {
        group: "Deliverables",
        items: [
          "Highlight film (3–5 min)",
          "Feature film (20–30 min)",
          "Raw footage files",
          "Online streaming link",
          "USB drive",
        ],
      },
      {
        group: "Extras",
        items: [
          "Same-day edit",
          "Second videographer",
          "Travel included",
          "Love story film",
        ],
      },
    ],
    addOns: [
      { name: "Drone footage", defaultPrice: 400 },
      { name: "Second videographer", defaultPrice: 400 },
      { name: "Same-day edit", defaultPrice: 600 },
      { name: "Extended edit", defaultPrice: 200 },
      { name: "Ceremony live stream", defaultPrice: 300 },
      { name: "Extra hour", defaultPrice: 200 },
    ],
    durationOptions: [
      "4 hours",
      "6 hours",
      "8 hours",
      "10 hours",
      "Full day",
      "Custom",
    ],
    descriptionHint:
      "Describe your filming style, editing aesthetic, and turnaround time. Mention how you capture emotion and tell the story of the event.",
    priceHint: "Starting price for base coverage",
  },

  Caterer: {
    displayName: "Caterer",
    emoji: "🍽️",
    accentClass: "from-green-600 to-emerald-900",
    featureGroups: [
      {
        group: "Included",
        items: [
          "Service staff",
          "Tables & linens",
          "Chafing dishes",
          "Plates & cutlery",
          "Napkins",
          "Setup & breakdown",
        ],
      },
      {
        group: "Menu",
        items: [
          "Appetizers",
          "Main course",
          "Sides",
          "Dessert station",
          "Late-night snacks",
          "Kids menu",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour of service", defaultPrice: 200 },
      { name: "Bar service", defaultPrice: 500 },
      { name: "Cake cutting service", defaultPrice: 150 },
      { name: "Additional server", defaultPrice: 100 },
      { name: "Custom menu tasting", defaultPrice: 200 },
      { name: "Decor styling", defaultPrice: 150 },
    ],
    durationOptions: [
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "8 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your cuisine style, signature dishes, and experience with events of your size. Mention how you work with clients on custom menus.",
    priceHint: "Price per person or flat event rate",
  },

  Baker: {
    displayName: "Baker",
    emoji: "🎂",
    accentClass: "from-pink-500 to-rose-700",
    featureGroups: [
      {
        group: "Design",
        items: [
          "Custom design consultation",
          "Buttercream finish",
          "Fondant finish",
          "Fresh flowers",
          "Edible decorations",
          "Hand-painted details",
          "Metallic accents",
        ],
      },
      {
        group: "Included",
        items: [
          "Complimentary tasting",
          "Design sketches",
          "Delivery to venue",
          "Setup & display",
          "Cake stand (rental)",
          "Cutting set",
        ],
      },
      {
        group: "Flavors & Fillings",
        items: [
          "Multiple tiers (different flavors)",
          "Premium flavor upgrade",
          "Custom filling",
        ],
      },
    ],
    addOns: [
      { name: "Additional tier", defaultPrice: 150 },
      { name: "Extra 20 servings", defaultPrice: 75 },
      { name: "Matching cupcakes (dozen)", defaultPrice: 60 },
      { name: "Cake stand (to keep)", defaultPrice: 45 },
      { name: "Rush order fee", defaultPrice: 100 },
      { name: "Extra tasting session", defaultPrice: 75 },
    ],
    durationOptions: ["Pickup", "Delivery only", "Delivery & setup", "Custom"],
    descriptionHint:
      "Describe your baking style, specialties, and how you work with clients to create a custom cake that reflects their vision.",
    priceHint: "Starting price (varies by tiers & design complexity)",
  },

  Florist: {
    displayName: "Florist",
    emoji: "💐",
    accentClass: "from-fuchsia-500 to-pink-700",
    featureGroups: [
      {
        group: "Bridal",
        items: [
          "Bridal bouquet",
          "Bridesmaid bouquets",
          "Boutonnieres",
          "Flower girl basket",
          "Wrist corsage",
          "Toss bouquet",
        ],
      },
      {
        group: "Ceremony",
        items: [
          "Ceremony arch / arbor",
          "Aisle arrangements",
          "Pew markers",
          "Altar florals",
          "Unity table flowers",
        ],
      },
      {
        group: "Reception",
        items: [
          "Centerpieces",
          "Head table arrangement",
          "Escort table flowers",
          "Cake flowers",
          "Lounge area florals",
        ],
      },
      {
        group: "Extras",
        items: [
          "Setup & installation",
          "Breakdown & removal",
          "Rental items included",
          "Bouquet preservation service",
        ],
      },
    ],
    addOns: [
      { name: "Additional centerpiece", defaultPrice: 75 },
      { name: "Ceremony arch", defaultPrice: 400 },
      { name: "Floral crown", defaultPrice: 85 },
      { name: "Extra bridesmaid bouquet", defaultPrice: 65 },
      { name: "Venue walkthrough visit", defaultPrice: 50 },
      { name: "Bouquet preservation", defaultPrice: 150 },
    ],
    durationOptions: [
      "Delivery & setup",
      "Half day",
      "Full day",
      "Custom",
    ],
    descriptionHint:
      "Describe your floral style (lush garden, minimalist, tropical, etc.), the flowers you specialise in, and how you collaborate on design.",
    priceHint: "Starting price (varies by flower selection)",
  },

  "Event Planner": {
    displayName: "Event Planner",
    emoji: "📋",
    accentClass: "from-blue-600 to-indigo-800",
    featureGroups: [
      {
        group: "Planning",
        items: [
          "Budget management",
          "Vendor sourcing & booking",
          "Contract review",
          "Timeline creation",
          "Floor plan design",
          "Seating chart",
        ],
      },
      {
        group: "Coordination",
        items: [
          "Day-of coordination",
          "Rehearsal management",
          "Vendor communication hub",
          "Family & wedding party coordination",
        ],
      },
      {
        group: "Design",
        items: [
          "Mood board & concept",
          "Decor sourcing",
          "Vendor selection guidance",
        ],
      },
      {
        group: "Support",
        items: [
          "Unlimited consultations",
          "Emergency kit on-site",
          "Monthly check-in calls",
          "Online planning portal",
        ],
      },
    ],
    addOns: [
      { name: "Extra planning month", defaultPrice: 200 },
      { name: "Rehearsal dinner planning", defaultPrice: 400 },
      { name: "Honeymoon planning", defaultPrice: 300 },
      { name: "Guest management system", defaultPrice: 150 },
      { name: "Post-event teardown oversight", defaultPrice: 200 },
    ],
    durationOptions: [
      "Day-of only",
      "1 month",
      "3 months",
      "6 months",
      "Full planning (12 months)",
      "Custom",
    ],
    descriptionHint:
      "Describe your planning philosophy, the event types you specialise in, and how you guide clients from first consultation to the final farewell.",
    priceHint: "Flat rate or starting price",
  },

  Decor: {
    displayName: "Decor",
    emoji: "✨",
    accentClass: "from-teal-500 to-cyan-800",
    featureGroups: [
      {
        group: "Backdrop",
        items: [
          "Sequin / shimmer wall",
          "Balloon backdrop",
          "Floral wall",
          "Neon sign",
          "Photo backdrop frame",
        ],
      },
      {
        group: "Table",
        items: [
          "Centerpieces",
          "Charger plates",
          "Table runners",
          "Candle arrangements",
          "Chair covers & sashes",
        ],
      },
      {
        group: "Ambient",
        items: [
          "String lights",
          "Lanterns",
          "Candles & holders",
          "Fairy lights",
          "LED floor lighting",
        ],
      },
      {
        group: "Specialty",
        items: [
          "Marquee letters",
          "Balloon garland",
          "Throne chairs",
          "Sweetheart table set",
          "Welcome sign",
        ],
      },
    ],
    addOns: [
      { name: "Extra table setup", defaultPrice: 35 },
      { name: "Marquee letters (rental)", defaultPrice: 150 },
      { name: "Throne chair rental", defaultPrice: 200 },
      { name: "Delivery & setup", defaultPrice: 100 },
      { name: "Overnight rental", defaultPrice: 75 },
      { name: "Custom balloon colors", defaultPrice: 50 },
    ],
    durationOptions: [
      "Delivery & setup",
      "4 hours",
      "8 hours",
      "Full day",
      "Custom",
    ],
    descriptionHint:
      "Describe your design aesthetic, the types of setups you specialise in, and how you transform a space into an unforgettable environment.",
    priceHint: "Starting price (varies by item count)",
  },

  Rentals: {
    displayName: "Rentals",
    emoji: "🪑",
    accentClass: "from-orange-500 to-amber-800",
    featureGroups: [
      {
        group: "Furniture",
        items: [
          "Round tables",
          "Rectangular tables",
          "Folding chairs",
          "Chiavari chairs",
          "Ghost chairs",
          "Lounge furniture",
          "Cocktail tables",
        ],
      },
      {
        group: "Linen",
        items: [
          "Tablecloths",
          "Napkins",
          "Chair covers",
          "Table runners",
          "Overlays",
        ],
      },
      {
        group: "Tableware",
        items: [
          "China / dinnerware",
          "Flatware",
          "Glassware",
          "Charger plates",
          "Serving platters",
        ],
      },
      {
        group: "Equipment",
        items: [
          "Tents",
          "Dance floor",
          "Staging",
          "Pipe & drape",
          "LED uplighting",
        ],
      },
    ],
    addOns: [
      { name: "Delivery & pickup", defaultPrice: 100 },
      { name: "Setup & teardown", defaultPrice: 150 },
      { name: "Damage waiver", defaultPrice: 50 },
      { name: "Late return fee waived", defaultPrice: 25 },
      { name: "Additional delivery zone", defaultPrice: 75 },
    ],
    durationOptions: [
      "Day rental",
      "Weekend rental",
      "Full week",
      "Custom",
    ],
    descriptionHint:
      "Describe your inventory highlights, delivery coverage area, and how you work with planners and venues on large orders.",
    priceHint: "Per-item or package rate",
  },

  Bartender: {
    displayName: "Bartender",
    emoji: "🍹",
    accentClass: "from-yellow-500 to-orange-700",
    featureGroups: [
      {
        group: "Bar Setup",
        items: [
          "Portable bar",
          "Ice bins & coolers",
          "Speed rails",
          "Bar mats & tools",
          "Garnish trays",
        ],
      },
      {
        group: "Service",
        items: [
          "Professional bartender",
          "Cocktail napkins",
          "Straws & stir sticks",
          "Drink menu display",
          "Tip jar",
        ],
      },
      {
        group: "Menu",
        items: [
          "Signature cocktail menu",
          "Mocktail menu",
          "Beer & wine service",
          "Full spirits bar",
          "Non-alcoholic options",
        ],
      },
      {
        group: "Extras",
        items: [
          "Alcohol sourcing assistance",
          "Batch cocktail service",
          "Champagne tower setup",
        ],
      },
    ],
    addOns: [
      { name: "Extra bartender", defaultPrice: 150 },
      { name: "Champagne tower setup", defaultPrice: 200 },
      { name: "Signature cocktail creation", defaultPrice: 75 },
      { name: "Alcohol sourcing", defaultPrice: 50 },
      { name: "Extra hour", defaultPrice: 125 },
      { name: "Bar linen & decor", defaultPrice: 85 },
    ],
    durationOptions: [
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "8 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your bar service style, specialty cocktails, and experience with events. Mention your licensing and approach to responsible service.",
    priceHint: "Service price (not including alcohol)",
  },

  "Hair Stylist": {
    displayName: "Hair Stylist",
    emoji: "💇",
    accentClass: "from-rose-400 to-pink-700",
    featureGroups: [
      {
        group: "Services",
        items: [
          "Bridal hair styling",
          "Trial session",
          "Hair extension consultation",
          "Hair accessories assistance",
          "Scalp prep treatment",
        ],
      },
      {
        group: "Included",
        items: [
          "Travel to venue",
          "Touch-up kit",
          "Bobby pins & hairspray",
          "Consultation session",
          "Timeline coordination",
        ],
      },
      {
        group: "Styles",
        items: [
          "Updo",
          "Half-up half-down",
          "Loose waves",
          "Braided style",
          "Sleek blowout",
          "Vintage / retro",
        ],
      },
    ],
    addOns: [
      { name: "Trial session", defaultPrice: 85 },
      { name: "Additional bridesmaid", defaultPrice: 75 },
      { name: "Flower girl styling", defaultPrice: 45 },
      { name: "Hair accessory sourcing", defaultPrice: 35 },
      { name: "Early morning surcharge", defaultPrice: 50 },
    ],
    durationOptions: [
      "1 person",
      "2–3 people",
      "4–6 people",
      "Full bridal party",
      "Custom",
    ],
    descriptionHint:
      "Describe your styling specialties, how you work with different hair types and textures, and your process for creating the perfect look.",
    priceHint: "Starting price per person",
  },

  "Makeup Artist": {
    displayName: "Makeup Artist",
    emoji: "💄",
    accentClass: "from-purple-400 to-violet-700",
    featureGroups: [
      {
        group: "Services",
        items: [
          "Bridal makeup application",
          "Trial session",
          "Airbrush application",
          "Skin prep & moisturising",
          "Strip lash application",
          "Individual lash application",
        ],
      },
      {
        group: "Included",
        items: [
          "Touch-up kit (lip color, blotting)",
          "Travel to venue",
          "Consultation session",
          "Timeline coordination",
        ],
      },
      {
        group: "Styles",
        items: [
          "Natural glow",
          "Full glam",
          "Bridal editorial",
          "Vintage / retro",
          "Bold eye",
        ],
      },
    ],
    addOns: [
      { name: "Trial session", defaultPrice: 85 },
      { name: "Additional bridesmaid", defaultPrice: 85 },
      { name: "Flower girl makeup", defaultPrice: 40 },
      { name: "Airbrush upgrade", defaultPrice: 50 },
      { name: "Individual lashes", defaultPrice: 30 },
      { name: "Early morning surcharge", defaultPrice: 50 },
    ],
    durationOptions: [
      "1 person",
      "2–3 people",
      "4–6 people",
      "Full bridal party",
      "Custom",
    ],
    descriptionHint:
      "Describe your makeup philosophy, the looks you excel at, and how you customise application for each client's skin tone and event.",
    priceHint: "Starting price per person",
  },

  Transportation: {
    displayName: "Transportation",
    emoji: "🚗",
    accentClass: "from-sky-600 to-blue-900",
    featureGroups: [
      {
        group: "Included",
        items: [
          "Professional chauffeur",
          "Wedding decorations",
          "Champagne / water",
          "Sound system",
          "Privacy partition",
          "GPS tracking",
        ],
      },
      {
        group: "Service",
        items: [
          "Red carpet service",
          "Curbside assistance",
          "Multiple stops included",
          "Airport transfers",
          "Late-night pickup",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour", defaultPrice: 150 },
      { name: "Additional vehicle", defaultPrice: 400 },
      { name: "Airport pickup / dropoff", defaultPrice: 100 },
      { name: "Custom decor upgrade", defaultPrice: 75 },
      { name: "Champagne upgrade", defaultPrice: 50 },
    ],
    durationOptions: [
      "2 hours",
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "Full day",
      "Custom",
    ],
    descriptionHint:
      "Describe your fleet, service style, and coverage area. Mention how you make the ride special and any extra touches included.",
    priceHint: "Starting price for base duration",
  },

  Officiant: {
    displayName: "Officiant",
    emoji: "💍",
    accentClass: "from-indigo-500 to-blue-800",
    featureGroups: [
      {
        group: "Ceremony",
        items: [
          "Fully customised ceremony script",
          "Legally binding ceremony",
          "Legal license filing",
        ],
      },
      {
        group: "Rituals",
        items: [
          "Unity candle ceremony",
          "Sand ceremony",
          "Handfasting",
          "Ring warming ceremony",
          "Community blessing",
        ],
      },
      {
        group: "Extras",
        items: [
          "2–3 consultation sessions",
          "Professional sound system",
          "Travel within 30 miles",
        ],
      },
    ],
    addOns: [
      { name: "Ceremony rehearsal", defaultPrice: 100 },
      { name: "Vow writing coaching", defaultPrice: 75 },
      { name: "Sound system rental", defaultPrice: 100 },
      { name: "Second ceremony location", defaultPrice: 150 },
      { name: "Personalised poem / reading", defaultPrice: 75 },
    ],
    durationOptions: [
      "30 minutes",
      "45 minutes",
      "1 hour",
      "1.5 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your ceremony style, how you personalise each ceremony, and what couples can expect from first consultation to I do.",
    priceHint: "Flat rate for the ceremony",
  },

  Security: {
    displayName: "Security",
    emoji: "🛡️",
    accentClass: "from-zinc-600 to-zinc-900",
    featureGroups: [
      {
        group: "Personnel",
        items: [
          "Uniformed security officers",
          "Plain-clothes officers",
          "VIP personal escort",
          "Crowd control specialists",
        ],
      },
      {
        group: "Services",
        items: [
          "Venue access control",
          "Perimeter patrol",
          "Bag screening",
          "Emergency response coordination",
        ],
      },
      {
        group: "Equipment",
        items: [
          "Radio communication",
          "Security cameras monitored",
          "Metal detector wand",
          "ID verification",
        ],
      },
    ],
    addOns: [
      { name: "Additional officer", defaultPrice: 200 },
      { name: "Overnight security", defaultPrice: 400 },
      { name: "Traffic control", defaultPrice: 175 },
      { name: "Specialised event briefing", defaultPrice: 100 },
      { name: "Overtime (per hour)", defaultPrice: 75 },
    ],
    durationOptions: [
      "4 hours",
      "6 hours",
      "8 hours",
      "10 hours",
      "12 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your security team's credentials, event experience, and approach to maintaining a safe atmosphere for all guests.",
    priceHint: "Starting price per officer per shift",
  },

  Entertainment: {
    displayName: "Entertainment",
    emoji: "🎭",
    accentClass: "from-red-500 to-orange-700",
    featureGroups: [
      {
        group: "Act",
        items: [
          "Live band performance",
          "DJ set",
          "Comedy act",
          "Magic show",
          "Aerial / acrobatic act",
          "Fire performance",
          "Cultural dance",
        ],
      },
      {
        group: "Included",
        items: [
          "Sound system",
          "MC duties",
          "Stage setup",
          "Costume / wardrobe",
          "Lighting rig",
        ],
      },
      {
        group: "Guest Engagement",
        items: [
          "Guest participation segments",
          "Custom song requests",
          "Meet & greet time",
          "Themed set list",
        ],
      },
    ],
    addOns: [
      { name: "Extra 30 minutes", defaultPrice: 150 },
      { name: "Additional performer", defaultPrice: 250 },
      { name: "Custom set list", defaultPrice: 75 },
      { name: "Meet & greet extension", defaultPrice: 100 },
      { name: "Merchandise table", defaultPrice: 50 },
    ],
    durationOptions: [
      "30 minutes",
      "1 hour",
      "1.5 hours",
      "2 hours",
      "3 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your act, performance style, and what makes it unforgettable. Mention the types of events you've performed at.",
    priceHint: "Starting price per performance",
  },

  MC: {
    displayName: "MC",
    emoji: "🎤",
    accentClass: "from-cyan-500 to-teal-800",
    featureGroups: [
      {
        group: "Hosting",
        items: [
          "Event introductions",
          "Program flow management",
          "Microphone handling",
          "Toast facilitation",
          "Award presentations",
        ],
      },
      {
        group: "Entertainment",
        items: [
          "Custom script & humour",
          "Crowd hype & energy",
          "Wedding party coordination",
          "Audience games & activities",
        ],
      },
      {
        group: "AV",
        items: [
          "Wireless lavalier mic",
          "Handheld wireless mic",
          "PA speaker system",
          "Music transitions",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour", defaultPrice: 125 },
      { name: "Bilingual MC surcharge", defaultPrice: 150 },
      { name: "Custom script writing", defaultPrice: 75 },
      { name: "DJ collaboration", defaultPrice: 200 },
      { name: "Games & activities kit", defaultPrice: 50 },
    ],
    durationOptions: [
      "2 hours",
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your hosting style, energy, and how you keep events moving while entertaining guests. Mention your experience with different formats.",
    priceHint: "Starting price for base duration",
  },

  "Balloon Artist": {
    displayName: "Balloon Artist",
    emoji: "🎈",
    accentClass: "from-lime-400 to-green-700",
    featureGroups: [
      {
        group: "Centerpieces",
        items: [
          "Table centerpieces",
          "Standing balloon centerpieces",
          "Floral balloon arrangements",
        ],
      },
      {
        group: "Specialty",
        items: [
          "Number / letter balloons",
          "Air-filled bouquets",
          "Balloon animals",
          "Custom color palette",
          "Personalised prints",
        ],
      },
      {
        group: "Service",
        items: [
          "Delivery included",
          "Setup & installation",
          "Breakdown & removal",
          "Custom color matching",
        ],
      },
    ],
    addOns: [
      { name: "Additional arch", defaultPrice: 200 },
      { name: "Balloon column pair", defaultPrice: 125 },
      { name: "Extra centerpiece", defaultPrice: 65 },
      { name: "Custom print balloons", defaultPrice: 50 },
      { name: "Rush order fee", defaultPrice: 100 },
      { name: "Extended delivery zone", defaultPrice: 50 },
    ],
    durationOptions: [
      "Delivery & setup only",
      "2 hours",
      "4 hours",
      "Full day",
      "Custom",
    ],
    descriptionHint:
      "Describe your balloon artistry style, colour coordination expertise, and how you create a wow factor with custom installations.",
    priceHint: "Starting price (varies by installation size)",
  },

  "Food Truck": {
    displayName: "Food Truck",
    emoji: "🚚",
    accentClass: "from-orange-400 to-red-600",
    featureGroups: [
      {
        group: "Service",
        items: [
          "On-site fresh cooking",
          "Dedicated service staff",
          "Utensils & plates included",
          "Napkins & condiments",
          "Setup & breakdown",
        ],
      },
      {
        group: "Menu",
        items: [
          "Customisable menu",
          "Signature specialty items",
          "Vegetarian options",
          "Vegan options",
          "Gluten-free options",
          "Kids menu",
          "Custom branded menu sign",
        ],
      },
      {
        group: "Extras",
        items: [
          "Event-branded packaging",
          "Social-media-worthy presentation",
          "Catering menu consultation",
        ],
      },
    ],
    addOns: [
      { name: "Extra service hour", defaultPrice: 200 },
      { name: "Additional staff member", defaultPrice: 150 },
      { name: "Premium menu upgrade", defaultPrice: 100 },
      { name: "Non-alcoholic beverages", defaultPrice: 75 },
      { name: "Late-night snack station", defaultPrice: 200 },
      { name: "Custom branded signage", defaultPrice: 50 },
    ],
    durationOptions: [
      "2 hours",
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your cuisine specialty, signature dishes, and the experience of having your food truck at an event. Mention guest count capacity.",
    priceHint: "Per person or flat event rate",
  },

  "Photo Booth": {
    displayName: "Photo Booth",
    emoji: "📸",
    accentClass: "from-fuchsia-400 to-pink-600",
    featureGroups: [
      {
        group: "Props & Attendant",
        items: [
          "Full prop collection",
          "Themed props",
          "Custom branded props",
          "Booth attendant on-site",
        ],
      },
      {
        group: "Output",
        items: [
          "Digital copies via text / email",
          "Custom print layout",
          "Scrapbook / guestbook",
          "Online gallery included",
        ],
      },
      {
        group: "Branding",
        items: [
          "Custom overlay / logo",
          "Personalised print template",
          "Event hashtag display",
          "QR code sharing station",
          "Branded start screen",
        ],
      },
    ],
    addOns: [
      { name: "Extra hour", defaultPrice: 150 },
      { name: "Scrapbook / guestbook", defaultPrice: 100 },
      { name: "360° video upgrade", defaultPrice: 300 },
      { name: "Social media sharing station", defaultPrice: 75 },
      { name: "Extra attendant", defaultPrice: 100 },
    ],
    durationOptions: [
      "2 hours",
      "3 hours",
      "4 hours",
      "5 hours",
      "6 hours",
      "Custom",
    ],
    descriptionHint:
      "Describe your photo booth experience, how you help guests make memories, and how your setup enhances the event atmosphere.",
    priceHint: "Starting price for base duration",
  },
};

// ---------------------------------------------------------------------------
// Fallback — unknown / generic vendor
// ---------------------------------------------------------------------------

const DEFAULT_TEMPLATE: CategoryTemplate = {
  displayName: "Vendor",
  emoji: "✦",
  accentClass: "from-gray-500 to-gray-800",
  featureGroups: [
    {
      group: "Services",
      items: [
        "Professional service",
        "Consultation included",
        "Setup & breakdown",
        "Travel to venue",
        "Custom quote available",
      ],
    },
    {
      group: "Support",
      items: [
        "Responsive communication",
        "Contract included",
        "Deposit required",
        "Day-of support",
      ],
    },
  ],
  addOns: [
    { name: "Extra hour", defaultPrice: 150 },
    { name: "Travel surcharge" },
    { name: "Rush booking fee", defaultPrice: 100 },
  ],
  durationOptions: [
    "2 hours",
    "4 hours",
    "6 hours",
    "8 hours",
    "Full day",
    "Custom",
  ],
  descriptionHint:
    "Describe what makes your service unique, what clients can expect when working with you, and why you're the right choice for their event.",
  priceHint: "Starting price for this package",
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function getCategoryTemplate(
  category: string | null | undefined
): CategoryTemplate {
  if (!category) return DEFAULT_TEMPLATE;
  const key = Object.keys(CATEGORY_TEMPLATES).find(
    (k) => k.toLowerCase() === category.toLowerCase()
  );
  return key ? CATEGORY_TEMPLATES[key] : DEFAULT_TEMPLATE;
}

export function getCategoryEmoji(
  category: string | null | undefined
): string {
  return getCategoryTemplate(category).emoji;
}

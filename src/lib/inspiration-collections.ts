export type InspirationCategory =
  | "Wedding"
  | "Birthday"
  | "Baby Shower"
  | "Bridal Shower"
  | "Graduation"
  | "Reunion"
  | "Anniversary"
  | "Corporate"
  | "Holiday Party"
  | "Church Event"
  | "School Event"
  | "Fundraiser";

export type InspirationStyle =
  | "Elegant"
  | "Luxury"
  | "Modern"
  | "Minimal"
  | "Floral"
  | "Rustic"
  | "Boho"
  | "Glam"
  | "Black Tie"
  | "Vintage"
  | "Watercolor"
  | "Seasonal"
  | "Colorful";

export type MatchingAsset =
  | "Save the Date"
  | "Invitation"
  | "RSVP Card"
  | "Details Card"
  | "Thank You Card"
  | "Welcome Sign"
  | "Seating Chart"
  | "Table Numbers"
  | "Place Cards"
  | "Menu"
  | "Event Website Theme";

export type InspirationCollection = {
  id: string;
  name: string;
  category: InspirationCategory;
  styles: InspirationStyle[];
  palette: string[];
  fontPair: { display: string; body: string };
  motif: string;
  description: string;
  tier: "free" | "premium" | "designer" | "vendor" | "sponsored" | "seasonal";
  assets: MatchingAsset[];
  gradient: string; // tailwind gradient classes for preview
  accent: string; // hex accent
};

const ALL_ASSETS: MatchingAsset[] = [
  "Save the Date",
  "Invitation",
  "RSVP Card",
  "Details Card",
  "Thank You Card",
  "Welcome Sign",
  "Seating Chart",
  "Table Numbers",
  "Place Cards",
  "Menu",
  "Event Website Theme",
];

export const INSPIRATION_COLLECTIONS: InspirationCollection[] = [
  {
    id: "garden-romance",
    name: "Garden Romance",
    category: "Wedding",
    styles: ["Floral", "Elegant", "Watercolor"],
    palette: ["#F5E9DE", "#D9B8A1", "#7C8D6E", "#3F4B36"],
    fontPair: { display: "Cormorant Garamond", body: "Lato" },
    motif: "Hand-painted florals with soft botanical trims",
    description: "Airy watercolor blooms, sage foliage, and blush script — a romantic garden welcome.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#F5E9DE] via-[#EAD5C4] to-[#7C8D6E]",
    accent: "#7C8D6E",
  },
  {
    id: "modern-black-tie",
    name: "Modern Black Tie",
    category: "Wedding",
    styles: ["Black Tie", "Modern", "Luxury"],
    palette: ["#0B0B0F", "#1A1A22", "#C9A96A", "#F5F1E8"],
    fontPair: { display: "Didot", body: "Inter" },
    motif: "Editorial typography on obsidian with gilded rules",
    description: "Confident, cinematic, and quietly opulent — for a formal evening affair.",
    tier: "premium",
    assets: ALL_ASSETS,
    gradient: "from-[#0B0B0F] via-[#1A1A22] to-[#C9A96A]",
    accent: "#C9A96A",
  },
  {
    id: "sage-gold-elegance",
    name: "Sage & Gold Elegance",
    category: "Wedding",
    styles: ["Elegant", "Luxury", "Floral"],
    palette: ["#EFEBE0", "#B7C4A2", "#7A8C6A", "#B48A45"],
    fontPair: { display: "Playfair Display", body: "Nunito" },
    motif: "Foil sprigs with tone-on-tone linen textures",
    description: "Refined sage foliage kissed with warm gold foil — timeless without feeling formal.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#EFEBE0] via-[#B7C4A2] to-[#B48A45]",
    accent: "#B48A45",
  },
  {
    id: "rustic-barn",
    name: "Rustic Barn Wedding",
    category: "Wedding",
    styles: ["Rustic", "Vintage", "Boho"],
    palette: ["#F1E3CB", "#C99B6D", "#8B5A2B", "#3E2C1C"],
    fontPair: { display: "Amatic SC", body: "Merriweather"},
    motif: "Kraft paper, wood grain, and hand-lettered signage",
    description: "Warm woods, wildflowers, and mason-jar charm for a countryside celebration.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#F1E3CB] via-[#C99B6D] to-[#3E2C1C]",
    accent: "#8B5A2B",
  },
  {
    id: "tropical-celebration",
    name: "Tropical Celebration",
    category: "Wedding",
    styles: ["Colorful", "Floral", "Seasonal"],
    palette: ["#FFF4E0", "#F4A261", "#2A9D8F", "#264653"],
    fontPair: { display: "Poppins", body: "Poppins" },
    motif: "Monstera fronds, coral blooms, and citrus accents",
    description: "Sun-drenched palms and hibiscus for a destination-worthy welcome.",
    tier: "seasonal",
    assets: ALL_ASSETS,
    gradient: "from-[#FFF4E0] via-[#F4A261] to-[#2A9D8F]",
    accent: "#2A9D8F",
  },
  {
    id: "timeless-white",
    name: "Timeless White",
    category: "Wedding",
    styles: ["Minimal", "Elegant", "Luxury"],
    palette: ["#FFFFFF", "#F3EEE7", "#D9CDBB", "#2E2A24"],
    fontPair: { display: "Cormorant Garamond", body: "Inter" },
    motif: "Debossed monogram on ivory cotton stock",
    description: "Whisper-quiet ivory and ink — the classic that never dates.",
    tier: "premium",
    assets: ALL_ASSETS,
    gradient: "from-white via-[#F3EEE7] to-[#D9CDBB]",
    accent: "#2E2A24",
  },
  {
    id: "minimal-luxe",
    name: "Minimal Luxe",
    category: "Corporate",
    styles: ["Minimal", "Modern", "Luxury"],
    palette: ["#0F172A", "#1E293B", "#94A3B8", "#E2E8F0"],
    fontPair: { display: "Space Grotesk", body: "Inter" },
    motif: "Ultra-thin rules, generous negative space",
    description: "A precise, editorial system for founders, galas, and premium brand nights.",
    tier: "premium",
    assets: ALL_ASSETS,
    gradient: "from-[#0F172A] via-[#1E293B] to-[#94A3B8]",
    accent: "#94A3B8",
  },
  {
    id: "floral-watercolor",
    name: "Floral Watercolor",
    category: "Bridal Shower",
    styles: ["Watercolor", "Floral", "Boho"],
    palette: ["#FFF6F1", "#F8CBB6", "#E58E7B", "#8C4A5E"],
    fontPair: { display: "Great Vibes", body: "Lora" },
    motif: "Loose watercolor peonies with painterly washes",
    description: "Dreamy peonies in blush and coral — soft, romantic, and hand-made.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#FFF6F1] via-[#F8CBB6] to-[#8C4A5E]",
    accent: "#E58E7B",
  },
  {
    id: "classic-monogram",
    name: "Classic Monogram",
    category: "Anniversary",
    styles: ["Vintage", "Elegant", "Luxury"],
    palette: ["#F6F1E7", "#D8C9A3", "#6B5433", "#2B1F12"],
    fontPair: { display: "Playfair Display", body: "EB Garamond" },
    motif: "Interlocking initials in copperplate script",
    description: "Heirloom monograms and pearl-toned cardstock for milestones worth marking.",
    tier: "premium",
    assets: ALL_ASSETS,
    gradient: "from-[#F6F1E7] via-[#D8C9A3] to-[#6B5433]",
    accent: "#6B5433",
  },
  {
    id: "contemporary-chic",
    name: "Contemporary Chic",
    category: "Birthday",
    styles: ["Modern", "Glam", "Colorful"],
    palette: ["#FCE7F3", "#F472B6", "#7C3AED", "#0F172A"],
    fontPair: { display: "Fraunces", body: "Manrope" },
    motif: "Asymmetric type, magenta accents, gradient washes",
    description: "Playful, punchy, and unmistakably 'right now' — perfect for a milestone birthday.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#FCE7F3] via-[#F472B6] to-[#7C3AED]",
    accent: "#7C3AED",
  },
  {
    id: "little-star-baby",
    name: "Little Star",
    category: "Baby Shower",
    styles: ["Minimal", "Watercolor", "Seasonal"],
    palette: ["#EAF2FB", "#B7D0EA", "#7091B8", "#F4C784"],
    fontPair: { display: "Quicksand", body: "Nunito" },
    motif: "Constellations, moons, and hand-drawn stars",
    description: "Sky-soft blues with a wink of gold — a gentle welcome for the tiniest guest.",
    tier: "seasonal",
    assets: ALL_ASSETS,
    gradient: "from-[#EAF2FB] via-[#B7D0EA] to-[#7091B8]",
    accent: "#7091B8",
  },
  {
    id: "graduation-gold",
    name: "Cap & Gold",
    category: "Graduation",
    styles: ["Modern", "Luxury", "Elegant"],
    palette: ["#0B1E3F", "#132C5B", "#C9A96A", "#F7F3EA"],
    fontPair: { display: "Playfair Display", body: "Inter" },
    motif: "Foiled tassels and academic seals",
    description: "A confident navy-and-gold moment for the graduate stepping into what's next.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#0B1E3F] via-[#132C5B] to-[#C9A96A]",
    accent: "#C9A96A",
  },
  {
    id: "harvest-fundraiser",
    name: "Harvest Table",
    category: "Fundraiser",
    styles: ["Rustic", "Seasonal", "Elegant"],
    palette: ["#F3E7D0", "#D89B60", "#7A3E1F", "#2F1D10"],
    fontPair: { display: "Fraunces", body: "Source Serif Pro" },
    motif: "Botanical illustrations and letterpress borders",
    description: "Warm, generous, and community-forward — designed to open wallets and hearts.",
    tier: "designer",
    assets: ALL_ASSETS,
    gradient: "from-[#F3E7D0] via-[#D89B60] to-[#2F1D10]",
    accent: "#7A3E1F",
  },
  {
    id: "school-showcase",
    name: "Bright Assembly",
    category: "School Event",
    styles: ["Colorful", "Modern", "Minimal"],
    palette: ["#FEF3C7", "#F59E0B", "#2563EB", "#1E293B"],
    fontPair: { display: "Poppins", body: "Nunito" },
    motif: "Confetti shapes and playful iconography",
    description: "Cheerful and unmistakably kid-friendly, without feeling juvenile.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#FEF3C7] via-[#F59E0B] to-[#2563EB]",
    accent: "#2563EB",
  },
  {
    id: "reunion-vintage",
    name: "Legacy Reunion",
    category: "Reunion",
    styles: ["Vintage", "Elegant"],
    palette: ["#F5EEDC", "#C6A664", "#4B3B2A", "#1F1710"],
    fontPair: { display: "Playfair Display", body: "Merriweather" },
    motif: "Archival photography frames and typewriter details",
    description: "Nostalgic without being sepia — a proud homecoming aesthetic.",
    tier: "free",
    assets: ALL_ASSETS,
    gradient: "from-[#F5EEDC] via-[#C6A664] to-[#4B3B2A]",
    accent: "#C6A664",
  },
  {
    id: "holiday-noir",
    name: "Midnight Noel",
    category: "Holiday Party",
    styles: ["Glam", "Seasonal", "Luxury", "Black Tie"],
    palette: ["#0A0F1A", "#1B2440", "#B91C1C", "#E4C767"],
    fontPair: { display: "Cormorant Garamond", body: "Inter" },
    motif: "Foil evergreen with velvet-dark backdrops",
    description: "Deep navy, red velvet, and warm gold — a jewel-box holiday soirée.",
    tier: "seasonal",
    assets: ALL_ASSETS,
    gradient: "from-[#0A0F1A] via-[#1B2440] to-[#E4C767]",
    accent: "#E4C767",
  },
  {
    id: "church-devotional",
    name: "Sanctuary",
    category: "Church Event",
    styles: ["Minimal", "Elegant", "Vintage"],
    palette: ["#F6F1E7", "#DCC9A6", "#6B4C2A", "#2C2013"],
    fontPair: { display: "Cormorant Garamond", body: "Lora" },
    motif: "Illuminated capitals and gilded borders",
    description: "Reverent, warm, and beautifully typeset — for gatherings that matter.",
    tier: "designer",
    assets: ALL_ASSETS,
    gradient: "from-[#F6F1E7] via-[#DCC9A6] to-[#6B4C2A]",
    accent: "#6B4C2A",
  },
  {
    id: "boho-bridal",
    name: "Desert Boho",
    category: "Bridal Shower",
    styles: ["Boho", "Rustic", "Colorful"],
    palette: ["#F3E1CB", "#E1A87A", "#A65E3B", "#3E2118"],
    fontPair: { display: "Cormorant Garamond", body: "Nunito" },
    motif: "Pampas grass silhouettes and terracotta washes",
    description: "Sun-baked terracotta and pampas grass for a free-spirited celebration.",
    tier: "premium",
    assets: ALL_ASSETS,
    gradient: "from-[#F3E1CB] via-[#E1A87A] to-[#3E2118]",
    accent: "#A65E3B",
  },
];

export const CATEGORIES: InspirationCategory[] = [
  "Wedding",
  "Birthday",
  "Baby Shower",
  "Bridal Shower",
  "Graduation",
  "Reunion",
  "Anniversary",
  "Corporate",
  "Holiday Party",
  "Church Event",
  "School Event",
  "Fundraiser",
];

export const STYLES: InspirationStyle[] = [
  "Elegant",
  "Luxury",
  "Modern",
  "Minimal",
  "Floral",
  "Rustic",
  "Boho",
  "Glam",
  "Black Tie",
  "Vintage",
  "Watercolor",
  "Seasonal",
  "Colorful",
];

const KEYWORD_STYLE_MAP: Record<string, InspirationStyle> = {
  elegant: "Elegant",
  luxury: "Luxury",
  luxe: "Luxury",
  modern: "Modern",
  minimal: "Minimal",
  simple: "Minimal",
  floral: "Floral",
  flower: "Floral",
  flowers: "Floral",
  rustic: "Rustic",
  boho: "Boho",
  bohemian: "Boho",
  glam: "Glam",
  glamour: "Glam",
  "black tie": "Black Tie",
  formal: "Black Tie",
  vintage: "Vintage",
  watercolor: "Watercolor",
  seasonal: "Seasonal",
  holiday: "Seasonal",
  colorful: "Colorful",
  bright: "Colorful",
};

const COLOR_HINTS: Record<string, string[]> = {
  sage: ["sage", "green"],
  green: ["sage", "green"],
  blush: ["blush", "pink"],
  pink: ["blush", "pink"],
  blue: ["blue", "navy"],
  navy: ["blue", "navy"],
  gold: ["gold"],
  black: ["black", "obsidian"],
  white: ["white", "ivory"],
  terracotta: ["terracotta"],
};

export function scoreCollection(c: InspirationCollection, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  let score = 0;
  if (c.name.toLowerCase().includes(q)) score += 6;
  if (c.description.toLowerCase().includes(q)) score += 2;
  if (c.category.toLowerCase().includes(q)) score += 4;
  for (const s of c.styles) if (q.includes(s.toLowerCase())) score += 3;
  for (const [kw, style] of Object.entries(KEYWORD_STYLE_MAP)) {
    if (q.includes(kw) && c.styles.includes(style)) score += 2;
  }
  for (const [kw, hints] of Object.entries(COLOR_HINTS)) {
    if (q.includes(kw)) {
      const blob = (c.name + " " + c.description + " " + c.motif).toLowerCase();
      if (hints.some((h) => blob.includes(h))) score += 3;
    }
  }
  return score;
}

export function aiRecommend(query: string, limit = 6): InspirationCollection[] {
  const scored = INSPIRATION_COLLECTIONS.map((c) => ({ c, s: scoreCollection(c, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.c);
  if (scored.length > 0) return scored;
  return INSPIRATION_COLLECTIONS.slice(0, limit);
}

export function recommendForEvent(eventType?: string | null, limit = 4): InspirationCollection[] {
  if (!eventType) return INSPIRATION_COLLECTIONS.slice(0, limit);
  const et = eventType.toLowerCase();
  const matches = INSPIRATION_COLLECTIONS.filter((c) => c.category.toLowerCase().includes(et) || et.includes(c.category.toLowerCase()));
  return (matches.length ? matches : INSPIRATION_COLLECTIONS).slice(0, limit);
}

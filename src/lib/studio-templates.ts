/** BridgeStudio template library — original designs, Fabric.js v6 JSON */

export type DesignCategory =
  | "invitation" | "save-the-date" | "rsvp" | "thank-you"
  | "birthday" | "program" | "menu" | "place-card"
  | "welcome-sign" | "social" | "poster" | "table-number";

export type DesignSize = { width: number; height: number; label: string };

export const DESIGN_SIZES: DesignSize[] = [
  { width: 480, height: 672, label: '5×7″ Invitation' },
  { width: 384, height: 576, label: '4×6″ Card' },
  { width: 384, height: 864, label: '4×9″ Menu' },
  { width: 384, height: 192, label: '4×2″ Place Card' },
  { width: 480, height: 480, label: '1:1 Social Post' },
  { width: 480, height: 270, label: '16:9 Banner' },
  { width: 288, height: 384, label: 'Table Number' },
  { width: 384, height: 512, label: 'Welcome Sign' },
];

export interface StudioTemplate {
  id: string;
  category: DesignCategory;
  name: string;
  width: number;
  height: number;
  /** CSS thumbnail colours for the home-screen preview card */
  thumbnail: { bg: string; accent: string; secondary: string };
  canvasJson: object;
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function text(overrides: Record<string, unknown>) {
  return {
    type: "textbox", version: "6.0.0",
    originX: "left", originY: "top",
    fontWeight: "normal", fontStyle: "normal",
    lineHeight: 1.3, underline: false, overline: false,
    linethrough: false, textAlign: "center", editable: true,
    splitByGrapheme: false, charSpacing: 0, ...overrides,
  };
}
function rect(overrides: Record<string, unknown>) {
  return {
    type: "rect", version: "6.0.0",
    originX: "left", originY: "top",
    rx: 0, ry: 0, fill: "transparent", stroke: null, strokeWidth: 1,
    selectable: true, ...overrides,
  };
}
function line(x1: number, y1: number, x2: number, y2: number, stroke: string, w = 1) {
  return {
    type: "line", version: "6.0.0",
    originX: "left", originY: "top",
    x1, y1, x2, y2, left: Math.min(x1, x2), top: Math.min(y1, y2),
    width: Math.abs(x2 - x1) || 1, height: Math.abs(y2 - y1) || 1,
    fill: "transparent", stroke, strokeWidth: w,
    selectable: true,
  };
}

// ─── Invitations ─────────────────────────────────────────────────────────────
const INVITATION_CLASSIC: StudioTemplate = {
  id: "inv-classic",
  category: "invitation",
  name: "Classic Ivory & Gold",
  width: 480, height: 672,
  thumbnail: { bg: "#F8F4ED", accent: "#C9A96E", secondary: "#4A3728" },
  canvasJson: {
    version: "6.0.0",
    background: "#F8F4ED",
    objects: [
      rect({ left: 28, top: 28, width: 424, height: 616, stroke: "#C9A96E", strokeWidth: 1.5 }),
      rect({ left: 34, top: 34, width: 412, height: 604, stroke: "#C9A96E", strokeWidth: 0.5 }),
      text({ left: 50, top: 100, width: 380, text: "YOU ARE CORDIALLY INVITED", fontSize: 10, fontFamily: "Lato", fill: "#9B8672", letterSpacing: 4, charSpacing: 200, fontWeight: "700" }),
      text({ left: 50, top: 140, width: 380, text: "{{event_name}}", fontSize: 42, fontFamily: "Playfair Display", fill: "#3B2F2F", lineHeight: 1.15 }),
      line(160, 255, 320, 255, "#C9A96E", 1),
      text({ left: 50, top: 270, width: 380, text: "{{event_date}}", fontSize: 14, fontFamily: "Cormorant Garamond", fill: "#5C4A3D", fontStyle: "italic" }),
      text({ left: 50, top: 302, width: 380, text: "{{venue}}", fontSize: 12, fontFamily: "Lato", fill: "#7A6355" }),
      line(160, 340, 320, 340, "#C9A96E", 1),
      text({ left: 50, top: 360, width: 380, text: "Hosted by", fontSize: 10, fontFamily: "Lato", fill: "#9B8672", charSpacing: 100 }),
      text({ left: 50, top: 383, width: 380, text: "{{host_names}}", fontSize: 16, fontFamily: "Cormorant Garamond", fill: "#3B2F2F" }),
      text({ left: 50, top: 560, width: 380, text: "Kindly RSVP by {{rsvp_date}}", fontSize: 10, fontFamily: "Lato", fill: "#9B8672" }),
    ],
  },
};

const INVITATION_MODERN: StudioTemplate = {
  id: "inv-modern",
  category: "invitation",
  name: "Modern Minimal",
  width: 480, height: 672,
  thumbnail: { bg: "#FFFFFF", accent: "#1A1A1A", secondary: "#888888" },
  canvasJson: {
    version: "6.0.0",
    background: "#FFFFFF",
    objects: [
      rect({ left: 0, top: 0, width: 8, height: 672, fill: "#1A1A1A", stroke: null }),
      text({ left: 40, top: 80, width: 420, textAlign: "left", text: "You're invited", fontSize: 12, fontFamily: "Lato", fill: "#888888", charSpacing: 200, fontWeight: "700" }),
      text({ left: 40, top: 108, width: 420, textAlign: "left", text: "{{event_name}}", fontSize: 48, fontFamily: "Montserrat", fill: "#1A1A1A", fontWeight: "700", lineHeight: 1.1 }),
      rect({ left: 40, top: 228, width: 80, height: 3, fill: "#1A1A1A", stroke: null }),
      text({ left: 40, top: 252, width: 420, textAlign: "left", text: "{{event_date}}", fontSize: 16, fontFamily: "Montserrat", fill: "#1A1A1A" }),
      text({ left: 40, top: 282, width: 420, textAlign: "left", text: "{{venue}}", fontSize: 13, fontFamily: "Lato", fill: "#666666" }),
      text({ left: 40, top: 330, width: 420, textAlign: "left", text: "Hosted by {{host_names}}", fontSize: 13, fontFamily: "Lato", fill: "#444444" }),
      text({ left: 40, top: 610, width: 420, textAlign: "left", text: "RSVP by {{rsvp_date}}", fontSize: 10, fontFamily: "Montserrat", fill: "#888888", charSpacing: 100 }),
    ],
  },
};

const INVITATION_BLUSH: StudioTemplate = {
  id: "inv-blush",
  category: "invitation",
  name: "Romantic Blush",
  width: 480, height: 672,
  thumbnail: { bg: "#F5E6E8", accent: "#C4788A", secondary: "#6B3D4A" },
  canvasJson: {
    version: "6.0.0",
    background: "#F5E6E8",
    objects: [
      rect({ left: 30, top: 30, width: 420, height: 612, stroke: "#C4788A", strokeWidth: 2, rx: 4, ry: 4 }),
      text({ left: 50, top: 90, width: 380, text: "~ Together with their families ~", fontSize: 11, fontFamily: "Dancing Script", fill: "#C4788A" }),
      text({ left: 50, top: 130, width: 380, text: "{{host_names}}", fontSize: 20, fontFamily: "Cormorant Garamond", fill: "#6B3D4A", fontStyle: "italic" }),
      text({ left: 50, top: 170, width: 380, text: "request the pleasure of your company", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#8B5B67" }),
      text({ left: 50, top: 200, width: 380, text: "to celebrate", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#8B5B67" }),
      text({ left: 50, top: 235, width: 380, text: "{{event_name}}", fontSize: 40, fontFamily: "Dancing Script", fill: "#6B3D4A", lineHeight: 1.2 }),
      line(160, 330, 320, 330, "#C4788A", 1),
      text({ left: 50, top: 348, width: 380, text: "{{event_date}}", fontSize: 14, fontFamily: "Cormorant Garamond", fill: "#6B3D4A", fontStyle: "italic" }),
      text({ left: 50, top: 378, width: 380, text: "at {{venue}}", fontSize: 12, fontFamily: "Cormorant Garamond", fill: "#8B5B67" }),
      text({ left: 50, top: 580, width: 380, text: "Kindly reply by {{rsvp_date}}", fontSize: 10, fontFamily: "Cormorant Garamond", fill: "#9B7080", fontStyle: "italic" }),
    ],
  },
};

// ─── Save the Date ────────────────────────────────────────────────────────────
const STD_SCRIPT: StudioTemplate = {
  id: "std-script",
  category: "save-the-date",
  name: "Elegant Script",
  width: 384, height: 576,
  thumbnail: { bg: "#FAFAF7", accent: "#8B7355", secondary: "#333333" },
  canvasJson: {
    version: "6.0.0",
    background: "#FAFAF7",
    objects: [
      rect({ left: 24, top: 24, width: 336, height: 528, stroke: "#CCBA9A", strokeWidth: 1 }),
      text({ left: 40, top: 80, width: 304, text: "Save the Date", fontSize: 36, fontFamily: "Great Vibes", fill: "#8B7355" }),
      line(120, 148, 264, 148, "#CCBA9A", 1),
      text({ left: 40, top: 168, width: 304, text: "{{event_name}}", fontSize: 22, fontFamily: "Playfair Display", fill: "#2D2D2D", lineHeight: 1.2 }),
      text({ left: 40, top: 230, width: 304, text: "{{event_date}}", fontSize: 15, fontFamily: "Lato", fill: "#5C5045" }),
      text({ left: 40, top: 260, width: 304, text: "{{venue}}", fontSize: 12, fontFamily: "Lato", fill: "#8B7355", fontStyle: "italic" }),
      text({ left: 40, top: 490, width: 304, text: "Formal invitation to follow", fontSize: 10, fontFamily: "Lato", fill: "#AFA090", charSpacing: 80 }),
    ],
  },
};

const STD_BOLD: StudioTemplate = {
  id: "std-bold",
  category: "save-the-date",
  name: "Bold & Modern",
  width: 384, height: 576,
  thumbnail: { bg: "#1A1A2E", accent: "#E8C84A", secondary: "#FFFFFF" },
  canvasJson: {
    version: "6.0.0",
    background: "#1A1A2E",
    objects: [
      rect({ left: 0, top: 0, width: 384, height: 6, fill: "#E8C84A", stroke: null }),
      rect({ left: 0, top: 570, width: 384, height: 6, fill: "#E8C84A", stroke: null }),
      text({ left: 30, top: 50, width: 324, textAlign: "left", text: "SAVE", fontSize: 64, fontFamily: "Montserrat", fill: "#FFFFFF", fontWeight: "700", lineHeight: 1 }),
      text({ left: 30, top: 114, width: 324, textAlign: "left", text: "THE", fontSize: 64, fontFamily: "Montserrat", fill: "#E8C84A", fontWeight: "700", lineHeight: 1 }),
      text({ left: 30, top: 178, width: 324, textAlign: "left", text: "DATE", fontSize: 64, fontFamily: "Montserrat", fill: "#FFFFFF", fontWeight: "700", lineHeight: 1 }),
      rect({ left: 30, top: 265, width: 80, height: 3, fill: "#E8C84A", stroke: null }),
      text({ left: 30, top: 285, width: 324, textAlign: "left", text: "{{event_name}}", fontSize: 20, fontFamily: "Lato", fill: "#FFFFFF", lineHeight: 1.2 }),
      text({ left: 30, top: 340, width: 324, textAlign: "left", text: "{{event_date}}", fontSize: 14, fontFamily: "Montserrat", fill: "#E8C84A" }),
      text({ left: 30, top: 368, width: 324, textAlign: "left", text: "{{venue}}", fontSize: 12, fontFamily: "Lato", fill: "#AAAAAA" }),
    ],
  },
};

const STD_BOTANICAL: StudioTemplate = {
  id: "std-botanical",
  category: "save-the-date",
  name: "Garden Botanical",
  width: 384, height: 576,
  thumbnail: { bg: "#E8EDE0", accent: "#4A6741", secondary: "#2D3B2A" },
  canvasJson: {
    version: "6.0.0",
    background: "#E8EDE0",
    objects: [
      rect({ left: 0, top: 0, width: 384, height: 12, fill: "#4A6741", stroke: null }),
      rect({ left: 0, top: 12, width: 384, height: 4, fill: "#7B9E6E", stroke: null }),
      rect({ left: 0, top: 560, width: 384, height: 16, fill: "#4A6741", stroke: null }),
      text({ left: 30, top: 52, width: 324, textAlign: "left", text: "Save the Date", fontSize: 30, fontFamily: "Playfair Display", fill: "#2D3B2A", fontStyle: "italic" }),
      line(30, 98, 354, 98, "#4A6741", 1),
      text({ left: 30, top: 120, width: 324, textAlign: "left", text: "{{event_name}}", fontSize: 26, fontFamily: "Cormorant Garamond", fill: "#2D3B2A", lineHeight: 1.2 }),
      text({ left: 30, top: 200, width: 324, textAlign: "left", text: "{{event_date}}", fontSize: 14, fontFamily: "Lato", fill: "#4A6741", fontWeight: "700" }),
      text({ left: 30, top: 226, width: 324, textAlign: "left", text: "{{venue}}", fontSize: 12, fontFamily: "Lato", fill: "#5C7350" }),
      text({ left: 30, top: 530, width: 324, textAlign: "left", text: "Formal invitation to follow", fontSize: 9, fontFamily: "Lato", fill: "#7B9E6E", charSpacing: 100 }),
    ],
  },
};

// ─── RSVP Card ────────────────────────────────────────────────────────────────
const RSVP_CLASSIC: StudioTemplate = {
  id: "rsvp-classic",
  category: "rsvp",
  name: "Classic Formal",
  width: 384, height: 240,
  thumbnail: { bg: "#FAFAF7", accent: "#9B8672", secondary: "#2D2D2D" },
  canvasJson: {
    version: "6.0.0",
    background: "#FAFAF7",
    objects: [
      rect({ left: 18, top: 18, width: 348, height: 204, stroke: "#CCBA9A", strokeWidth: 1.5 }),
      text({ left: 30, top: 32, width: 324, text: "RSVP", fontSize: 11, fontFamily: "Lato", fill: "#9B8672", charSpacing: 300, fontWeight: "700" }),
      text({ left: 30, top: 52, width: 324, text: "Kindly reply by {{rsvp_date}}", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#555555", fontStyle: "italic" }),
      line(30, 78, 354, 78, "#CCBA9A", 0.5),
      text({ left: 30, top: 92, width: 80, textAlign: "left", text: "Name:", fontSize: 10, fontFamily: "Lato", fill: "#9B8672" }),
      rect({ left: 100, top: 90, width: 260, height: 14, stroke: "#CCBA9A", strokeWidth: 0.5, fill: "transparent" }),
      text({ left: 30, top: 120, width: 180, textAlign: "left", text: "□  Accepts with pleasure", fontSize: 9, fontFamily: "Lato", fill: "#555555" }),
      text({ left: 30, top: 142, width: 180, textAlign: "left", text: "□  Declines with regrets", fontSize: 9, fontFamily: "Lato", fill: "#555555" }),
      text({ left: 210, top: 120, width: 160, textAlign: "left", text: "Meal preference:", fontSize: 9, fontFamily: "Lato", fill: "#9B8672" }),
      text({ left: 210, top: 138, width: 160, textAlign: "left", text: "□  Chicken  □  Fish  □  Veg", fontSize: 9, fontFamily: "Lato", fill: "#555555" }),
    ],
  },
};

const RSVP_MODERN: StudioTemplate = {
  id: "rsvp-modern",
  category: "rsvp",
  name: "Modern Clean",
  width: 384, height: 240,
  thumbnail: { bg: "#FFFFFF", accent: "#1A1A1A", secondary: "#666666" },
  canvasJson: {
    version: "6.0.0",
    background: "#FFFFFF",
    objects: [
      rect({ left: 0, top: 0, width: 6, height: 240, fill: "#1A1A1A", stroke: null }),
      text({ left: 24, top: 24, width: 340, textAlign: "left", text: "RSVP", fontSize: 10, fontFamily: "Montserrat", fill: "#AAAAAA", charSpacing: 300, fontWeight: "700" }),
      text({ left: 24, top: 42, width: 340, textAlign: "left", text: "Reply by {{rsvp_date}}", fontSize: 18, fontFamily: "Montserrat", fill: "#1A1A1A", fontWeight: "700" }),
      rect({ left: 24, top: 84, width: 60, height: 3, fill: "#1A1A1A", stroke: null }),
      text({ left: 24, top: 105, width: 80, textAlign: "left", text: "Name", fontSize: 9, fontFamily: "Lato", fill: "#888888" }),
      rect({ left: 24, top: 118, width: 340, height: 1, fill: "#CCCCCC", stroke: null }),
      text({ left: 24, top: 138, width: 160, textAlign: "left", text: "□  Will attend", fontSize: 10, fontFamily: "Lato", fill: "#333333" }),
      text({ left: 24, top: 160, width: 160, textAlign: "left", text: "□  Cannot attend", fontSize: 10, fontFamily: "Lato", fill: "#333333" }),
      text({ left: 200, top: 138, width: 164, textAlign: "left", text: "Number of guests:", fontSize: 9, fontFamily: "Lato", fill: "#888888" }),
      rect({ left: 200, top: 155, width: 164, height: 1, fill: "#CCCCCC", stroke: null }),
    ],
  },
};

// ─── Menu ─────────────────────────────────────────────────────────────────────
const MENU_ELEGANT: StudioTemplate = {
  id: "menu-elegant",
  category: "menu",
  name: "Elegant Dinner",
  width: 384, height: 864,
  thumbnail: { bg: "#1C1C1C", accent: "#C9A96E", secondary: "#F5F0E8" },
  canvasJson: {
    version: "6.0.0",
    background: "#1C1C1C",
    objects: [
      rect({ left: 30, top: 30, width: 324, height: 804, stroke: "#C9A96E", strokeWidth: 1 }),
      text({ left: 40, top: 70, width: 304, text: "DINNER MENU", fontSize: 10, fontFamily: "Lato", fill: "#C9A96E", charSpacing: 300, fontWeight: "700" }),
      text({ left: 40, top: 96, width: 304, text: "{{event_name}}", fontSize: 28, fontFamily: "Playfair Display", fill: "#F5F0E8", lineHeight: 1.15 }),
      line(120, 160, 264, 160, "#C9A96E", 0.5),
      text({ left: 40, top: 180, width: 304, text: "Starter", fontSize: 9, fontFamily: "Lato", fill: "#C9A96E", charSpacing: 200, fontWeight: "700" }),
      text({ left: 40, top: 200, width: 304, textAlign: "left", text: "Heirloom Tomato Salad", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#F5F0E8", fontWeight: "700" }),
      text({ left: 40, top: 218, width: 304, textAlign: "left", text: "Burrata, basil oil, aged balsamic", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#AAAAAA", fontStyle: "italic" }),
      text({ left: 40, top: 260, width: 304, textAlign: "left", text: "Wild Mushroom Bisque", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#F5F0E8", fontWeight: "700" }),
      text({ left: 40, top: 278, width: 304, textAlign: "left", text: "Truffle cream, chives, sourdough crisp", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#AAAAAA", fontStyle: "italic" }),
      line(40, 316, 344, 316, "#333333", 0.5),
      text({ left: 40, top: 330, width: 304, text: "Main Course", fontSize: 9, fontFamily: "Lato", fill: "#C9A96E", charSpacing: 200, fontWeight: "700" }),
      text({ left: 40, top: 350, width: 304, textAlign: "left", text: "Herb-Roasted Chicken", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#F5F0E8", fontWeight: "700" }),
      text({ left: 40, top: 368, width: 304, textAlign: "left", text: "Roasted garlic jus, seasonal vegetables", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#AAAAAA", fontStyle: "italic" }),
      text({ left: 40, top: 406, width: 304, textAlign: "left", text: "Pan-Seared Atlantic Salmon", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#F5F0E8", fontWeight: "700" }),
      text({ left: 40, top: 424, width: 304, textAlign: "left", text: "Lemon caper butter, wild rice pilaf", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#AAAAAA", fontStyle: "italic" }),
      text({ left: 40, top: 462, width: 304, textAlign: "left", text: "Wild Mushroom Risotto (v)", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#F5F0E8", fontWeight: "700" }),
      text({ left: 40, top: 480, width: 304, textAlign: "left", text: "Parmesan, truffle oil, fresh herbs", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#AAAAAA", fontStyle: "italic" }),
      line(40, 520, 344, 520, "#333333", 0.5),
      text({ left: 40, top: 534, width: 304, text: "Dessert", fontSize: 9, fontFamily: "Lato", fill: "#C9A96E", charSpacing: 200, fontWeight: "700" }),
      text({ left: 40, top: 554, width: 304, textAlign: "left", text: "Celebration Cake", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#F5F0E8", fontWeight: "700" }),
      text({ left: 40, top: 572, width: 304, textAlign: "left", text: "Vanilla sponge, champagne buttercream", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#AAAAAA", fontStyle: "italic" }),
      text({ left: 40, top: 800, width: 304, text: "{{event_date}}", fontSize: 10, fontFamily: "Lato", fill: "#666666" }),
    ],
  },
};

const MENU_MODERN: StudioTemplate = {
  id: "menu-modern",
  category: "menu",
  name: "Modern Minimalist",
  width: 384, height: 864,
  thumbnail: { bg: "#F9F9F6", accent: "#2D2D2D", secondary: "#888888" },
  canvasJson: {
    version: "6.0.0",
    background: "#F9F9F6",
    objects: [
      rect({ left: 0, top: 0, width: 384, height: 8, fill: "#2D2D2D", stroke: null }),
      text({ left: 40, top: 40, width: 304, textAlign: "left", text: "MENU", fontSize: 9, fontFamily: "Montserrat", fill: "#AAAAAA", charSpacing: 400, fontWeight: "700" }),
      text({ left: 40, top: 60, width: 304, textAlign: "left", text: "{{event_name}}", fontSize: 30, fontFamily: "Montserrat", fill: "#2D2D2D", fontWeight: "700", lineHeight: 1.1 }),
      text({ left: 40, top: 120, width: 304, textAlign: "left", text: "{{event_date}}", fontSize: 11, fontFamily: "Lato", fill: "#888888" }),
      rect({ left: 40, top: 152, width: 304, height: 1, fill: "#DDDDDD", stroke: null }),
      text({ left: 40, top: 172, width: 304, textAlign: "left", text: "TO START", fontSize: 8, fontFamily: "Montserrat", fill: "#888888", charSpacing: 300, fontWeight: "700" }),
      text({ left: 40, top: 192, width: 220, textAlign: "left", text: "Seasonal Garden Salad", fontSize: 13, fontFamily: "Lato", fill: "#2D2D2D", fontWeight: "700" }),
      text({ left: 40, top: 210, width: 304, textAlign: "left", text: "Mixed greens, cherry tomatoes, house dressing", fontSize: 11, fontFamily: "Lato", fill: "#888888" }),
      rect({ left: 40, top: 242, width: 304, height: 0.5, fill: "#EEEEEE", stroke: null }),
      text({ left: 40, top: 260, width: 304, textAlign: "left", text: "MAINS", fontSize: 8, fontFamily: "Montserrat", fill: "#888888", charSpacing: 300, fontWeight: "700" }),
      text({ left: 40, top: 280, width: 220, textAlign: "left", text: "Herb-Crusted Chicken", fontSize: 13, fontFamily: "Lato", fill: "#2D2D2D", fontWeight: "700" }),
      text({ left: 40, top: 298, width: 304, textAlign: "left", text: "Roasted vegetables, rosemary jus", fontSize: 11, fontFamily: "Lato", fill: "#888888" }),
      text({ left: 40, top: 330, width: 220, textAlign: "left", text: "Atlantic Salmon", fontSize: 13, fontFamily: "Lato", fill: "#2D2D2D", fontWeight: "700" }),
      text({ left: 40, top: 348, width: 304, textAlign: "left", text: "Dill cream, asparagus, lemon", fontSize: 11, fontFamily: "Lato", fill: "#888888" }),
      text({ left: 40, top: 380, width: 220, textAlign: "left", text: "Roasted Mushroom Tart (v)", fontSize: 13, fontFamily: "Lato", fill: "#2D2D2D", fontWeight: "700" }),
      text({ left: 40, top: 398, width: 304, textAlign: "left", text: "Gruyère, caramelised onion, fresh herbs", fontSize: 11, fontFamily: "Lato", fill: "#888888" }),
      rect({ left: 40, top: 430, width: 304, height: 0.5, fill: "#EEEEEE", stroke: null }),
      text({ left: 40, top: 448, width: 304, textAlign: "left", text: "DESSERT", fontSize: 8, fontFamily: "Montserrat", fill: "#888888", charSpacing: 300, fontWeight: "700" }),
      text({ left: 40, top: 468, width: 220, textAlign: "left", text: "Celebration Cake", fontSize: 13, fontFamily: "Lato", fill: "#2D2D2D", fontWeight: "700" }),
      text({ left: 40, top: 486, width: 304, textAlign: "left", text: "Seasonal fruits, honey cream", fontSize: 11, fontFamily: "Lato", fill: "#888888" }),
    ],
  },
};

// ─── Welcome Sign ─────────────────────────────────────────────────────────────
const WELCOME_CLASSIC: StudioTemplate = {
  id: "welcome-classic",
  category: "welcome-sign",
  name: "Welcome Sign",
  width: 384, height: 512,
  thumbnail: { bg: "#F0EBE0", accent: "#6B4E3D", secondary: "#C9A96E" },
  canvasJson: {
    version: "6.0.0",
    background: "#F0EBE0",
    objects: [
      rect({ left: 24, top: 24, width: 336, height: 464, stroke: "#C9A96E", strokeWidth: 2 }),
      rect({ left: 30, top: 30, width: 324, height: 452, stroke: "#C9A96E", strokeWidth: 0.5 }),
      text({ left: 40, top: 70, width: 304, text: "Welcome to", fontSize: 14, fontFamily: "Cormorant Garamond", fill: "#8B7355", fontStyle: "italic" }),
      text({ left: 40, top: 98, width: 304, text: "{{event_name}}", fontSize: 38, fontFamily: "Playfair Display", fill: "#3B2A1A", lineHeight: 1.15 }),
      line(100, 200, 284, 200, "#C9A96E", 1),
      text({ left: 40, top: 220, width: 304, text: "{{event_date}}", fontSize: 14, fontFamily: "Lato", fill: "#5C4A3D" }),
      text({ left: 40, top: 246, width: 304, text: "{{venue}}", fontSize: 12, fontFamily: "Lato", fill: "#8B7355", fontStyle: "italic" }),
      line(100, 290, 284, 290, "#C9A96E", 1),
      text({ left: 40, top: 314, width: 304, text: "Hosted by {{host_names}}", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#5C4A3D" }),
      text({ left: 40, top: 450, width: 304, text: "Please sign the guest book ♡", fontSize: 10, fontFamily: "Cormorant Garamond", fill: "#9B8672", fontStyle: "italic" }),
    ],
  },
};

// ─── Social Post ──────────────────────────────────────────────────────────────
const SOCIAL_ANNOUNCE: StudioTemplate = {
  id: "social-announce",
  category: "social",
  name: "Event Announcement",
  width: 480, height: 480,
  thumbnail: { bg: "#1A1A2E", accent: "#E8C84A", secondary: "#FFFFFF" },
  canvasJson: {
    version: "6.0.0",
    background: "#1A1A2E",
    objects: [
      rect({ left: 0, top: 0, width: 480, height: 480, fill: "transparent", stroke: "#E8C84A", strokeWidth: 12 }),
      text({ left: 40, top: 60, width: 400, text: "YOU'RE INVITED", fontSize: 12, fontFamily: "Montserrat", fill: "#E8C84A", charSpacing: 300, fontWeight: "700" }),
      text({ left: 40, top: 110, width: 400, text: "{{event_name}}", fontSize: 46, fontFamily: "Playfair Display", fill: "#FFFFFF", lineHeight: 1.1 }),
      line(120, 270, 360, 270, "#E8C84A", 2),
      text({ left: 40, top: 290, width: 400, text: "{{event_date}}", fontSize: 16, fontFamily: "Lato", fill: "#E8C84A", fontWeight: "700" }),
      text({ left: 40, top: 318, width: 400, text: "{{venue}}", fontSize: 13, fontFamily: "Lato", fill: "#AAAAAA" }),
      text({ left: 40, top: 410, width: 400, text: "Link in bio to RSVP", fontSize: 11, fontFamily: "Lato", fill: "#E8C84A", charSpacing: 100 }),
    ],
  },
};

const SOCIAL_BLUSH: StudioTemplate = {
  id: "social-blush",
  category: "social",
  name: "Blush & Gold",
  width: 480, height: 480,
  thumbnail: { bg: "#F9EDE8", accent: "#C07A5A", secondary: "#3B2A1A" },
  canvasJson: {
    version: "6.0.0",
    background: "#F9EDE8",
    objects: [
      rect({ left: 20, top: 20, width: 440, height: 440, stroke: "#D4937A", strokeWidth: 1.5 }),
      text({ left: 40, top: 80, width: 400, text: "{{event_name}}", fontSize: 40, fontFamily: "Dancing Script", fill: "#3B2A1A", lineHeight: 1.15 }),
      text({ left: 40, top: 200, width: 400, text: "is happening!", fontSize: 18, fontFamily: "Cormorant Garamond", fill: "#C07A5A", fontStyle: "italic" }),
      line(140, 240, 340, 240, "#D4937A", 1),
      text({ left: 40, top: 260, width: 400, text: "{{event_date}}", fontSize: 16, fontFamily: "Cormorant Garamond", fill: "#5C3D2A" }),
      text({ left: 40, top: 290, width: 400, text: "{{venue}}", fontSize: 13, fontFamily: "Lato", fill: "#9B7060", fontStyle: "italic" }),
      text({ left: 40, top: 390, width: 400, text: "RSVP in bio ♡", fontSize: 13, fontFamily: "Lato", fill: "#C07A5A" }),
    ],
  },
};

// ─── Table Number ─────────────────────────────────────────────────────────────
const TABLE_CLASSIC: StudioTemplate = {
  id: "table-classic",
  category: "table-number",
  name: "Classic Table Card",
  width: 288, height: 384,
  thumbnail: { bg: "#FAFAF7", accent: "#9B8672", secondary: "#2D2D2D" },
  canvasJson: {
    version: "6.0.0",
    background: "#FAFAF7",
    objects: [
      rect({ left: 18, top: 18, width: 252, height: 348, stroke: "#CCBA9A", strokeWidth: 1.5 }),
      text({ left: 30, top: 60, width: 228, text: "TABLE", fontSize: 10, fontFamily: "Lato", fill: "#9B8672", charSpacing: 400, fontWeight: "700" }),
      text({ left: 30, top: 130, width: 228, text: "1", fontSize: 96, fontFamily: "Playfair Display", fill: "#2D2D2D" }),
      line(80, 280, 208, 280, "#CCBA9A", 1),
      text({ left: 30, top: 300, width: 228, text: "{{event_name}}", fontSize: 11, fontFamily: "Cormorant Garamond", fill: "#9B8672", fontStyle: "italic" }),
    ],
  },
};

// ─── Thank You ────────────────────────────────────────────────────────────────
const THANKYOU_CLASSIC: StudioTemplate = {
  id: "thankyou-classic",
  category: "thank-you",
  name: "Classic Thank You",
  width: 384, height: 276,
  thumbnail: { bg: "#F8F4ED", accent: "#9B8672", secondary: "#3B2F2F" },
  canvasJson: {
    version: "6.0.0",
    background: "#F8F4ED",
    objects: [
      rect({ left: 18, top: 18, width: 348, height: 240, stroke: "#CCBA9A", strokeWidth: 1.5 }),
      text({ left: 30, top: 48, width: 324, text: "Thank You", fontSize: 36, fontFamily: "Great Vibes", fill: "#6B4E3D" }),
      line(100, 104, 284, 104, "#CCBA9A", 1),
      text({ left: 30, top: 120, width: 324, text: "for being a part of {{event_name}}", fontSize: 13, fontFamily: "Cormorant Garamond", fill: "#5C4A3D", fontStyle: "italic" }),
      text({ left: 30, top: 148, width: 324, text: "Your presence made it truly special.", fontSize: 12, fontFamily: "Cormorant Garamond", fill: "#7A6355" }),
      text({ left: 30, top: 210, width: 324, text: "With love, {{host_names}}", fontSize: 12, fontFamily: "Cormorant Garamond", fill: "#6B4E3D", fontStyle: "italic" }),
    ],
  },
};

// ─── Birthday ──────────────────────────────────────────────────────────────────
const BIRTHDAY_PARTY: StudioTemplate = {
  id: "birthday-party",
  category: "birthday",
  name: "Birthday Celebration",
  width: 480, height: 672,
  thumbnail: { bg: "#FFF0E8", accent: "#FF6B6B", secondary: "#FF9A5C" },
  canvasJson: {
    version: "6.0.0",
    background: "#FFF0E8",
    objects: [
      rect({ left: 0, top: 0, width: 480, height: 12, fill: "#FF6B6B", stroke: null }),
      rect({ left: 0, top: 660, width: 480, height: 12, fill: "#FF6B6B", stroke: null }),
      rect({ left: 0, top: 12, width: 480, height: 6, fill: "#FF9A5C", stroke: null }),
      rect({ left: 0, top: 654, width: 480, height: 6, fill: "#FF9A5C", stroke: null }),
      text({ left: 40, top: 70, width: 400, text: "You're Invited to", fontSize: 14, fontFamily: "Lato", fill: "#FF6B6B", fontWeight: "700" }),
      text({ left: 40, top: 100, width: 400, text: "{{event_name}}", fontSize: 40, fontFamily: "Montserrat", fill: "#2D2D2D", fontWeight: "700", lineHeight: 1.1 }),
      line(80, 200, 400, 200, "#FF9A5C", 2),
      text({ left: 40, top: 220, width: 400, text: "🎉  Let's Celebrate!", fontSize: 18, fontFamily: "Lato", fill: "#FF6B6B" }),
      line(80, 258, 400, 258, "#FF9A5C", 2),
      text({ left: 40, top: 280, width: 400, text: "Date:", fontSize: 11, fontFamily: "Lato", fill: "#888888", fontWeight: "700", textAlign: "left" }),
      text({ left: 40, top: 298, width: 400, textAlign: "left", text: "{{event_date}}", fontSize: 16, fontFamily: "Montserrat", fill: "#2D2D2D" }),
      text({ left: 40, top: 336, width: 400, textAlign: "left", text: "Where:", fontSize: 11, fontFamily: "Lato", fill: "#888888", fontWeight: "700" }),
      text({ left: 40, top: 354, width: 400, textAlign: "left", text: "{{venue}}", fontSize: 16, fontFamily: "Montserrat", fill: "#2D2D2D" }),
      text({ left: 40, top: 620, width: 400, text: "RSVP by {{rsvp_date}}  ·  Hosted by {{host_names}}", fontSize: 10, fontFamily: "Lato", fill: "#AAAAAA" }),
    ],
  },
};

// ─── Place Card ───────────────────────────────────────────────────────────────
const PLACE_CARD: StudioTemplate = {
  id: "place-card",
  category: "place-card",
  name: "Elegant Place Card",
  width: 288, height: 192,
  thumbnail: { bg: "#F8F4ED", accent: "#C9A96E", secondary: "#3B2F2F" },
  canvasJson: {
    version: "6.0.0",
    background: "#F8F4ED",
    objects: [
      rect({ left: 16, top: 16, width: 256, height: 160, stroke: "#C9A96E", strokeWidth: 1 }),
      line(84, 96, 204, 96, "#C9A96E", 0.5),
      text({ left: 24, top: 48, width: 240, text: "Guest Name", fontSize: 22, fontFamily: "Great Vibes", fill: "#3B2F2F" }),
      text({ left: 24, top: 110, width: 240, text: "{{event_name}}", fontSize: 9, fontFamily: "Lato", fill: "#9B8672", charSpacing: 100 }),
    ],
  },
};

// ─── Exports ──────────────────────────────────────────────────────────────────
export const ALL_TEMPLATES: StudioTemplate[] = [
  INVITATION_CLASSIC, INVITATION_MODERN, INVITATION_BLUSH,
  STD_SCRIPT, STD_BOLD, STD_BOTANICAL,
  RSVP_CLASSIC, RSVP_MODERN,
  MENU_ELEGANT, MENU_MODERN,
  WELCOME_CLASSIC,
  SOCIAL_ANNOUNCE, SOCIAL_BLUSH,
  TABLE_CLASSIC,
  THANKYOU_CLASSIC,
  BIRTHDAY_PARTY,
  PLACE_CARD,
];

export const CATEGORY_LABELS: Record<DesignCategory, string> = {
  invitation: "Invitations",
  "save-the-date": "Save the Date",
  rsvp: "RSVP Cards",
  "thank-you": "Thank You",
  birthday: "Birthday",
  program: "Programs",
  menu: "Menus",
  "place-card": "Place Cards",
  "welcome-sign": "Welcome Signs",
  social: "Social Posts",
  poster: "Posters",
  "table-number": "Table Numbers",
};

export const CATEGORY_ORDER: DesignCategory[] = [
  "invitation", "save-the-date", "rsvp", "menu", "welcome-sign",
  "social", "table-number", "place-card", "thank-you", "birthday", "program", "poster",
];

export function getTemplatesByCategory(category: DesignCategory): StudioTemplate[] {
  return ALL_TEMPLATES.filter((t) => t.category === category);
}

export function getTemplate(id: string): StudioTemplate | undefined {
  return ALL_TEMPLATES.find((t) => t.id === id);
}

/** Replace {{token}} placeholders in a Fabric.js JSON string */
export function applyEventTokens(
  canvasJson: object,
  tokens: Record<string, string>,
): object {
  let str = JSON.stringify(canvasJson);
  for (const [key, val] of Object.entries(tokens)) {
    str = str.replaceAll(`{{${key}}}`, val.replace(/\\/g, "\\\\").replace(/"/g, '\\"'));
  }
  return JSON.parse(str);
}

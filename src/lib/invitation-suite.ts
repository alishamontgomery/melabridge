import type { InspirationCollection } from "@/lib/inspiration-collections";
import { jsPDF } from "jspdf";

export type SuitePieceId =
  | "invitation"
  | "rsvp"
  | "details"
  | "envelope"
  | "digital"
  | "instagram"
  | "facebook"
  | "email"
  | "sms"
  | "qr"
  | "pdf"
  | "thankyou"
  | "menu"
  | "seating"
  | "place"
  | "welcome"
  | "program";

export type SuitePiece = {
  id: SuitePieceId;
  label: string;
  group: "Print" | "Digital" | "Signage" | "Social";
  aspect: string;
};

export const SUITE_PIECES: SuitePiece[] = [
  { id: "invitation", label: "Invitation", group: "Print", aspect: "3/4" },
  { id: "rsvp", label: "RSVP Card", group: "Print", aspect: "4/3" },
  { id: "details", label: "Details Card", group: "Print", aspect: "4/3" },
  { id: "envelope", label: "Envelope", group: "Print", aspect: "16/9" },
  { id: "thankyou", label: "Thank You Card", group: "Print", aspect: "4/3" },
  { id: "menu", label: "Menu", group: "Print", aspect: "3/4" },
  { id: "seating", label: "Seating Chart", group: "Signage", aspect: "3/4" },
  { id: "place", label: "Place Card", group: "Print", aspect: "16/9" },
  { id: "welcome", label: "Welcome Sign", group: "Signage", aspect: "3/4" },
  { id: "program", label: "Program", group: "Print", aspect: "3/4" },
  { id: "digital", label: "Digital Invite", group: "Digital", aspect: "9/16" },
  { id: "instagram", label: "Instagram Story", group: "Social", aspect: "9/16" },
  { id: "facebook", label: "Facebook Event", group: "Social", aspect: "16/9" },
  { id: "email", label: "Email Invite", group: "Digital", aspect: "3/4" },
  { id: "sms", label: "SMS Version", group: "Digital", aspect: "9/16" },
  { id: "qr", label: "Guest QR Code", group: "Digital", aspect: "1/1" },
];

export type Personalization = {
  title: string;
  hosts: string;
  dateLabel: string;
  timeLabel: string;
  venue: string;
  dressCode?: string;
  rsvpDeadline?: string;
  registry?: string;
  language?: string;
  message?: string;
};

export function defaultPersonalization(): Personalization {
  return {
    title: "Our Celebration",
    hosts: "The Harper Family",
    dateLabel: "Saturday, September 14",
    timeLabel: "5:00 in the evening",
    venue: "The Rosewood Estate",
    dressCode: "Cocktail",
    rsvpDeadline: "Please respond by August 20",
    registry: "",
    language: "English",
    message: "Together with joyful hearts, we invite you to celebrate with us.",
  };
}

/** Build a shareable link that carries the invitation payload in the URL hash. */
export function buildShareToken(collectionId: string, p: Personalization): string {
  const payload = { c: collectionId, p };
  if (typeof window === "undefined") return "";
  const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  return b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function parseShareToken(token: string): { c: string; p: Personalization } | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(escape(atob(b64 + "===".slice((b64.length + 3) % 4))));
    const parsed = JSON.parse(json);
    if (parsed?.c && parsed?.p) return parsed as { c: string; p: Personalization };
    return null;
  } catch {
    return null;
  }
}

/** Simple text-based printable PDF using jsPDF only (no html2canvas). */
export function generateInvitationPdf(collection: InspirationCollection, p: Personalization) {
  const doc = new jsPDF({ unit: "pt", format: [432, 576] }); // 6x8 inch card
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  // Background wash
  doc.setFillColor(hexToRgb(collection.palette[0]).r, hexToRgb(collection.palette[0]).g, hexToRgb(collection.palette[0]).b);
  doc.rect(0, 0, w, h, "F");

  const accent = hexToRgb(collection.accent);
  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.setLineWidth(1);
  doc.rect(24, 24, w - 48, h - 48);

  const dark = hexToRgb("#2E2A24");
  doc.setTextColor(dark.r, dark.g, dark.b);

  doc.setFont("times", "italic");
  doc.setFontSize(10);
  doc.text("TOGETHER WITH THEIR FAMILIES", w / 2, 84, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(28);
  doc.text(p.hosts, w / 2, 160, { align: "center" });

  doc.setDrawColor(accent.r, accent.g, accent.b);
  doc.line(w / 2 - 40, 180, w / 2 + 40, 180);

  doc.setFontSize(11);
  doc.text("invite you to celebrate", w / 2, 210, { align: "center" });

  doc.setFont("times", "italic");
  doc.setFontSize(20);
  doc.text(p.title, w / 2, 250, { align: "center" });

  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.text(p.dateLabel, w / 2, h - 180, { align: "center" });
  doc.text(p.timeLabel, w / 2, h - 158, { align: "center" });
  doc.text(p.venue, w / 2, h - 136, { align: "center" });

  if (p.dressCode) {
    doc.setFontSize(9);
    doc.text(`ATTIRE · ${p.dressCode.toUpperCase()}`, w / 2, h - 100, { align: "center" });
  }
  if (p.rsvpDeadline) {
    doc.setFontSize(9);
    doc.text(p.rsvpDeadline, w / 2, h - 80, { align: "center" });
  }

  return doc;
}

function hexToRgb(hex: string) {
  const s = hex.replace("#", "");
  const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

export const SAMPLE_HOSTS = [
  "Olivia & Ethan",
  "Sophia & Noah",
  "Amelia & James",
  "Harper & Lucas",
  "Charlotte & Benjamin",
  "The Anderson Family",
  "The Wilson Family",
  "The Morgan Celebration",
  "The Harper Wedding",
  "The Annual Gala",
];

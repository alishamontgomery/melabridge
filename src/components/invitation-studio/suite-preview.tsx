import type { InspirationCollection } from "@/lib/inspiration-collections";
import { InvitationPreview } from "@/components/inspiration/invitation-preview";
import type { Personalization, SuitePieceId } from "@/lib/invitation-suite";
import { cn } from "@/lib/utils";
import { QrCode, Mail, MessageSquare, Instagram, Facebook } from "lucide-react";

type Props = {
  collection: InspirationCollection;
  personalization: Personalization;
  piece: SuitePieceId;
};

const ASPECT: Record<SuitePieceId, string> = {
  invitation: "aspect-[3/4]",
  rsvp: "aspect-[4/3]",
  details: "aspect-[4/3]",
  envelope: "aspect-[16/9]",
  digital: "aspect-[9/16]",
  instagram: "aspect-[9/16]",
  facebook: "aspect-[16/9]",
  email: "aspect-[3/4]",
  sms: "aspect-[9/16]",
  qr: "aspect-square",
  pdf: "aspect-[3/4]",
  thankyou: "aspect-[4/3]",
  menu: "aspect-[3/4]",
  seating: "aspect-[3/4]",
  place: "aspect-[16/9]",
  welcome: "aspect-[3/4]",
  program: "aspect-[3/4]",
};

export function SuitePreview({ collection, personalization, piece }: Props) {
  if (piece === "invitation" || piece === "digital" || piece === "email" || piece === "pdf") {
    return <InvitationPreview collection={collection} personalization={personalization} size="lg" />;
  }

  const isDark = ["#0", "#1", "#2"].some((prefix) => collection.accent.startsWith(prefix));
  const fg = isDark ? "text-white" : "text-[#2E2A24]";

  const Frame = ({ children }: { children: React.ReactNode }) => (
    <div className={cn("relative w-full overflow-hidden rounded-2xl bg-gradient-to-br p-6 shadow-elegant", collection.gradient, ASPECT[piece])}>
      <div className="absolute inset-3 rounded-xl border border-white/25" />
      <div className={cn("relative flex h-full w-full flex-col items-center justify-center gap-3 text-center", fg)}>
        {children}
      </div>
    </div>
  );

  const displayFont = { fontFamily: collection.fontPair.display };
  const bodyFont = { fontFamily: collection.fontPair.body };

  switch (piece) {
    case "rsvp":
      return (
        <Frame>
          <p style={bodyFont} className="text-xs uppercase tracking-[0.3em] opacity-80">Kindly respond</p>
          <p style={displayFont} className="text-2xl font-semibold">{personalization.rsvpDeadline || "By August 20"}</p>
          <div className="mt-2 space-y-1 text-sm" style={bodyFont}>
            <p>__ Joyfully accepts</p>
            <p>__ Regretfully declines</p>
            <p className="pt-2">Number attending: ___</p>
          </div>
        </Frame>
      );
    case "details":
      return (
        <Frame>
          <p style={displayFont} className="text-xl">Details</p>
          <div className="space-y-1 text-sm" style={bodyFont}>
            <p><b>Venue</b> · {personalization.venue}</p>
            <p><b>Attire</b> · {personalization.dressCode || "Cocktail"}</p>
            <p><b>Time</b> · {personalization.timeLabel}</p>
            {personalization.registry && <p><b>Registry</b> · {personalization.registry}</p>}
          </div>
        </Frame>
      );
    case "envelope":
      return (
        <Frame>
          <p style={displayFont} className="text-lg">{personalization.hosts}</p>
          <p className="text-xs opacity-80" style={bodyFont}>{personalization.venue}</p>
        </Frame>
      );
    case "thankyou":
      return (
        <Frame>
          <p style={displayFont} className="text-3xl">Thank You</p>
          <p className="max-w-[80%] text-xs opacity-80" style={bodyFont}>Your presence made our celebration complete. With love, {personalization.hosts}.</p>
        </Frame>
      );
    case "menu":
      return (
        <Frame>
          <p style={displayFont} className="text-2xl">Menu</p>
          <ul className="space-y-1 text-sm" style={bodyFont}>
            <li>First · Heirloom tomato</li>
            <li>Second · Wild mushroom risotto</li>
            <li>Main · Herb-crusted lamb</li>
            <li>Dessert · Vanilla bean panna cotta</li>
          </ul>
        </Frame>
      );
    case "seating":
      return (
        <Frame>
          <p style={displayFont} className="text-2xl">Please find your seat</p>
          <div className="grid grid-cols-3 gap-2 text-[10px]" style={bodyFont}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="rounded-md border border-current/40 px-2 py-1">Table {i + 1}</div>
            ))}
          </div>
        </Frame>
      );
    case "place":
      return (
        <Frame>
          <p style={bodyFont} className="text-[10px] uppercase tracking-[0.3em] opacity-80">Reserved for</p>
          <p style={displayFont} className="text-3xl">Guest of Honor</p>
        </Frame>
      );
    case "welcome":
      return (
        <Frame>
          <p style={bodyFont} className="text-[10px] uppercase tracking-[0.3em] opacity-80">Welcome to</p>
          <p style={displayFont} className="text-3xl leading-tight">{personalization.title}</p>
          <p className="text-xs opacity-80" style={bodyFont}>{personalization.dateLabel}</p>
        </Frame>
      );
    case "program":
      return (
        <Frame>
          <p style={displayFont} className="text-xl">Program</p>
          <ul className="space-y-1 text-sm" style={bodyFont}>
            <li>4:30 · Guests arrive</li>
            <li>5:00 · Ceremony</li>
            <li>6:00 · Cocktails</li>
            <li>7:00 · Dinner &amp; toasts</li>
            <li>9:00 · Dancing</li>
          </ul>
        </Frame>
      );
    case "instagram":
      return (
        <Frame>
          <Instagram className="h-6 w-6 opacity-70" />
          <p style={displayFont} className="text-2xl leading-tight">{personalization.title}</p>
          <p className="text-xs opacity-80" style={bodyFont}>{personalization.dateLabel} · {personalization.venue}</p>
        </Frame>
      );
    case "facebook":
      return (
        <Frame>
          <Facebook className="h-6 w-6 opacity-70" />
          <p style={displayFont} className="text-2xl">{personalization.title}</p>
          <p className="text-xs opacity-80" style={bodyFont}>Hosted by {personalization.hosts}</p>
        </Frame>
      );
    case "sms":
      return (
        <Frame>
          <MessageSquare className="h-5 w-5 opacity-70" />
          <p className="max-w-[85%] rounded-2xl bg-white/20 p-3 text-sm" style={bodyFont}>
            You&rsquo;re invited to {personalization.title} on {personalization.dateLabel}. RSVP: melabridge.co/rsvp
          </p>
        </Frame>
      );
    case "qr":
      return (
        <Frame>
          <div className="grid h-32 w-32 place-items-center rounded-2xl bg-white/95 text-[#2E2A24]">
            <QrCode className="h-24 w-24" />
          </div>
          <p className="text-xs opacity-80" style={bodyFont}>Scan to RSVP</p>
        </Frame>
      );
    default:
      return (
        <Frame>
          <Mail className="h-5 w-5 opacity-70" />
          <p style={displayFont}>{personalization.title}</p>
        </Frame>
      );
  }
}

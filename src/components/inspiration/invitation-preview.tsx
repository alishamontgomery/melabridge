import type { InspirationCollection } from "@/lib/inspiration-collections";
import { cn } from "@/lib/utils";

type Props = {
  collection: InspirationCollection;
  personalization?: {
    title?: string | null;
    hosts?: string | null;
    dateLabel?: string | null;
    timeLabel?: string | null;
    venue?: string | null;
    dressCode?: string | null;
  };
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "aspect-[3/4] p-4 text-[10px]",
  md: "aspect-[3/4] p-6 text-xs",
  lg: "aspect-[3/4] p-8 text-sm",
} as const;

export function InvitationPreview({ collection, personalization, size = "md", className }: Props) {
  const p = personalization ?? {};
  const isDark = ["#0", "#1", "#2"].some((prefix) => collection.accent.startsWith(prefix));
  const fg = isDark ? "text-white" : "text-[#2E2A24]";
  const sub = isDark ? "text-white/80" : "text-[#2E2A24]/70";

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-2xl bg-gradient-to-br shadow-elegant",
        collection.gradient,
        SIZE[size],
        className,
      )}
    >
      <div className="absolute inset-3 rounded-xl border border-white/25" />
      <div className={cn("relative flex h-full flex-col items-center justify-between text-center", fg)}>
        <div className="flex flex-col items-center gap-1">
          <span className={cn("uppercase tracking-[0.3em]", sub)} style={{ fontSize: "0.55em" }}>
            Together with their families
          </span>
          <span className={cn("uppercase tracking-[0.35em]", sub)} style={{ fontSize: "0.5em" }}>
            {collection.name}
          </span>
        </div>

        <div className="flex flex-col items-center gap-2">
          <p style={{ fontFamily: collection.fontPair.display, fontSize: "1.6em", lineHeight: 1.05 }} className="font-semibold">
            {p.hosts || "Priya & Arjun"}
          </p>
          <div
            className="h-px w-16"
            style={{ backgroundColor: isDark ? "rgba(255,255,255,0.6)" : collection.accent }}
          />
          <p style={{ fontFamily: collection.fontPair.body }} className={cn("uppercase tracking-[0.25em]", sub)}>
            invite you to celebrate
          </p>
          <p style={{ fontFamily: collection.fontPair.display, fontSize: "1.05em" }}>
            {p.title || "Our Wedding Day"}
          </p>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p style={{ fontFamily: collection.fontPair.body }} className="uppercase tracking-[0.3em]">
            {p.dateLabel || "Saturday, September 14"}
          </p>
          <p className={cn(sub)} style={{ fontFamily: collection.fontPair.body }}>
            {p.timeLabel || "4:00 in the afternoon"}
          </p>
          <p className={cn(sub, "max-w-[80%]")} style={{ fontFamily: collection.fontPair.body }}>
            {p.venue || "The Rosewood Estate"}
          </p>
          {p.dressCode && (
            <p className={cn(sub, "mt-1 uppercase tracking-[0.3em]")} style={{ fontSize: "0.55em" }}>
              Attire · {p.dressCode}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

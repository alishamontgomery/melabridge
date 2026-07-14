import { Sparkles } from "lucide-react";

const IDEAS = [
  { title: "Blush + sage floral palette", tag: "Colors" },
  { title: "Lantern-lit outdoor aisle", tag: "Ceremony" },
  { title: "Cascading centerpieces", tag: "Florals" },
  { title: "Bistro-string overhead lighting", tag: "Lighting" },
  { title: "Family-style seating layout", tag: "Seating" },
  { title: "Textured linen table settings", tag: "Tables" },
  { title: "Naked cake with fresh figs", tag: "Cake" },
];

export function InspirationFeed({ eventType }: { eventType?: string | null }) {
  const label = (eventType ?? "event").toLowerCase();
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Inspiration for your {label}</h2>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Rotating</span>
      </div>
      <div className="mt-4 -mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2">
        {IDEAS.map((i) => (
          <div key={i.title} className="snap-start w-52 shrink-0 rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="mt-3 font-display text-base font-semibold leading-snug">{i.title}</p>
            <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{i.tag}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

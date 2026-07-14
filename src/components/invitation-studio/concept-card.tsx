import { Heart, Sparkles, TrendingUp, Eye } from "lucide-react";
import type { InspirationCollection } from "@/lib/inspiration-collections";
import { InvitationPreview } from "@/components/inspiration/invitation-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Personalization } from "@/lib/invitation-suite";

type Props = {
  collection: InspirationCollection;
  personalization?: Personalization;
  matchScore?: number;
  trending?: boolean;
  saved?: boolean;
  onSave?: () => void;
  onPreview?: () => void;
  onUse: () => void;
};

export function ConceptCard({ collection, personalization, matchScore, trending, saved, onSave, onPreview, onUse }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-border/60 bg-card p-3 shadow-soft transition hover:-translate-y-1 hover:shadow-elegant sm:p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-0 blur-2xl transition group-hover:opacity-40" style={{ background: `radial-gradient(60% 60% at 50% 0%, ${collection.accent}55, transparent)` }} />

      <div className="relative overflow-hidden rounded-2xl">
        <InvitationPreview collection={collection} personalization={personalization} size="md" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1.5">
          {matchScore != null && (
            <Badge className="gap-1 border-0 bg-primary text-primary-foreground shadow-soft">
              <Sparkles className="h-3 w-3" /> {matchScore}% AI Match
            </Badge>
          )}
          {trending && (
            <Badge variant="secondary" className="gap-1 bg-gold/90 text-gold-foreground">
              <TrendingUp className="h-3 w-3" /> Trending
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onSave}
          aria-label={saved ? "Remove from favorites" : "Save to favorites"}
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-foreground backdrop-blur transition hover:bg-white"
        >
          <Heart className={cn("h-4 w-4 transition", saved && "fill-primary text-primary")} />
        </button>
      </div>

      <div className="mt-3 space-y-2 px-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="min-w-0 truncate font-display text-base font-semibold sm:text-lg">{collection.name}</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{collection.category}</span>
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{collection.description}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {collection.styles.slice(0, 3).map((s) => (
            <span key={s} className="rounded-full bg-accent/60 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              {s}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" onClick={onUse} className="min-h-9 flex-1 whitespace-normal bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
            Use This Design
          </Button>
          <Button size="sm" variant="outline" onClick={onPreview} className="min-h-9 gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
        </div>
      </div>
    </div>
  );
}

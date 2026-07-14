import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Sparkles, Search, Heart, Bookmark, Eye, Wand2, Palette, Filter, Star,
  PenLine, Check, ImageIcon, ArrowRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSPIRATION_COLLECTIONS, CATEGORIES, STYLES, aiRecommend, recommendForEvent,
  type InspirationCollection, type InspirationCategory, type InspirationStyle,
} from "@/lib/inspiration-collections";
import { useInspirationStorage } from "@/lib/use-inspiration-storage";
import { InvitationPreview } from "@/components/inspiration/invitation-preview";
import { useActiveEvent } from "@/lib/use-active-event";
import { useRequireAuth } from "@/lib/use-require-auth";

export const Route = createFileRoute("/inspiration")({
  head: () => ({
    meta: [
      { title: "Inspiration Studio™ — MelaBridge" },
      { name: "description", content: "Browse professionally designed invitation collections and personalize them in one click." },
      { property: "og:title", content: "Inspiration Studio™ — MelaBridge" },
      { property: "og:description", content: "Beautifully curated invitation suites, ready to personalize for your event." },
    ],
  }),
  component: InspirationStudioPage,
});

function formatEventDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function InspirationStudioPage() {
  useRequireAuth();
  const navigate = useNavigate();
  const { event } = useActiveEvent();
  const { favorites, board, notes, toggleFavorite, toggleSaved, setNote } = useInspirationStorage();

  const [query, setQuery] = useState("");
  const [aiQuery, setAiQuery] = useState("");
  const [aiThinking, setAiThinking] = useState(false);
  const [aiResults, setAiResults] = useState<InspirationCollection[] | null>(null);
  const [category, setCategory] = useState<InspirationCategory | "All">("All");
  const [selectedStyles, setSelectedStyles] = useState<Set<InspirationStyle>>(new Set());
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [preview, setPreview] = useState<InspirationCollection | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);

  const filtered = useMemo(() => {
    const base = aiResults ?? INSPIRATION_COLLECTIONS;
    return base.filter((c) => {
      if (category !== "All" && c.category !== category) return false;
      if (selectedStyles.size > 0 && !c.styles.some((s) => selectedStyles.has(s))) return false;
      if (showFavoritesOnly && !favorites.has(c.id)) return false;
      if (showSavedOnly && !board.has(c.id)) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!(`${c.name} ${c.description} ${c.category} ${c.styles.join(" ")}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [aiResults, category, selectedStyles, favorites, board, showFavoritesOnly, showSavedOnly, query]);

  const recommendations = useMemo(() => recommendForEvent(event?.event_type ?? null, 4), [event?.event_type]);

  const runAI = async () => {
    if (!aiQuery.trim()) {
      setAiResults(null);
      return;
    }
    setAiThinking(true);
    // Simulated latency to communicate that MelaAssist is thinking
    await new Promise((r) => setTimeout(r, 500));
    const res = aiRecommend(aiQuery, 12);
    setAiResults(res);
    setAiThinking(false);
    toast.success(`MelaAssist found ${res.length} collections you might love`);
  };

  const resetFilters = () => {
    setCategory("All");
    setSelectedStyles(new Set());
    setShowFavoritesOnly(false);
    setShowSavedOnly(false);
    setQuery("");
    setAiQuery("");
    setAiResults(null);
  };

  const usePersonalization = (c: InspirationCollection) => {
    // For MVP: personalization is applied in-app and the user is guided to the messaging composer
    // where invitation drafting lives. The collection choice is passed via search so the composer
    // can theme itself later.
    toast.success(`${c.name} applied — MelaAssist personalized your invitation`);
    navigate({ to: "/messaging", search: { inspiration: c.id } as never });
  };

  return (
    <AppShell active="/inspiration">
      <PageHeader
        eyebrow="Inspiration Studio™"
        icon={Sparkles}
        title={<>Beautiful invitations, <span className="text-gradient">personalized in seconds</span>.</>}
        description="Browse editorial-quality collections, save favorites to your Inspiration Board, and let MelaAssist personalize any suite for your event."
        actions={
          <Button variant="hero" onClick={() => setChooserOpen(true)}>
            <Wand2 className="mr-2 h-4 w-4" /> Create invitation
          </Button>
        }
      />

      <div className="mt-8 space-y-8">
        {/* AI SEARCH */}
        <section className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-soft">
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Ask MelaAssist
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold">Describe your dream invitation</h2>
          <p className="mt-1 text-sm text-muted-foreground">Try: "Elegant sage green wedding", "Luxury black tie gala", or "Rustic barn wedding"</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") runAI(); }}
                placeholder="Describe your dream invitation…"
                className="pl-9"
              />
            </div>
            <Button onClick={runAI} disabled={aiThinking} className="min-w-32">
              {aiThinking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {aiThinking ? "Thinking…" : "Recommend"}
            </Button>
            {aiResults && (
              <Button variant="outline" onClick={() => { setAiResults(null); setAiQuery(""); }}>
                Clear
              </Button>
            )}
          </div>
        </section>

        {/* PERSONAL RECOMMENDATIONS */}
        {event && (
          <section>
            <div className="mb-3 flex items-end justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Recommended for {event.name ?? "your event"}</h2>
                <p className="text-sm text-muted-foreground">
                  Based on your {(event.event_type ?? "event").toLowerCase()} — hand-picked by MelaAssist.
                </p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {recommendations.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  compact
                  isFavorite={favorites.has(c.id)}
                  isSaved={board.has(c.id)}
                  onFavorite={() => toggleFavorite(c.id)}
                  onSave={() => toggleSaved(c.id)}
                  onPreview={() => setPreview(c)}
                  onUse={() => usePersonalization(c)}
                />
              ))}
            </div>
          </section>
        )}

        {/* FILTERS */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-soft">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search collections…" className="pl-9" />
            </div>
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFavoritesOnly((v) => !v)}
            >
              <Heart className={cn("mr-2 h-4 w-4", showFavoritesOnly && "fill-current")} />
              Favorites {favorites.size > 0 && <span className="ml-1 opacity-70">({favorites.size})</span>}
            </Button>
            <Button
              variant={showSavedOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSavedOnly((v) => !v)}
            >
              <Bookmark className={cn("mr-2 h-4 w-4", showSavedOnly && "fill-current")} />
              Board {board.size > 0 && <span className="ml-1 opacity-70">({board.size})</span>}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetFilters}>Reset</Button>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Filter className="h-3 w-3" /> Event type
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip active={category === "All"} onClick={() => setCategory("All")}>All</Chip>
              {CATEGORIES.map((c) => (
                <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</Chip>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Palette className="h-3 w-3" /> Style
            </div>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => {
                const active = selectedStyles.has(s);
                return (
                  <Chip
                    key={s}
                    active={active}
                    onClick={() => {
                      const next = new Set(selectedStyles);
                      active ? next.delete(s) : next.add(s);
                      setSelectedStyles(next);
                    }}
                  >
                    {s}
                  </Chip>
                );
              })}
            </div>
          </div>
        </section>

        {/* GALLERY */}
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">
                {aiResults ? "MelaAssist recommends" : "The gallery"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "collection" : "collections"} · every suite includes {ASSETS_COUNT} matching pieces
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-card p-12 text-center">
              <p className="font-semibold">No matches for those filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Try clearing a filter or ask MelaAssist above.</p>
              <Button className="mt-4" variant="outline" onClick={resetFilters}>Reset filters</Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <CollectionCard
                  key={c.id}
                  collection={c}
                  isFavorite={favorites.has(c.id)}
                  isSaved={board.has(c.id)}
                  onFavorite={() => toggleFavorite(c.id)}
                  onSave={() => toggleSaved(c.id)}
                  onPreview={() => setPreview(c)}
                  onUse={() => usePersonalization(c)}
                />
              ))}
            </div>
          )}
        </section>

        {/* BOARD w/ NOTES */}
        {board.size > 0 && (
          <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold">Your Inspiration Board</h2>
                <p className="text-sm text-muted-foreground">Saved designs and private notes.</p>
              </div>
              <Badge variant="secondary">{board.size} saved</Badge>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {Array.from(board).map((id) => {
                const c = INSPIRATION_COLLECTIONS.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <div key={id} className="flex gap-4 rounded-2xl border border-border/60 p-4">
                    <div className="w-24 shrink-0">
                      <InvitationPreview collection={c} size="sm" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-base font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.category}</p>
                      <Textarea
                        placeholder="Add a private note…"
                        defaultValue={notes[id] ?? ""}
                        onBlur={(e) => setNote(id, e.target.value)}
                        className="mt-2 min-h-16 text-xs"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setPreview(c)}>Preview</Button>
                        <Button size="sm" onClick={() => usePersonalization(c)}>Use style</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleSaved(id)}>Remove</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* PREVIEW SHEET */}
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {preview && (
            <PreviewPanel
              collection={preview}
              event={event}
              isFavorite={favorites.has(preview.id)}
              isSaved={board.has(preview.id)}
              onFavorite={() => toggleFavorite(preview.id)}
              onSave={() => toggleSaved(preview.id)}
              onUse={() => { usePersonalization(preview); setPreview(null); }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* CREATE-INVITATION CHOOSER */}
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How would you like to start?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <button
              onClick={() => { setChooserOpen(false); navigate({ to: "/messaging" }); }}
              className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-accent/10 p-4 text-left transition hover:shadow-soft"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Create with AI
              </div>
              <p className="mt-1 font-display text-base font-semibold">Describe it and MelaAssist designs it</p>
              <p className="text-xs text-muted-foreground">Tell us the vibe — we'll draft a custom invitation for review.</p>
            </button>
            <button
              onClick={() => setChooserOpen(false)}
              className="rounded-2xl border border-border p-4 text-left transition hover:shadow-soft"
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
                <ImageIcon className="h-3.5 w-3.5" /> Browse Inspiration Studio™
              </div>
              <p className="mt-1 font-display text-base font-semibold">Start from a curated collection</p>
              <p className="text-xs text-muted-foreground">Pick a look you love — we'll personalize the whole suite.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

const ASSETS_COUNT = 11;

function Chip({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-soft"
          : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TierBadge({ tier }: { tier: InspirationCollection["tier"] }) {
  if (tier === "free") return null;
  const label = tier === "premium" ? "Premium"
    : tier === "designer" ? "Designer"
    : tier === "vendor" ? "Vendor"
    : tier === "sponsored" ? "Featured"
    : "Seasonal";
  return (
    <Badge variant="secondary" className="gap-1 bg-background/90 backdrop-blur">
      <Star className="h-3 w-3" /> {label}
    </Badge>
  );
}

function CollectionCard({
  collection, compact, isFavorite, isSaved, onFavorite, onSave, onPreview, onUse,
}: {
  collection: InspirationCollection;
  compact?: boolean;
  isFavorite: boolean;
  isSaved: boolean;
  onFavorite: () => void;
  onSave: () => void;
  onPreview: () => void;
  onUse: () => void;
}) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-soft transition hover:-translate-y-0.5 hover:shadow-elegant">
      <div className="relative">
        <div className="p-4">
          <InvitationPreview collection={collection} size={compact ? "sm" : "md"} />
        </div>
        <div className="absolute right-5 top-5 flex flex-col gap-1.5">
          <button
            onClick={onFavorite}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border border-border bg-background/90 backdrop-blur transition hover:scale-105",
              isFavorite && "text-primary",
            )}
            aria-label="Favorite"
            title="Favorite"
          >
            <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </button>
          <button
            onClick={onSave}
            className={cn(
              "grid h-8 w-8 place-items-center rounded-full border border-border bg-background/90 backdrop-blur transition hover:scale-105",
              isSaved && "text-primary",
            )}
            aria-label="Save to board"
            title="Save to board"
          >
            <Bookmark className={cn("h-4 w-4", isSaved && "fill-current")} />
          </button>
        </div>
        <div className="absolute left-5 top-5"><TierBadge tier={collection.tier} /></div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5 pt-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <p className="font-display text-lg font-semibold leading-tight">{collection.name}</p>
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">{collection.category}</p>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{collection.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {collection.styles.slice(0, 4).map((s) => (
            <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {collection.palette.map((c) => (
            <span key={c} className="h-4 w-4 rounded-full border border-border/60" style={{ backgroundColor: c }} title={c} />
          ))}
        </div>
        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onPreview}>
            <Eye className="mr-2 h-4 w-4" /> Preview
          </Button>
          <Button variant="hero" size="sm" className="flex-1" onClick={onUse}>
            <Wand2 className="mr-2 h-4 w-4" /> Use style
          </Button>
        </div>
      </div>
    </div>
  );
}

function PreviewPanel({
  collection, event, isFavorite, isSaved, onFavorite, onSave, onUse,
}: {
  collection: InspirationCollection;
  event: ReturnType<typeof useActiveEvent>["event"];
  isFavorite: boolean;
  isSaved: boolean;
  onFavorite: () => void;
  onSave: () => void;
  onUse: () => void;
}) {
  const personalization = event ? {
    title: event.name,
    dateLabel: formatEventDate(event.event_date),
    timeLabel: event.event_time ?? null,
    venue: event.location ?? null,
    hosts: null,
    dressCode: null,
  } : undefined;

  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-display text-2xl">{collection.name}</SheetTitle>
        <p className="text-sm text-muted-foreground">{collection.description}</p>
      </SheetHeader>
      <div className="mt-4 space-y-6">
        <InvitationPreview collection={collection} personalization={personalization} size="lg" />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border/60 p-3">
            <p className="uppercase tracking-widest text-muted-foreground">Palette</p>
            <div className="mt-2 flex gap-1.5">
              {collection.palette.map((c) => (
                <span key={c} className="h-5 w-5 rounded-full border border-border/60" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border/60 p-3">
            <p className="uppercase tracking-widest text-muted-foreground">Typography</p>
            <p className="mt-2 text-sm" style={{ fontFamily: collection.fontPair.display }}>{collection.fontPair.display}</p>
            <p className="text-xs text-muted-foreground" style={{ fontFamily: collection.fontPair.body }}>{collection.fontPair.body}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Matching suite ({collection.assets.length} pieces)</p>
          <div className="grid grid-cols-2 gap-2">
            {collection.assets.map((a) => (
              <div key={a} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-xs">
                <Check className="h-3.5 w-3.5 text-primary" /> {a}
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Change the collection and every piece updates automatically.</p>
        </div>

        {event && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> Ready to personalize</p>
            <p className="mt-1 text-muted-foreground">
              MelaAssist will fill in <strong>{event.name}</strong>, date, venue, and RSVP details automatically.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onFavorite}>
            <Heart className={cn("mr-2 h-4 w-4", isFavorite && "fill-current")} />
            {isFavorite ? "Favorited" : "Favorite"}
          </Button>
          <Button variant="outline" size="sm" onClick={onSave}>
            <Bookmark className={cn("mr-2 h-4 w-4", isSaved && "fill-current")} />
            {isSaved ? "Saved to board" : "Save to board"}
          </Button>
          <Button variant="hero" size="sm" className="ml-auto" onClick={onUse}>
            <Wand2 className="mr-2 h-4 w-4" /> Use this style <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {!event && (
          <p className="text-xs text-muted-foreground">
            Tip: <Link to="/events/new" className="underline">create an event</Link> to auto-fill your invitation with real details.
          </p>
        )}

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <PenLine className="mt-0.5 h-3.5 w-3.5" />
          <span>Every suite is designed to scale — from Save the Date through Thank You cards — with a matching event website theme.</span>
        </div>
      </div>
    </>
  );
}

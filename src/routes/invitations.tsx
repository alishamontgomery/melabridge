import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sparkles, Wand2, Download, Share2, Copy, Check, PartyPopper, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { StudioStepper, type StudioStepId } from "@/components/invitation-studio/stepper";
import { ConceptCard } from "@/components/invitation-studio/concept-card";
import { SuitePreview } from "@/components/invitation-studio/suite-preview";
import { AIAssistant } from "@/components/invitation-studio/ai-assistant";
import { INSPIRATION_COLLECTIONS, CATEGORIES, STYLES, recommendForEvent, scoreCollection, type InspirationCollection } from "@/lib/inspiration-collections";
import { SUITE_PIECES, defaultPersonalization, buildShareToken, generateInvitationPdf, type Personalization } from "@/lib/invitation-suite";
import { useInspirationStorage } from "@/lib/use-inspiration-storage";
import { useActiveEvent } from "@/lib/use-active-event";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/invitations")({
  head: () => ({
    meta: [
      { title: "Create Invitation — MelaBridge" },
      { name: "description", content: "AI-designed invitation suites, personalized for your event in minutes." },
    ],
  }),
  component: InvitationStudioPage,
});

function InvitationStudioPage() {
  const { event } = useActiveEvent();
  const { favorites, toggleFavorite } = useInspirationStorage();
  const [step, setStep] = useState<StudioStepId>("design");
  const [category, setCategory] = useState<string>("All");
  const [style, setStyle] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [personalization, setPersonalization] = useState<Personalization>(() => defaultPersonalization());

  useEffect(() => {
    if (event) {
      setPersonalization((p) => ({
        ...p,
        title: event.name ?? p.title,
        dateLabel: event.event_date ? new Date(event.event_date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : p.dateLabel,
        venue: (event as { venue?: string }).venue || p.venue,
      }));
    }
  }, [event]);

  const aiPicks = useMemo(() => recommendForEvent(event?.event_type ?? null, 3), [event?.event_type]);

  const filtered = useMemo(() => {
    let base = INSPIRATION_COLLECTIONS;
    if (category !== "All") base = base.filter((c) => c.category === category);
    if (style !== "All") base = base.filter((c) => c.styles.includes(style as never));
    if (query.trim()) {
      base = base
        .map((c) => ({ c, s: scoreCollection(c, query) + (c.name.toLowerCase().includes(query.toLowerCase()) ? 5 : 0) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.c);
    }
    return base;
  }, [category, style, query]);

  const selected: InspirationCollection | null = useMemo(
    () => INSPIRATION_COLLECTIONS.find((c) => c.id === selectedId) ?? null,
    [selectedId],
  );

  function chooseDesign(id: string) {
    setSelectedId(id);
    setStep("personalize");
    toast.success("Design selected", { description: "Now personalize the wording." });
  }

  // Empty state: no event
  if (!event) {
    return (
      <AppShell active="/invitations">
        <div className="space-y-6">
          <PageHeader
            eyebrow="Invitation Studio"
            title="Create something beautiful"
            description="AI-designed invitations, tailored to your celebration."
            icon={Sparkles}
          />
          <Card className="relative overflow-hidden border-border/60 p-8 text-center shadow-soft sm:p-14">
            <div className="pointer-events-none absolute inset-0 bg-hero-radial opacity-70" />
            <div className="relative mx-auto max-w-lg space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">Let&rsquo;s Create Something Beautiful</h2>
              <p className="text-sm text-muted-foreground sm:text-base">
                Create an event and Mela AI will generate personalized invitation concepts designed specifically for your celebration.
              </p>
              <Button asChild size="lg" className="min-h-11 bg-gradient-to-r from-primary to-primary-glow px-6 text-primary-foreground">
                <a href="/events/new">Create Event</a>
              </Button>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell active="/invitations">
      <div className="space-y-6 pb-24">
        <PageHeader
          eyebrow="Design &amp; Invite"
          title={<>Create Invitation <span className="text-gradient">Studio</span></>}
          description={`Designed for ${event.name} — analyzed by Mela AI from your theme, guest list, and event date.`}
          icon={Sparkles}
        />

        <StudioStepper current={step} onStep={setStep} />

        {step === "design" && (
          <DesignStep
            aiPicks={aiPicks}
            filtered={filtered}
            categories={["All", ...CATEGORIES]}
            styles={["All", ...STYLES]}
            category={category}
            style={style}
            query={query}
            onCategory={setCategory}
            onStyle={setStyle}
            onQuery={setQuery}
            favorites={favorites}
            onSave={toggleFavorite}
            onUse={chooseDesign}
            personalization={personalization}
          />
        )}

        {step === "personalize" && selected && (
          <PersonalizeStep
            collection={selected}
            personalization={personalization}
            onChange={setPersonalization}
            onBack={() => setStep("design")}
            onNext={() => setStep("suite")}
          />
        )}

        {step === "suite" && selected && (
          <SuiteStep collection={selected} personalization={personalization} onBack={() => setStep("personalize")} onNext={() => setStep("review")} />
        )}

        {step === "review" && selected && (
          <ReviewStep collection={selected} personalization={personalization} onBack={() => setStep("suite")} onNext={() => setStep("send")} />
        )}

        {step === "send" && selected && (
          <SendStep collection={selected} personalization={personalization} onBack={() => setStep("review")} />
        )}
      </div>
      {selected && (
        <AIAssistant
          onApply={(text) => {
            // Deterministic "AI" tweak: apply based on keywords.
            const t = text.toLowerCase();
            setPersonalization((p) => {
              const next = { ...p };
              if (t.includes("shorter")) next.message = "Please join us to celebrate.";
              if (t.includes("bilingual")) next.message = `${next.message}\n\nSe complace en invitarte a nuestra celebración.`;
              if (t.includes("verse") || t.includes("scripture")) next.message = "Two are better than one — Ecclesiastes 4:9. " + next.message;
              if (t.includes("black tie")) next.dressCode = "Black Tie";
              if (t.includes("bilingual")) next.language = "Bilingual (EN/ES)";
              return next;
            });
          }}
        />
      )}
    </AppShell>
  );
}

// ---- Sub-steps ----

function DesignStep(props: {
  aiPicks: InspirationCollection[];
  filtered: InspirationCollection[];
  categories: string[];
  styles: string[];
  category: string;
  style: string;
  query: string;
  onCategory: (v: string) => void;
  onStyle: (v: string) => void;
  onQuery: (v: string) => void;
  favorites: Set<string>;
  onSave: (id: string) => void;
  onUse: (id: string) => void;
  personalization: Personalization;
}) {
  const { aiPicks, filtered, categories, styles, category, style, query, onCategory, onStyle, onQuery, favorites, onSave, onUse, personalization } = props;
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-gold/5 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold sm:text-xl">Designed for your event</h2>
            <p className="text-xs text-muted-foreground sm:text-sm">We analyzed your theme, colors, guest count, and occasion.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {aiPicks.map((c, i) => (
            <ConceptCard
              key={c.id}
              collection={c}
              personalization={personalization}
              matchScore={98 - i * 4}
              trending={i === 0}
              saved={favorites.has(c.id)}
              onSave={() => onSave(c.id)}
              onUse={() => onUse(c.id)}
            />
          ))}
        </div>
      </section>

      <Card className="border-border/60 p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search: 'sage green wedding', 'modern black tie'…" className="h-10 pl-9" />
          </div>
        </div>
        <ScrollArea className="mt-4">
          <div className="flex gap-2 pb-2">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => onCategory(c)}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <ScrollArea className="mt-1">
          <div className="flex gap-2 pb-2">
            {styles.map((s) => (
              <button
                key={s}
                onClick={() => onStyle(s)}
                className={cn(
                  "min-h-8 shrink-0 rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  style === s ? "border-gold bg-gold/20 text-gold-foreground" : "border-border/70 bg-background hover:bg-accent",
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((c) => (
          <ConceptCard
            key={c.id}
            collection={c}
            personalization={personalization}
            saved={favorites.has(c.id)}
            onSave={() => onSave(c.id)}
            onUse={() => onUse(c.id)}
          />
        ))}
        {filtered.length === 0 && (
          <Card className="col-span-full border-dashed p-8 text-center text-sm text-muted-foreground">
            No exact matches — try clearing filters or ask Mela AI for a new direction.
          </Card>
        )}
      </div>
    </div>
  );
}

function PersonalizeStep({
  collection,
  personalization,
  onChange,
  onBack,
  onNext,
}: {
  collection: InspirationCollection;
  personalization: Personalization;
  onChange: (p: Personalization) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const set = (k: keyof Personalization) => (v: string) => onChange({ ...personalization, [k]: v });
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 shadow-soft sm:p-5">
          <div className="mb-2 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">AI Personalization</p>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            We&rsquo;ll rewrite the invitation using your event details. Adjust anything below — the preview updates live.
          </p>
        </Card>
        <Card className="border-border/60 p-4 shadow-soft sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Event title"><Input value={personalization.title} onChange={(e) => set("title")(e.target.value)} /></Field>
            <Field label="Hosts"><Input value={personalization.hosts} onChange={(e) => set("hosts")(e.target.value)} /></Field>
            <Field label="Date"><Input value={personalization.dateLabel} onChange={(e) => set("dateLabel")(e.target.value)} /></Field>
            <Field label="Time"><Input value={personalization.timeLabel} onChange={(e) => set("timeLabel")(e.target.value)} /></Field>
            <Field label="Venue" className="sm:col-span-2"><Input value={personalization.venue} onChange={(e) => set("venue")(e.target.value)} /></Field>
            <Field label="Dress code"><Input value={personalization.dressCode ?? ""} onChange={(e) => set("dressCode")(e.target.value)} /></Field>
            <Field label="RSVP deadline"><Input value={personalization.rsvpDeadline ?? ""} onChange={(e) => set("rsvpDeadline")(e.target.value)} /></Field>
            <Field label="Registry (optional)" className="sm:col-span-2"><Input value={personalization.registry ?? ""} onChange={(e) => set("registry")(e.target.value)} /></Field>
            <Field label="Invitation message" className="sm:col-span-2">
              <Textarea rows={3} value={personalization.message ?? ""} onChange={(e) => set("message")(e.target.value)} />
            </Field>
          </div>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} className="min-h-10">Back</Button>
          <Button onClick={onNext} className="min-h-10 flex-1 gap-2 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground sm:flex-none">
            Continue <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="sticky top-24 h-fit">
        <SuitePreview collection={collection} personalization={personalization} piece="invitation" />
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SuiteStep({ collection, personalization, onBack, onNext }: { collection: InspirationCollection; personalization: Personalization; onBack: () => void; onNext: () => void }) {
  const groups = Array.from(new Set(SUITE_PIECES.map((p) => p.group)));
  const [active, setActive] = useState(SUITE_PIECES[0].id);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <Card className="border-border/60 p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Your matching suite</p>
          <Badge variant="secondary" className="ml-auto">{SUITE_PIECES.length} pieces</Badge>
        </div>
        <ScrollArea>
          <div className="flex gap-2 pb-2">
            {SUITE_PIECES.map((p) => (
              <button
                key={p.id}
                onClick={() => setActive(p.id)}
                className={cn(
                  "min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  active === p.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((g) => (
            <div key={g} className="rounded-2xl border border-border/50 bg-muted/30 p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g}</p>
              <ul className="space-y-1 text-xs">
                {SUITE_PIECES.filter((p) => p.group === g).map((p) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-primary" /> <span className="truncate">{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} className="min-h-10">Back</Button>
          <Button onClick={onNext} className="min-h-10 flex-1 gap-2 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground sm:flex-none">
            Review &amp; Send <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
      <div className="sticky top-24 h-fit">
        <SuitePreview collection={collection} personalization={personalization} piece={active} />
      </div>
    </div>
  );
}

function ReviewStep({ collection, personalization, onBack, onNext }: { collection: InspirationCollection; personalization: Personalization; onBack: () => void; onNext: () => void }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/60 p-4 shadow-soft sm:p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Review your invitation</h2>
        <Tabs defaultValue="invitation">
          <ScrollArea>
            <TabsList className="w-max">
              {["invitation", "rsvp", "details", "envelope", "digital"].map((t) => (
                <TabsTrigger key={t} value={t} className="capitalize">{t}</TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          {(["invitation", "rsvp", "details", "envelope", "digital"] as const).map((t) => (
            <TabsContent key={t} value={t} className="mt-4">
              <SuitePreview collection={collection} personalization={personalization} piece={t as never} />
            </TabsContent>
          ))}
        </Tabs>
      </Card>
      <Card className="border-border/60 p-4 shadow-soft sm:p-5">
        <h3 className="mb-2 font-display text-lg font-semibold">Details</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Design</dt><dd className="min-w-0 truncate">{collection.name}</dd>
          <dt className="text-muted-foreground">Hosts</dt><dd className="min-w-0 break-words">{personalization.hosts}</dd>
          <dt className="text-muted-foreground">Title</dt><dd className="min-w-0 break-words">{personalization.title}</dd>
          <dt className="text-muted-foreground">When</dt><dd className="min-w-0 break-words">{personalization.dateLabel} · {personalization.timeLabel}</dd>
          <dt className="text-muted-foreground">Where</dt><dd className="min-w-0 break-words">{personalization.venue}</dd>
          {personalization.dressCode && (<><dt className="text-muted-foreground">Attire</dt><dd>{personalization.dressCode}</dd></>)}
          {personalization.rsvpDeadline && (<><dt className="text-muted-foreground">RSVP</dt><dd className="min-w-0 break-words">{personalization.rsvpDeadline}</dd></>)}
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onBack} className="min-h-10">Back</Button>
          <Button onClick={onNext} className="min-h-10 flex-1 gap-2 bg-gradient-to-r from-primary to-primary-glow text-primary-foreground sm:flex-none">
            Continue to send <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SendStep({ collection, personalization, onBack }: { collection: InspirationCollection; personalization: Personalization; onBack: () => void }) {
  const navigate = useNavigate();
  const token = useMemo(() => buildShareToken(collection.id, personalization), [collection.id, personalization]);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : "";
  const [copied, setCopied] = useState(false);

  const downloadPdf = () => {
    const doc = generateInvitationPdf(collection, personalization);
    doc.save(`${collection.name.replace(/\s+/g, "-").toLowerCase()}-invitation.pdf`);
    toast.success("Invitation PDF downloaded");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Share link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — long-press to copy manually");
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-gold/5 p-5 shadow-elegant sm:p-7">
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
          <PartyPopper className="h-5 w-5" />
        </div>
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">Your invitation is ready</h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">Share it digitally, download the print-ready PDF, or send it through your existing guest list.</p>

        <div className="mt-5 space-y-3">
          <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Public share link</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-muted px-2 py-1.5 text-xs">{shareUrl}</code>
              <Button size="sm" variant="outline" onClick={copyLink} className="min-h-9 gap-1.5">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={downloadPdf} className="min-h-11 gap-2 whitespace-normal bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button variant="outline" onClick={() => window.open(shareUrl, "_blank")} className="min-h-11 gap-2 whitespace-normal">
              <Share2 className="h-4 w-4" /> Open preview
            </Button>
            <Button variant="secondary" onClick={() => navigate({ to: "/messaging" })} className="min-h-11 gap-2 whitespace-normal">
              Send via Messaging
            </Button>
            <Button variant="secondary" onClick={() => navigate({ to: "/guests" })} className="min-h-11 gap-2 whitespace-normal">
              Send to Guests
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Automations queued</p>
            <ul className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              <li>· RSVP page</li>
              <li>· Guest QR code</li>
              <li>· Reminder schedule</li>
              <li>· Email campaign</li>
              <li>· SMS reminders</li>
              <li>· Calendar invite</li>
            </ul>
          </div>

          <Button variant="ghost" onClick={onBack} className="min-h-10">Back to review</Button>
        </div>
      </Card>
      <div className="sticky top-24 h-fit">
        <SuitePreview collection={collection} personalization={personalization} piece="invitation" />
      </div>
    </div>
  );
}

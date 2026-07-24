import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
  Globe,
  Building2,
  FileText,
  MessageSquare,
  Loader2,
  Check,
  RefreshCw,
  X,
  Copy,
  Save,
  ShieldCheck,
} from "lucide-react";
import {
  generateVendorProfileDraft,
  saveVendorProfileDraft,
  getVendorProfileSnapshot,
  type VendorProfileDraft,
} from "@/lib/vendor-ai.functions";

export const Route = createFileRoute("/_authenticated/vendor-profile-builder")({
  head: () => ({
    meta: [
      { title: "Complete with MelaAssist — MelaBridge" },
      { name: "description", content: "Build a professional vendor profile in minutes with MelaAssist." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorProfileBuilder,
});

type StartMode = "website" | "business_name" | "description" | "conversation";

type SectionKey =
  | "description"
  | "short_bio"
  | "long_bio"
  | "services"
  | "highlights"
  | "faqs"
  | "policies"
  | "service_areas"
  | "cta"
  | "social_bio"
  | "packages";

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: "description", label: "Business description" },
  { key: "short_bio", label: "Short bio" },
  { key: "long_bio", label: "Long bio" },
  { key: "services", label: "Services" },
  { key: "highlights", label: "Business highlights" },
  { key: "faqs", label: "FAQs" },
  { key: "policies", label: "Policies" },
  { key: "service_areas", label: "Service areas" },
  { key: "cta", label: "Call to action" },
  { key: "social_bio", label: "Social media bio" },
  { key: "packages", label: "Packages" },
];

function VendorProfileBuilder() {
  const generateFn = useServerFn(generateVendorProfileDraft);
  const saveFn = useServerFn(saveVendorProfileDraft);
  const snapshotFn = useServerFn(getVendorProfileSnapshot);

  const snapshot = useQuery({ queryKey: ["vendor-profile-snapshot"], queryFn: () => snapshotFn() });

  const [mode, setMode] = useState<StartMode>("business_name");
  const [input, setInput] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState<false | SectionKey | "all">(false);
  const [draft, setDraft] = useState<VendorProfileDraft | null>(null);
  const [skipped, setSkipped] = useState<Set<SectionKey>>(new Set());
  const [saving, setSaving] = useState(false);

  async function generate(regenerateSection?: SectionKey | "all") {
    if (input.trim().length < 2) {
      toast.error("Add a little more detail so MelaAssist can help.");
      return;
    }
    setBusy(regenerateSection ?? "all");
    try {
      const res = await generateFn({
        data: {
          mode,
          input: input.trim(),
          category: category.trim() || undefined,
          regenerateSection: regenerateSection ?? undefined,
        },
      });
      if (!res.draft) {
        toast.error(res.message ?? "MelaAssist couldn't respond.");
        return;
      }
      if (!draft || regenerateSection === "all" || !regenerateSection) {
        setDraft(res.draft);
        toast.success("Draft ready — review each section below.");
      } else {
        // Merge only the regenerated section
        setDraft((prev) => (prev ? { ...prev, [regenerateSection]: res.draft![regenerateSection] } : res.draft));
        toast.success(`${sectionLabel(regenerateSection)} regenerated.`);
      }
    } finally {
      setBusy(false);
    }
  }

  function updateSection<K extends SectionKey>(key: K, value: VendorProfileDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleSkip(key: SectionKey) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function saveMappedFields() {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          business_name: draft.business_name || undefined,
          business_category: draft.business_category || undefined,
          business_description: skipped.has("description") ? undefined : draft.description || undefined,
        },
      });
      if (res.saved) {
        toast.success("Profile updated. Copy the other sections you approved into their fields when ready.");
        snapshot.refetch();
      } else {
        toast.info("Nothing new to save — every mapped field was empty or skipped.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const completion = snapshot.data?.completion ?? 0;
  const missing = snapshot.data?.missing ?? [];

  return (
    <AppShell active="/vendor-profile-builder">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendor"
          icon={Sparkles}
          title="Complete with MelaAssist"
          description="Answer one question and MelaAssist drafts your full vendor profile. Nothing is saved without your approval."
          actions={
            <Button asChild variant="outline" size="sm">
              <Link to="/profile">Open profile</Link>
            </Button>
          }
        />

        {/* Completion */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Profile completion</p>
              <p className="font-display text-2xl font-semibold">{completion}%</p>
            </div>
            <div className="min-w-[220px] flex-1">
              <Progress value={completion} className="h-2" />
              {missing.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Missing: {missing.slice(0, 4).join(", ")}{missing.length > 4 ? "…" : ""}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Start */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold">How would you like to start?</h2>
          </div>

          <Tabs value={mode} onValueChange={(v) => setMode(v as StartMode)}>
            <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
              <TabsTrigger value="business_name"><Building2 className="mr-1.5 h-3.5 w-3.5" />Business name</TabsTrigger>
              <TabsTrigger value="website"><Globe className="mr-1.5 h-3.5 w-3.5" />Website URL</TabsTrigger>
              <TabsTrigger value="description"><FileText className="mr-1.5 h-3.5 w-3.5" />Description</TabsTrigger>
              <TabsTrigger value="conversation"><MessageSquare className="mr-1.5 h-3.5 w-3.5" />Chat</TabsTrigger>
            </TabsList>

            <TabsContent value="business_name" className="mt-4 space-y-3">
              <Label>Your business name</Label>
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Aurora Photo Booths" />
            </TabsContent>
            <TabsContent value="website" className="mt-4 space-y-3">
              <Label>Your website URL</Label>
              <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="https://yourbusiness.com" />
            </TabsContent>
            <TabsContent value="description" className="mt-4 space-y-3">
              <Label>Paste an existing description</Label>
              <Textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste your About page, Instagram bio, or a rough description…" className="min-h-[100px]" />
            </TabsContent>
            <TabsContent value="conversation" className="mt-4 space-y-3">
              <Label>Tell MelaAssist about your business</Label>
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. I own a photo booth company in Toronto. I do weddings, corporate parties, and school proms. My style is fun and modern with premium props."
                className="min-h-[100px]"
              />
            </TabsContent>
          </Tabs>

          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <Label className="text-xs">Category (optional)</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Photo booth, catering, florist, DJ…" />
            </div>
            <Button variant="hero" onClick={() => generate("all")} disabled={busy === "all"} className="sm:w-auto">
              {busy === "all" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Drafting…</> : <><Sparkles className="mr-2 h-4 w-4" />Generate profile</>}
            </Button>
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> MelaAssist drafts suggestions only — nothing is published or saved unless you approve it.
          </p>
        </Card>

        {/* Draft results */}
        {draft && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Review your draft</h2>
              <Button onClick={saveMappedFields} disabled={saving} variant="hero">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : <><Save className="mr-2 h-4 w-4" />Save approved fields</>}
              </Button>
            </div>

            <TextCard
              title="Business description"
              sectionKey="description"
              value={draft.description}
              onChange={(v) => updateSection("description", v)}
              onRegenerate={() => generate("description")}
              onSkip={() => toggleSkip("description")}
              skipped={skipped.has("description")}
              busy={busy === "description"}
              savesToProfile
            />
            <TextCard
              title="Short bio"
              sectionKey="short_bio"
              value={draft.short_bio}
              onChange={(v) => updateSection("short_bio", v)}
              onRegenerate={() => generate("short_bio")}
              onSkip={() => toggleSkip("short_bio")}
              skipped={skipped.has("short_bio")}
              busy={busy === "short_bio"}
            />
            <TextCard
              title="Long bio"
              sectionKey="long_bio"
              value={draft.long_bio}
              onChange={(v) => updateSection("long_bio", v)}
              onRegenerate={() => generate("long_bio")}
              onSkip={() => toggleSkip("long_bio")}
              skipped={skipped.has("long_bio")}
              busy={busy === "long_bio"}
              multiline
            />
            <ListCard
              title="Services"
              sectionKey="services"
              items={draft.services}
              onChange={(v) => updateSection("services", v)}
              onRegenerate={() => generate("services")}
              onSkip={() => toggleSkip("services")}
              skipped={skipped.has("services")}
              busy={busy === "services"}
            />
            <ListCard
              title="Business highlights"
              sectionKey="highlights"
              items={draft.highlights}
              onChange={(v) => updateSection("highlights", v)}
              onRegenerate={() => generate("highlights")}
              onSkip={() => toggleSkip("highlights")}
              skipped={skipped.has("highlights")}
              busy={busy === "highlights"}
            />
            <FAQsCard
              faqs={draft.faqs}
              onChange={(v) => updateSection("faqs", v)}
              onRegenerate={() => generate("faqs")}
              onSkip={() => toggleSkip("faqs")}
              skipped={skipped.has("faqs")}
              busy={busy === "faqs"}
            />
            <PoliciesCard
              policies={draft.policies}
              onChange={(v) => updateSection("policies", v)}
              onRegenerate={() => generate("policies")}
              onSkip={() => toggleSkip("policies")}
              skipped={skipped.has("policies")}
              busy={busy === "policies"}
            />
            <ListCard
              title="Service areas"
              sectionKey="service_areas"
              items={draft.service_areas}
              onChange={(v) => updateSection("service_areas", v)}
              onRegenerate={() => generate("service_areas")}
              onSkip={() => toggleSkip("service_areas")}
              skipped={skipped.has("service_areas")}
              busy={busy === "service_areas"}
            />
            <TextCard
              title="Call to action"
              sectionKey="cta"
              value={draft.cta}
              onChange={(v) => updateSection("cta", v)}
              onRegenerate={() => generate("cta")}
              onSkip={() => toggleSkip("cta")}
              skipped={skipped.has("cta")}
              busy={busy === "cta"}
            />
            <TextCard
              title="Social media bio"
              sectionKey="social_bio"
              value={draft.social_bio}
              onChange={(v) => updateSection("social_bio", v)}
              onRegenerate={() => generate("social_bio")}
              onSkip={() => toggleSkip("social_bio")}
              skipped={skipped.has("social_bio")}
              busy={busy === "social_bio"}
            />
            <PackagesCard
              packages={draft.packages}
              onChange={(v) => updateSection("packages", v)}
              onRegenerate={() => generate("packages")}
              onSkip={() => toggleSkip("packages")}
              skipped={skipped.has("packages")}
              busy={busy === "packages"}
            />

            {draft.suggestions.length > 0 && (
              <Card className="border-primary/30 bg-primary/5 p-5 shadow-soft">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-semibold">MelaAssist recommendations</h3>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {draft.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>{s}</span></li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function sectionLabel(key: SectionKey) {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}

type CardHeaderProps = {
  title: string;
  onRegenerate: () => void;
  onSkip: () => void;
  skipped: boolean;
  busy: boolean;
  onCopy?: () => void;
  savesToProfile?: boolean;
};

function SectionHeader({ title, onRegenerate, onSkip, skipped, busy, onCopy, savesToProfile }: CardHeaderProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-base font-semibold">{title}</h3>
        {skipped && <Badge variant="outline">Skipped</Badge>}
        {savesToProfile && <Badge variant="secondary" className="text-[10px]">Saves to profile</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {onCopy && (
          <Button variant="ghost" size="sm" onClick={onCopy}>
            <Copy className="mr-1 h-3.5 w-3.5" />Copy
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onRegenerate} disabled={busy}>
          {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
          Regenerate
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          {skipped ? <><Check className="mr-1 h-3.5 w-3.5" />Include</> : <><X className="mr-1 h-3.5 w-3.5" />Skip</>}
        </Button>
      </div>
    </div>
  );
}

function copyText(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed"),
  );
}

function TextCard({
  title,
  value,
  onChange,
  onRegenerate,
  onSkip,
  skipped,
  busy,
  multiline,
  savesToProfile,
}: {
  title: string;
  sectionKey: SectionKey;
  value: string;
  onChange: (v: string) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  skipped: boolean;
  busy: boolean;
  multiline?: boolean;
  savesToProfile?: boolean;
}) {
  return (
    <Card className={`border-border/60 p-5 shadow-soft ${skipped ? "opacity-60" : ""}`}>
      <SectionHeader
        title={title}
        onRegenerate={onRegenerate}
        onSkip={onSkip}
        skipped={skipped}
        busy={busy}
        onCopy={() => copyText(value)}
        savesToProfile={savesToProfile}
      />
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={multiline ? "min-h-[160px]" : "min-h-[90px]"}
        disabled={skipped}
      />
    </Card>
  );
}

function ListCard({
  title,
  items,
  onChange,
  onRegenerate,
  onSkip,
  skipped,
  busy,
}: {
  title: string;
  sectionKey: SectionKey;
  items: string[];
  onChange: (v: string[]) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  skipped: boolean;
  busy: boolean;
}) {
  const text = useMemo(() => items.join("\n"), [items]);
  return (
    <Card className={`border-border/60 p-5 shadow-soft ${skipped ? "opacity-60" : ""}`}>
      <SectionHeader
        title={title}
        onRegenerate={onRegenerate}
        onSkip={onSkip}
        skipped={skipped}
        busy={busy}
        onCopy={() => copyText(text)}
      />
      <Textarea
        value={text}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trim()).filter(Boolean))}
        className="min-h-[130px] font-mono text-sm"
        disabled={skipped}
        placeholder="One item per line"
      />
    </Card>
  );
}

function FAQsCard({
  faqs,
  onChange,
  onRegenerate,
  onSkip,
  skipped,
  busy,
}: {
  faqs: { question: string; answer: string }[];
  onChange: (v: { question: string; answer: string }[]) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  skipped: boolean;
  busy: boolean;
}) {
  return (
    <Card className={`border-border/60 p-5 shadow-soft ${skipped ? "opacity-60" : ""}`}>
      <SectionHeader
        title="FAQs"
        onRegenerate={onRegenerate}
        onSkip={onSkip}
        skipped={skipped}
        busy={busy}
        onCopy={() => copyText(faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n"))}
      />
      <div className="space-y-3">
        {faqs.map((f, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <Input
              value={f.question}
              onChange={(e) => onChange(faqs.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
              disabled={skipped}
              className="mb-2 font-medium"
            />
            <Textarea
              value={f.answer}
              onChange={(e) => onChange(faqs.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              disabled={skipped}
              className="min-h-[70px]"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function PoliciesCard({
  policies,
  onChange,
  onRegenerate,
  onSkip,
  skipped,
  busy,
}: {
  policies: { title: string; body: string }[];
  onChange: (v: { title: string; body: string }[]) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  skipped: boolean;
  busy: boolean;
}) {
  return (
    <Card className={`border-border/60 p-5 shadow-soft ${skipped ? "opacity-60" : ""}`}>
      <SectionHeader
        title="Policies"
        onRegenerate={onRegenerate}
        onSkip={onSkip}
        skipped={skipped}
        busy={busy}
        onCopy={() => copyText(policies.map((p) => `${p.title}\n${p.body}`).join("\n\n"))}
      />
      <div className="space-y-3">
        {policies.map((p, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <Input
              value={p.title}
              onChange={(e) => onChange(policies.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              disabled={skipped}
              className="mb-2 font-medium"
            />
            <Textarea
              value={p.body}
              onChange={(e) => onChange(policies.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
              disabled={skipped}
              className="min-h-[70px]"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

function PackagesCard({
  packages,
  onChange,
  onRegenerate,
  onSkip,
  skipped,
  busy,
}: {
  packages: VendorProfileDraft["packages"];
  onChange: (v: VendorProfileDraft["packages"]) => void;
  onRegenerate: () => void;
  onSkip: () => void;
  skipped: boolean;
  busy: boolean;
}) {
  return (
    <Card className={`border-border/60 p-5 shadow-soft ${skipped ? "opacity-60" : ""}`}>
      <SectionHeader
        title="Packages"
        onRegenerate={onRegenerate}
        onSkip={onSkip}
        skipped={skipped}
        busy={busy}
        onCopy={() =>
          copyText(
            packages
              .map((p) => `${p.name} — ${p.price_placeholder} (${p.duration})\n${p.description}\nIncludes: ${p.inclusions.join(", ")}\nUpgrades: ${p.upgrades.join(", ")}`)
              .join("\n\n"),
          )
        }
      />
      <div className="grid gap-3 md:grid-cols-2">
        {packages.map((p, i) => (
          <div key={i} className="rounded-xl border border-border p-3">
            <Input
              value={p.name}
              onChange={(e) => onChange(packages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              disabled={skipped}
              className="mb-2 font-semibold"
            />
            <div className="mb-2 grid grid-cols-2 gap-2">
              <Input
                value={p.price_placeholder}
                onChange={(e) => onChange(packages.map((x, j) => (j === i ? { ...x, price_placeholder: e.target.value } : x)))}
                disabled={skipped}
                placeholder="Starting at $…"
                className="text-sm"
              />
              <Input
                value={p.duration}
                onChange={(e) => onChange(packages.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))}
                disabled={skipped}
                placeholder="Duration"
                className="text-sm"
              />
            </div>
            <Textarea
              value={p.description}
              onChange={(e) => onChange(packages.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              disabled={skipped}
              className="mb-2 min-h-[60px] text-sm"
            />
            <Label className="text-[10px] uppercase text-muted-foreground">Inclusions (one per line)</Label>
            <Textarea
              value={p.inclusions.join("\n")}
              onChange={(e) =>
                onChange(
                  packages.map((x, j) =>
                    j === i ? { ...x, inclusions: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } : x,
                  ),
                )
              }
              disabled={skipped}
              className="mb-2 min-h-[60px] font-mono text-xs"
            />
            <Label className="text-[10px] uppercase text-muted-foreground">Optional upgrades (one per line)</Label>
            <Textarea
              value={p.upgrades.join("\n")}
              onChange={(e) =>
                onChange(
                  packages.map((x, j) =>
                    j === i ? { ...x, upgrades: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) } : x,
                  ),
                )
              }
              disabled={skipped}
              className="min-h-[50px] font-mono text-xs"
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

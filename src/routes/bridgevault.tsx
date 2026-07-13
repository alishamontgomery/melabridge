import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Vault,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Mic2,
  ScrollText,
  Users,
  Lock,
  Upload,
  Sparkles,
  Wallet,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/bridgevault")({
  head: () => ({
    meta: [
      { title: "BridgeVault™ — Your Event Archive · MelaBridge" },
      {
        name: "description",
        content:
          "A permanent, encrypted digital vault for every event: photos, videos, contracts, budgets, invitations, speeches, playlists, keepsakes, and notes — preserved for a lifetime.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeVault,
});

const vaults = [
  { id: "e1", name: "Amara & Julien — Wedding", year: 2026, items: 47, cover: "from-primary via-primary-glow to-gold" },
  { id: "m6", name: "Okafor Family Reunion '24", year: 2024, items: 189, cover: "from-gold via-primary-glow to-primary" },
  { id: "m4", name: "Positano Engagement", year: 2021, items: 302, cover: "from-primary via-gold to-primary-glow" },
  { id: "m2", name: "NYU Graduation", year: 2015, items: 214, cover: "from-primary-glow via-primary to-gold" },
];

const shelves = [
  { key: "photos", label: "Photos", icon: ImageIcon, count: 214, tone: "from-primary/15 to-gold/10" },
  { key: "videos", label: "Videos", icon: Video, count: 38, tone: "from-primary/10 to-primary-glow/15" },
  { key: "contracts", label: "Contracts", icon: FileText, count: 12, tone: "from-gold/15 to-primary/10" },
  { key: "budgets", label: "Budgets & receipts", icon: Wallet, count: 41, tone: "from-primary/10 to-gold/15" },
  { key: "invites", label: "Invitations", icon: Mail, count: 6, tone: "from-primary-glow/15 to-gold/10" },
  { key: "seating", label: "Seating charts", icon: Users, count: 3, tone: "from-gold/10 to-primary/10" },
  { key: "speeches", label: "Speeches & toasts", icon: Mic2, count: 8, tone: "from-primary/10 to-primary-glow/15" },
  { key: "playlists", label: "Playlists", icon: Music, count: 5, tone: "from-primary-glow/15 to-gold/15" },
  { key: "notes", label: "Notes & keepsakes", icon: ScrollText, count: 27, tone: "from-primary/10 to-gold/10" },
];

const recent = [
  { name: "Bloomhaus_final_contract.pdf", type: "Contract", added: "Yesterday", size: "412 KB" },
  { name: "Lake Como venue walkthrough.mp4", type: "Video", added: "2 days ago", size: "184 MB" },
  { name: "Save the date — batch 2.png", type: "Invitation", added: "3 days ago", size: "2.1 MB" },
  { name: "Julien's vows draft.txt", type: "Speech", added: "Last week", size: "6 KB" },
  { name: "Reception playlist — v3.m3u", type: "Playlist", added: "Last week", size: "18 KB" },
  { name: "Guest allergy summary.csv", type: "Note", added: "Last week", size: "9 KB" },
];

function BridgeVault() {
  const [activeVault, setActiveVault] = useState(vaults[0].id);
  const active = vaults.find((v) => v.id === activeVault)!;

  return (
    <PublicShell>
      <PageHeader
        eyebrow="BridgeVault™ · Permanent digital archive"
        icon={Vault}
        title={
          <>
            Every event, <span className="text-gradient">preserved for a lifetime</span>.
          </>
        }
        description="Every event on MelaBridge automatically gets a private, encrypted vault. Photos, videos, contracts, invitations, budgets, seating charts, speeches, playlists, and keepsakes — organized so you (and the people you invite) can revisit them years from now."
      />

      <section className="mt-8 grid gap-3 sm:grid-cols-4">
        {[
          { k: "Total artifacts", v: "1,296" },
          { k: "Vaults", v: `${vaults.length}` },
          { k: "Encrypted at rest", v: "AES-256" },
          { k: "Storage used", v: "4.2 / 50 GB" },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{s.k}</p>
            <p className="mt-1 font-display text-2xl font-semibold">{s.v}</p>
          </div>
        ))}
      </section>

      <section className="mt-8">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Your vaults</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {vaults.map((v) => (
            <button
              key={v.id}
              onClick={() => setActiveVault(v.id)}
              className={`group overflow-hidden rounded-2xl border text-left transition ${
                v.id === activeVault ? "border-primary/40 shadow-elegant" : "border-border hover:shadow-soft"
              }`}
            >
              <div className={`h-24 bg-gradient-to-br ${v.cover}`} />
              <div className="bg-card p-4">
                <div className="flex items-center gap-2">
                  <Lock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{v.year}</span>
                </div>
                <p className="mt-1 font-display text-base font-semibold leading-tight">{v.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">{v.items} artifacts</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8 rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Inside</p>
            <h2 className="font-display text-xl font-semibold">{active.name}</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="soft" className="gap-2"><Upload className="h-4 w-4" /> Upload</Button>
            <Button variant="hero" className="gap-2"><Sparkles className="h-4 w-4" /> Auto-organize</Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shelves.map((s) => (
            <div key={s.key} className={`rounded-2xl border border-border bg-gradient-to-br ${s.tone} p-4`}>
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-background/70 text-primary">
                  <s.icon className="h-4 w-4" />
                </span>
                <Badge variant="secondary" className="bg-background/70">{s.count}</Badge>
              </div>
              <p className="mt-3 font-medium">{s.label}</p>
              <p className="text-xs text-muted-foreground">Tap to browse</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-card p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Recently added</p>
          <ul className="mt-3 divide-y divide-border">
            {recent.map((r) => (
              <li key={r.name} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.type} · {r.added} · {r.size}</p>
                </div>
                <Button size="sm" variant="ghost">Open</Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-border bg-hero-radial p-6">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Preservation</p>
          <h3 className="font-display text-lg font-semibold">Built to last a lifetime</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-start gap-2"><Lock className="mt-0.5 h-4 w-4 text-primary" /> Encrypted at rest and in transit</li>
            <li className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 text-primary" /> Share view-only access with family — for generations</li>
            <li className="flex items-start gap-2"><Sparkles className="mt-0.5 h-4 w-4 text-primary" /> AI auto-tags people, places, and moments</li>
            <li className="flex items-start gap-2"><FileText className="mt-0.5 h-4 w-4 text-primary" /> Export a full archive anytime — you own your memories</li>
          </ul>
          <div className="mt-5 flex gap-2">
            <Button variant="soft" asChild><Link to="/bridgeworld">See on timeline</Link></Button>
            <Button variant="hero">Invite family</Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

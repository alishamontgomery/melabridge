import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { MessageSquare, Sparkles, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/messaging")({
  head: () => ({
    meta: [
      { title: "Messaging — MelaBridge" },
      { name: "description", content: "One inbox for guests, vendors, and your team — drafted by AI in your voice." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MessagingPage,
});

const THREADS = [
  { who: "Priya Menon", role: "Guest", last: "Is a vegan option possible?", when: "2h", unread: 1 },
  { who: "Studio Nero", role: "Vendor", last: "Attached the shot list draft.", when: "Yesterday", unread: 0 },
  { who: "Bloomhaus", role: "Vendor", last: "Awaiting your signature.", when: "Yesterday", unread: 2 },
  { who: "Maman Marie", role: "Team", last: "Added 4 guests to family side.", when: "2d", unread: 0 },
  { who: "Villa d'Este", role: "Vendor", last: "Load-in confirmed for Fri 10 AM.", when: "3d", unread: 0 },
];

const CONVERSATION = [
  { from: "Priya", text: "Really excited! Quick Q — is a vegan option possible?", when: "2:14 PM" },
  { from: "AI draft", text: "Hi Priya! So thrilled you're joining. Yes — we've noted a vegan option for you. Our caterer is confirming this week and I'll circle back with details. 💜", when: "just now", ai: true },
];

function MessagingPage() {
  return (
    <AppShell active="/messaging">
      <PageHeader
        eyebrow="Messaging"
        icon={MessageSquare}
        title={<>Every conversation, <span className="text-gradient">in your voice</span>.</>}
        description="BridgeDNA™ drafts replies that sound like you. Every message ties back to the guest, vendor, or task it's about."
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr_320px]">
        <div className="rounded-3xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {THREADS.map((t) => (
              <li key={t.who} className="flex cursor-pointer items-center gap-3 p-3 transition hover:bg-accent/40">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-gold/20 text-sm font-semibold">{t.who[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium">{t.who}</p>
                    <span className="text-[10px] text-muted-foreground">{t.when}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.last}</p>
                </div>
                {t.unread > 0 && <Badge className="bg-primary text-primary-foreground">{t.unread}</Badge>}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="flex items-center gap-3 border-b border-border pb-4">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-gold/20 font-semibold">P</div>
            <div>
              <p className="font-medium">Priya Menon</p>
              <p className="text-xs text-muted-foreground">Guest · Table 3 · Vegetarian</p>
            </div>
          </div>
          <ul className="mt-4 space-y-3">
            {CONVERSATION.map((c, i) => (
              <li key={i} className={`max-w-md rounded-2xl p-3 text-sm ${c.ai ? "bg-primary/10 text-primary-foreground/90" : "bg-accent/60"}`}>
                <div className="flex items-center gap-2 text-xs">
                  {c.ai && <Sparkles className="h-3 w-3 text-primary" />}
                  <span className="font-medium">{c.from}</span>
                  <span className="text-muted-foreground">· {c.when}</span>
                </div>
                <p className="mt-1 text-foreground">{c.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex gap-2">
            <input className="flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm" placeholder="Reply, or ask AI to draft…" />
            <Button variant="hero" className="gap-1"><Send className="h-4 w-4" /> Send</Button>
          </div>
        </div>
        <RippleFeed compact />
      </div>
    </AppShell>
  );
}

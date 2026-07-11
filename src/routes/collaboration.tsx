import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { Handshake, UserPlus, MessageSquare, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/collaboration")({
  head: () => ({
    meta: [
      { title: "Collaboration Workspace — MelaBridge" },
      { name: "description", content: "Shared feed for planners, family, and vendors — every module updates it." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CollabPage,
});

const TEAM = [
  { name: "Amara", role: "Lead planner (you)" },
  { name: "Julien", role: "Co-planner" },
  { name: "Maman Marie", role: "Family lead" },
  { name: "Chidi", role: "Best man · logistics" },
  { name: "Isa Kone", role: "Wedding planner (external)" },
];

const FEED = [
  { who: "AI", when: "just now", body: "Ripple: Bloomhaus confirmation is now 4 days overdue. I've drafted a nudge — needs your OK.", tag: "AI update" },
  { who: "Julien", when: "2h ago", body: "Approved the string quartet decision from Decision Center™.", tag: "Decision" },
  { who: "Isa", when: "yesterday", body: "Uploaded final Villa d'Este walkthrough video to BridgeVault™.", tag: "Vault" },
  { who: "Maman Marie", when: "yesterday", body: "Added 4 guests to the family side. Seating and catering updated automatically.", tag: "Guests" },
];

function CollabPage() {
  return (
    <AppShell active="/collaboration">
      <PageHeader
        eyebrow="Collaboration Workspace"
        icon={Handshake}
        title={<>Everyone planning, <span className="text-gradient">on the same page</span>.</>}
        description="Family, planners, and vendors share one feed. Every action anywhere in MelaBridge shows up here."
        actions={<Button variant="hero" className="gap-1"><UserPlus className="h-4 w-4" /> Invite collaborator</Button>}
      />
      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card">
          <div className="border-b border-border p-4">
            <p className="font-display text-lg font-semibold">Activity feed</p>
          </div>
          <ul className="divide-y divide-border">
            {FEED.map((f, i) => (
              <li key={i} className="p-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-gold/20 text-xs font-semibold">{f.who[0]}</div>
                  <p className="text-sm"><span className="font-medium">{f.who}</span> · <span className="text-muted-foreground">{f.when}</span></p>
                  <Badge className="ml-auto bg-primary/10 text-primary">{f.tag}</Badge>
                </div>
                <p className="mt-2 pl-10 text-sm">{f.body}</p>
                <div className="mt-2 flex gap-2 pl-10 text-xs">
                  <Button size="sm" variant="ghost" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Approve</Button>
                  <Button size="sm" variant="ghost" className="gap-1"><MessageSquare className="h-3 w-3" /> Reply</Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-6">
          <div className="rounded-3xl border border-border bg-card p-6">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Team</p>
            <ul className="mt-3 space-y-3">
              {TEAM.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary/20 to-gold/20 text-sm font-semibold">{m.name[0]}</div>
                  <div>
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.role}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <RippleFeed compact />
        </div>
      </div>
    </AppShell>
  );
}

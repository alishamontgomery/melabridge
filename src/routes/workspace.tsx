import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader, NAV_GROUPS } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Sparkles } from "lucide-react";

export const Route = createFileRoute("/workspace")({
  head: () => ({
    meta: [
      { title: "Event Workspace — MelaBridge" },
      { name: "description", content: "Every planning tool for your event in one intelligent workspace." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WorkspacePage,
});

function WorkspacePage() {
  const { event, health, budgetPct } = useEcosystem();
  const planningGroups = NAV_GROUPS.filter((g) => g.label !== "Ecosystem" && g.label !== "Account");

  return (
    <AppShell active="/workspace">
      <PageHeader
        eyebrow="Event Workspace"
        icon={GitBranch}
        title={<>Everything for <span className="text-gradient">{event.name}</span>, in one place.</>}
        description={`${event.type} · ${event.location} · Health ${health} · Budget ${budgetPct}% used. Every tool below is wired to every other tool — changes propagate instantly.`}
      />
      <section className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {planningGroups.flatMap((g) =>
          g.items.map((item) => (
            <Link
              key={item.to}
              to={item.to as "/guests"}
              className="group rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-soft"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                  <item.icon className="h-5 w-5" />
                </span>
                <Badge variant="secondary" className="text-[10px]">{g.label}</Badge>
              </div>
              <p className="mt-4 font-display text-base font-semibold">{item.label}</p>
              <p className="mt-1 text-xs text-muted-foreground group-hover:text-primary">Open →</p>
            </Link>
          ))
        )}
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-3xl border border-border bg-hero-radial p-6">
          <div className="flex items-center gap-2 text-primary"><Sparkles className="h-4 w-4" /><span className="text-xs uppercase tracking-widest">BridgeMind™ suggestion</span></div>
          <p className="mt-3 text-lg">Your florist contract has been outstanding for 4 days. I've drafted a friendly nudge and a fallback vendor from your BridgeDNA™ favorites in case it falls through.</p>
        </div>
        <RippleFeed compact />
      </section>
    </AppShell>
  );
}

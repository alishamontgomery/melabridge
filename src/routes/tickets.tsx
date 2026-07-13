import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Ticket, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ModuleGrid } from "@/components/module-page";
import { Users, CreditCard, QrCode, BarChart3, ShieldCheck, Share2 } from "lucide-react";

export const Route = createFileRoute("/tickets")({
  head: () => ({
    meta: [
      { title: "Tickets — MelaBridge" },
      { name: "description", content: "Sell tickets and admissions — check-in, tiers, and payouts integrated with the ecosystem." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TicketsPage,
});

function TicketsPage() {
  return (
    <AppShell active="/tickets">
      <PageHeader
        eyebrow="Tickets"
        icon={Ticket}
        title={<>Sell admissions <span className="text-gradient">without leaving the plan</span>.</>}
        description="Every sale updates the guest list, budget, and Bridge Intelligence™ benchmarks."
        actions={<Badge variant="secondary">Preview</Badge>}
      />
      <section className="mt-8">
        <Card className="border-border/60 p-8 text-center shadow-soft">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <h3 className="font-display text-lg font-semibold">Ticketing is coming to your workspace</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create tiers, sell online, and check guests in — all connected to your event's guest list and budget.
            In the meantime, you can collect RSVPs and manage guests today.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button asChild variant="hero"><Link to="/guests">Manage guests</Link></Button>
            <Button asChild variant="outline"><Link to="/subscription">See pricing</Link></Button>
          </div>
        </Card>
      </section>
      <section className="mt-8">
        <ModuleGrid
          features={[
            { icon: BarChart3, title: "Tiered pricing", detail: "Early bird, VIP, table packages, discount codes." },
            { icon: QrCode, title: "Fast check-in", detail: "QR scanning at the door with offline mode." },
            { icon: CreditCard, title: "Direct payouts", detail: "Funds land in your BridgePay balance automatically." },
            { icon: Users, title: "Guest list sync", detail: "Every sale becomes a confirmed guest — no double entry." },
            { icon: Share2, title: "Shareable pages", detail: "Beautiful event pages with your branding." },
            { icon: ShieldCheck, title: "Fraud protection", detail: "Stripe Radar + duplicate-ticket detection." },
          ]}
        />
      </section>
    </AppShell>
  );
}

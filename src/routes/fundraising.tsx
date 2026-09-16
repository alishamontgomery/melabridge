import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { HeartHandshake, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/fundraising")({
  head: () => ({
    meta: [
      { title: "Fundraising — MelaBridge" },
      { name: "description", content: "Preview MelaBridge fundraising, currently in development, and track contributions manually in your event budget." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FundraisingPage,
});

function FundraisingPage() {
  return (
    <AppShell active="/fundraising">
      <PageHeader
        eyebrow="Fundraising"
        icon={HeartHandshake}
        title={<>Raise, thank, and <span className="text-gradient">turn goodwill into a great event</span>.</>}
        description="Donations flow into the budget module automatically; thank-you notes draft themselves with MelaAssist."
      />

      <Card className="mt-8 border-primary/20 bg-gradient-to-br from-primary/5 via-card to-gold/5 p-10 text-center shadow-soft">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-6 w-6" />
        </div>
        <Badge variant="secondary" className="mb-3">Coming soon</Badge>
        <h2 className="font-display text-2xl font-semibold">Fundraising module in development</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
          Create and share donation campaigns, track contributors, and route funds
          directly into your event budget. Thank-you notes will draft themselves
          with MelaAssist.
        </p>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          For now, use the Budget module to manually record any donations or contributions received.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild variant="hero">
            <Link to="/budget">Go to Budget</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </AppShell>
  );
}

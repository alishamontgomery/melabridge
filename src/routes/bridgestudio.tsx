import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Palette, Sparkles } from "lucide-react";

export const Route = createFileRoute("/bridgestudio")({
  component: BridgeStudioUnavailable,
});

function BridgeStudioUnavailable() {
  return (
    <AppShell active="/bridgestudio">
      <PageHeader eyebrow="Creative tools" icon={Palette} title="BridgeStudio is still being prepared." description="We are polishing this workspace before opening it to everyone." />
      <Card className="mt-6 max-w-xl border-border/70 p-6">
        <p className="text-sm text-muted-foreground">You can still use MelaAssist to draft themes, task lists, budgets, timelines, and event details today.</p>
        <Button className="mt-4" asChild><Link to="/ai-planning"><Sparkles className="mr-2 h-4 w-4" />Plan with MelaAssist</Link></Button>
      </Card>
    </AppShell>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/app-shell";
import { PublicShell } from "@/components/public-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Vault, Sparkles } from "lucide-react";

export const Route = createFileRoute("/bridgevault")({
  head: () => ({
    meta: [
      { title: "BridgeVault™ — MelaBridge" },
      { name: "description", content: "Preview the upcoming BridgeVault event archive and use MelaBridge's available File Center today." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BridgeVault,
});

function BridgeVault() {
  const navigate = useNavigate();
  return (
    <PublicShell>
      <PageHeader
        eyebrow="BridgeVault™ · Permanent digital archive"
        icon={Vault}
        title="Every event, preserved for a lifetime"
        description="A private, encrypted archive for photos, videos, contracts, invitations, budgets, speeches, and keepsakes — organized for years to come."
      />
      <Card className="mt-8 p-10 text-center shadow-soft border-border/60">
        <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
        <h3 className="font-display text-lg font-semibold">This feature is in development</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          BridgeVault™ — encrypted event archives, multi-generational sharing, and AI auto-tagging — is coming to MelaBridge soon.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => navigate({ to: "/files" })}>
          Back to files
        </Button>
      </Card>
    </PublicShell>
  );
}

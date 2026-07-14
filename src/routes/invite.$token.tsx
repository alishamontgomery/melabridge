import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { PublicShell } from "@/components/public-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InvitationPreview } from "@/components/inspiration/invitation-preview";
import { INSPIRATION_COLLECTIONS } from "@/lib/inspiration-collections";
import { parseShareToken } from "@/lib/invitation-suite";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({
    meta: [
      { title: "You're Invited — MelaBridge" },
      { name: "description", content: "A beautiful invitation, shared through MelaBridge." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePreviewPage,
});

function InvitePreviewPage() {
  const { token } = Route.useParams();
  const parsed = useMemo(() => parseShareToken(token), [token]);
  const collection = useMemo(() => (parsed ? INSPIRATION_COLLECTIONS.find((c) => c.id === parsed.c) : null), [parsed]);

  if (!parsed || !collection) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <h1 className="font-display text-2xl font-semibold">Invitation not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link may have expired or been mistyped.</p>
          <Button asChild className="mt-6"><Link to="/">Return home</Link></Button>
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="text-center">
          <div className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs text-primary">
            <Sparkles className="h-3.5 w-3.5" /> You&rsquo;re invited
          </div>
        </div>
        <div className="mx-auto max-w-md">
          <InvitationPreview collection={collection} personalization={parsed.p} size="lg" />
        </div>
        <Card className="mx-auto max-w-md p-4 text-center sm:p-6">
          <p className="text-sm text-muted-foreground">
            Kindly respond by <b>{parsed.p.rsvpDeadline || "the date on the invitation"}</b>.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button className="min-h-11 whitespace-normal bg-gradient-to-r from-primary to-primary-glow text-primary-foreground">
              Joyfully accept
            </Button>
            <Button variant="outline" className="min-h-11 whitespace-normal">Regretfully decline</Button>
          </div>
        </Card>
      </div>
    </PublicShell>
  );
}

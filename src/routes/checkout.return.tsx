import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/checkout/return")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Payment complete — MelaBridge" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <div>
        <h1 className="font-display text-3xl">Thank you!</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {session_id
            ? "Your subscription is being activated — it will appear on your account within a moment."
            : "We couldn't find your checkout session, but if you completed payment your plan will still activate shortly."}
        </p>
      </div>
      <Card className="w-full p-4 text-left text-xs text-muted-foreground">
        Payments are processed securely by Stripe. You can manage or cancel your plan any time from your subscription page.
      </Card>
      <div className="flex gap-2">
        <Button asChild variant="hero">
          <Link to="/subscription">Go to subscription</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/dashboard">Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

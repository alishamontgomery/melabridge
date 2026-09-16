import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useSubscription } from "@/hooks/use-subscription";
import { useServerFn } from "@tanstack/react-start";
import { verifyCheckoutSession } from "@/utils/payments.functions";
import { getStripeEnvironment } from "@/lib/stripe";

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
  const { isActive, loading, refetch } = useSubscription();
  const verifyFn = useServerFn(verifyCheckoutSession);
  const navigate = useNavigate();
  const [pollCount, setPollCount] = useState(0);
  const [settled, setSettled] = useState(false);

  // No session_id means the user navigated here directly — send them to subscription management.
  useEffect(() => {
    if (!session_id) navigate({ to: "/subscription", search: { audience: undefined }, replace: true });
  }, [session_id, navigate]);

  // Step 1: On mount, directly verify the session with Stripe and activate
  // the subscription in our DB — no webhook required.
  useEffect(() => {
    if (!session_id) { setSettled(true); return; }
    let cancelled = false;
    (async () => {
      try {
        const env = (() => { try { return getStripeEnvironment(); } catch { return "sandbox" as const; } })();
        await verifyFn({ data: { sessionId: session_id, environment: env } });
      } catch {
        // Non-fatal — fall through to polling
      }
      if (!cancelled) await refetch();
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id]);

  // Step 2: Poll until subscription row appears (handles any DB propagation delay)
  useEffect(() => {
    if (!session_id) { setSettled(true); return; }
    if (isActive) { setSettled(true); return; }
    if (pollCount >= 8) { setSettled(true); return; }

    const timer = setTimeout(async () => {
      await refetch();
      setPollCount((n) => n + 1);
    }, 1500);

    return () => clearTimeout(timer);
  }, [session_id, isActive, pollCount, refetch]);

  const isPending = session_id && !settled;
  const isSuccess = isActive;
  const isFailed = settled && !isActive && session_id;
  const isNoSession = !session_id;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-6 text-center">
      {/* ── Icon ─────────────────────────────────────────────────────── */}
      <div
        className={`grid h-20 w-20 place-items-center rounded-full ${
          isSuccess
            ? "bg-emerald-100 text-emerald-600"
            : isFailed || isNoSession
              ? "bg-amber-100 text-amber-600"
              : "bg-primary/10 text-primary"
        }`}
      >
        {isPending ? (
          <Loader2 className="h-9 w-9 animate-spin" />
        ) : isSuccess ? (
          <CheckCircle2 className="h-9 w-9" />
        ) : (
          <Crown className="h-9 w-9" />
        )}
      </div>

      {/* ── Heading ──────────────────────────────────────────────────── */}
      <div className="space-y-2">
        {isPending && (
          <>
            <h1 className="font-display text-3xl font-semibold">Activating your plan…</h1>
            <p className="text-sm text-muted-foreground">
              Your payment was received. We're activating your subscription — this usually takes a few seconds.
            </p>
          </>
        )}
        {isSuccess && (
          <>
            <h1 className="font-display text-3xl font-semibold">You're all set!</h1>
            <p className="text-sm text-muted-foreground">
              Your plan is active. All premium features are now unlocked.
            </p>
          </>
        )}
        {(isFailed || isNoSession) && (
          <>
            <h1 className="font-display text-3xl font-semibold">
              {isNoSession ? "Checkout complete" : "Activation in progress"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isNoSession
                ? "If you completed your payment, your plan will activate shortly and appear on your account within a minute."
                : "Your payment was received. Subscription activation can take up to a minute — check back in a moment."}
            </p>
          </>
        )}
      </div>

      {/* ── Info card ────────────────────────────────────────────────── */}
      <Card className="w-full p-4 text-left shadow-soft">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Payments processed securely by Stripe — MelaBridge never stores your card details.
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Cancel anytime from your subscription page — no fees, no lock-in.
          </li>
          {session_id && (
            <li className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Session: <span className="font-mono text-xs">{session_id.slice(0, 28)}…</span>
            </li>
          )}
        </ul>
      </Card>

      {/* ── CTAs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant={isSuccess ? "hero" : "default"} className="gap-2">
          <Link to="/dashboard">
            {isSuccess ? "Start planning" : "Go to dashboard"}
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/subscription" search={{ audience: undefined }}>View subscription</Link>
        </Button>
      </div>

      {isFailed && (
        <button
          type="button"
          onClick={() => { setPollCount(0); setSettled(false); }}
          className="text-xs text-primary underline hover:text-primary/80"
        >
          Check again
        </button>
      )}
    </div>
  );
}

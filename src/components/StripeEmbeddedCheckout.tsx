import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createCheckoutSession } from "@/utils/payments.functions";

interface Props {
  priceId: string;
  returnUrl?: string;
}

type State =
  | { status: "loading" }
  | { status: "ready"; clientSecret: string }
  | { status: "error"; message: string };

/**
 * Pre-fetches the Stripe client secret server-side before mounting the
 * EmbeddedCheckoutProvider, so any server/configuration errors are caught
 * and displayed as a friendly inline message with a retry button — not a
 * blank white container.
 */
export function StripeEmbeddedCheckout({ priceId, returnUrl }: Props) {
  const [state, setState] = useState<State>({ status: "loading" });
  const abortRef = useRef(false);

  const load = useCallback(async () => {
    abortRef.current = false;
    setState({ status: "loading" });
    try {
      const env = getStripeEnvironment();
      const result = await createCheckoutSession({
        data: {
          priceId,
          returnUrl:
            returnUrl ||
            `${window.location.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: env,
        },
      });
      if (abortRef.current) return;
      if ("error" in result) {
        setState({ status: "error", message: result.error });
      } else if (!result.clientSecret) {
        setState({ status: "error", message: "Stripe did not return a checkout session. Please try again." });
      } else {
        setState({ status: "ready", clientSecret: result.clientSecret });
      }
    } catch (e) {
      if (abortRef.current) return;
      setState({
        status: "error",
        message: e instanceof Error ? e.message : "Unable to start checkout. Please try again.",
      });
    }
  }, [priceId, returnUrl]);

  useEffect(() => {
    load();
    return () => { abortRef.current = true; };
  }, [load]);

  /* ── Loading skeleton ─────────────────────────────────────────────────── */
  if (state.status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Preparing secure checkout…</p>
      </div>
    );
  }

  /* ── Error state ──────────────────────────────────────────────────────── */
  if (state.status === "error") {
    const isConfigError =
      state.message.toLowerCase().includes("not configured") ||
      state.message.toLowerCase().includes("stripe_secret_key") ||
      state.message.toLowerCase().includes("api_key");

    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <div className="max-w-sm">
          <p className="font-semibold">Checkout unavailable</p>
          {isConfigError ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Stripe is not yet configured for this environment. Add your Stripe secret key
              (<code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">STRIPE_SECRET_KEY</code>)
              to Replit Secrets, then try again.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }

  /* ── Ready — mount Stripe checkout ───────────────────────────────────── */
  const { clientSecret } = state;
  // fetchClientSecret resolves immediately with the pre-fetched secret
  const fetchClientSecret = async () => clientSecret;

  return (
    <div id="checkout" className="min-h-[400px] w-full">
      <EmbeddedCheckoutProvider
        stripe={getStripe()}
        options={{ fetchClientSecret }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

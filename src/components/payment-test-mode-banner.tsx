const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken) {
    // No publishable key configured — show a neutral notice (not a red error)
    // so the subscription page still renders normally for users.
    return (
      <div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        Stripe is not yet configured. Add <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900">STRIPE_SECRET_KEY</code> and{" "}
        <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900">VITE_PAYMENTS_CLIENT_TOKEN</code> to Replit Secrets to enable live checkout.
      </div>
    );
  }
  if (clientToken.startsWith("pk_test_")) {
    return (
      <div className="w-full border-b border-orange-200 bg-orange-50 px-4 py-2 text-center text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
        Stripe test mode — all payments are simulated and no real money moves.
      </div>
    );
  }
  return null;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/cancellation")({
  head: () => ({
    meta: [
      { title: "Cancellation Policy — MelaBridge" },
      { name: "description", content: "How to cancel your MelaBridge subscription and what happens after." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Cancellation Policy"
      description="Last updated: September 9, 2026"
    >
      <p>
        You can cancel a paid MelaBridge subscription from your Subscription page. No phone call is required.
      </p>

      <h2>1. How to Cancel</h2>
      <p>
        You can cancel your subscription at any time directly from your{" "}
        <Link to="/subscription" search={{ audience: undefined }} className="underline">Subscription page</Link> by clicking{" "}
        <strong>Cancel Subscription</strong>. A confirmation step will show you the exact date your access
        ends before you confirm. You can also manage billing details (invoices, payment method) via the
        Stripe billing portal accessible from the same page.
      </p>

      <h2>2. Trial and Billing</h2>
      <p>
        Planner Pro includes one 5-day trial for eligible professional planners, and a valid payment method
        is required when the trial begins. Cancel before the disclosed trial end date to avoid the first
        subscription charge. If you do not cancel, the selected $29 monthly or $290 yearly subscription
        starts automatically and renews until canceled.
      </p>

      <h2>3. What Happens After You Cancel</h2>
      <ul>
        <li>
          <strong>Access continues</strong> through the end of your current paid billing period. You will
          not be charged again.
        </li>
        <li>
          <strong>No future renewals</strong> — cancellation stops all future automatic charges.
        </li>
        <li>
          <strong>Your account and data are preserved</strong> — cancelling does not delete your account,
          events, guest lists, vendor history, files, or any other data. Your account downgrades to the
          Free tier at the end of the billing period.
        </li>
        <li>
          <strong>Your account remains</strong> and moves to the Free plan when paid access ends.
        </li>
      </ul>

      <h2>4. Refunds and Account Deletion</h2>
      <p>
        Cancellation stops future charges but does not automatically refund a paid period. See the{" "}
        <Link to="/refund" className="underline">Refund Policy</Link>. To permanently remove your account
        and data, use Settings → Account → Delete Account.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/refund" className="underline">Refund Policy</Link> ·{" "}
        <Link to="/payment-terms" className="underline">Payment Terms</Link> ·{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>
      </p>
    </MarketingPage>
  ),
});

import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/payment-terms")({
  head: () => ({
    meta: [
      { title: "Payment Terms — MelaBridge" },
      { name: "description", content: "Payment terms covering subscriptions, ticket sales, and processing fees on MelaBridge." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Payment Terms"
      description="Effective date: July 30, 2026 · Last updated: July 30, 2026"
    >
      <p>
        These Payment Terms describe how payments are processed on MelaBridge and the rights and
        responsibilities of each party in payment transactions. By making or receiving payments through
        MelaBridge, you agree to these terms.
      </p>

      <h2>1. Payment Processor</h2>
      <p>
        All payments on MelaBridge — including subscription billing and ticket sales — are processed by{" "}
        <strong>Stripe, Inc.</strong>, a third-party payment processor. MelaBridge does not store your
        credit card or bank account information. By making a payment, you agree to{" "}
        <a href="https://stripe.com/legal" target="_blank" rel="noopener noreferrer" className="underline">
          Stripe's Terms of Service
        </a>{" "}
        in addition to these Payment Terms.
      </p>

      <h2>2. Subscription Billing</h2>
      <p>
        Paid MelaBridge subscriptions are billed on a recurring basis (monthly or annually as selected)
        until cancelled. By subscribing to a paid plan, you authorize MelaBridge to charge your payment
        method automatically at the start of each billing period. You will receive advance notice of any
        price changes that affect your subscription.
      </p>

      <h2>3. Payment Processing Fees</h2>
      <p>
        MelaBridge charges <strong>$0 platform fee</strong> on ticket sales and <strong>0%</strong> on
        donation or fundraising transactions. However, Stripe's standard processing fees (typically a
        percentage plus a fixed amount per transaction) apply when money moves. These fees are set by
        Stripe and are not controlled by MelaBridge. The total amount shown at checkout includes all
        applicable fees.
      </p>

      <h2>4. Currency</h2>
      <p>
        All prices on MelaBridge are displayed and charged in US Dollars (USD) unless otherwise stated.
        Your bank or card issuer may apply currency conversion fees for non-USD accounts, which are not
        controlled by MelaBridge.
      </p>

      <h2>5. Taxes</h2>
      <p>
        You are responsible for paying all applicable taxes on your subscription, ticket revenue, or
        other payments. MelaBridge does not calculate or remit taxes on behalf of event organizers.
        If you are an organizer selling tickets, you are solely responsible for determining and
        fulfilling your tax obligations under all applicable laws.
      </p>

      <h2>6. Failed Payments</h2>
      <p>
        If a subscription payment fails, MelaBridge (via Stripe) may retry the charge up to several
        times over a short period. If payment cannot be collected, your subscription may be downgraded
        or suspended. You are responsible for keeping your payment information current.
      </p>

      <h2>7. Chargebacks and Disputes</h2>
      <p>
        If you initiate a chargeback or payment dispute with your bank or card issuer for a legitimate
        MelaBridge charge, we encourage you to contact us first at{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>. Fraudulent chargebacks or
        chargebacks filed against legitimate charges may result in account suspension. MelaBridge
        reserves the right to recover chargeback fees from the responsible party.
      </p>

      <h2>8. Fraud Prevention</h2>
      <p>
        MelaBridge and Stripe employ fraud-detection systems. Suspected fraudulent transactions may be
        declined, reviewed, or refunded at our sole discretion. If your legitimate transaction is
        declined in error, please contact us at{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>.
      </p>

      <h2>9. Organizer Payouts</h2>
      <p>
        Ticket revenue is paid out to event organizers by Stripe directly according to Stripe's payout
        schedule and your Stripe account settings. MelaBridge does not hold organizer funds and is not
        responsible for payout delays, Stripe-initiated holds, or disputes between organizers and Stripe.
        To manage payouts, you must maintain a valid and verified Stripe account.
      </p>

      <h2>10. No MelaBridge Liability for Third-Party Processor Failures</h2>
      <p>
        MelaBridge is not liable for any losses, delays, or damages arising from the actions or
        omissions of Stripe or any other third-party payment processor, including system outages,
        processing errors, or account restrictions. Any such issues must be resolved directly with
        the applicable processor.
      </p>

      <h2>11. Changes to These Terms</h2>
      <p>
        We may update these Payment Terms from time to time. Material changes will be communicated
        at least 14 days in advance via email or in-app notice. Continued use of MelaBridge payment
        features after the effective date constitutes acceptance of the revised terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about a charge or payment? Email{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/refund" className="underline">Refund Policy</Link> ·{" "}
        <Link to="/cancellation" className="underline">Cancellation Policy</Link> ·{" "}
        <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> ·{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>
      </p>
    </MarketingPage>
  ),
});

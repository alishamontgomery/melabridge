import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — MelaBridge" },
      { name: "description", content: "MelaBridge's refund policy for subscriptions, tickets, and platform services." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Refund Policy"
      description="Last updated: September 9, 2026"
    >
      <p>
        This Refund Policy governs refunds for MelaBridge subscriptions and platform services. Event-ticket
        refunds are addressed separately in our{" "}
        <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> and are the responsibility of
        the event organizer, not MelaBridge.
      </p>

      <h2>1. Subscription Refunds</h2>

      <h3>1.1 Subscription Charges</h3>
      <p>
        Subscription charges are generally non-refundable except where required by law. Planner Pro includes
        one 5-day trial with a payment method required at signup; cancel before the trial ends to avoid the
        first subscription charge.
      </p>

      <h3>1.2 Renewal Charges</h3>
      <p>
        Subscription renewal charges (monthly or annual charges after the initial period) are generally
        non-refundable, except where required by applicable law. We recommend cancelling your subscription
        before the renewal date to avoid being charged for the next period. See our{" "}
        <Link to="/cancellation" className="underline">Cancellation Policy</Link> for details on how to cancel.
      </p>

      <h3>1.3 Free Trials</h3>
      <p>
        No charge is made during the Planner Pro 5-day trial. A valid payment method is collected when the
        trial begins. If you cancel before the disclosed trial end date, the subscription will not start.
      </p>

      <h3>1.4 Duplicate or Incorrect Charges</h3>
      <p>
        If you believe you were charged in error — for example, charged twice for the same billing period or
        charged for a plan you did not select — please contact us at{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> within 30 days of the charge. We will
        investigate and, where confirmed, refund the erroneous charge.
      </p>

      <h3>1.5 Featured and Sponsored Services</h3>
      <p>
        Fees paid for featured placement, sponsored listings, or other promotional services are generally
        non-refundable once the promotional period has begun, as the service has already been provided.
        Exceptions may be made at our discretion where a material error has occurred on our part.
      </p>

      <h3>1.6 Material Platform Failures</h3>
      <p>
        In the event of a verified, material failure of the MelaBridge platform that substantially prevents
        access to core features for an extended period, we may review requests for pro-rata or partial refunds
        on a case-by-case basis. Platform failures caused by third-party services, force majeure events, or
        scheduled maintenance do not automatically qualify for refunds.
      </p>

      <h2>2. Event-Ticket Refunds</h2>
      <p>
        MelaBridge is a technology platform that enables event organizers to sell tickets. We are not the
        organizer of any event. Refund rights for event tickets are determined by the individual event
        organizer, not by MelaBridge. Before purchasing a ticket, you should review the organizer's stated
        refund and cancellation policy. MelaBridge does not guarantee refunds for events that are canceled,
        postponed, rescheduled, disappointing, or affected by vendor or venue problems, unless the organizer
        or the applicable payment arrangement provides for such a refund. See our{" "}
        <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> for more information.
      </p>

      <h2>3. Payment Processing Fees</h2>
      <p>
        Third-party payment-processing fees (e.g., Stripe fees) may not be recoverable when a refund is
        processed, depending on the processor's own refund policy. MelaBridge does not retain payment
        processing fees and cannot guarantee their return on your behalf.
      </p>

      <h2>4. Chargebacks</h2>
      <p>
        If you initiate a chargeback with your bank or card issuer instead of contacting us first, we reserve
        the right to suspend or terminate your account pending resolution. We encourage you to reach out to us
        directly — we are committed to resolving legitimate disputes quickly.
      </p>

      <h2>5. How to Request a Refund</h2>
      <p>
        Email <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>. Please include your account email, the charge date,
        and a brief description of your request. We aim to respond within 2 business days.
      </p>

      <h2>6. Changes to This Policy</h2>
      <p>
        We may update this Refund Policy from time to time. Material changes will be communicated via email
        or an in-app notice. Continued use of MelaBridge after the effective date of any update constitutes
        acceptance of the revised policy.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/cancellation" className="underline">Cancellation Policy</Link> ·{" "}
        <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> ·{" "}
        <Link to="/payment-terms" className="underline">Payment Terms</Link> ·{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>
      </p>
    </MarketingPage>
  ),
});

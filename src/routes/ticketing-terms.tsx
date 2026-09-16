import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/ticketing-terms")({
  head: () => ({
    meta: [
      { title: "Ticketing Terms — MelaBridge" },
      { name: "description", content: "Terms governing ticket sales on MelaBridge — for organizers and ticket purchasers." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Ticketing Terms"
      description="Effective date: July 30, 2026 · Last updated: July 30, 2026"
    >
      <p>
        These Ticketing Terms apply to event organizers who sell tickets through MelaBridge and to
        individuals who purchase tickets ("Ticket Purchasers"). By selling or purchasing tickets on
        MelaBridge, you agree to these terms in addition to our{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>.
      </p>

      <h2>For Ticket Purchasers</h2>

      <h3>1. MelaBridge Is Not the Event Organizer</h3>
      <p>
        MelaBridge provides the technology platform used by event organizers to sell tickets. We are not
        the organizer of any event. Your ticket purchase is a contract between you and the event organizer,
        not with MelaBridge. All questions about the event — including schedule, location, content, safety,
        and refunds — should be directed to the organizer.
      </p>

      <h3>2. Refunds and Event Changes</h3>
      <p>
        <strong>MelaBridge does not guarantee refunds for:</strong> canceled events, postponed events,
        rescheduled events, disappointing events, events affected by vendor or venue problems, or any other
        event outcome. Your right to a refund depends entirely on the event organizer's stated refund and
        cancellation policy, which you should review before purchasing. Where applicable law requires
        organizers to provide refunds (e.g., in the event of outright cancellation), that obligation rests
        with the organizer, not MelaBridge.
      </p>

      <h3>3. Payment Processing Fees</h3>
      <p>
        Ticket prices are set by the event organizer. MelaBridge does not charge a platform fee on ticket
        sales. Standard payment-processing fees (e.g., Stripe's transaction fees) may be passed through
        or absorbed by the organizer; the final price displayed at checkout is the total you will be
        charged. Payment is processed securely through Stripe.
      </p>

      <h3>4. Free Tickets</h3>
      <p>
        Free-ticket registrations are processed through MelaBridge's platform at no charge. No payment
        processing fees apply to $0 tickets. Your registration constitutes an agreement with the organizer
        to attend under the organizer's terms.
      </p>

      <h3>5. Ticket Transfers</h3>
      <p>
        Ticket transfers are subject to the organizer's policy. MelaBridge does not currently operate a
        secondary ticket marketplace. Contact the organizer directly if you wish to transfer your ticket.
      </p>

      <h3>6. Your Ticket Is Personal</h3>
      <p>
        Tickets are issued to the purchaser and may be validated with a QR code at the event. Fraudulent
        duplication or resale of tickets may result in denial of entry at the organizer's discretion.
        MelaBridge is not responsible for fraudulently obtained or duplicated tickets not issued through
        our platform.
      </p>

      <h2>For Event Organizers</h2>

      <h3>7. Organizer Responsibility for Refunds</h3>
      <p>
        As an organizer, you are responsible for establishing and honoring a refund and cancellation
        policy for your ticket purchasers. You must display this policy clearly during checkout. If you
        cancel or materially alter your event, you may be legally required to provide refunds to
        purchasers in your jurisdiction. MelaBridge does not process organizer-initiated ticket refunds
        on your behalf — you must arrange refunds directly with Stripe or your payment processor.
      </p>

      <h3>8. Revenue and Payouts</h3>
      <p>
        Ticket revenue is collected through Stripe and paid out to you according to Stripe's payout
        schedule and terms. MelaBridge does not hold ticket revenue and is not responsible for payout
        timing, Stripe account restrictions, or Stripe-initiated holds or reversals.
      </p>

      <h3>9. Tax Responsibility</h3>
      <p>
        You are solely responsible for all taxes applicable to ticket sales, including but not limited
        to sales tax, VAT, entertainment tax, and amusement tax. MelaBridge does not calculate,
        collect, or remit taxes on your behalf.
      </p>

      <h3>10. Prohibited Uses</h3>
      <p>
        Ticket sales may not be used for illegal purposes, to sell access to unlawful events, to
        defraud purchasers, or to circumvent consumer-protection laws. Organizers who engage in
        prohibited conduct may have their accounts suspended and may be reported to relevant authorities.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, MelaBridge's liability to any ticket purchaser or
        organizer in connection with a ticket transaction is limited to the lower of: (a) the face
        value of the ticket(s) in question, or (b) the MelaBridge subscription fees paid by the
        organizer in the 12 months preceding the claim. MelaBridge is not liable for event outcomes,
        organizer conduct, or vendor and venue performance.
      </p>

      <h2>12. Changes to These Terms</h2>
      <p>
        We may update these Ticketing Terms from time to time. Continued use of the ticketing features
        after the effective date of any update constitutes acceptance of the revised terms.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/organizer-terms" className="underline">Organizer Terms</Link> ·{" "}
        <Link to="/refund" className="underline">Refund Policy</Link> ·{" "}
        <Link to="/payment-terms" className="underline">Payment Terms</Link> ·{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>
      </p>
    </MarketingPage>
  ),
});

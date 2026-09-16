import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/organizer-terms")({
  head: () => ({
    meta: [
      { title: "Organizer Terms — MelaBridge" },
      { name: "description", content: "Terms for event organizers and hosts using MelaBridge to plan and run events." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Organizer Terms"
      description="Effective date: July 30, 2026 · Last updated: July 30, 2026"
    >
      <p>
        These Organizer Terms apply to any individual or organization ("Organizer") that uses MelaBridge
        to plan, manage, or host events, including collecting RSVPs, selling tickets, or communicating
        with guests. By using MelaBridge as an organizer, you agree to these terms in addition to our{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>.
      </p>

      <h2>1. You Are the Event Organizer</h2>
      <p>
        MelaBridge is a technology platform. <strong>You, the organizer, are solely responsible for your
        event</strong> — its planning, execution, safety, compliance with applicable laws, and all
        commitments made to guests, vendors, and venues. MelaBridge does not co-organize, co-host, or
        share responsibility for any event hosted through the platform.
      </p>

      <h2>2. Compliance with Laws</h2>
      <p>
        You are responsible for ensuring your event complies with all applicable local, state, federal,
        and international laws, including but not limited to: venue permits and licensing, health and safety
        regulations, fire codes, noise ordinances, food and beverage licensing, accessibility requirements,
        and any regulations specific to your event type (e.g., alcohol service, fundraising registration).
      </p>

      <h2>3. Refund and Cancellation Policy Disclosure</h2>
      <p>
        If you sell tickets or collect payments for your event, you are required to establish and clearly
        disclose a refund and cancellation policy to your guests and ticket purchasers before they pay.
        MelaBridge provides tools to display your policy during ticket checkout. You are solely responsible
        for honoring the policy you disclose and for any refunds owed to attendees under that policy or
        applicable law. MelaBridge does not guarantee event-ticket refunds on your behalf.
      </p>

      <h2>4. Taxes</h2>
      <p>
        You are solely responsible for determining, collecting, reporting, and remitting any applicable
        taxes on ticket sales, donations, or other revenue generated through your use of MelaBridge,
        including sales tax, VAT, GST, and any applicable entertainment or amusement taxes. MelaBridge
        does not provide tax advice and is not responsible for your tax obligations.
      </p>

      <h2>5. Guest Data</h2>
      <p>
        When guests provide their personal information (name, email, dietary preferences, etc.) through
        MelaBridge in connection with your event, you act as a data controller with respect to that
        information. You agree to use guest data only for legitimate event-management purposes and not to
        sell, share, or exploit guest data for unrelated commercial purposes. You agree to comply with all
        applicable data-protection laws, including GDPR and CCPA where applicable.
      </p>

      <h2>6. Event Cancellation, Postponement, and Changes</h2>
      <p>
        If you cancel, postpone, or materially change your event, you are responsible for notifying
        affected guests and ticket purchasers promptly, honoring your stated refund policy, and complying
        with any legal obligations regarding consumer refunds in your jurisdiction. MelaBridge is not
        responsible for event cancellations, postponements, or changes, and does not guarantee that
        organizers will fulfill their refund obligations.
      </p>

      <h2>7. Vendor Relationships</h2>
      <p>
        Any agreement you reach with a vendor discovered through the MelaBridge marketplace is solely
        between you and that vendor. MelaBridge is not a party to vendor agreements, does not guarantee
        vendor performance, and has no liability for vendor failure to deliver contracted services.
      </p>

      <h2>8. Prohibited Events</h2>
      <p>
        You may not use MelaBridge to organize events that violate any law, promote illegal activity,
        incite hatred or violence, constitute fraud, or otherwise violate our{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>. We reserve the right to remove
        events or suspend accounts that violate these restrictions.
      </p>

      <h2>9. MelaAssist™ AI Output</h2>
      <p>
        MelaBridge provides AI-assisted planning tools ("MelaAssist"). AI output — including timelines,
        vendor suggestions, communication drafts, and budget estimates — is generated automatically and
        may contain errors, inaccuracies, or omissions. You are responsible for reviewing, verifying,
        and correcting all AI-generated content before acting on it or sharing it with guests or vendors.
        MelaBridge makes no warranty as to the accuracy, completeness, or fitness of AI output for any
        particular purpose.
      </p>

      <h2>10. No Guarantee of Outcomes</h2>
      <p>
        MelaBridge does not guarantee the success of your event, the quality or performance of vendors
        connected through the platform, a minimum number of RSVPs or ticket sales, fundraising targets,
        or any other event outcome.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, MelaBridge's aggregate liability to any organizer for
        claims arising out of or relating to these Organizer Terms or your use of the platform is limited
        to the subscription fees paid by you to MelaBridge in the 12 months preceding the claim.
        MelaBridge is not liable for any indirect, incidental, consequential, special, or exemplary
        damages arising from event outcomes, vendor performance, guest satisfaction, or any other
        event-related matter.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless MelaBridge and its officers, employees, and
        agents from and against any claims, damages, losses, liabilities, costs, and expenses (including
        reasonable legal fees) arising out of or relating to: (a) your event; (b) your violation of these
        terms or any applicable law; (c) any third-party claim by a guest, vendor, or venue arising from
        your event; or (d) your misuse of the MelaBridge platform.
      </p>

      <h2>13. Changes to These Terms</h2>
      <p>
        We may update these Organizer Terms from time to time. Continued use of MelaBridge as an organizer
        after the effective date of any update constitutes acceptance of the revised terms.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> ·{" "}
        <Link to="/refund" className="underline">Refund Policy</Link> ·{" "}
        <Link to="/terms" className="underline">Terms of Service</Link> ·{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link>
      </p>
    </MarketingPage>
  ),
});

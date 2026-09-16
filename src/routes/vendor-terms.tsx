import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/vendor-terms")({
  head: () => ({
    meta: [
      { title: "Vendor Terms — MelaBridge" },
      { name: "description", content: "Terms governing vendor use of the MelaBridge marketplace platform." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Vendor Terms"
      description="Effective date: July 30, 2026 · Last updated: July 30, 2026"
    >
      <p>
        These Vendor Terms apply to any individual or business ("Vendor") that creates a vendor profile,
        lists services, or uses MelaBridge to connect with event organizers and hosts. By using MelaBridge
        as a vendor, you agree to these terms in addition to our{" "}
        <Link to="/terms" className="underline">Terms of Service</Link>.
      </p>

      <h2>1. MelaBridge Is a Technology Platform</h2>
      <p>
        MelaBridge provides software tools to help vendors market their services and connect with potential
        clients. <strong>MelaBridge is not a party to any agreement between a vendor and a client.</strong>{" "}
        We do not broker, guarantee, or facilitate vendor-client contracts, deposits, or payments on your
        behalf. Any booking, agreement, deposit, payment, or contractual arrangement made between a vendor
        and a client is solely between those parties.
      </p>

      <h2>2. Lead-Based Model</h2>
      <p>
        The MelaBridge marketplace operates on a <strong>lead-based model</strong>. Hosts and event
        planners may discover your profile, send inquiries, and request quotes. MelaBridge does not
        guarantee that any inquiry will result in a booking, that you will receive a minimum number of
        leads, or that leads will meet any particular quality standard. Lead volume and quality depend on
        many factors outside MelaBridge's control.
      </p>

      <h2>3. No Booking Commissions</h2>
      <p>
        MelaBridge does not currently charge a commission on bookings secured through the platform. Vendors
        retain 100% of any fees they charge clients. This policy may be reviewed in future and any changes
        will be communicated with reasonable advance notice.
      </p>

      <h2>4. No Escrow, Deposits, or Payment Processing</h2>
      <p>
        MelaBridge does not hold, process, or escrow client payments on behalf of vendors. Any deposits,
        milestone payments, or final payments between you and your clients must be arranged directly between
        you and the client using payment methods of your choosing. MelaBridge has no liability for unpaid
        invoices, disputed payments, chargebacks, or payment failures between vendors and clients.
      </p>

      <h2>5. Vendor Profile Accuracy</h2>
      <p>
        You are responsible for ensuring that your vendor profile, portfolio, pricing, availability, and
        service descriptions are accurate, current, and not misleading. MelaBridge reserves the right to
        remove or flag profiles that contain false, misleading, or prohibited content.
      </p>

      <h2>6. Verified Badge</h2>
      <p>
        The Verified badge (available on Professional plans) indicates that a vendor has completed our
        profile verification process. It does not constitute an endorsement of service quality, professional
        licensing, insurance, or business registration. Clients should conduct their own due diligence before
        engaging any vendor.
      </p>

      <h2>7. Professional Licensing and Insurance</h2>
      <p>
        You are solely responsible for maintaining any professional licenses, permits, and insurance required
        by applicable law for your services. MelaBridge does not verify professional credentials and makes no
        representation that any vendor holds required licenses or is adequately insured.
      </p>

      <h2>8. Vendor Conduct</h2>
      <p>
        You agree not to use MelaBridge to solicit clients off-platform to avoid platform fees, send
        unsolicited marketing communications, misrepresent your services, or engage in any fraudulent,
        deceptive, or illegal conduct. Violation of these conduct standards may result in account suspension
        or termination.
      </p>

      <h2>9. No Guarantee of Results</h2>
      <p>
        MelaBridge makes no guarantee of leads, bookings, revenue, business growth, or any other business
        outcome. Subscription fees are for access to platform tools and marketplace visibility, not for
        guaranteed results.
      </p>

      <h2>10. Intellectual Property</h2>
      <p>
        You retain ownership of all photos, descriptions, logos, and other content you upload to your vendor
        profile. By uploading content, you grant MelaBridge a non-exclusive, royalty-free license to display
        that content on the platform for the purpose of operating the marketplace.
      </p>

      <h2>11. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by law, MelaBridge is not liable for any loss of revenue, lost
        bookings, damage to reputation, or other direct, indirect, incidental, or consequential damages
        arising from your use of the platform, including any failure of the marketplace, lead generation
        tools, or AI features to perform as expected.
      </p>

      <h2>12. Changes to These Terms</h2>
      <p>
        We may update these Vendor Terms from time to time. Continued use of MelaBridge as a vendor after
        the effective date of any update constitutes acceptance of the revised terms.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/terms" className="underline">Terms of Service</Link> ·{" "}
        <Link to="/payment-terms" className="underline">Payment Terms</Link> ·{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link>
      </p>
    </MarketingPage>
  ),
});

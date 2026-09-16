import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — MelaBridge" },
      { name: "description", content: "How MelaBridge collects, uses, and protects your data." },
      { property: "og:title", content: "Privacy Policy — MelaBridge" },
      { property: "og:description", content: "Your data is yours. Here's exactly how we handle it." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="Effective date: July 30, 2026 · Last updated: July 30, 2026"
    >
      <p>
        MelaBridge Inc. ("MelaBridge," "we," "us," or "our") is committed to protecting your personal
        information. This Privacy Policy explains what data we collect, how we use it, with whom we share
        it, and the choices and rights you have. By using our Services, you agree to the practices
        described in this policy.
      </p>

      <h2>1. Information We Collect</h2>

      <h3>1.1 Information You Provide</h3>
      <ul>
        <li>
          <strong>Account information:</strong> name, email address, password (hashed), and profile
          details you choose to add.
        </li>
        <li>
          <strong>Event data:</strong> event names, dates, locations, budgets, timelines, runsheets,
          and other planning information you create.
        </li>
        <li>
          <strong>Guest and attendee data:</strong> guest names, email addresses, RSVP status, dietary
          preferences, plus-one information, and other details you enter about guests.
        </li>
        <li>
          <strong>Vendor data:</strong> vendor profile information, portfolio photos, service descriptions,
          inquiry messages, and booking-related communications.
        </li>
        <li>
          <strong>Files and documents:</strong> any files you upload to the platform, including photos,
          contracts, and planning documents.
        </li>
        <li>
          <strong>Payment information:</strong> billing details are collected and processed by Stripe.
          MelaBridge does not store full card numbers or bank account details.
        </li>
        <li>
          <strong>Communications:</strong> messages you send through the platform, support inquiries,
          and feedback you provide.
        </li>
      </ul>

      <h3>1.2 Information Collected Automatically</h3>
      <ul>
        <li>
          <strong>Usage data:</strong> pages visited, features used, session duration, and interaction
          patterns, used to understand and improve the platform.
        </li>
        <li>
          <strong>Device and browser information:</strong> IP address, browser type, operating system,
          and device identifiers.
        </li>
        <li>
          <strong>Cookies and similar technologies:</strong> session cookies required for authentication
          and preferences cookies for settings you choose. See our{" "}
          <Link to="/cookies" className="underline">Cookie Policy</Link> for details.
        </li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <p>We use your information to:</p>
      <ul>
        <li>Provide, operate, and maintain the Services</li>
        <li>Process subscription payments and manage your billing</li>
        <li>Enable event planning, guest management, vendor discovery, and ticketing features</li>
        <li>Power AI-assisted planning tools (MelaAssist) using your event context — never for external model training</li>
        <li>Send transactional communications (booking confirmations, billing receipts, security alerts)</li>
        <li>Send product updates and newsletters where you have opted in</li>
        <li>Detect and prevent fraud, abuse, and security incidents</li>
        <li>Comply with legal obligations</li>
        <li>Improve and personalize the Services based on aggregated usage patterns</li>
      </ul>
      <p>
        <strong>We never sell your personal data.</strong> We do not use your guest data, event details,
        or communications to train external AI models or share them with advertisers.
      </p>

      <h2>3. How We Share Your Information</h2>
      <p>
        We share your information only in the following circumstances:
      </p>
      <ul>
        <li>
          <strong>Subprocessors:</strong> We work with trusted third-party service providers under
          strict data-processing agreements. Key subprocessors include:
          <ul>
            <li>
              <strong>Supabase</strong> — database hosting and authentication
            </li>
            <li>
              <strong>Stripe</strong> — payment processing
            </li>
            <li>
              <strong>Email delivery providers</strong> — transactional email
            </li>
            <li>
              <strong>Vercel / hosting providers</strong> — platform infrastructure
            </li>
          </ul>
        </li>
        <li>
          <strong>Within the platform:</strong> Event data is shared with collaborators you explicitly
          invite. Vendor profiles are displayed to users browsing the marketplace.
        </li>
        <li>
          <strong>Legal requirements:</strong> We may disclose information when required by law, court
          order, or governmental authority, or when necessary to protect the rights, safety, or property
          of MelaBridge, our users, or the public.
        </li>
        <li>
          <strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of
          substantially all assets, your information may be transferred as part of the transaction,
          subject to the same privacy protections.
        </li>
      </ul>

      <h2>4. Data Retention</h2>
      <p>
        We retain your account data for as long as your account is active and for a reasonable period
        afterward to comply with legal obligations, resolve disputes, and enforce our agreements. You may
        request deletion of your account and associated data at any time from Settings. Some data may
        be retained in anonymized or aggregated form for analytical purposes after deletion.
      </p>

      <h2>5. Security</h2>
      <p>
        We implement industry-standard security measures to protect your data, including encryption in
        transit (TLS), encryption at rest, access controls, and regular security audits. Payments are
        processed via PCI-compliant providers. No system is completely secure; we encourage you to use
        a strong, unique password and to notify us immediately of any suspected breach.
      </p>

      <h2>6. Your Rights and Choices</h2>
      <p>Depending on your location, you may have rights including:</p>
      <ul>
        <li>
          <strong>Access and portability:</strong> Request a copy of the personal data we hold about you.
          Most data can be exported directly from Settings.
        </li>
        <li>
          <strong>Correction:</strong> Update or correct inaccurate personal data in your account settings.
        </li>
        <li>
          <strong>Deletion:</strong> Request deletion of your account and personal data from Settings →
          Account → Delete Account. We will honor deletion requests subject to any legal retention
          obligations.
        </li>
        <li>
          <strong>Objection and restriction:</strong> Object to or request restriction of certain
          processing activities by contacting us at{" "}
          <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>.
        </li>
        <li>
          <strong>Opt-out of marketing:</strong> Unsubscribe from marketing emails at any time using the
          unsubscribe link in any email or by updating your notification preferences in Settings.
        </li>
      </ul>
      <p>
        If you are located in the European Economic Area (EEA), United Kingdom, or California, you have
        additional rights under GDPR, UK GDPR, and CCPA respectively. We honour these rights globally
        to the extent practicable.
      </p>

      <h2>7. International Data Transfers</h2>
      <p>
        MelaBridge is operated in the United States. If you are located outside the US, your data may
        be transferred to and processed in the US or other countries where our subprocessors operate.
        We implement appropriate safeguards (such as Standard Contractual Clauses) for international
        transfers where required by law.
      </p>

      <h2>8. Children's Privacy</h2>
      <p>
        MelaBridge is not directed to children under 18. We do not knowingly collect personal data from
        minors. If we become aware that we have collected data from a child under 18 without parental
        consent, we will delete it promptly. Contact us at{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> if you believe a minor's data
        has been collected.
      </p>

      <h2>9. Changes to This Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. Material changes will be communicated via
        email or in-app notice at least 14 days before taking effect. The "Last updated" date at the
        top of this page reflects the most recent revision. Continued use of the Services after the
        effective date constitutes acceptance of the revised policy.
      </p>

      <h2>10. Contact</h2>
      <p>
        For privacy questions, data requests, or to exercise your rights, contact us at:{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/terms" className="underline">Terms of Service</Link> ·{" "}
        <Link to="/cookies" className="underline">Cookie Policy</Link> ·{" "}
        <Link to="/refund" className="underline">Refund Policy</Link>
      </p>
    </MarketingPage>
  ),
});

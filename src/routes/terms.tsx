import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — MelaBridge" },
      { name: "description", content: "The terms that govern your use of MelaBridge." },
      { property: "og:title", content: "Terms of Service — MelaBridge" },
      { property: "og:description", content: "Clear, fair terms for using MelaBridge." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Terms of Service"
      description="Effective date: July 30, 2026 · Last updated: July 30, 2026"
    >
      <p>
        Welcome to MelaBridge. By accessing or using our platform, website, mobile applications, or any
        MelaBridge services (collectively, the "Services"), you agree to be bound by these Terms of Service
        ("Terms"). Please read them carefully. If you do not agree, do not use the Services.
      </p>

      <h2>1. About MelaBridge</h2>
      <p>
        MelaBridge Inc. ("MelaBridge," "we," "us," or "our") provides a technology platform that helps
        individuals, businesses, and professionals plan, manage, and run events. <strong>MelaBridge is a
        technology platform only.</strong> We are not an event organizer, vendor, venue operator, or party
        to any agreement between users of the platform. We do not co-host events, employ vendors, or
        guarantee the services of any third party discovered through our marketplace.
      </p>

      <h2>2. Your Account</h2>
      <p>
        You must create an account to use most MelaBridge features. You are responsible for maintaining
        the confidentiality of your login credentials and for all activities that occur under your account.
        You must provide accurate, current, and complete information when creating your account and keep it
        up to date. You must be at least 18 years old to create an account. Notify us immediately at{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> if you suspect unauthorized access
        to your account.
      </p>

      <h2>3. Acceptable Use</h2>
      <p>You agree not to use MelaBridge to:</p>
      <ul>
        <li>Violate any applicable law, regulation, or third-party right</li>
        <li>Send spam, unsolicited messages, or engage in unauthorized marketing</li>
        <li>Harass, threaten, intimidate, or harm any person</li>
        <li>Upload or transmit viruses, malware, or other malicious code</li>
        <li>Infringe any intellectual property right</li>
        <li>Collect or harvest user data without authorization</li>
        <li>Misrepresent your identity, services, or event details</li>
        <li>Facilitate or engage in fraud, chargebacks, or payment abuse</li>
        <li>Organize or promote events that are illegal, dangerous, or deceptive</li>
        <li>Interfere with or disrupt the integrity or performance of the Services</li>
        <li>Circumvent platform fees, restrictions, or access controls</li>
        <li>Use AI-generated output from MelaBridge to deceive others</li>
      </ul>
      <p>
        We reserve the right to suspend or terminate accounts that violate these standards, at our sole
        discretion and without prior notice where necessary to protect users or the platform.
      </p>

      <h2>4. Subscriptions and Billing</h2>
      <p>
        Paid plans renew automatically at the end of each billing period until cancelled. By subscribing,
        you authorize MelaBridge (via Stripe) to charge your payment method on a recurring basis. You
        may cancel your subscription at any time from your{" "}
        <Link to="/subscription" search={{ audience: undefined }} className="underline">Subscription page</Link>; you will retain access
        through the end of the current paid period. See our{" "}
        <Link to="/cancellation" className="underline">Cancellation Policy</Link> and{" "}
        <Link to="/refund" className="underline">Refund Policy</Link> for full details. All payments are
        processed by Stripe. See our{" "}
        <Link to="/payment-terms" className="underline">Payment Terms</Link> for more information.
      </p>

      <h2>5. User Content and Intellectual Property</h2>
      <p>
        You retain full ownership of all content you upload to MelaBridge — including event details, guest
        lists, files, photos, and messages ("User Content"). By uploading User Content, you grant
        MelaBridge a limited, non-exclusive, worldwide, royalty-free license to store, process, display,
        and transmit your User Content solely for the purpose of operating and improving the Services for
        you. We will not sell your User Content or use it to train external AI models.
      </p>
      <p>
        MelaBridge and its licensors retain all intellectual property rights in the Services, including
        all software, designs, trademarks, and AI models. These Terms do not grant you any right to use
        MelaBridge's intellectual property except as necessary to use the Services for their intended
        purpose.
      </p>

      <h2>6. MelaAssist™ AI</h2>
      <p>
        The Services include AI-assisted planning tools ("MelaAssist"). AI output — including timelines,
        vendor suggestions, communications drafts, budget estimates, and other recommendations — is
        generated automatically and may contain errors, inaccuracies, or omissions.{" "}
        <strong>You are responsible for reviewing and verifying all AI-generated output before
        acting on it.</strong> MelaBridge makes no warranty as to the accuracy, completeness, or fitness
        of any AI output for any particular purpose. AI output does not constitute professional legal,
        financial, medical, or other expert advice.
      </p>

      <h2>7. Third-Party Services</h2>
      <p>
        MelaBridge integrates with third-party services, including Stripe for payments, email delivery
        providers, and mapping services. Your use of these integrations is subject to the third party's
        own terms and privacy policies. MelaBridge is not responsible for the actions, availability, or
        policies of any third-party service.
      </p>

      <h2>8. Organizers and Vendors</h2>
      <p>
        Event organizers and vendors who use MelaBridge operate independently. MelaBridge does not vet,
        endorse, or guarantee the performance of any organizer or vendor. Any disputes between users of
        the platform must be resolved between those parties directly. See our{" "}
        <Link to="/organizer-terms" className="underline">Organizer Terms</Link> and{" "}
        <Link to="/vendor-terms" className="underline">Vendor Terms</Link> for role-specific obligations.
      </p>

      <h2>9. Disclaimer of Warranties</h2>
      <p>
        The Services are provided "as is" and "as available" without warranties of any kind, express or
        implied, including but not limited to warranties of merchantability, fitness for a particular
        purpose, non-infringement, uninterrupted availability, or error-free operation. To the maximum
        extent permitted by applicable law, MelaBridge disclaims all such warranties. We do not warrant
        that the Services will meet your specific requirements or that any AI output will be accurate or
        complete.
      </p>

      <h2>10. Limitation of Liability</h2>
      <p>
        To the maximum extent permitted by applicable law, MelaBridge and its officers, directors,
        employees, and agents shall not be liable for any indirect, incidental, special, consequential,
        exemplary, or punitive damages, including but not limited to loss of profits, loss of data, loss
        of goodwill, business interruption, or cost of substitute services, arising out of or in
        connection with your use of the Services, even if advised of the possibility of such damages.
      </p>
      <p>
        To the maximum extent permitted by applicable law, MelaBridge's total aggregate liability to you
        for any claims arising under or related to these Terms is limited to the greater of: (a) the
        amounts paid by you to MelaBridge in the 12 months immediately preceding the claim, or (b)
        one hundred US dollars ($100).
      </p>

      <h2>11. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless MelaBridge and its officers, directors,
        employees, and agents from and against any and all claims, damages, losses, liabilities, costs,
        and expenses (including reasonable attorneys' fees) arising out of or relating to: (a) your use of
        the Services; (b) your User Content; (c) your violation of these Terms or any applicable law;
        (d) your event or vendor activities; or (e) any dispute between you and another user of the
        platform.
      </p>

      <h2>12. Termination</h2>
      <p>
        We may suspend or terminate your access to the Services at any time for violations of these Terms,
        for conduct that we determine is harmful to other users or to MelaBridge, or for any other reason
        at our discretion. Upon termination, your right to use the Services ceases immediately. Provisions
        that by their nature should survive termination (including Sections 5, 9, 10, 11, 13, 14, and 15)
        will do so. You may delete your account at any time from Settings.
      </p>

      <h2>13. Dispute Resolution</h2>
      <p>
        Before initiating any formal legal action, you agree to contact us at{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> to attempt informal resolution.
        Most concerns can be resolved quickly this way. Where informal resolution fails, any dispute
        arising out of or relating to these Terms or the Services shall be resolved by binding
        arbitration or in the courts of the applicable governing jurisdiction, as set forth below.
      </p>

      <h2>14. Governing Law</h2>
      <p>
        These Terms are governed by and construed in accordance with the laws of the State of Alabama,
        United States, without regard to conflict-of-law principles. To the extent that arbitration does
        not apply, you consent to the exclusive jurisdiction of the state and federal courts located in
        Alabama for any disputes arising under these Terms.
      </p>

      <h2>15. General Provisions</h2>
      <ul>
        <li>
          <strong>Severability:</strong> If any provision of these Terms is found unenforceable, that
          provision will be modified to the minimum extent necessary to make it enforceable, and the
          remaining provisions will continue in full force.
        </li>
        <li>
          <strong>Entire Agreement:</strong> These Terms, together with our Privacy Policy and any
          role-specific terms (Organizer Terms, Vendor Terms, Ticketing Terms, Payment Terms), constitute
          the entire agreement between you and MelaBridge with respect to the Services.
        </li>
        <li>
          <strong>No Waiver:</strong> Our failure to enforce any right or provision of these Terms does
          not constitute a waiver of that right or provision.
        </li>
        <li>
          <strong>Assignment:</strong> You may not assign or transfer these Terms without our prior
          written consent. We may assign our rights and obligations freely.
        </li>
        <li>
          <strong>Electronic Communications:</strong> By using the Services, you consent to receive
          electronic communications from MelaBridge, including billing notices, product updates, and
          policy notifications. These communications satisfy any legal requirement for written notice.
        </li>
        <li>
          <strong>Changes to Terms:</strong> We may update these Terms from time to time. We will notify
          you of material changes via email or in-app notice at least 14 days before the change takes
          effect. Continued use of the Services after the effective date constitutes acceptance.
        </li>
      </ul>

      <h2>16. Contact</h2>
      <p>
        Questions about these Terms? Email{" "}
        <a href="mailto:hello@melabridge.com">hello@melabridge.com</a>.
      </p>

      <p className="mt-8 text-sm text-muted-foreground">
        Related policies:{" "}
        <Link to="/privacy" className="underline">Privacy Policy</Link> ·{" "}
        <Link to="/refund" className="underline">Refund Policy</Link> ·{" "}
        <Link to="/cancellation" className="underline">Cancellation Policy</Link> ·{" "}
        <Link to="/organizer-terms" className="underline">Organizer Terms</Link> ·{" "}
        <Link to="/vendor-terms" className="underline">Vendor Terms</Link> ·{" "}
        <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> ·{" "}
        <Link to="/payment-terms" className="underline">Payment Terms</Link>
      </p>
    </MarketingPage>
  ),
});

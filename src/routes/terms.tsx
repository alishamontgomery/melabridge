import { createFileRoute } from "@tanstack/react-router";
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
      description="Last updated January 2026. By using MelaBridge, you agree to these terms."
    >
      <h2>1. Your account</h2>
      <p>You are responsible for maintaining the confidentiality of your account and for all activities under it.</p>
      <h2>2. Acceptable use</h2>
      <p>Don't use MelaBridge to send spam, harass others, infringe copyrights, or violate any law.</p>
      <h2>3. Subscriptions & billing</h2>
      <p>Paid plans renew automatically until cancelled. You may cancel anytime from Settings; you'll retain access through the end of your billing period.</p>
      <h2>4. Content ownership</h2>
      <p>You retain full ownership of the event data, guest lists, and files you upload. You grant MelaBridge a limited license to store and display it for you.</p>
      <h2>5. Termination</h2>
      <p>We may suspend accounts that violate these terms. You may delete your account at any time.</p>
      <h2>6. Disclaimers</h2>
      <p>MelaBridge is provided "as is" without warranties. To the maximum extent permitted by law, our liability is limited to the fees paid in the prior 12 months.</p>
      <h2>7. Contact</h2>
      <p>Questions about these terms? Email <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> or call <a href="tel:+12567848427">+1 (256) 784-8427</a>.</p>
    </MarketingPage>
  ),
});

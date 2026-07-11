import { createFileRoute } from "@tanstack/react-router";
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
      description="Last updated January 2026. This policy explains what we collect, why, and the controls you have."
    >
      <h2>1. Information we collect</h2>
      <p>Account details (name, email), event details you create, guest and vendor data you input, and usage analytics required to operate the service.</p>
      <h2>2. How we use it</h2>
      <p>To provide MelaBridge features, improve the product, and communicate with you. We never sell your data or use guest data to train external models.</p>
      <h2>3. Sharing</h2>
      <p>We share data only with trusted subprocessors (hosting, email delivery, payments) under strict data-processing agreements.</p>
      <h2>4. Your rights</h2>
      <p>Access, export, correct, or delete your data at any time from Settings. GDPR and CCPA rights are honored globally.</p>
      <h2>5. Security</h2>
      <p>All data is encrypted in transit and at rest. Payments are processed via PCI-compliant providers.</p>
      <h2>6. Contact</h2>
      <p>Questions? Email privacy@melabridge.com.</p>
    </MarketingPage>
  ),
});

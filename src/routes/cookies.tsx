import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie Policy — MelaBridge" },
      { name: "description", content: "How MelaBridge uses cookies and similar technologies." },
      { property: "og:title", content: "Cookie Policy — MelaBridge" },
      { property: "og:description", content: "What cookies we set and how to control them." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Legal"
      title="Cookie Policy"
      description="Last updated January 2026. We use cookies to keep you signed in, remember preferences, and understand how MelaBridge is used."
    >
      <h2>Essential cookies</h2>
      <p>Required for authentication, security, and core functionality. These cannot be disabled.</p>
      <h2>Preference cookies</h2>
      <p>Remember your theme, language, and layout choices.</p>
      <h2>Analytics cookies</h2>
      <p>Help us understand aggregate usage so we can improve the product. Anonymized and opt-out at any time from Settings.</p>
      <h2>Managing cookies</h2>
      <p>Most browsers allow you to block or delete cookies. Disabling essential cookies will prevent MelaBridge from functioning correctly.</p>
      <h2>Contact</h2>
      <p>Questions? Email <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> or call <a href="tel:+12567848427">+1 (256) 784-8427</a>.</p>
    </MarketingPage>
  ),
});

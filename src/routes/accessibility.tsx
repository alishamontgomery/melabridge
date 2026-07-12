import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/accessibility")({
  head: () => ({
    meta: [
      { title: "Accessibility Statement — MelaBridge" },
      { name: "description", content: "Our commitment to building MelaBridge for everyone." },
      { property: "og:title", content: "Accessibility — MelaBridge" },
      { property: "og:description", content: "WCAG 2.1 AA and continuously improving." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Accessibility"
      title="Accessibility Statement"
      description="MelaBridge is designed to be usable by everyone, regardless of ability or assistive technology."
    >
      <h2>Our commitment</h2>
      <p>We target WCAG 2.1 Level AA compliance across the MelaBridge web app and marketing site, and we continuously test with real users and assistive technologies.</p>
      <h2>What we do</h2>
      <ul>
        <li>Semantic HTML, ARIA labels, and keyboard-navigable interfaces</li>
        <li>Visible focus states and adequate color contrast</li>
        <li>Screen-reader-friendly patterns for complex UI (calendars, seating charts, timelines)</li>
        <li>Reduced-motion support for animations</li>
      </ul>
      <h2>Feedback</h2>
      <p>If you encounter an accessibility barrier, please email <a href="mailto:hello@melabridge.com">hello@melabridge.com</a> or call <a href="tel:+12567848427">+1 (256) 784-8427</a> and we'll respond within two business days.</p>
    </MarketingPage>
  ),
});

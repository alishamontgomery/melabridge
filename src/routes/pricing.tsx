import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MelaBridge" },
      { name: "description", content: "Simple, transparent plans for every celebration. Start free and upgrade as your guest list grows." },
      { property: "og:title", content: "Pricing — MelaBridge" },
      { property: "og:description", content: "Free, Pro, and Business plans for planners, families, and teams." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Pricing"
      title={<>Simple plans for <span className="text-gradient">every celebration.</span></>}
      description="Start free. Upgrade when the guest list grows. Cancel anytime — no calls, no forms."
    >
      <h2>Free — $0</h2>
      <p>For a single moment. 1 active event, up to 25 guests, AI planning assistant, basic invitations.</p>
      <h2>Pro — $18/month</h2>
      <p>For life's memorable moments. Unlimited events, up to 500 guests, full AI concierge, vendor inbox, budgets, ticket sales, and fundraising.</p>
      <h2>Business — $79/month</h2>
      <p>For planners and teams. Everything in Pro plus team collaboration, client portals, white-label invitations, and priority support.</p>
      <h2>Enterprise</h2>
      <p>Custom pricing for large organizations. <a href="/contact">Talk to sales</a>.</p>
    </MarketingPage>
  ),
});

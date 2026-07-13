import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — MelaBridge" },
      { name: "description", content: "Explore every AI-powered feature MelaBridge offers for planning weddings, birthdays, corporate events, and every milestone." },
      { property: "og:title", content: "Features — MelaBridge" },
      { property: "og:description", content: "AI planning, guests, vendors, budgets, timelines, tickets, and more — all in one platform." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Features"
      title={<>Every planning tool, <span className="text-gradient">quietly intelligent.</span></>}
      description="MelaBridge brings AI planning, guest management, vendor discovery, budgeting, tickets, fundraising, and messaging into one calm workspace."
    >
      <h2>AI Planning</h2>
      <p>Describe your event in a sentence — MelaBridge drafts a timeline, guest list strategy, vendor shortlist, and budget. You review and approve before anything is created.</p>
      <h2>Guests</h2>
      <p>Smart RSVPs, dietary preferences, and seating suggestions. <em>QR check-in coming soon.</em></p>
      <h2>Vendors</h2>
      <p>Discover, compare, and book vendors from a concierge inbox with quote and contract tracking.</p>
      <h2>Budgets &amp; Payments</h2>
      <p>Live budget tracking, category forecasting, and secure payments powered by Stripe so every dollar is accounted for.</p>
      <h2>Timelines &amp; Tasks</h2>
      <p>Multi-view planning (Kanban, Gantt, Calendar) tied to your Event Health Score™.</p>
      <h2>Tickets &amp; Fundraising</h2>
      <p>Sell tickets with tiered pricing and run donation campaigns. <em>Silent auctions coming soon.</em></p>
    </MarketingPage>
  ),
});

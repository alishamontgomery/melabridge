import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — MelaBridge" },
      { name: "description", content: "Explore every AI-powered feature MelaBridge offers for planning weddings, birthdays, conferences, and every milestone." },
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
      <p>Describe your event in a sentence — MelaBridge drafts a timeline, guest list strategy, vendor shortlist, and budget in seconds.</p>
      <h2>Guests</h2>
      <p>Smart RSVPs, dietary preferences, seating suggestions with AI conflict detection, and QR check-in.</p>
      <h2>Vendors</h2>
      <p>Discover, compare, and book florists, venues, and caterers from a concierge inbox with contract management.</p>
      <h2>Budgets & BridgePay™</h2>
      <p>Live budget tracking, category forecasting, and secure escrow payments so every dollar is accounted for.</p>
      <h2>Timelines & Tasks</h2>
      <p>Multi-view planning (Kanban, Gantt, Calendar) tied to your Event Health Score™.</p>
      <h2>Tickets & Fundraising</h2>
      <p>Sell tickets with tiered pricing, run donation campaigns, and manage silent auctions natively.</p>
    </MarketingPage>
  ),
});

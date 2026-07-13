import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — MelaBridge" },
      { name: "description", content: "AI planning, guests, vendors, budgets, timelines, tickets, fundraising, and messaging — every event tool in one calm workspace." },
      { property: "og:title", content: "Features — MelaBridge" },
      { property: "og:description", content: "Every planning tool, quietly intelligent." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Features"
      title={<>Every planning tool, <span className="text-gradient">quietly intelligent.</span></>}
      description="MelaBridge brings AI planning, guest management, vendor discovery, budgeting, tickets, fundraising, and messaging into one calm workspace — so you can spend time on the moments, not the spreadsheets."
    >
      <h2>AI Planning</h2>
      <p>Describe your event in a sentence — MelaBridge drafts a timeline, guest list strategy, vendor shortlist, and budget. You review and approve before anything is created. MelaAssist stays with you as your event evolves, catching risks early and suggesting the next best step.</p>

      <h2>Guests &amp; RSVPs</h2>
      <p>Unlimited guests. Smart RSVPs with dietary preferences, plus-ones, and seating suggestions. Send beautiful invitations, track responses in real time, and export to CSV anytime. <em>QR check-in and seating charts coming soon.</em></p>

      <h2>Vendor Marketplace</h2>
      <p>Discover, compare, and book vendors from a concierge inbox. Save favorites, request quotes, compare proposals side-by-side, and track quote and contract status in one place. Add off-platform vendors manually to keep every booking together.</p>

      <h2>Budgets &amp; Payments</h2>
      <p>Live budget tracking with category forecasting and drift alerts so overspend never surprises you. Secure milestone payments and vendor payouts powered by Stripe — deposits, balances, and receipts reconciled automatically with your budget.</p>

      <h2>Timelines &amp; Tasks</h2>
      <p>Multi-view planning across Kanban, list, and calendar. Auto-generated timelines you can edit, with prompts as key milestones approach. Every task is tied to your Event Health Score™ so you always know what's on track and what needs attention.</p>

      <h2>Tickets &amp; Fundraising</h2>
      <p>Sell tickets with tiered pricing for community and corporate events. Run donation campaigns for weddings, celebrations, and causes with 0% platform fee. <em>Silent auctions coming soon.</em></p>

      <h2>Messaging &amp; Collaboration</h2>
      <p>One inbox for guests, vendors, family, and team. Threaded conversations, message templates, and AI-drafted replies — with your approval before anything sends. Co-plan with granular permissions so the right people see the right things.</p>

      <h2>Files &amp; Contracts</h2>
      <p>Every contract, invoice, receipt, and photo lives in BridgeVault™ — searchable, versioned, and shared with the right people. Never dig through email chains again.</p>

      <h2>Who it's for</h2>
      <ul>
        <li><strong>Hosts &amp; families</strong> — plan your own wedding, birthday, anniversary, or reunion, free forever.</li>
        <li><strong>Professional planners</strong> — run every client and every event from one cockpit.</li>
        <li><strong>Vendors</strong> — get discovered, win more bookings, and manage your calendar in one place.</li>
        <li><strong>Community organizers &amp; nonprofits</strong> — sell tickets, raise funds, and coordinate volunteers.</li>
      </ul>
    </MarketingPage>
  ),
});

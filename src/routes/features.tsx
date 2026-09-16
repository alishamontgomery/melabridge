import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — MelaBridge" },
      { name: "description", content: "AI-assisted planning, guest lists, vendor discovery, budgets, timelines, tickets, files, and event pages in one workspace." },
      { property: "og:title", content: "Features — MelaBridge" },
      { property: "og:description", content: "Every planning tool, quietly intelligent." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Features"
      title={<>Every planning tool, <span className="text-gradient">quietly intelligent.</span></>}
      description="MelaBridge brings AI-assisted planning, guest lists, vendor discovery, budgeting, tickets, files, and event pages into one calm workspace."
    >
      <h2>AI Planning</h2>
      <p>Describe your event and MelaBridge can draft editable tasks, budget categories, a day-of runsheet, vendor needs, and event details. You review and edit the results before using them.</p>

      <h2>Guests &amp; RSVPs</h2>
      <p>Organize guest names, RSVP status, plus-ones, meal choices, and notes. Export guest records to CSV. Guests can confirm Yes or No through secure invitation links; guest self-service details, dietary forms, and seating charts are not available.</p>

      <h2>Vendor Marketplace</h2>
      <p>Discover and evaluate vendors from a beautiful marketplace. Search by category, location, and budget. View full profiles, portfolios, and packages. Save favorites to your account. Contact vendors directly by phone, email, or website — their information is right on their profile. Add any vendor manually to track files and notes in one place.</p>

      <h2>Budgets &amp; Payments</h2>
      <p>Track a budget target, categories, planned costs, paid amounts, and the amount remaining. MelaBridge warns you when planned expenses exceed the target. MelaBridge does not process vendor deposits or milestone payments.</p>

      <h2>Timelines &amp; Tasks</h2>
      <p>Multi-view planning across Kanban, list, and calendar. Create editable timelines and review planning readiness as key milestones approach.</p>

      <h2>Tickets &amp; Check-in</h2>
      <p>Eligible paid plans can create free or paid ticket types, set quantities and sale windows, track orders, and use QR check-in.</p>

      <h2>Guest Lists &amp; Team Access</h2>
      <p>Keep guest names, RSVP status, plus-ones, meal choices, and notes organized in one place. Invite collaborators with event-member permissions and share files with your planning team.</p>

      <h2>Files &amp; Contracts</h2>
      <p>The File Center lets you upload, rename, download, and remove documents and images. <em>Event-linked folders, version history, and the expanded BridgeVault™ archive are coming soon.</em></p>

      <h2>Who it's for</h2>
      <ul>
        <li><strong>Hosts &amp; families</strong> — plan your own wedding, birthday, anniversary, or reunion, free forever.</li>
        <li><strong>Professional planners</strong> — run every client and every event from one cockpit.</li>
        <li><strong>Vendors</strong> — get discovered, showcase portfolios and packages, and keep your public profile current.</li>
        <li><strong>Community organizers &amp; nonprofits</strong> — sign up as a Host to sell tickets, manage guests, and coordinate event details.</li>
      </ul>
    </MarketingPage>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/ai-planning")({
  head: () => ({
    meta: [
      { title: "AI Planning — MelaBridge" },
      { name: "description", content: "Meet MelaAssist™ — the AI planning assistant that drafts, reviews, and runs every event alongside you." },
      { property: "og:title", content: "AI Planning — MelaBridge" },
      { property: "og:description", content: "An AI planning assistant that always asks before it acts." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="AI Planning"
      title={<>MelaAssist™ — your planning <span className="text-gradient">co-pilot.</span></>}
      description="MelaAssist guides you through a natural conversation, drafts a full plan, and hands you the wheel. You review and approve — nothing is created without you."
    >
      <h2>Planning Assistant</h2>
      <p>Describe your event and MelaAssist drafts a complete workspace — timeline, guest strategy, vendor shortlist, and budget — for your review. Change your mind halfway through? Just say so, and the plan updates.</p>

      <h2>Smart Recommendations</h2>
      <p>Contextual nudges as your event evolves. RSVP follow-ups when replies stall. Budget rebalancing when a vendor comes in high. Vendor suggestions when a category is still empty two months out.</p>

      <h2>Timeline Intelligence</h2>
      <p>Auto-generated timelines you can edit, with prompts as key milestones approach. MelaAssist knows how long a mandap takes to set up, when caterers need final counts, and when to send the seating chart.</p>

      <h2>Budget Intelligence</h2>
      <p>Category forecasting, drift alerts, and re-allocation suggestions so you catch overspend early — not on event week.</p>

      <h2>Risk Detection</h2>
      <p>MelaAssist continuously reviews your event and flags issues before they become emergencies: missing vendor, unpaid deposit, RSVP shortfall, timeline conflict.</p>

      <h2>Vendor Assistance</h2>
      <p>Help drafting vendor inquiries, comparing quotes side-by-side, and evaluating contracts. MelaAssist writes the first draft; you send the final word.</p>

      <h2>Decision Support</h2>
      <p>When you're stuck, MelaAssist lays out the trade-offs — venue A versus venue B, buffet versus plated, live band versus DJ — never the decision itself.</p>

      <h2>How AI approvals work</h2>
      <p>Every AI-drafted event, task, vendor invitation, message, or booking lives in a review queue. Approve, edit, or discard with one click. Nothing ships until you say yes.</p>

      <h2>Privacy &amp; data</h2>
      <p>Your event details, guest data, budgets, and messages are never sold and never used to train external models. Delete everything with one click, anytime.</p>
    </MarketingPage>
  ),
});

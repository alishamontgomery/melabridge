import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/ai-planning")({
  head: () => ({
    meta: [
      { title: "AI Planning — MelaBridge" },
      { name: "description", content: "Meet MelaAssist™ — the AI planning assistant that helps you draft, review, and run every event." },
      { property: "og:title", content: "AI Planning — MelaBridge" },
      { property: "og:description", content: "An AI planning assistant that always asks before it acts." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="AI Planning"
      title={<>MelaAssist™ — your planning <span className="text-gradient">co-pilot.</span></>}
      description="MelaAssist guides you through a natural conversation, drafts a plan, and hands you the wheel. You review and approve — nothing is created without you."
    >
      <h2>Planning Assistant</h2>
      <p>Describe your event and MelaAssist drafts a workspace — timeline, guest strategy, vendor shortlist, and budget — for your review.</p>
      <h2>Smart Recommendations</h2>
      <p>Contextual nudges as your event evolves — from RSVP follow-ups to budget rebalancing suggestions.</p>
      <h2>Timeline Intelligence</h2>
      <p>Auto-generated timelines you can edit, with prompts when key milestones are approaching.</p>
      <h2>Budget Intelligence</h2>
      <p>Category forecasting and drift alerts so you catch overspend early.</p>
      <h2>Risk Detection</h2>
      <p>MelaAssist continuously reviews your event and recommends improvements before small issues become bigger problems.</p>
      <h2>Vendor Assistance</h2>
      <p>Help drafting inquiries, comparing quotes, and evaluating contracts.</p>
      <h2>Decision Support</h2>
      <p>When you're stuck, MelaAssist lays out the trade-offs — never the decision.</p>
    </MarketingPage>
  ),
});

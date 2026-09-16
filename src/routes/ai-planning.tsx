import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/ai-planning")({
  head: () => ({
    meta: [
      { title: "AI Planning — MelaBridge" },
      { name: "description", content: "Meet MelaAssist™ — AI-assisted drafts for event tasks, budgets, runsheets, vendor needs, and event details." },
      { property: "og:title", content: "AI Planning — MelaBridge" },
      { property: "og:description", content: "An AI planning assistant that always asks before it acts." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="AI Planning"
      title={<>MelaAssist™ — your planning <span className="text-gradient">co-pilot.</span></>}
      description="MelaAssist turns the event details you provide into practical starting drafts. You review, edit, and decide what to use."
    >
      <h2>Planning Assistant</h2>
      <p>Describe your event and MelaAssist can prepare editable starter tasks, budget categories, a day-of runsheet, vendor needs, and event details.</p>

      <h2>Editable starting point</h2>
      <p>AI output is a draft, not an automatic decision. Review each suggestion, change the details, and keep only what fits your event.</p>

      <h2>Tasks &amp; runsheets</h2>
      <p>Generate a starter checklist and day-of schedule from your event type, date, and timing, then adjust every item in the workspace.</p>

      <h2>Budget starting point</h2>
      <p>Create suggested budget categories and line items, then enter your own planned and paid amounts as decisions are made.</p>

      <h2>Vendor needs</h2>
      <p>Turn your event description into a list of vendor categories to consider, then browse marketplace profiles and packages yourself.</p>

      <h2>Guest-message drafts</h2>
      <p>Draft an event update or reminder, review the wording and recipients, and send only when it is ready.</p>

      <h2>Current scope</h2>
      <p>MelaAssist does not book vendors, move money, evaluate contracts, or continuously monitor your event. Those decisions and actions stay with you.</p>

      <h2>Privacy &amp; data</h2>
      <p>Use MelaAssist for planning details you are comfortable including in an AI request. Review generated content before adding it to your event or sending it to guests.</p>
    </MarketingPage>
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — MelaBridge" },
      { name: "description", content: "From idea to unforgettable in three steps — see how MelaBridge plans any event with AI." },
      { property: "og:title", content: "How MelaBridge Works" },
      { property: "og:description", content: "Share the idea. Let AI build the plan. Bring everyone together." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="How it works"
      title={<>From idea to unforgettable, in <span className="text-gradient">three steps.</span></>}
      description="MelaBridge is the bridge between a spark of inspiration and a moment people will talk about for years."
    >
      <h2>01 — Share the idea</h2>
      <p>Tell MelaBridge what you're planning. A backyard birthday or a 500-guest gala — start with a sentence.</p>
      <h2>02 — Let AI build the plan</h2>
      <p>Timelines, budgets, vendor shortlists, guest lists, and messaging drafts appear in seconds, tailored to your event type, budget, and location.</p>
      <h2>03 — Bring everyone together</h2>
      <p>Invite co-planners, sell tickets, collect RSVPs, raise funds, and run the day from one unified dashboard.</p>
      <h2>What happens next</h2>
      <p>Your Event Health Score™ updates in real time as tasks complete, budgets shift, and RSVPs come in — so nothing slips through the cracks.</p>
    </MarketingPage>
  ),
});

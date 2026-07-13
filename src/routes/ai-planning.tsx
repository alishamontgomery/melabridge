import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/ai-planning")({
  head: () => ({
    meta: [
      { title: "AI Planning — MelaBridge" },
      { name: "description", content: "Meet MelaAssist™, MelaAssist™, and the AI systems that plan your event in minutes." },
      { property: "og:title", content: "AI Planning — MelaBridge" },
      { property: "og:description", content: "An elite AI event planner, project manager, and personal assistant in one." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="AI Planning"
      title={<>A world-class planner, <span className="text-gradient">summoned in seconds.</span></>}
      description="MelaAssist™ guides you through a natural conversation, then autonomously builds your timeline, budget, guest strategy, and vendor shortlist."
    >
      <h2>MelaAssist™</h2>
      <p>Your flagship AI planning experience. Answer a few questions and receive a complete, editable event workspace in minutes.</p>
      <h2>MelaAssist™</h2>
      <p>The reasoning engine that continuously monitors your event and suggests optimizations across budget, tasks, and logistics.</p>
      <h2>AI Event Simulator™</h2>
      <p>Stress-test your plan against 10,000+ scenarios to surface risks before they surface at your event.</p>
      <h2>Event Health Score™</h2>
      <p>A single number that reflects your event's readiness, updated live as tasks close and decisions are made.</p>
    </MarketingPage>
  ),
});

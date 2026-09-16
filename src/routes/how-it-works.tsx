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
      <p>Tell MelaBridge what you're planning. A backyard birthday or a 500-guest gala — start with a sentence. Add the date, budget, and location if you know them. Skip anything you don't.</p>

      <h2>02 — Let AI draft the plan</h2>
      <p>MelaAssist drafts editable tasks, budget categories, a day-of runsheet, vendor needs, and event details from the information you provide. Review and change the plan before putting it to work.</p>

      <h2>03 — Bring everyone together</h2>
      <p>Invite collaborators, manage guests, share an event page, and sell tickets from one workspace. Discover vendors, view profiles and packages, save favorites, and send inquiries.</p>

      <h2>04 — Run the day</h2>
      <p>On event day, use the mobile-friendly runsheet and ticket check-in tools to keep the schedule and arrivals organized.</p>

      <h2>05 — Remember it forever</h2>
      <p>Keep useful documents and images in the File Center. <em>The expanded BridgeVault™ event archive is coming soon.</em></p>

      <h2>What makes it different</h2>
      <ul>
        <li><strong>AI that asks first.</strong> MelaAssist drafts everything, decides nothing. You always approve before anything is created or sent.</li>
        <li><strong>A free starting point for hosts.</strong> Plan an event, manage guests, track a budget, and discover vendors before upgrading for premium tools.</li>
        <li><strong>One workspace.</strong> Guest lists, vendors, budget, timeline, tickets, and files — all in one place.</li>
      </ul>
    </MarketingPage>
  ),
});

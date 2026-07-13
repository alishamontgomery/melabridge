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
      <p>Timelines, budgets, vendor shortlists, guest strategy, and messaging drafts appear in seconds — tailored to your event type, budget, and location. Every draft waits for your review. Approve, edit, or discard; nothing is created without you.</p>

      <h2>03 — Bring everyone together</h2>
      <p>Invite co-planners with granular permissions. Send invitations, collect RSVPs, message vendors, sell tickets, and raise funds — all from one unified workspace.</p>

      <h2>04 — Run the day</h2>
      <p>Your Event Health Score™ updates in real time as tasks complete, budgets shift, and RSVPs come in. On event day, run the timeline from your phone with a live view for you, your team, and your vendors.</p>

      <h2>05 — Remember it forever</h2>
      <p>After the event, every photo, receipt, contract, and message lives in BridgeVault™ — searchable years from now, ready to inspire the next celebration.</p>

      <h2>What makes it different</h2>
      <ul>
        <li><strong>AI that asks first.</strong> MelaAssist drafts everything, decides nothing. You always approve before anything is created or sent.</li>
        <li><strong>Free forever for hosts.</strong> Unlimited events. No fees on RSVPs, invitations, or donations.</li>
        <li><strong>One workspace.</strong> Guests, vendors, budget, timeline, messaging, tickets, and files — all in one place.</li>
      </ul>
    </MarketingPage>
  ),
});

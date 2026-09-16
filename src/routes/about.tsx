import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — MelaBridge" },
      { name: "description", content: "MelaBridge is the intelligent platform for planning every event — with more presence, meaning, and joy." },
      { property: "og:title", content: "About MelaBridge" },
      { property: "og:description", content: "The intelligent platform for planning every event." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="About us"
      title={<>The intelligent platform for <span className="text-gradient">planning every event.</span></>}
      description="MelaBridge exists because life's most important moments deserve more than scattered spreadsheets and disconnected tools."
    >
      <h2>Our story</h2>
      <p>We started MelaBridge after planning one too many weddings, birthdays, and community celebrations across a dozen disconnected tools — checklists in one app, budgets in another, guest lists in a spreadsheet, and vendor conversations buried in email. There had to be a calmer way.</p>
      <p>So we built the workspace we wished existed: one place for the whole event, with an AI planner that drafts the hard parts and hands you the wheel.</p>

      <h2>What we believe</h2>
      <ul>
        <li><strong>Great events are acts of love.</strong> Software should get out of the way so the people planning them can be present for the moments that matter.</li>
        <li><strong>AI should ask, not act.</strong> Every draft, every message, and every vendor suggestion waits for your approval. You always hold the pen.</li>
        <li><strong>Hosting your own event should be free.</strong> Families shouldn't pay per RSVP or lose a cut of donations. We charge businesses running a business, not families running a celebration.</li>
        <li><strong>Privacy is table stakes.</strong> Your guest data is yours. It is never sold, never used to train external models, and always exportable.</li>
      </ul>

      <h2>Who MelaBridge is for</h2>
      <p>Hosts and families planning weddings, birthdays, anniversaries, and reunions. Professional planners running many events for many clients. Event-service providers who want to be discovered and connect with more planners and hosts. Community groups and nonprofits can use a Host profile for fundraisers, galas, and gatherings.</p>

      <h2>Where we're going</h2>
      <p>A lifelong companion — from a first birthday to a wedding, from a milestone anniversary to a community gala. One workspace that grows with you, remembers what mattered, and helps you plan the next moment a little more calmly than the last.</p>

      <h2>Early access</h2>
      <p>We're now welcoming planners and vendors into the first wave. Join us and help shape what the future of event planning looks like.</p>
    </MarketingPage>
  ),
});

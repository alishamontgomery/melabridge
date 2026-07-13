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
      description="MelaBridge exists because life's most important moments deserve more than spreadsheets and group chats."
    >
      <h2>Our story</h2>
      <p>We started MelaBridge after planning one too many weddings, birthdays, and community celebrations across a dozen disconnected tools. There had to be a calmer way.</p>
      <h2>What we believe</h2>
      <p>Great events are acts of love. Software should get out of the way so the people planning them can be present for the moments that matter.</p>
      <h2>Where we're going</h2>
      <p>A lifelong companion — from your first birthday to your child's graduation, from every milestone to every celebration.</p>
      <h2>Early access</h2>
      <p>We're now welcoming planners and vendors into the first wave. Join us and help shape the future of event planning.</p>
    </MarketingPage>
  ),
});

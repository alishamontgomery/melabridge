import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — MelaBridge" },
      { name: "description", content: "MelaBridge is on a mission to help people gather with more presence, meaning, and joy." },
      { property: "og:title", content: "About MelaBridge" },
      { property: "og:description", content: "Where every event comes together." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="About us"
      title={<>Building the future of <span className="text-gradient">gathering.</span></>}
      description="MelaBridge exists because life's most important moments deserve more than spreadsheets and group chats."
    >
      <h2>Our story</h2>
      <p>We started MelaBridge after planning one too many weddings, funerals, and birthdays across a dozen disconnected tools. There had to be a calmer way.</p>
      <h2>What we believe</h2>
      <p>Great events are acts of love. Software should get out of the way so the people planning them can be present for the moments that matter.</p>
      <h2>Where we're going</h2>
      <p>A lifelong companion — from your first birthday to your child's graduation, from every milestone to every remembrance.</p>
    </MarketingPage>
  ),
});

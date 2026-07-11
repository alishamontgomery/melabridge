import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";

export const Route = createFileRoute("/vision")({
  head: () => ({
    meta: [
      { title: "Our Vision — MelaBridge" },
      { name: "description", content: "MelaBridge is building a lifelong companion for every gathering — powered by AI, guided by care." },
      { property: "og:title", content: "Our Vision — MelaBridge" },
      { property: "og:description", content: "Where every event comes together — for a lifetime." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="Our vision"
      title={<>A lifelong companion for <span className="text-gradient">every gathering.</span></>}
      description="From a first birthday to a golden anniversary, MelaBridge is designed to grow with you across every meaningful moment."
    >
      <h2>Beyond a planner</h2>
      <p>MelaBridge is evolving into a personal life-events operating system. Your BridgeWorld™ timeline, BridgeVault™ memories, and BridgeDNA™ preferences follow you across every event you host and every event you attend.</p>
      <h2>Rooted in privacy</h2>
      <p>Guest data is encrypted, never sold, and never used to train external models. What you gather is yours.</p>
      <h2>Powered by community</h2>
      <p>Bridge Intelligence™ surfaces anonymized benchmarks — planning timelines, budgeting ranges, RSVP trends — so every host benefits from the collective wisdom of the platform.</p>
      <h2>The next decade</h2>
      <p>We're building the connective tissue between the people, places, and moments that shape a life.</p>
    </MarketingPage>
  ),
});

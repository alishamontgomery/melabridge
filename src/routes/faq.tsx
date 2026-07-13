import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SECTIONS: { title: string; faqs: { q: string; a: string }[] }[] = [
  {
    title: "Getting started",
    faqs: [
      { q: "What kinds of events can I plan on MelaBridge?", a: "Weddings, engagements, birthdays, anniversaries, corporate events, community events, school events, reunions, fundraisers, cultural celebrations, and private gatherings. MelaBridge adapts its playbook to the occasion — you don't fill in a generic form." },
      { q: "Do I need to sign up to try it?", a: "Yes — sign-up is free and takes under a minute. Once you're in you can create your first event, invite family, and try the AI planner without entering a credit card." },
      { q: "Can I plan multiple events at the same time?", a: "Yes. Hosts and families can plan unlimited personal events on the free plan. Professional planners get a client dashboard for running many events side-by-side." },
      { q: "Is MelaBridge only for weddings?", a: "No. We started with weddings because they're the hardest to plan — if the tool works there, it works for everything else. Today MelaBridge is used for birthdays, corporate events, fundraisers, school events, and more." },
    ],
  },
  {
    title: "Pricing & plans",
    faqs: [
      { q: "Is personal event planning really free?", a: "Yes. Unlimited events, unlimited guests, budget, checklist, timeline, MelaAssist AI planning, and marketplace access are free for hosts and families — forever." },
      { q: "What do the paid plans include?", a: "Paid plans are for running a business on MelaBridge. Vendor Professional ($29/mo) and Premium ($59/mo) unlock full profiles, unlimited portfolios, AI messaging, quotes, contracts, calendar sync, and analytics. Professional Planner ($39/mo) unlocks client portals, team collaboration, and premium automation." },
      { q: "Do you take a cut of donations, tickets, or RSVPs?", a: "No. 0% on donations. 0% on fundraising. No fees on RSVPs, invitations, or guest management. Standard Stripe processor fees apply when money moves." },
      { q: "Can I cancel anytime?", a: "Yes. Every paid plan can be cancelled with one click from the billing portal — no calls, no forms, no retention emails." },
      { q: "Do you offer a free trial on paid plans?", a: "Yes — 14 days free on all paid plans. No credit card required to start." },
    ],
  },
  {
    title: "AI & MelaAssist™",
    faqs: [
      { q: "What does the AI actually do?", a: "MelaAssist drafts timelines, suggests vendors, writes guest communications, tracks budget drift, and answers planning questions grounded in your event's real details. Think of it as an experienced planner sitting next to you." },
      { q: "Will the AI do things without asking me?", a: "No. Every AI-generated event, task, message, or booking requires your review and approval before it's created. You always hold the pen." },
      { q: "Is my event data used to train AI models?", a: "No. Your guest lists, budgets, messages, and event details are never used to train external models or shared with third parties." },
    ],
  },
  {
    title: "Collaboration & privacy",
    faqs: [
      { q: "Can I invite family or a team to help plan?", a: "Yes. Invite co-planners with granular permissions — view, comment, edit, or admin. Everyone stays on the same timeline and can see updates in real time." },
      { q: "Is my guest data private?", a: "Always. Guest data is encrypted at rest and in transit, never sold, and never used to train external models. You control exports and can delete everything with one click." },
      { q: "Can I export my data?", a: "Yes. Guests, budget, timeline, and files can all be exported to CSV or downloaded at any time." },
    ],
  },
  {
    title: "Payments & vendors",
    faqs: [
      { q: "How do payments work?", a: "Payments are processed securely via Stripe. Deposits, milestone payments, and vendor payouts are tracked against your booking and reconciled with your budget automatically." },
      { q: "How do I find and book vendors?", a: "Browse the marketplace by category, location, and budget. Save favorites, request quotes, compare proposals side-by-side, and sign contracts — all inside MelaBridge." },
      { q: "What if my vendor isn't on MelaBridge yet?", a: "You can add any vendor manually to track quotes, contracts, and payments in one place. And we'll happily invite them to claim their profile." },
    ],
  },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — MelaBridge" },
      { name: "description", content: "Answers to the most common questions about MelaBridge — planning, pricing, AI, privacy, payments, and more." },
      { property: "og:title", content: "Frequently Asked Questions — MelaBridge" },
      { property: "og:description", content: "Everything you need to know before you start planning." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="FAQ"
      title={<>Answers <span className="text-gradient">before you ask.</span></>}
      description="Can't find what you're looking for? Visit the Help Center or reach out anytime — we usually reply the same day."
    >
      <div className="not-prose space-y-10">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h2 className="font-display text-xl tracking-tight mb-3">{section.title}</h2>
            <Accordion type="single" collapsible className="space-y-3">
              {section.faqs.map((f, i) => (
                <AccordionItem
                  key={i}
                  value={`${section.title}-${i}`}
                  className="rounded-2xl border border-border bg-card px-6"
                >
                  <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">
                    {f.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </div>
    </MarketingPage>
  ),
});

import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const SECTIONS: { title: string; faqs: { q: string; a: string }[] }[] = [
  {
    title: "Getting started",
    faqs: [
      { q: "What kinds of events can I plan on MelaBridge?", a: "Weddings, engagements, birthdays, anniversaries, corporate events, community events, school events, reunions, fundraisers, cultural celebrations, and private gatherings. MelaBridge adapts its playbook to the occasion — you don't fill in a generic form." },
      { q: "Do I need to sign up to try it?", a: "Yes — sign-up is free and takes under a minute. Once you're in you can create your first event, invite family, and try the AI planner without entering a credit card." },
      { q: "Can I plan multiple events at the same time?", a: "Yes. Hosts and families can plan unlimited events on the free plan. Professional Planners get a client dashboard for running many events side-by-side." },
      { q: "Is MelaBridge only for weddings?", a: "No. We started with weddings because they're the hardest to plan — if the tool works there, it works for everything else. Today MelaBridge is used for birthdays, corporate events, fundraisers, school events, and more." },
    ],
  },
  {
    title: "Pricing & plans",
    faqs: [
      { q: "Is planning my own event really free?", a: "Yes. Unlimited events, unlimited guests, budget, checklist, timeline, MelaAssist AI planning, and marketplace access are free for Hosts and families — forever." },
      { q: "What do the paid plans include?", a: "Planner Pro is for professional event planners. It costs $29/month or $290/year after one eligible 5-day trial, with a payment method required at signup. My Event and Vendor Profile remain free at launch; paid vendor tiers are not available for purchase." },
      { q: "Can I sell tickets on MelaBridge?", a: "Eligible workspaces can create ticket types, process secure payments through Stripe, generate QR codes for check-in, and manage attendees — all from inside MelaBridge. MelaBridge charges $0 platform fee on ticket sales. Standard third-party payment-processing fees (for example, Stripe) apply." },
      { q: "What fees apply to tickets and RSVPs?", a: "MelaBridge does not charge per RSVP. Eligible paid plans can sell tickets with no added MelaBridge platform fee; standard third-party payment-processing fees apply. Fundraising and donation processing are not yet available." },
      { q: "Can I cancel anytime?", a: "Yes. Every paid plan can be cancelled directly from your Subscription page — no calls, no forms, no retention emails. You keep access through the end of your billing period. See our Cancellation Policy for full details." },
      { q: "Does Planner Pro include a free trial?", a: "Eligible professional planners can use one 5-day Planner Pro trial. A valid payment method is required when the trial begins. At the end of the trial, the selected $29 monthly or $290 yearly subscription starts automatically unless you cancel before the disclosed trial end date. My Event and Vendor Profile are free and do not require checkout." },
    ],
  },
  {
    title: "AI & MelaAssist™",
    faqs: [
      { q: "What does the AI actually do?", a: "MelaAssist drafts timelines, suggests vendors, organizes event details, tracks budget drift, and answers planning questions grounded in your event's real details. Think of it as an experienced planner sitting next to you." },
      { q: "Will the AI do things without asking me?", a: "No. Every AI-generated event, task, or vendor suggestion requires your review and approval before it's created or used. You always hold the pen." },
      { q: "Is MelaAssist output guaranteed to be accurate?", a: "No. AI output is a starting point, not a finished product. You are responsible for reviewing and verifying all AI-generated content — timelines, budgets, and vendor suggestions — before acting on it or sharing it. MelaBridge does not warrant the accuracy or completeness of AI output." },
      { q: "Is my event data used to train AI models?", a: "No. Your guest lists, budgets, and event details are never used to train external models or shared with third parties." },
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
      { q: "How does subscription billing work?", a: "Planner Pro billing is processed securely via Stripe. After the one-time 5-day trial, your selected $29 monthly or $290 yearly subscription renews automatically until you cancel. You can cancel during the trial or at any time from your Subscription page; after a paid period begins, access continues through the end of that paid period." },
      { q: "How do I find and contact vendors?", a: "Browse the marketplace by category, location, and budget. Save favorites and send inquiries inside MelaBridge. Any agreement you reach with a vendor is between you and that vendor; MelaBridge does not facilitate vendor-client contracts or payments." },
      { q: "Can one vendor profile show more than one service?", a: "Yes. A vendor can select a primary service plus additional services and appear once in marketplace results. Planners can filter by any service the vendor offers, while the public profile shows the complete service list." },
      { q: "What if my vendor isn't on MelaBridge yet?", a: "You can save a known vendor privately to your event. Vendors can create a free Vendor Profile, and an existing public profile can be claimed only through the sign-in and ownership-verification flow." },
      { q: "Does MelaBridge handle vendor deposits or escrow?", a: "No. MelaBridge does not process deposits, milestone payments, or escrow on behalf of vendors or organizers. Any financial arrangements between you and a vendor are handled directly between those parties." },
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
        <p className="text-sm text-muted-foreground pt-2">
          See also:{" "}
          <Link to="/refund" className="underline">Refund Policy</Link> ·{" "}
          <Link to="/cancellation" className="underline">Cancellation Policy</Link> ·{" "}
          <Link to="/ticketing-terms" className="underline">Ticketing Terms</Link> ·{" "}
          <Link to="/terms" className="underline">Terms of Service</Link>
        </p>
      </div>
    </MarketingPage>
  ),
});

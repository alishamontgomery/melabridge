import { createFileRoute } from "@tanstack/react-router";
import { MarketingPage } from "@/components/marketing-page";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const FAQS = [
  { q: "What kinds of events can I plan?", a: "Anything — weddings, birthdays, funerals, corporate offsites, conferences, vacations, graduations, nonprofit galas, family reunions. MelaBridge adapts its playbook to the occasion." },
  { q: "How does the AI actually help?", a: "It drafts timelines, suggests vendors, writes guest communications, tracks budget drift, and answers planning questions grounded in your event's real details." },
  { q: "Can I collaborate with family or a team?", a: "Yes. Invite co-planners with granular permissions on Pro and Business plans. Everyone stays on the same timeline." },
  { q: "Is my guest data private?", a: "Always. Guest data is encrypted, never sold, and never used to train external models. You control exports and deletion." },
  { q: "Can I cancel anytime?", a: "Yes. Every paid plan can be cancelled with one click — no calls, no forms." },
  { q: "Do you support international events?", a: "Yes. MelaBridge supports multi-currency budgets, international vendors, and multi-language guest communications." },
  { q: "How does BridgePay™ escrow work?", a: "Payments to vendors are held in escrow until agreed-upon milestones are met, protecting both hosts and vendors." },
];

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — MelaBridge" },
      { name: "description", content: "Answers to the most common questions about MelaBridge, AI planning, pricing, and privacy." },
      { property: "og:title", content: "Frequently Asked Questions — MelaBridge" },
      { property: "og:description", content: "Answers before you ask." },
    ],
  }),
  component: () => (
    <MarketingPage
      eyebrow="FAQ"
      title={<>Answers <span className="text-gradient">before you ask.</span></>}
      description="Can't find what you're looking for? Visit the Help Center or contact us anytime."
    >
      <Accordion type="single" collapsible className="not-prose space-y-3">
        {FAQS.map((f, i) => (
          <AccordionItem key={i} value={`item-${i}`} className="rounded-2xl border border-border bg-card px-6">
            <AccordionTrigger className="py-5 text-left text-base font-medium hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="pb-5 text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </MarketingPage>
  ),
});

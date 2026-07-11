import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LifeBuoy, MessageCircle, BookOpen, PlayCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/module-page";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — MelaBridge" },
      { name: "description", content: "Guides, tutorials, and Concierge chat to help you plan with confidence." },
    ],
  }),
  component: HelpPage,
});

const TOPICS = [
  { icon: BookOpen, t: "Getting started", n: 12 },
  { icon: PlayCircle, t: "Bridge Concierge™", n: 8 },
  { icon: MessageCircle, t: "Vendors & BridgePay™", n: 14 },
  { icon: LifeBuoy, t: "Guest portal", n: 9 },
];

const ARTICLES = [
  "How Bridge Concierge™ builds your event in minutes",
  "Setting up BridgePay™ escrow for the first time",
  "Sharing your event microsite with guests",
  "Understanding your Event Health Score™",
  "Inviting collaborators and setting roles",
  "Using AI Event Simulator™ before the big day",
];

function HelpPage() {
  return (
    <AppShell active="/help">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Help Center"
          title="How can we help?"
          description="Search 200+ guides, watch tutorials, or chat with Bridge Concierge™ — anytime."
          icon={LifeBuoy}
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search guides, tutorials, and answers…" className="h-12 pl-9 text-base" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TOPICS.map((t) => (
            <Card key={t.t} className="cursor-pointer border-border/60 p-5 shadow-soft transition hover:shadow-elegant">
              <span className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <t.icon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold">{t.t}</p>
              <p className="text-xs text-muted-foreground">{t.n} articles</p>
            </Card>
          ))}
        </div>
        <Section title="Popular articles">
          <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
            {ARTICLES.map((a) => (
              <div key={a} className="flex items-center justify-between p-4 text-sm">
                <span>{a}</span>
                <Badge variant="secondary">Guide</Badge>
              </div>
            ))}
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}

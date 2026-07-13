import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { LifeBuoy, MessageCircle, BookOpen, Search, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/module-page";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help Center — MelaBridge" },
      { name: "description", content: "Guides and support for planning with MelaBridge." },
    ],
  }),
  component: HelpPage,
});

const ARTICLES = [
  { t: "Getting started with MelaBridge", cat: "Getting started", body: "Create your first event, invite your team, and start planning." },
  { t: "Inviting collaborators and setting roles", cat: "Team", body: "Owners, admins, editors, commenters, and viewers." },
  { t: "Managing your event guest list", cat: "Guests", body: "Add guests, track RSVPs, and manage dietary preferences." },
  { t: "Tracking your event budget", cat: "Budget", body: "Set targets and log expenses as you go." },
  { t: "Using MelaAssist™ for AI planning", cat: "AI", body: "Draft messages, generate task lists, and get recommendations." },
  { t: "Sharing your event microsite with guests", cat: "Guests", body: "One link for RSVPs, travel details, and updates." },
];

const CATEGORIES = ["Getting started", "Team", "Guests", "Budget", "AI"];

function HelpPage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return ARTICLES.filter(
      (a) =>
        (!category || a.cat === category) &&
        (!query || a.t.toLowerCase().includes(query) || a.body.toLowerCase().includes(query))
    );
  }, [q, category]);

  return (
    <AppShell active="/help">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Help Center"
          title="How can we help?"
          description="Search guides or reach out — we usually respond within one business day."
          icon={LifeBuoy}
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search guides…"
            className="h-12 pl-9 text-base"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant={category === null ? "default" : "secondary"}
            className="cursor-pointer"
            onClick={() => setCategory(null)}
          >
            All
          </Badge>
          {CATEGORIES.map((c) => (
            <Badge
              key={c}
              variant={category === c ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() => setCategory(c)}
            >
              {c}
            </Badge>
          ))}
        </div>

        <Section title={`${filtered.length} ${filtered.length === 1 ? "article" : "articles"}`}>
          {filtered.length === 0 ? (
            <Card className="border-border/60 p-8 text-center shadow-soft">
              <p className="text-sm text-muted-foreground">
                No articles matched your search. Try a different keyword or contact support.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
              {filtered.map((a) => (
                <div key={a.t} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{a.t}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0"><BookOpen className="mr-1 h-3 w-3" />{a.cat}</Badge>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </Section>

        <Section title="Still need help?">
          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="border-border/60 p-5 shadow-soft">
              <Mail className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Email support</p>
              <p className="mt-1 text-xs text-muted-foreground">Reach a human at hello@melabridge.com — we reply within one business day.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href="mailto:hello@melabridge.com">Email us</a>
              </Button>
            </Card>
            <Card className="border-border/60 p-5 shadow-soft">
              <MessageCircle className="mb-2 h-5 w-5 text-primary" />
              <p className="text-sm font-semibold">Ask MelaAssist™</p>
              <p className="mt-1 text-xs text-muted-foreground">Get planning help from your AI assistant in Messaging.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <a href="/messaging">Open Messaging</a>
              </Button>
            </Card>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}

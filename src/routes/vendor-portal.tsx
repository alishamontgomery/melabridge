import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Briefcase, MessageSquare, FileText, Wallet, Calendar, Upload } from "lucide-react";
import { ModuleGrid, MetricRow, Section } from "@/components/module-page";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/vendor-portal")({
  head: () => ({
    meta: [
      { title: "Vendor Portal — MelaBridge" },
      { name: "description", content: "One place for vendors to see their bookings, deliverables, and payments." },
    ],
  }),
  component: VendorPortalPage,
});

function VendorPortalPage() {
  return (
    <AppShell active="/vendor-portal">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Vendor Portal"
          title="A calm cockpit for every vendor you book"
          description="Vendors see only what's theirs — deliverables, timelines, messages, contracts, and payouts."
          icon={Briefcase}
        />
        <MetricRow
          metrics={[
            { label: "Active bookings", value: 6 },
            { label: "Pending deliverables", value: 3 },
            { label: "Awaiting payment", value: "$1,800" },
            { label: "Avg. response", value: "42m" },
          ]}
        />
        <ModuleGrid
          features={[
            { icon: Calendar, title: "Load-in schedule", detail: "Shared timeline with day-of contacts and access notes." },
            { icon: FileText, title: "Contracts & briefs", detail: "Signed contracts, mood boards, and creative direction in one place." },
            { icon: Upload, title: "Deliverables upload", detail: "Send proofs and finals directly into the event workspace." },
            { icon: MessageSquare, title: "Direct messaging", detail: "Threaded chat with the couple, planner, and coordinators." },
            { icon: Wallet, title: "Milestone payouts", detail: "Track scheduled payouts and request early release." },
            { icon: Briefcase, title: "Multi-event view", detail: "Vendors managing many events see it all in BridgePilot™." },
          ]}
        />
        <Section title="Your bookings this month">
          <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
            {[
              { c: "Amara & Kola · Jun 14", role: "Lead florist", s: "On track" },
              { c: "Idris 40th · Jul 3", role: "Ceremony arrangements", s: "Proof due" },
              { c: "Adeola × Corp · Aug 22", role: "Corporate arch", s: "Contract sent" },
            ].map((b) => (
              <div key={b.c} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{b.c}</p>
                  <p className="text-xs text-muted-foreground">{b.role}</p>
                </div>
                <Badge variant="secondary">{b.s}</Badge>
              </div>
            ))}
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}

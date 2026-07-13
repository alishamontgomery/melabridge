import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { FileBarChart, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — MelaBridge" },
      { name: "description", content: "Analytics across every event and every module — export anytime." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const { user } = useRequireAuth();

  const eventsQ = useQuery({
    queryKey: ["reports-events", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, event_date, guest_target, budget_target, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const events = eventsQ.data ?? [];
  const tracked = events.length;
  const withDates = events.filter((e) => e.event_date).length;

  const exportCsv = () => {
    if (!events.length) {
      toast.info("Nothing to export yet");
      return;
    }
    const header = ["Name", "Date", "Guest target", "Budget target", "Status"];
    const rows = events.map((e) => [
      e.name ?? "",
      e.event_date ?? "",
      e.guest_target ?? "",
      e.budget_target ?? "",
      e.status ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "melabridge-events.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  return (
    <AppShell active="/reports">
      <PageHeader
        eyebrow="Reports"
        icon={FileBarChart}
        title={<>Every event, <span className="text-gradient">measured</span>.</>}
        description="Cross-event analytics across guests, budget, engagement, and health. Every module feeds this view."
        actions={
          <Button variant="soft" className="gap-1" onClick={exportCsv} disabled={!events.length}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />
      <section className="mt-8 grid gap-4 sm:grid-cols-4">
        <StatCard k="Events tracked" v={String(tracked)} />
        <StatCard k="With scheduled dates" v={String(withDates)} />
        <StatCard k="Avg health score" v="—" hint="Coming soon" />
        <StatCard k="Guest satisfaction" v="—" hint="Coming soon" />
      </section>
      <section className="mt-8">
        <Card className="border-border/60 p-6 shadow-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold">Engagement analytics</p>
            <Badge variant="secondary" className="ml-auto">Preview</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Weekly activity across guests, vendors, tasks, and payments will appear here as your events accumulate data.
            {events.length === 0 && " Create your first event to start collecting metrics."}
          </p>
        </Card>
      </section>
    </AppShell>
  );
}

function StatCard({ k, v, hint }: { k: string; v: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{k}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{v}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/module-page";
import { Sparkles, Inbox, ClipboardCheck, CalendarClock, TrendingUp, MessageSquare, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/bridgepilot")({
  head: () => ({
    meta: [
      { title: "MelaAssist™ — MelaBridge for Vendors" },
      { name: "description", content: "Your AI-powered vendor command center: inbox, tasks, schedule, and business insights in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MelaAssistPage,
});

type Stats = {
  unreadThreads: number;
  openTasks: number;
  upcomingBookings: number;
  vendorProfile: { business_name: string | null; bridge_score: number | null } | null;
};

function MelaAssistPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({
    unreadThreads: 0,
    openTasks: 0,
    upcomingBookings: 0,
    vendorProfile: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        if (!cancelled) setLoading(false);
        return;
      }

      const [profileRes, tasksRes, convRes] = await Promise.all([
        supabase.from("vendor_profiles").select("business_name,bridge_score").eq("user_id", uid).maybeSingle(),
        supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", uid).neq("status", "done"),
        supabase.from("conversation_participants").select("conversation_id", { count: "exact", head: true }).eq("user_id", uid),
      ]);

      if (cancelled) return;
      setStats({
        unreadThreads: convRes.count ?? 0,
        openTasks: tasksRes.count ?? 0,
        upcomingBookings: 0,
        vendorProfile: profileRes.data ?? null,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const businessName = stats.vendorProfile?.business_name;

  return (
    <AppShell active="/bridgepilot">
      <div className="space-y-6">
        <PageHeader
          eyebrow="MelaAssist™"
          title={businessName ? `Welcome back, ${businessName}` : "Your AI vendor command center"}
          description="Track your inbox, tasks, and bookings in one place. AI-assisted quoting and follow-ups launching soon."
          icon={Sparkles}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your workspace…
          </div>
        ) : !stats.vendorProfile ? (
          <Card className="p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h3 className="font-display text-lg font-semibold">Set up your vendor profile</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              MelaAssist™ works best once your business profile is live. Add your services, pricing, and portfolio to unlock the command center.
            </p>
            <Button asChild className="mt-4">
              <Link to="/profile">Complete vendor profile</Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={Inbox} label="Active conversations" value={stats.unreadThreads} to="/messaging" />
              <StatCard icon={ClipboardCheck} label="Open tasks" value={stats.openTasks} to="/tasks" />
              <StatCard icon={CalendarClock} label="Upcoming bookings" value={stats.upcomingBookings} to="/timeline" />
              <StatCard
                icon={TrendingUp}
                label="BridgeScore™"
                value={stats.vendorProfile.bridge_score ?? "—"}
                to="/profile"
              />
            </div>

            <Section title="Get started">
              <div className="grid gap-4 md:grid-cols-2">
                <ActionCard
                  icon={MessageSquare}
                  title="Reply to your inbox"
                  description="Manage client conversations and quotes in one thread."
                  to="/messaging"
                />
                <ActionCard
                  icon={ClipboardCheck}
                  title="Review open tasks"
                  description="Stay on top of proposals, deliverables, and follow-ups."
                  to="/tasks"
                />
              </div>
            </Section>

            <Card className="border-primary/20 bg-primary/5 p-5">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
                <div className="text-sm">
                  <p className="font-semibold">AI-assisted quoting, proposals & follow-ups are coming soon.</p>
                  <p className="mt-1 text-muted-foreground">
                    We're wiring up MelaAssist™ AI features. In the meantime, use your inbox and tasks to run your business — everything you do here will carry over.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-4 transition hover:border-primary/40 hover:shadow-soft">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      </Card>
    </Link>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  to,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  to: string;
}) {
  return (
    <Link to={to}>
      <Card className="h-full p-5 transition hover:border-primary/40 hover:shadow-soft">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </Card>
    </Link>
  );
}

// Preserve export used in other places that may reference default badge naming
export const _melaAssistBadge = <Badge variant="secondary">MelaAssist™</Badge>;

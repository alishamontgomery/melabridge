import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  Activity, AlertTriangle, ArrowUpRight, BadgeCheck, CheckCircle2,
  ChevronDown, CreditCard, FlaskConical, Layers3, Loader2, Lock, Mail, RefreshCw,
  Server, Settings2, ShieldCheck, Store, Ticket, Trash2, Users,
} from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { billingConfig } from "@/lib/billing-config";
import { getAdminStats } from "@/lib/admin-stats.functions";
import { getSystemHealth, type SystemHealthResult } from "@/lib/admin-health.functions";
import { seedTestData, wipeTestData } from "@/lib/test-seed.functions";
import { sendDomainTestEmail } from "@/lib/email-test.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "AdminOS — MelaBridge" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
});

function AdminPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";
  const fetchStats = useServerFn(getAdminStats);
  const stats = useQuery({
    queryKey: ["admin-stats"], enabled: isAdmin,
    queryFn: async () => {
      const result = await fetchStats({ data: undefined } as never);
      if ("error" in result) throw new Error(result.error);
      return result;
    },
  });
  const [health, setHealth] = useState<SystemHealthResult | null>(null);
  const [checking, setChecking] = useState(false);
  const fetchHealth = useServerFn(getSystemHealth);

  async function runHealthCheck() {
    setChecking(true);
    try { setHealth(await fetchHealth({ data: undefined } as never)); }
    catch { toast.error("Health check failed"); }
    finally { setChecking(false); }
  }
  if (authLoading || roleLoading) return <AppShell active="/admin"><Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card></AppShell>;
  if (!user || !isAdmin) return <AppShell active="/admin"><Card className="flex flex-col items-center gap-3 p-10 text-center"><Lock className="h-7 w-7 text-primary" /><h1 className="font-display text-xl font-semibold">AdminOS is restricted</h1><p className="max-w-md text-sm text-muted-foreground">This command center is available to platform administrators only.</p><Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button></Card></AppShell>;

  const data = stats.data;
  const n = (value?: number) => typeof value === "number" ? value.toLocaleString() : "—";
  const incompleteVendors = Math.max(0, (data?.totalVendors ?? 0) - (data?.activeVendors ?? 0));
  const metrics = [
    ["Active users", data?.activeUsers, Users, "/admin/users"],
    ["Total vendors", data?.totalVendors, Store, "/admin/vendors"],
    ["Active listings", data?.activeVendors, BadgeCheck, "/admin/vendors"],
    ["Events", data?.totalEvents, Layers3, "/analytics"],
    ["Published events", data?.publishedEvents, Activity, "/analytics"],
    ["Ticket orders", data?.ticketOrders, Ticket, "/analytics"],
    ["Attendees", data?.ticketAttendees, Users, "/analytics"],
    ["Checked in", data?.checkedInAttendees, CheckCircle2, "/analytics"],
  ] as const;
  return (
    <AppShell active="/admin">
      <div className="space-y-7">
        <PageHeader eyebrow="AdminOS" title="The platform, at a glance." description="A quiet command center for the work that keeps MelaBridge moving." icon={ShieldCheck} actions={<Button asChild size="sm"><Link to="/admin/invite"><Users className="mr-1.5 h-4 w-4" />Invite users</Link></Button>} />

        <section aria-labelledby="overview-heading">
          <div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Signal</p><h2 id="overview-heading" className="font-display text-xl font-semibold">Platform overview</h2></div><span className="text-xs text-muted-foreground">Live counts from the platform</span></div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {stats.isLoading ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl border bg-muted/40" />) : metrics.map(([label, value, Icon, to]) => <Link key={label} to={to as "/admin"} className="group rounded-xl border border-border/70 bg-card/80 p-3 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span><Icon className="h-3.5 w-3.5 text-primary/70" /></div><p className="mt-2 font-display text-2xl font-semibold tabular-nums">{n(value)}</p></Link>)}
          </div>
        </section>

         <section aria-labelledby="attention-heading"><div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Triage</p><h2 id="attention-heading" className="font-display text-xl font-semibold">Needs attention</h2><p className="text-sm text-muted-foreground">Small queues worth clearing before they become noise.</p></div><div className="grid gap-3 md:grid-cols-3">
           <AttentionCard to="/admin/vendors" label="Incomplete vendor profiles" count={incompleteVendors} detail="Profiles not ready for listing" icon={Store} tone="slate" />
        </div></section>

        <section aria-labelledby="management-heading"><div className="mb-3 flex items-end justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Workspace</p><h2 id="management-heading" className="font-display text-xl font-semibold">Management</h2></div></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
           <ManagementCard to="/admin/users" icon={Users} label="Users" detail="Roles, status, access" /><ManagementCard to="/admin/invite" icon={Mail} label="Invite" detail="Bring in a teammate" /><ManagementCard to="/admin/vendors" icon={Store} label="Vendors" detail="Profiles and listings" /><ManagementCard to="/admin/sourcing" icon={Layers3} label="Vendor Demand" detail="Aggregate marketplace demand" /><ManagementCard to="/admin/subscriptions" icon={CreditCard} label="Subscriptions" detail="Plans and billing status" />
        </div></section>

         <section aria-labelledby="health-heading"><div className="mb-3"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Reliability</p><h2 id="health-heading" className="font-display text-xl font-semibold">Platform health</h2></div><Card className="border-border/70 p-4"><div className="flex flex-wrap items-center gap-3"><div className="flex items-center gap-2">{health ? health.overall === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" /> : <Server className="h-4 w-4 text-muted-foreground" />}<span className="text-sm font-medium">{health ? health.overall === "ok" ? "All checked services operational" : "One or more services degraded" : "Not checked yet"}</span>{health && <span className="text-xs text-muted-foreground">at {new Date(health.checkedAt).toLocaleTimeString()}</span>}</div><Button className="ml-auto" size="sm" variant="outline" onClick={runHealthCheck} disabled={checking}>{checking ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}{health ? "Re-check services" : "Check services"}</Button></div>{health && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{health.services.map((service) => <div key={service.name} className="rounded-lg bg-muted/45 p-3"><div className="flex items-center gap-2 text-sm font-medium">{service.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}{service.name}</div><p className="mt-1 text-xs text-muted-foreground">{service.status === "ok" ? "Operational" : "Degraded"}{service.latencyMs !== undefined && ` · ${service.latencyMs}ms`}</p></div>)}</div>}{health?.synthetic && <div className="mt-4 rounded-lg border border-border/70 bg-muted/20 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Synthetic monitor: {health.synthetic.overall}</p><p className="text-xs text-muted-foreground">Last run {new Date(health.synthetic.completedAt).toLocaleString()} · {health.synthetic.checks.filter((check) => check.status === "ok").length}/{health.synthetic.checks.length} checks passed</p></div><span className="text-xs text-muted-foreground">Every 5 minutes</span></div>{health.synthetic.checks.some((check) => check.status === "degraded") && <ul className="mt-2 space-y-1 text-xs text-amber-700">{health.synthetic.checks.filter((check) => check.status === "degraded").slice(0, 3).map((check) => <li key={check.name}><strong>{check.name}:</strong> {check.detail}</li>)}</ul>}</div>}</Card></section>

        <AdvancedTools />
      </div>
    </AppShell>
  );
}

function AttentionCard({ to, label, count, detail, icon: Icon, tone }: { to: string; label: string; count?: number; detail: string; icon: React.ComponentType<{ className?: string }>; tone: "amber" | "teal" | "slate" }) {
  return <Link to={to as "/admin"} className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card p-4 transition hover:border-primary/40 hover:shadow-soft"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tone === "amber" ? "bg-amber-100 text-amber-700" : tone === "teal" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}><Icon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-muted-foreground">{detail}</span></span><span className="flex items-center gap-1 font-display text-xl font-semibold">{count ?? "—"}<ArrowUpRight className="h-4 w-4 text-primary opacity-0 transition group-hover:opacity-100" /></span></Link>;
}
function ManagementCard({ to, icon: Icon, label, detail }: { to: string; icon: React.ComponentType<{ className?: string }>; label: string; detail: string }) { return <Link to={to as "/admin"} className="group rounded-xl border border-border/70 bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"><Icon className="h-4 w-4 text-primary" /><p className="mt-3 text-sm font-semibold">{label}</p><p className="mt-0.5 text-xs text-muted-foreground">{detail}</p><ArrowUpRight className="mt-3 h-3.5 w-3.5 text-primary opacity-0 transition group-hover:opacity-100" /></Link>; }

function AdvancedTools() {
  const [open, setOpen] = useState(false);
  return <Collapsible open={open} onOpenChange={setOpen}><div className="border-t border-border/70 pt-5"><CollapsibleTrigger className="flex w-full items-center justify-between text-left"><div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">For operators</p><h2 className="font-display text-xl font-semibold">Advanced tools</h2><p className="text-sm text-muted-foreground">Testing and configuration utilities, kept out of the daily path.</p></div><ChevronDown className={`h-5 w-5 text-muted-foreground transition ${open ? "rotate-180" : ""}`} /></CollapsibleTrigger><CollapsibleContent className="mt-4 grid gap-3 md:grid-cols-2"><TestDataTool /><EmailTool /><TicketTool /><BillingTool /></CollapsibleContent></div></Collapsible>;
}
function TestDataTool() { const seed = useServerFn(seedTestData); const wipe = useServerFn(wipeTestData); const [busy, setBusy] = useState(false); return <ToolCard icon={FlaskConical} title="QA test data" text="Seed or remove tagged preview records." actions={<><Button size="sm" onClick={async () => { setBusy(true); try { const r = await seed({ data: undefined } as never); if (!r.ok) throw new Error(r.error); toast.success("Test data seeded"); } catch (e) { toast.error(e instanceof Error ? e.message : "Seed failed"); } finally { setBusy(false); } }} disabled={busy}>Seed</Button><Button size="sm" variant="outline" onClick={async () => { if (!confirm("Delete all tagged test data?")) return; setBusy(true); try { const r = await wipe({ data: undefined } as never); if (!r.ok) throw new Error(r.error); toast.success("Test data wiped"); } catch (e) { toast.error(e instanceof Error ? e.message : "Wipe failed"); } finally { setBusy(false); } }} disabled={busy}><Trash2 className="mr-1 h-3.5 w-3.5" />Wipe</Button></>} />; }
function EmailTool() { const send = useServerFn(sendDomainTestEmail); const [busy, setBusy] = useState(false); return <ToolCard icon={Mail} title="Email domain" text="Send a delivery test to hello@melabridge.com." actions={<Button size="sm" variant="outline" disabled={busy} onClick={async () => { setBusy(true); try { const r = await send({ data: { recipient: "hello@melabridge.com" } } as never); if (!r.ok) throw new Error(r.message); toast.success("Test email sent"); } catch (e) { toast.error(e instanceof Error ? e.message : "Send failed"); } finally { setBusy(false); } }}>{busy ? "Sending…" : "Send test"}</Button>} />; }
function TicketTool() { return <ToolCard icon={Ticket} title="Ticketing sandbox" text="Create a private test event and validate checkout with Stripe test mode." actions={<Button size="sm" variant="outline" asChild><Link to="/events/new">Create test event</Link></Button>} />; }
function BillingTool() { return <ToolCard icon={Settings2} title="Billing configuration" text={`${billingConfig.ticketingPlatformFeeRate * 100}% ticketing fee · plans are read from the shared config.`} actions={<Button size="sm" variant="outline" asChild><Link to="/pricing">View pricing</Link></Button>} />; }
function ToolCard({ icon: Icon, title, text, actions }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; actions: React.ReactNode }) { return <Card className="flex flex-wrap items-center gap-3 border-border/70 p-4"><Icon className="h-4 w-4 shrink-0 text-primary" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted-foreground">{text}</p></div><div className="flex gap-2">{actions}</div></Card>; }
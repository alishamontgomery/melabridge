import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Copy,
  RefreshCcw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import {
  disconnectCalendar,
  getIcsUrl,
  listCalendarConnections,
} from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/settings/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar Sync — MelaBridge" },
      {
        name: "description",
        content:
          "Sync MelaBridge events with Google Calendar, Microsoft Outlook, and Apple Calendar.",
      },
    ],
  }),
  component: CalendarSettingsPage,
});

type ConnRow = Awaited<ReturnType<typeof listCalendarConnections>>[number];

function formatWhen(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

function CalendarSettingsPage() {
  const list = useServerFn(listCalendarConnections);
  const disconnect = useServerFn(disconnectCalendar);
  const getUrl = useServerFn(getIcsUrl);

  const [connections, setConnections] = useState<ConnRow[]>([]);
  const [icsToken, setIcsToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const rows = await list();
      setConnections(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void reload();
    void getUrl({ data: {} })
      .then((r) => setIcsToken(r.token))
      .catch(() => {});
  }, [reload, getUrl]);

  const google = connections.find((c) => c.provider === "google");
  const outlook = connections.find((c) => c.provider === "outlook");

  const origin = typeof window !== "undefined" ? window.location.origin : "https://melabridge.com";
  const icsUrl = icsToken ? `${origin}/api/public/calendar/${icsToken}.ics` : "";
  const webcalUrl = icsUrl.replace(/^https?:/, "webcal:");

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function rotate() {
    const r = await getUrl({ data: { rotate: true } });
    setIcsToken(r.token);
    toast.success("Subscription URL rotated");
  }

  async function onDisconnect(provider: "google" | "outlook") {
    if (!confirm(`Disconnect ${provider === "google" ? "Google Calendar" : "Outlook"}?`)) return;
    await disconnect({ data: { provider } });
    await reload();
    toast.success("Disconnected");
  }

  return (
    <AppShell active="/settings">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to settings
        </Link>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar sync</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep MelaBridge events in sync with the calendar apps you already use.
          </p>
        </div>

        {/* Google */}
        <ProviderCard
          name="Google Calendar"
          icon="G"
          iconClass="bg-blue-500/10 text-blue-600"
          conn={google}
          loading={loading}
          onConnect={() => {
            window.location.href = "/api/oauth/google-calendar/start";
          }}
          onDisconnect={() => onDisconnect("google")}
          description="Two-way sync. Events created or updated in MelaBridge appear on Google Calendar, and changes made there flow back."
        />

        {/* Outlook */}
        <ProviderCard
          name="Microsoft Outlook"
          icon="O"
          iconClass="bg-sky-500/10 text-sky-600"
          conn={outlook}
          loading={loading}
          onConnect={() => {
            window.location.href = "/api/oauth/outlook-calendar/start";
          }}
          onDisconnect={() => onDisconnect("outlook")}
          description="Two-way sync via Microsoft Graph. Great for Office 365 accounts."
        />

        {/* Apple / ICS */}
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-500/10 text-slate-700 font-semibold">
              A
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">Apple Calendar (and any ICS-capable app)</h3>
                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Ready
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Subscribe to this private URL from Apple Calendar (or any ICS-compatible client) to see your
                MelaBridge events. Read-only — perfect for a personal glance.
              </p>

              {icsToken ? (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input value={icsUrl} readOnly className="font-mono text-xs" />
                    <Button size="sm" variant="secondary" onClick={() => copyText(icsUrl, "URL")}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href={webcalUrl}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        Add to Apple Calendar
                      </a>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={rotate}>
                      <RefreshCcw className="mr-2 h-4 w-4" />
                      Rotate URL
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Keep this URL private — anyone with the link can view your event titles, dates, and locations.
                    Rotating invalidates the old URL immediately.
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
              )}
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Sync respects your account. We only ever touch calendars you explicitly connect.
        </p>
      </div>
    </AppShell>
  );
}

function ProviderCard({
  name,
  icon,
  iconClass,
  conn,
  loading,
  onConnect,
  onDisconnect,
  description,
}: {
  name: string;
  icon: string;
  iconClass: string;
  conn: ConnRow | undefined;
  loading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  description: string;
}) {
  const connected = !!conn && conn.is_active;
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-semibold ${iconClass}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold">{name}</h3>
            {loading ? null : connected ? (
              <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
              </Badge>
            ) : (
              <Badge variant="secondary">Not connected</Badge>
            )}
            {conn?.last_error && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700">
                <AlertCircle className="mr-1 h-3 w-3" /> Sync error
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>

          {connected && (
            <div className="mt-2 text-xs text-muted-foreground">
              {conn?.external_account_email ?? "connected account"} · last sync{" "}
              {formatWhen(conn?.last_synced_at ?? null)}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {connected ? (
              <>
                <Button size="sm" variant="outline" onClick={onConnect}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Reconnect
                </Button>
                <Button size="sm" variant="ghost" onClick={onDisconnect}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onConnect}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Connect {name.split(" ")[0]}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

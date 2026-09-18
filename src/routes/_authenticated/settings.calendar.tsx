import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, ArrowLeft, Calendar as CalendarIcon, Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import {
  generateCalendarFeedToken,
  getCalendarFeedPreferences,
  getCalendarFeedToken,
  updateCalendarFeedPreferences,
} from "@/lib/calendar.functions";
import { useAuth } from "@/lib/auth";

const DEFAULT_FEED_PREFERENCES = {
  include_event_name: false,
  include_venue: false,
  include_address: false,
};

type FeedPreferenceKey = keyof typeof DEFAULT_FEED_PREFERENCES;

export const Route = createFileRoute("/_authenticated/settings/calendar")({
  head: () => ({
    meta: [
      { title: "External Calendar Sync — MelaBridge" },
      {
        name: "description",
        content: "Subscribe to your MelaBridge bookings in Google, Outlook, or Apple Calendar.",
      },
    ],
  }),
  component: CalendarSyncPage,
});

function CalendarSyncPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const loadToken = useServerFn(getCalendarFeedToken);
  const generateToken = useServerFn(generateCalendarFeedToken);
  const loadPreferences = useServerFn(getCalendarFeedPreferences);
  const savePreferences = useServerFn(updateCalendarFeedPreferences);
  const tokenQuery = useQuery({
    queryKey: ["calendar-feed-token", user?.id],
    queryFn: () => loadToken(),
    enabled: Boolean(user?.id),
  });
  const preferencesQuery = useQuery({
    queryKey: ["calendar-feed-preferences", user?.id],
    queryFn: () => loadPreferences(),
    enabled: Boolean(user?.id),
  });
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savingPreference, setSavingPreference] = useState<FeedPreferenceKey | null>(null);
  const token = tokenQuery.data?.token;
  const preferences = preferencesQuery.data ?? DEFAULT_FEED_PREFERENCES;
  const feedUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/api/public/calendar/${token}`
      : "";

  useEffect(() => {
    queryClient.removeQueries({
      predicate: (query) =>
        query.queryKey[0] === "calendar-feed-token" && query.queryKey[1] !== user?.id,
    });
  }, [queryClient, user?.id]);

  const providers = [
    {
      name: "Google Calendar",
      icon: "G",
      iconClass: "bg-blue-500/10 text-blue-600",
      href: feedUrl
        ? `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(feedUrl.replace(/^https?:/, "webcal:"))}`
        : "",
    },
    {
      name: "Microsoft Outlook",
      icon: "O",
      iconClass: "bg-sky-500/10 text-sky-600",
      href: feedUrl
        ? `https://outlook.live.com/calendar/0/addcalendar?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent("MelaBridge Bookings")}`
        : "",
    },
    {
      name: "Apple Calendar",
      icon: "A",
      iconClass: "bg-slate-500/10 text-slate-700",
      href: feedUrl ? feedUrl.replace(/^https?:/, "webcal:") : "",
    },
  ];

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await generateToken();
      queryClient.setQueryData(["calendar-feed-token", user?.id], result);
      toast.success(token ? "Calendar link reset" : "Calendar link created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create calendar link");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      toast.success("Calendar link copied");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy the link");
    }
  }

  async function handlePreferenceChange(key: FeedPreferenceKey, value: boolean) {
    const nextPreferences = { ...preferences, [key]: value };
    setSavingPreference(key);
    try {
      const saved = await savePreferences({ data: nextPreferences });
      queryClient.setQueryData(["calendar-feed-preferences", user?.id], saved);
      toast.success("Calendar feed privacy updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update calendar feed privacy");
    } finally {
      setSavingPreference(null);
    }
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
          <h1 className="text-2xl font-semibold tracking-tight">External calendar sync</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscribe to a read-only feed of confirmed bookings and blocked dates. Your calendar app
            refreshes the feed automatically.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5 p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">Use MelaBridge Calendar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your availability, incoming inquiries, events, and schedule all in one place.
              </p>
              <div className="mt-3">
                <Button asChild size="sm" variant="hero">
                  <Link to="/calendar">Open calendar</Link>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-amber-500/10 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">Choose what your feed shows</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Confirmed booking entries are private by default. Turn on only the details you want included in
                your external calendar.
              </p>
              <div className="mt-4 space-y-2">
                {([
                  ["include_event_name", "Event names", "Show the name of each confirmed event instead of a generic label."],
                  ["include_venue", "Venue names", "Show the venue name when one is saved on the event."],
                  ["include_address", "Addresses", "Show the event address when one is saved on the event."],
                ] as const).map(([key, label, description]) => (
                  <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-3">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={preferences[key]}
                      onCheckedChange={(checked) => handlePreferenceChange(key, checked)}
                      disabled={preferencesQuery.isLoading || savingPreference !== null}
                      aria-label={`Include ${label.toLowerCase()} in external calendar`}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-100">
                Anyone with your private feed link can read the details you enable here. Treat the link like a
                password and reset it if you think it was shared.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Your private calendar link</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Anyone with this link can see the calendar entries it contains. Keep it private and reset it
            if it is shared accidentally.
          </p>
          {tokenQuery.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading calendar link…</p>
          ) : feedUrl ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input value={feedUrl} readOnly aria-label="Private calendar feed URL" className="font-mono text-xs" />
              <Button type="button" variant="outline" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button type="button" variant="ghost" onClick={handleGenerate} disabled={generating}>
                <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} />
                Reset link
              </Button>
            </div>
          ) : (
            <Button className="mt-4" type="button" onClick={handleGenerate} disabled={generating}>
              {generating && <RefreshCw className="h-4 w-4 animate-spin" />}
              Generate calendar link
            </Button>
          )}
        </Card>

        <div className="space-y-3">
          {providers.map((p) => (
            <Card key={p.name} className="p-5">
              <div className="flex items-center gap-4">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg font-semibold ${p.iconClass}`}>
                  {p.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold">{p.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Subscribe to your read-only MelaBridge calendar in {p.name}.
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild={Boolean(p.href)} disabled={!p.href}>
                  {p.href ? (
                    <a href={p.href} target={p.name === "Apple Calendar" ? undefined : "_blank"} rel="noreferrer">
                      Subscribe <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span>Generate link first</span>
                  )}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

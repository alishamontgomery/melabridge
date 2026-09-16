import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Settings2, Plus, Trash2, ArrowLeft, Copy, CalendarOff } from "lucide-react";
import {
  getCalendarSettings,
  updateCalendarSettings,
  listAvailability,
  upsertAvailability,
  deleteAvailability,
  listBlockedDates,
  addBlockedDate,
  deleteBlockedDate,
} from "@/lib/calendar.functions";

export const Route = createFileRoute("/_authenticated/calendar/settings")({
  head: () => ({
    meta: [
      { title: "Scheduling Preferences — MelaBridge" },
      { name: "description", content: "Set your business hours, blocked dates, and scheduling preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarSettingsPage,
});

// Monday-first for the week display; Sunday is index 0 in the DB weekday field
const ORDERED_WEEKDAYS = [
  { label: "Monday",    short: "Mon", idx: 1 },
  { label: "Tuesday",   short: "Tue", idx: 2 },
  { label: "Wednesday", short: "Wed", idx: 3 },
  { label: "Thursday",  short: "Thu", idx: 4 },
  { label: "Friday",    short: "Fri", idx: 5 },
  { label: "Saturday",  short: "Sat", idx: 6 },
  { label: "Sunday",    short: "Sun", idx: 0 },
];

const BLOCK_REASONS: { value: string; label: string }[] = [
  { value: "vacation",      label: "Vacation" },
  { value: "day_off",       label: "Personal / Day Off" },
  { value: "travel",        label: "Travel" },
];

function CalendarSettingsPage() {
  const qc = useQueryClient();
  const loadSettings = useServerFn(getCalendarSettings);
  const saveSettings = useServerFn(updateCalendarSettings);
  const loadAvail = useServerFn(listAvailability);
  const upAvail = useServerFn(upsertAvailability);
  const delAvail = useServerFn(deleteAvailability);
  const loadBlocks = useServerFn(listBlockedDates);
  const addBlock = useServerFn(addBlockedDate);
  const delBlock = useServerFn(deleteBlockedDate);

  const settings = useQuery({ queryKey: ["cal-settings"], queryFn: () => loadSettings() });
  const availability = useQuery({ queryKey: ["cal-avail"], queryFn: () => loadAvail() });
  const blocks = useQuery({ queryKey: ["cal-blocks"], queryFn: () => loadBlocks() });

  // Per-day "add window" forms — keyed by weekday index
  const [addForms, setAddForms] = useState<Record<number, { start: string; end: string }>>({});
  const [newBlock, setNewBlock] = useState({ start_date: "", end_date: "", reason: "vacation" as string, notes: "" });

  // Vacation mode — controlled local state so we can validate before saving
  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");
  const [vacError, setVacError] = useState<string | null>(null);
  const vacInitialized = useRef(false);
  useEffect(() => {
    if (settings.data && !vacInitialized.current) {
      setVacStart(settings.data.vacation_start ?? "");
      setVacEnd(settings.data.vacation_end ?? "");
      vacInitialized.current = true;
    }
  }, [settings.data]);

  async function onSaveSettings(patch: Partial<any>) {
    const s = { ...(settings.data ?? {}), ...patch };
    await saveSettings({
      data: {
        buffer_before_minutes: Number(s.buffer_before_minutes ?? 30),
        buffer_after_minutes: Number(s.buffer_after_minutes ?? 30),
        max_events_per_day: Number(s.max_events_per_day ?? 2),
        block_travel_days: Boolean(s.block_travel_days),
        vacation_start: s.vacation_start || null,
        vacation_end: s.vacation_end || null,
        timezone: s.timezone ?? "UTC",
      },
    });
    qc.invalidateQueries({ queryKey: ["cal-settings"] });
    toast.success("Saved");
  }

  // Group availability windows by weekday
  const windowsByDay: Record<number, any[]> = {};
  for (const w of availability.data ?? []) {
    if (!windowsByDay[w.weekday]) windowsByDay[w.weekday] = [];
    windowsByDay[w.weekday]!.push(w);
  }

  async function addWindowForDay(weekday: number) {
    const f = addForms[weekday] ?? { start: "09:00", end: "17:00" };
    await upAvail({ data: { weekday, start_time: f.start, end_time: f.end, is_active: true } });
    qc.invalidateQueries({ queryKey: ["cal-avail"] });
    setAddForms((prev) => {
      const next = { ...prev };
      delete next[weekday];
      return next;
    });
    toast.success("Window added");
  }

  async function closeDay(weekday: number) {
    const windows = windowsByDay[weekday] ?? [];
    await Promise.all(windows.map((w) => delAvail({ data: { id: w.id } })));
    qc.invalidateQueries({ queryKey: ["cal-avail"] });
    toast.success("Day marked as closed");
  }

  async function copyDayToWeekdays(sourceWeekday: number) {
    const source = windowsByDay[sourceWeekday] ?? [];
    if (source.length === 0) { toast.error("No windows to copy"); return; }
    // Mon-Fri = weekday 1-5
    const targets = [1, 2, 3, 4, 5].filter((d) => d !== sourceWeekday);
    // Delete existing windows on target days, then add source windows
    for (const day of targets) {
      const existing = windowsByDay[day] ?? [];
      await Promise.all(existing.map((w) => delAvail({ data: { id: w.id } })));
      await Promise.all(
        source.map((w) =>
          upAvail({ data: { weekday: day, start_time: w.start_time, end_time: w.end_time, is_active: true } })
        )
      );
    }
    qc.invalidateQueries({ queryKey: ["cal-avail"] });
    toast.success("Copied to all weekdays");
  }

  function formatDate(iso: string) {
    // Parse as local date (noon UTC avoids timezone edge-case shifting the day)
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(
      new Date(`${iso}T12:00:00`),
    );
  }

  function formatTimeRange(start: string, end: string) {
    const fmt = (t: string) => {
      const [h, m] = t.split(":").map(Number);
      const period = h! >= 12 ? "PM" : "AM";
      const hour = h! % 12 || 12;
      return `${hour}:${String(m).padStart(2, "0")} ${period}`;
    };
    return `${fmt(start)} – ${fmt(end)}`;
  }

  return (
    <AppShell active="/calendar">
      <Link to="/calendar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to calendar
      </Link>

      <div className="mt-2">
        <PageHeader
          eyebrow="Scheduling"
          icon={Settings2}
          title={<>Set your <span className="text-gradient">availability</span>.</>}
          description="Configure your weekly hours, scheduling preferences, and days off."
        />
      </div>

      <div className="mt-6 space-y-6">

        {/* ── Weekly availability ── */}
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg font-semibold">Weekly availability</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Set your hours for each day. Add multiple windows if you take a mid-day break.</p>
            </div>
          </div>

          <div className="mt-5 divide-y divide-border">
            {ORDERED_WEEKDAYS.map(({ label, short, idx: weekday }) => {
              const windows = windowsByDay[weekday] ?? [];
              const isOpen = windows.length > 0;
              const adding = !!addForms[weekday];
              const addForm = addForms[weekday] ?? { start: "09:00", end: "17:00" };

              return (
                <div key={weekday} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    {/* Day label + open/closed badge */}
                    <div className="flex items-center gap-2 min-w-[90px]">
                      <span className="font-medium text-sm">{label}</span>
                      <Badge
                        variant={isOpen ? "default" : "outline"}
                        className={`text-[10px] ${isOpen ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
                      >
                        {isOpen ? "Open" : "Closed"}
                      </Badge>
                    </div>

                    {/* Windows */}
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                      {windows.map((w: any) => (
                        <div key={w.id} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs">
                          <Switch
                            checked={w.is_active}
                            onCheckedChange={async (v) => {
                              await upAvail({ data: { id: w.id, weekday: w.weekday, start_time: w.start_time, end_time: w.end_time, is_active: v } });
                              qc.invalidateQueries({ queryKey: ["cal-avail"] });
                            }}
                          />
                          <span className={w.is_active ? "text-foreground" : "text-muted-foreground line-through"}>
                            {formatTimeRange(w.start_time, w.end_time)}
                          </span>
                          <button
                            type="button"
                            onClick={async () => { await delAvail({ data: { id: w.id } }); qc.invalidateQueries({ queryKey: ["cal-avail"] }); }}
                            className="ml-0.5 text-muted-foreground hover:text-destructive"
                            aria-label="Remove window"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Day actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!adding && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAddForms((p) => ({ ...p, [weekday]: { start: "09:00", end: "17:00" } }))}
                          className="h-7 gap-1 text-xs px-2"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </Button>
                      )}
                      {isOpen && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyDayToWeekdays(weekday)}
                            title="Copy this day's hours to all weekdays (Mon–Fri)"
                            className="h-7 gap-1 text-xs px-2 text-muted-foreground hover:text-foreground"
                          >
                            <Copy className="h-3 w-3" />
                            <span className="hidden sm:inline">Copy to weekdays</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => closeDay(weekday)}
                            title="Mark this day as closed"
                            className="h-7 gap-1 text-xs px-2 text-muted-foreground hover:text-destructive"
                          >
                            <CalendarOff className="h-3 w-3" />
                            <span className="hidden sm:inline">Close</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Add window inline form */}
                  {adding && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-2">
                      <Input
                        type="time"
                        value={addForm.start}
                        onChange={(e) => setAddForms((p) => ({ ...p, [weekday]: { ...addForm, start: e.target.value } }))}
                        className="h-8 w-[120px] text-xs"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <Input
                        type="time"
                        value={addForm.end}
                        onChange={(e) => setAddForms((p) => ({ ...p, [weekday]: { ...addForm, end: e.target.value } }))}
                        className="h-8 w-[120px] text-xs"
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => addWindowForDay(weekday)}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs"
                        onClick={() => setAddForms((p) => { const n = { ...p }; delete n[weekday]; return n; })}
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Scheduling preferences (formerly Booking rules) ── */}
          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold">Scheduling preferences</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Control preparation time, daily limits, and travel day blocking.
            </p>
            {settings.data && (
              <div className="mt-5 space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="prep-time">Preparation time before events</Label>
                    <div className="relative mt-1">
                      <Input
                        id="prep-time"
                        type="number"
                        min={0}
                        defaultValue={settings.data.buffer_before_minutes}
                        onBlur={(e) => onSaveSettings({ buffer_before_minutes: Number(e.target.value) })}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Time you need to set up before an event starts.</p>
                  </div>
                  <div>
                    <Label htmlFor="cleanup-time">Cleanup time after events</Label>
                    <div className="relative mt-1">
                      <Input
                        id="cleanup-time"
                        type="number"
                        min={0}
                        defaultValue={settings.data.buffer_after_minutes}
                        onBlur={(e) => onSaveSettings({ buffer_after_minutes: Number(e.target.value) })} />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Time you need after an event before you're available again.</p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="max-events">Maximum events per day</Label>
                  <Input
                    id="max-events"
                    type="number"
                    min={1}
                    defaultValue={settings.data.max_events_per_day}
                    onBlur={(e) => onSaveSettings({ max_events_per_day: Number(e.target.value) })}
                    className="mt-1"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">New availability requests beyond this limit will be flagged as a conflict.</p>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 p-3">
                  <div>
                    <p className="text-sm font-medium">Travel time between events</p>
                    <p className="text-xs text-muted-foreground">Warn on back-to-back events in different locations.</p>
                  </div>
                  <Switch
                    checked={settings.data.block_travel_days}
                    onCheckedChange={(v) => onSaveSettings({ block_travel_days: v })}
                  />
                </div>

                <div>
                  <Label>Vacation mode</Label>
                  <p className="mt-0.5 text-xs text-muted-foreground mb-2">While on vacation, new availability requests will not be accepted.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="vac-start" className="text-xs text-muted-foreground">Start date</Label>
                      <Input
                        id="vac-start"
                        type="date"
                        value={vacStart}
                        onChange={(e) => { setVacStart(e.target.value); setVacError(null); }}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="vac-end" className="text-xs text-muted-foreground">End date</Label>
                      <Input
                        id="vac-end"
                        type="date"
                        value={vacEnd}
                        onChange={(e) => { setVacEnd(e.target.value); setVacError(null); }}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  {vacError && <p className="mt-1 text-xs text-destructive">{vacError}</p>}
                  {settings.data.vacation_start && settings.data.vacation_end && (
                    <p className="mt-1 text-xs text-primary">
                      Active: {formatDate(settings.data.vacation_start)} – {formatDate(settings.data.vacation_end)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (vacStart && vacEnd && vacEnd < vacStart) {
                          setVacError("End date must be on or after the start date.");
                          return;
                        }
                        setVacError(null);
                        onSaveSettings({ vacation_start: vacStart || null, vacation_end: vacEnd || null });
                      }}
                    >
                      Save vacation dates
                    </Button>
                    {(settings.data.vacation_start || settings.data.vacation_end) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => {
                          setVacStart(""); setVacEnd(""); setVacError(null);
                          onSaveSettings({ vacation_start: null, vacation_end: null });
                        }}
                      >
                        Clear vacation
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* ── Blocked dates ── */}
          <Card className="p-5">
            <h3 className="font-display text-lg font-semibold">Blocked dates</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Mark specific dates when you're unavailable.
            </p>

            {/* Add block form */}
            <div className="mt-4 space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="block-start" className="text-xs">Start date</Label>
                  <Input
                    id="block-start"
                    type="date"
                    value={newBlock.start_date}
                    onChange={(e) => setNewBlock({ ...newBlock, start_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="block-end" className="text-xs">End date</Label>
                  <Input
                    id="block-end"
                    type="date"
                    value={newBlock.end_date}
                    onChange={(e) => setNewBlock({ ...newBlock, end_date: e.target.value })}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Reason</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {BLOCK_REASONS.map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setNewBlock({ ...newBlock, reason: r.value })}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        newBlock.reason === r.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="block-notes" className="text-xs">Notes (optional)</Label>
                <Textarea
                  id="block-notes"
                  rows={2}
                  className="mt-1 text-sm"
                  value={newBlock.notes}
                  onChange={(e) => setNewBlock({ ...newBlock, notes: e.target.value })}
                  placeholder="Additional context…"
                />
              </div>

              <Button
                className="w-full gap-2"
                onClick={async () => {
                  if (!newBlock.start_date || !newBlock.end_date) return toast.error("Select a start and end date");
                  if (newBlock.end_date < newBlock.start_date) return toast.error("End date must be on or after the start date.");
                  await addBlock({ data: newBlock as any });
                  setNewBlock({ start_date: "", end_date: "", reason: "vacation", notes: "" });
                  qc.invalidateQueries({ queryKey: ["cal-blocks"] });
                  toast.success("Dates blocked");
                }}
              >
                <Plus className="h-4 w-4" /> Block these dates
              </Button>
            </div>

            {/* Block list */}
            {(blocks.data?.length ?? 0) > 0 && (
              <div className="mt-5 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Upcoming blocked dates</p>
                {blocks.data?.map((b: any) => {
                  const reasonLabel = BLOCK_REASONS.find((r) => r.value === b.reason)?.label ?? b.reason.replace("_", " ");
                  return (
                    <div key={b.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarOff className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div>
                          <span className="font-medium">
                            {formatDate(b.start_date)}{b.end_date !== b.start_date ? ` – ${formatDate(b.end_date)}` : ""}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px] h-4">{reasonLabel}</Badge>
                            {b.notes && <span className="text-xs text-muted-foreground">{b.notes}</span>}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await delBlock({ data: { id: b.id } });
                          qc.invalidateQueries({ queryKey: ["cal-blocks"] });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            {blocks.data?.length === 0 && (
              <p className="mt-4 text-center text-sm text-muted-foreground">No blocked dates.</p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

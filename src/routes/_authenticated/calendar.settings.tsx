import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Settings2, Plus, Trash2, ArrowLeft } from "lucide-react";
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
      { title: "Availability — MelaBridge Calendar" },
      { name: "description", content: "Configure your business hours, blocked dates, and booking rules." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CalendarSettingsPage,
});

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

  const [newWindow, setNewWindow] = useState({ weekday: 1, start_time: "09:00", end_time: "17:00" });
  const [newBlock, setNewBlock] = useState({ start_date: "", end_date: "", reason: "day_off" as const, notes: "" });

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

  return (
    <AppShell active="/calendar">
      <Link to="/calendar" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to calendar
      </Link>

      <div className="mt-2">
        <PageHeader
          eyebrow="Availability"
          icon={Settings2}
          title={<>Set your <span className="text-gradient">availability rules</span>.</>}
          description="Business hours, days off, buffers, and vacation mode."
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Business hours */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Business hours</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add one or more windows per day.</p>
          <div className="mt-4 space-y-2">
            {availability.data?.length === 0 && <p className="text-sm text-muted-foreground">No windows yet.</p>}
            {availability.data?.map((w: any) => (
              <div key={w.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <Switch
                  checked={w.is_active}
                  onCheckedChange={async (v) => {
                    await upAvail({ data: { id: w.id, weekday: w.weekday, start_time: w.start_time, end_time: w.end_time, is_active: v } });
                    qc.invalidateQueries({ queryKey: ["cal-avail"] });
                  }}
                />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{WEEKDAYS[w.weekday]}</span>{" "}
                  <span className="text-muted-foreground">{w.start_time?.slice(0,5)} – {w.end_time?.slice(0,5)}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={async () => {
                    await delAvail({ data: { id: w.id } });
                    qc.invalidateQueries({ queryKey: ["cal-avail"] });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select value={String(newWindow.weekday)} onValueChange={(v) => setNewWindow({ ...newWindow, weekday: Number(v) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WEEKDAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="time" value={newWindow.start_time} onChange={(e) => setNewWindow({ ...newWindow, start_time: e.target.value })} />
            <Input type="time" value={newWindow.end_time} onChange={(e) => setNewWindow({ ...newWindow, end_time: e.target.value })} />
            <Button
              onClick={async () => {
                await upAvail({ data: { ...newWindow, is_active: true } });
                qc.invalidateQueries({ queryKey: ["cal-avail"] });
                toast.success("Added");
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add
            </Button>
          </div>
        </Card>

        {/* Booking rules */}
        <Card className="p-5">
          <h3 className="font-display text-lg font-semibold">Booking rules</h3>
          <p className="mt-1 text-sm text-muted-foreground">Buffers, event caps, and travel-day blocking.</p>
          {settings.data && (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Buffer before (min)</Label>
                  <Input type="number" min={0} defaultValue={settings.data.buffer_before_minutes}
                    onBlur={(e) => onSaveSettings({ buffer_before_minutes: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Buffer after (min)</Label>
                  <Input type="number" min={0} defaultValue={settings.data.buffer_after_minutes}
                    onBlur={(e) => onSaveSettings({ buffer_after_minutes: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>Max events per day</Label>
                <Input type="number" min={1} defaultValue={settings.data.max_events_per_day}
                  onBlur={(e) => onSaveSettings({ max_events_per_day: Number(e.target.value) })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Block travel days</p>
                  <p className="text-xs text-muted-foreground">Warn on back-to-back bookings in different cities.</p>
                </div>
                <Switch
                  checked={settings.data.block_travel_days}
                  onCheckedChange={(v) => onSaveSettings({ block_travel_days: v })}
                />
              </div>
              <div>
                <Label>Vacation mode</Label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <Input type="date" defaultValue={settings.data.vacation_start ?? ""}
                    onBlur={(e) => onSaveSettings({ vacation_start: e.target.value || null })} />
                  <Input type="date" defaultValue={settings.data.vacation_end ?? ""}
                    onBlur={(e) => onSaveSettings({ vacation_end: e.target.value || null })} />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Blocked dates */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold">Blocked dates</h3>
          <p className="mt-1 text-sm text-muted-foreground">Days off, vacations, and travel days.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            <Input type="date" value={newBlock.start_date} onChange={(e) => setNewBlock({ ...newBlock, start_date: e.target.value })} placeholder="Start" />
            <Input type="date" value={newBlock.end_date} onChange={(e) => setNewBlock({ ...newBlock, end_date: e.target.value })} placeholder="End" />
            <Select value={newBlock.reason} onValueChange={(v: any) => setNewBlock({ ...newBlock, reason: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day_off">Day off</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="travel">Travel</SelectItem>
              </SelectContent>
            </Select>
            <Textarea rows={1} className="min-h-[38px]" value={newBlock.notes} onChange={(e) => setNewBlock({ ...newBlock, notes: e.target.value })} placeholder="Notes (optional)" />
            <Button
              onClick={async () => {
                if (!newBlock.start_date || !newBlock.end_date) return toast.error("Pick dates");
                await addBlock({ data: newBlock });
                setNewBlock({ start_date: "", end_date: "", reason: "day_off", notes: "" });
                qc.invalidateQueries({ queryKey: ["cal-blocks"] });
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Block
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {blocks.data?.length === 0 && <p className="text-sm text-muted-foreground">No blocked dates.</p>}
            {blocks.data?.map((b: any) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-2 text-sm">
                <div>
                  <span className="font-medium">{b.start_date}</span>
                  {b.end_date !== b.start_date && <> → <span className="font-medium">{b.end_date}</span></>}
                  <span className="ml-2 text-muted-foreground">{b.reason.replace("_", " ")}{b.notes ? ` · ${b.notes}` : ""}</span>
                </div>
                <Button size="icon" variant="ghost" onClick={async () => { await delBlock({ data: { id: b.id } }); qc.invalidateQueries({ queryKey: ["cal-blocks"] }); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

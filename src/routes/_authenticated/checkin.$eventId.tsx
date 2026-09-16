/**
 * Mobile check-in scanner for event organizers.
 * Route: /checkin/:eventId  (authenticated, owner-only)
 *
 * Three tabs:
 *  • Scanner  – live camera QR scanner
 *  • Search   – manual attendee search + check-in
 *  • All      – full scrollable attendee list
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useEffect, useRef, useState, useCallback, useMemo,
  type RefObject,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, CheckCircle2, XCircle, AlertTriangle, Camera, CameraOff,
  Search, Users, Loader2, ScanLine, RotateCcw, Check, Clock,
  Ticket, RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/app-shell";
import {
  getCheckinData, checkInByQrCode,
  undoCheckInAttendee,
} from "@/lib/tickets.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/checkin/$eventId")({
  head: () => ({ meta: [{ title: "Check-in Scanner — MelaBridge" }] }),
  component: CheckinPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type AttendeeRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  qr_code: string | null;
  checked_in_at: string | null;
  order_id: string;
  ticket_orders?: {
    ticket_type_id?: string | null;
    ticket_types?: { name?: string | null } | null;
  } | null;
};

type ScanResult =
  | { type: "success"; attendeeName: string | null; typeName: string; checkedInAt: string }
  | { type: "already_checked_in"; attendeeName: string | null; typeName: string; checkedInAt: string }
  | { type: "wrong_event" }
  | { type: "invalid" }
  | { type: "cancelled" }
  | { type: "unauthorized" }
  | { type: "error" };

type Tab = "scanner" | "search" | "all";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  } catch { return iso; }
}

function fmtDate(date?: string | null, time?: string | null) {
  if (!date) return null;
  try {
    const d = new Date(`${date}T${time ?? "00:00"}`);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) +
      (time ? `, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}` : "");
  } catch { return date; }
}

/** Extract ticket code from scanned QR value.
 *  Accepts full URL (/ticket/CODE) or raw code strings. */
function extractTicketCode(raw: string): string | null {
  raw = raw.trim();
  // URL form: https://…/ticket/CODE
  const match = raw.match(/\/ticket\/([a-zA-Z0-9_-]{8,})/);
  if (match) return match[1];
  // Raw hex token: 32–128 hex chars
  if (/^[a-f0-9]{32,128}$/i.test(raw)) return raw;
  return null;
}

function attendeeTypeName(a: AttendeeRow): string {
  return (a.ticket_orders as AttendeeRow["ticket_orders"])?.ticket_types?.name ?? "Admission";
}

// ── Main page ─────────────────────────────────────────────────────────────────

function CheckinPage() {
  const { eventId } = Route.useParams();
  const [loadState, setLoadState] = useState<"loading" | "ok" | "unauthorized" | "error">("loading");
  const [event, setEvent] = useState<{ id: string; name: string; event_date?: string | null; event_time?: string | null; location?: string | null } | null>(null);
  const [attendees, setAttendees] = useState<AttendeeRow[]>([]);
  const [tab, setTab] = useState<Tab>("scanner");
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [realtimeLive, setRealtimeLive] = useState<boolean | null>(null);

  const getFn = useServerFn(getCheckinData);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoadState("loading");
    try {
      const d = await getFn({ data: { eventId } });
      if (!d.authorized) { setLoadState("unauthorized"); return; }
      setEvent(d.event);
      setAttendees(d.attendees as AttendeeRow[]);
      setLoadState("ok");
      setLastRefresh(Date.now());
    } catch (err) {
      setLoadState("error");
      if (silent) toast.error("Failed to refresh attendee list");
    }
  }, [eventId, getFn]);

  useEffect(() => { load(); }, [load]);

  // Refresh attendee list every 30 s (fallback when realtime drops)
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  // Supabase realtime: push check-in changes from other devices instantly
  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      channel = supabase
        .channel(`checkin-${eventId}`)
        .on(
          "postgres_changes" as never,
          {
            event: "*",
            schema: "public",
            table: "ticket_attendees",
            filter: `event_id=eq.${eventId}`,
          },
          (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            if (payload.eventType === "UPDATE") {
              const updated = payload.new as AttendeeRow;
              setAttendees((prev) =>
                prev.map((a) =>
                  a.id === updated.id
                    ? { ...a, checked_in_at: updated.checked_in_at }
                    : a
                )
              );
            } else if (payload.eventType === "INSERT") {
              // New attendee needs joined data — do a silent refresh
              load(true);
            } else if (payload.eventType === "DELETE") {
              const deleted = payload.old as { id: string };
              setAttendees((prev) => prev.filter((a) => a.id !== deleted.id));
            }
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            setRealtimeLive(true);
          } else if (
            status === "CHANNEL_ERROR" ||
            status === "TIMED_OUT" ||
            status === "CLOSED"
          ) {
            setRealtimeLive(false);
          }
        });
    } catch (err) {
      // Supabase unavailable — polling fallback already active
      setRealtimeLive(false);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [eventId, load]);

  const stats = useMemo(() => {
    const total = attendees.length;
    const checkedIn = attendees.filter((a) => !!a.checked_in_at).length;
    return { total, checkedIn, remaining: total - checkedIn };
  }, [attendees]);

  /** Called after a successful scan/manual check-in to update local state immediately */
  function applyCheckIn(attendeeId: string, checkedInAt: string) {
    setAttendees((prev) =>
      prev.map((a) => a.id === attendeeId ? { ...a, checked_in_at: checkedInAt } : a)
    );
  }

  function applyUndoCheckIn(attendeeId: string) {
    setAttendees((prev) =>
      prev.map((a) => a.id === attendeeId ? { ...a, checked_in_at: null } : a)
    );
  }

  // ── Loading / error states ─────────────────────────────────────────

  if (loadState === "loading") {
    return (
      <AppShell active="/events">
        <div className="grid min-h-[50vh] place-items-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (loadState === "unauthorized") {
    return (
      <AppShell active="/events">
        <Card className="border-border/60 p-10 text-center shadow-soft max-w-sm mx-auto mt-16">
          <XCircle className="mx-auto mb-4 h-10 w-10 text-destructive" />
          <h2 className="font-display text-xl font-semibold">Not authorized</h2>
          <p className="mt-2 text-sm text-muted-foreground">Only the event organizer can access the check-in scanner.</p>
          <Button asChild variant="outline" className="mt-5">
            <Link to="/events">Back to events</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  if (loadState === "error") {
    return (
      <AppShell active="/events">
        <Card className="border-border/60 p-10 text-center shadow-soft max-w-sm mx-auto mt-16">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
          <h2 className="font-display text-xl font-semibold">Could not load event</h2>
          <Button className="mt-5 gap-2" onClick={() => load()}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </Card>
      </AppShell>
    );
  }

  // ── Main UI ────────────────────────────────────────────────────────

  return (
    <AppShell active="/events">
      <div className="mx-auto max-w-lg space-y-4 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Back to event">
            <Link to={`/events/${eventId}` as never}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold">{event?.name}</h1>
            {fmtDate(event?.event_date, event?.event_time) && (
              <p className="truncate text-xs text-muted-foreground">{fmtDate(event?.event_date, event?.event_time)}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {realtimeLive !== null && (
              <span
                title={realtimeLive ? "Live updates active" : "Live updates disconnected — using 30s polling"}
                aria-label={realtimeLive ? "Live updates active" : "Live updates disconnected"}
                className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                  realtimeLive ? "text-emerald-500" : "text-muted-foreground/50"
                }`}
              >
                {realtimeLive ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
              </span>
            )}
            <button
              onClick={() => load(true)}
              aria-label="Refresh"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Counter strip */}
        <div className="grid grid-cols-3 gap-2">
          <StatPill label="Checked in" value={stats.checkedIn} accent />
          <StatPill label="Total" value={stats.total} />
          <StatPill label="Remaining" value={stats.remaining} />
        </div>

        {/* Tab bar */}
        <div className="flex rounded-xl border border-border/60 bg-muted/30 p-1">
          {(["scanner", "search", "all"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition ${
                tab === t ? "bg-background shadow-soft text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "scanner" && <ScanLine className="h-4 w-4" />}
              {t === "search" && <Search className="h-4 w-4" />}
              {t === "all" && <Users className="h-4 w-4" />}
              <span className="capitalize">{t === "all" ? `All (${stats.total})` : t}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === "scanner" && (
          <ScannerTab
            eventId={eventId}
            onCheckIn={applyCheckIn}
          />
        )}
        {tab === "search" && (
          <SearchTab
            eventId={eventId}
            attendees={attendees}
            onCheckIn={applyCheckIn}
            onUndoCheckIn={applyUndoCheckIn}
          />
        )}
        {tab === "all" && (
          <AllAttendeesTab
            attendees={attendees}
            eventId={eventId}
            onCheckIn={applyCheckIn}
            onUndoCheckIn={applyUndoCheckIn}
          />
        )}
      </div>
    </AppShell>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${accent ? "border-primary/30 bg-primary/5" : "border-border/60 bg-card"}`}>
      <p className={`font-display text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

// ── Scanner tab ───────────────────────────────────────────────────────────────

type ScannerTabProps = {
  eventId: string;
  onCheckIn: (id: string, at: string) => void;
};

type CameraPermission = "prompt" | "granted" | "denied" | "error";

function ScannerTab({ eventId, onCheckIn }: ScannerTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastCodeRef = useRef<{ code: string; ts: number } | null>(null);

  const [permission, setPermission] = useState<CameraPermission>("prompt");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const checkInFn = useServerFn(checkInByQrCode);

  const handleCode = useCallback(async (raw: string) => {
    if (processing) return;
    const code = extractTicketCode(raw);
    if (!code) return;

    // Debounce: ignore same code within 3 s
    const now = Date.now();
    if (lastCodeRef.current?.code === code && now - lastCodeRef.current.ts < 3000) return;
    lastCodeRef.current = { code, ts: now };

    scanningRef.current = false;
    setProcessing(true);
    try {
      const result = await checkInFn({ data: { eventId, qrCode: code } });
      if (result.type === "success") {
        onCheckIn(result.attendee.id, result.checkedInAt);
      }
      setScanResult(
        result.type === "success" || result.type === "already_checked_in"
          ? {
              type: result.type,
              attendeeName: result.attendee.full_name,
              typeName: result.typeName,
              checkedInAt: result.checkedInAt,
            }
          : { type: result.type },
      );
      setProcessing(false);
    } catch {
      setProcessing(false);
      setScanResult({ type: "error" });
    }
  }, [processing, checkInFn, eventId, onCheckIn]);

  const startScanLoop = useCallback(function startScanLoop(
    vRef: RefObject<HTMLVideoElement | null>,
    cRef: RefObject<HTMLCanvasElement | null>
  ) {
    const hasBarcodeDetector =
      typeof window !== "undefined" && "BarcodeDetector" in window;

    if (hasBarcodeDetector) {
      // @ts-expect-error — BarcodeDetector is not in TS lib yet
      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      async function loopDetector() {
        // Always reschedule — only skip detection while paused (overlay showing)
        if (!scanningRef.current) { requestAnimationFrame(loopDetector); return; }
        const video = vRef.current;
        if (video && video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            if (codes.length > 0) await handleCode(codes[0].rawValue);
          } catch { /* ignore */ }
        }
        requestAnimationFrame(loopDetector);
      }
      requestAnimationFrame(loopDetector);
    } else {
      // jsQR fallback
      async function loopJsQR() {
        if (!scanningRef.current) { requestAnimationFrame(loopJsQR); return; }
        const video = vRef.current;
        const canvas = cRef.current;
        if (video && canvas && video.readyState >= 2) {
          const w = video.videoWidth;
          const h = video.videoHeight;
          if (w > 0 && h > 0) {
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(video, 0, 0, w, h);
              const imgData = ctx.getImageData(0, 0, w, h);
              // Dynamic import so bundle doesn't load on browsers with BarcodeDetector
              type JsQrFn = (data: Uint8ClampedArray, w: number, h: number, opts?: { inversionAttempts?: string }) => { data: string } | null;
              const mod = await import("jsqr" as string) as { default?: JsQrFn } | JsQrFn;
              const jsQR: JsQrFn = (typeof mod === "function" ? mod : (mod as { default?: JsQrFn }).default) as JsQrFn;
              const result = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: "dontInvert" });
              if (result) await handleCode(result.data);
            }
          }
        }
        requestAnimationFrame(loopJsQR);
      }
      requestAnimationFrame(loopJsQR);
    }
  }, [handleCode]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setPermission("granted");
      scanningRef.current = true;
      startScanLoop(videoRef, canvasRef);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("denied") || msg.toLowerCase().includes("permission")) {
        setPermission("denied");
      } else {
        setPermission("error");
      }
    }
  }, [startScanLoop]);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  function dismissResult() {
    setScanResult(null);
    scanningRef.current = true;
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (permission === "denied" || permission === "error") {
    return (
      <Card className="border-border/60 p-8 shadow-soft text-center space-y-4">
        <CameraOff className="mx-auto h-10 w-10 text-muted-foreground" />
        <div>
          <h3 className="font-display font-semibold">Camera access needed</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {permission === "denied"
              ? "Camera permission was denied. To enable it, open your browser settings, find this site under Site Permissions, and allow camera access. Then reload this page."
              : "Could not access camera. Make sure no other app is using it, then reload."}
          </p>
        </div>
        <Button className="gap-2" onClick={() => { setPermission("prompt"); startCamera(); }}>
          <Camera className="h-4 w-4" /> Try again
        </Button>
        <p className="text-xs text-muted-foreground">
          You can still use the <strong>Search</strong> tab to manually check in attendees.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Camera viewfinder */}
      <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4] sm:aspect-video w-full">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="h-full w-full object-cover"
          aria-label="Camera viewfinder"
        />
        {/* Hidden canvas for jsQR */}
        <canvas ref={canvasRef} className="hidden" aria-hidden />

        {/* Scan zone overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {/* Dark overlay with cutout effect via box-shadow */}
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative z-10 h-52 w-52 sm:h-64 sm:w-64"
            style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }}
          >
            {/* Corner brackets */}
            {[
              "top-0 left-0 border-t-4 border-l-4",
              "top-0 right-0 border-t-4 border-r-4",
              "bottom-0 left-0 border-b-4 border-l-4",
              "bottom-0 right-0 border-b-4 border-r-4",
            ].map((cls, i) => (
              <span key={i} className={`absolute h-8 w-8 border-primary rounded-sm ${cls}`} />
            ))}
          </div>
        </div>

        {/* Processing spinner */}
        {processing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <Loader2 className="h-10 w-10 animate-spin text-white" />
          </div>
        )}

        {/* Scan result overlay */}
        {scanResult && !processing && (
          <ScanResultOverlay result={scanResult} onDismiss={dismissResult} />
        )}

        {/* Instruction label */}
        {!processing && !scanResult && permission === "granted" && (
          <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
            <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs text-white/90 backdrop-blur-sm">
              Point at attendee's QR code
            </span>
          </div>
        )}

        {/* Waiting for camera */}
        {permission === "prompt" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70">
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </div>
          </div>
        )}
      </div>

      {/* Reset button */}
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => {
          dismissResult();
          if (!streamRef.current) startCamera();
        }}
      >
        <RotateCcw className="h-4 w-4" /> Reset scanner
      </Button>
    </div>
  );
}

// ── Scan result overlay ───────────────────────────────────────────────────────

function ScanResultOverlay({ result, onDismiss }: { result: ScanResult; onDismiss: () => void }) {
  const isSuccess = result.type === "success";
  const isAlreadyIn = result.type === "already_checked_in";
  const isInvalid = result.type === "invalid" || result.type === "wrong_event" || result.type === "cancelled" || result.type === "unauthorized" || result.type === "error";

  const bg = isSuccess ? "bg-emerald-600/90" : isAlreadyIn ? "bg-amber-500/90" : "bg-destructive/90";
  const icon = isSuccess
    ? <CheckCircle2 className="h-16 w-16 text-white" />
    : isAlreadyIn
    ? <Clock className="h-16 w-16 text-white" />
    : <XCircle className="h-16 w-16 text-white" />;

  let heading = "";
  let sub = "";
  if (result.type === "success") {
    heading = "Check-in successful";
    sub = [result.attendeeName ?? "Guest", "·", result.typeName].filter(Boolean).join(" ");
  } else if (result.type === "already_checked_in") {
    heading = "Already checked in";
    sub = `${result.attendeeName ?? "Guest"} · Checked in at ${fmtTime(result.checkedInAt)}`;
  } else if (result.type === "wrong_event") {
    heading = "Wrong event";
    sub = "This ticket belongs to a different event.";
  } else if (result.type === "cancelled") {
    heading = "Ticket cancelled";
    sub = "This order was refunded or cancelled.";
  } else if (result.type === "unauthorized") {
    heading = "Access denied";
    sub = "Your organizer session can no longer check in this event.";
  } else if (result.type === "error") {
    heading = "Scanner unavailable";
    sub = "The check-in could not be confirmed. Check your connection and try this ticket again.";
  } else {
    heading = "Invalid ticket";
    sub = "This QR code was not recognized.";
  }

  return (
    <button
      className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 ${bg} backdrop-blur-sm`}
      onClick={onDismiss}
      aria-label="Dismiss scan result"
    >
      {icon}
      <div className="text-center text-white">
        <p className="font-display text-2xl font-bold">{heading}</p>
        {sub && <p className="mt-1 text-sm opacity-90">{sub}</p>}
      </div>
      <p className="text-xs text-white/70">Tap to scan next ticket</p>
    </button>
  );
}

// ── Search tab ────────────────────────────────────────────────────────────────

type SearchTabProps = {
  eventId: string;
  attendees: AttendeeRow[];
  onCheckIn: (id: string, at: string) => void;
  onUndoCheckIn: (id: string) => void;
};

function SearchTab({ eventId, attendees, onCheckIn, onUndoCheckIn }: SearchTabProps) {
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const checkInFn = useServerFn(checkInByQrCode);
  const undoFn = useServerFn(undoCheckInAttendee);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return attendees.filter(
      (a) =>
        (a.full_name?.toLowerCase().includes(q) ?? false) ||
        (a.email?.toLowerCase().includes(q) ?? false)
    ).slice(0, 30);
  }, [query, attendees]);

  async function handleCheckIn(a: AttendeeRow) {
    if (!a.qr_code) { toast.error("This attendee has no QR code"); return; }
    setBusyId(a.id);
    try {
      const result = await checkInFn({ data: { eventId, qrCode: a.qr_code } });
      if (result.type === "success") {
        onCheckIn(result.attendee.id, result.checkedInAt);
        toast.success(`${a.full_name ?? "Attendee"} checked in`);
      } else if (result.type === "already_checked_in") {
        toast.info(`Already checked in at ${fmtTime(result.checkedInAt)}`);
      } else {
        toast.error("Could not check in this attendee");
      }
    } catch {
      toast.error("Check-in failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo(a: AttendeeRow) {
    setBusyId(a.id);
    try {
      await undoFn({ data: { id: a.id } });
      onUndoCheckIn(a.id);
      toast.success("Check-in reversed");
    } catch {
      toast.error("Could not undo check-in");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {query.trim() === "" && (
        <p className="py-8 text-center text-sm text-muted-foreground">Type a name or email above to find an attendee.</p>
      )}

      {query.trim() !== "" && results.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No attendees match &ldquo;{query}&rdquo;</p>
      )}

      <div className="space-y-2">
        {results.map((a) => (
          <AttendeeRow
            key={a.id}
            attendee={a}
            busy={busyId === a.id}
            onCheckIn={() => handleCheckIn(a)}
            onUndo={() => handleUndo(a)}
          />
        ))}
      </div>
    </div>
  );
}

// ── All attendees tab ─────────────────────────────────────────────────────────

type AllAttendeesTabProps = {
  attendees: AttendeeRow[];
  eventId: string;
  onCheckIn: (id: string, at: string) => void;
  onUndoCheckIn: (id: string) => void;
};

function AllAttendeesTab({ attendees, eventId, onCheckIn, onUndoCheckIn }: AllAttendeesTabProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const checkInFn = useServerFn(checkInByQrCode);
  const undoFn = useServerFn(undoCheckInAttendee);

  // Sort: unchecked first, then alphabetically
  const sorted = useMemo(() =>
    [...attendees].sort((a, b) => {
      if (!!a.checked_in_at !== !!b.checked_in_at) return a.checked_in_at ? 1 : -1;
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    }),
    [attendees]
  );

  async function handleCheckIn(a: AttendeeRow) {
    if (!a.qr_code) { toast.error("This attendee has no QR code"); return; }
    setBusyId(a.id);
    try {
      const result = await checkInFn({ data: { eventId, qrCode: a.qr_code } });
      if (result.type === "success") {
        onCheckIn(result.attendee.id, result.checkedInAt);
        toast.success(`${a.full_name ?? "Attendee"} checked in`);
      } else if (result.type === "already_checked_in") {
        toast.info(`Already checked in at ${fmtTime(result.checkedInAt)}`);
      } else {
        toast.error("Could not check in this attendee");
      }
    } catch {
      toast.error("Check-in failed");
    } finally {
      setBusyId(null);
    }
  }

  async function handleUndo(a: AttendeeRow) {
    setBusyId(a.id);
    try {
      await undoFn({ data: { id: a.id } });
      onUndoCheckIn(a.id);
      toast.success("Check-in reversed");
    } catch {
      toast.error("Could not undo check-in");
    } finally {
      setBusyId(null);
    }
  }

  if (sorted.length === 0) {
    return (
      <Card className="border-border/60 p-10 shadow-soft text-center">
        <Ticket className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No attendees yet.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map((a) => (
        <AttendeeRow
          key={a.id}
          attendee={a}
          busy={busyId === a.id}
          onCheckIn={() => handleCheckIn(a)}
          onUndo={() => handleUndo(a)}
        />
      ))}
    </div>
  );
}

// ── Shared attendee row ───────────────────────────────────────────────────────

function AttendeeRow({
  attendee: a,
  busy,
  onCheckIn,
  onUndo,
}: {
  attendee: AttendeeRow;
  busy: boolean;
  onCheckIn: () => void;
  onUndo: () => void;
}) {
  const typeName = attendeeTypeName(a);
  const checkedIn = !!a.checked_in_at;

  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
      checkedIn ? "border-border/40 bg-muted/20" : "border-border/60 bg-card"
    }`}>
      {/* Status icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        checkedIn ? "bg-emerald-100 text-emerald-600" : "bg-muted text-muted-foreground"
      }`}>
        {checkedIn ? <Check className="h-4 w-4" /> : <Ticket className="h-4 w-4" />}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${checkedIn ? "text-muted-foreground" : ""}`}>
          {a.full_name ?? "Guest"}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-xs text-muted-foreground">{typeName}</span>
          {checkedIn && a.checked_in_at && (
            <span className="text-xs text-emerald-600">· {fmtTime(a.checked_in_at)}</span>
          )}
        </div>
      </div>

      {/* Action */}
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : checkedIn ? (
        <button
          onClick={onUndo}
          className="shrink-0 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition"
          aria-label={`Undo check-in for ${a.full_name ?? "guest"}`}
        >
          Undo
        </button>
      ) : (
        <button
          onClick={onCheckIn}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition"
          aria-label={`Check in ${a.full_name ?? "guest"}`}
        >
          Check in
        </button>
      )}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { MessageSquare, Send, Sparkles, Megaphone, Clock, FileText, Bell, Loader2, Trash2, Copy, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/messaging")({
  head: () => ({ meta: [
    { title: "Messaging — MelaBridge" },
    { name: "description", content: "One hub for internal, vendor, and guest conversations with AI drafts." },
    { name: "robots", content: "noindex" },
  ]}),
  component: MessagingPage,
});

type Thread = { id:string; who:string; last:string; unread:number; type:"Internal"|"Vendor"|"Guest"; };
const THREADS: Thread[] = [
  { id:"m1", who:"Sofia Onyema · Planner", last:"Sent updated seating v3 — take a look?", unread:2, type:"Internal" },
  { id:"m2", who:"Studio Nero · Photography", last:"Timeline looks great. See you Oct 17!", unread:0, type:"Vendor" },
  { id:"m3", who:"Priya Rao", last:"Confirming vegan meal for me and my +1", unread:1, type:"Guest" },
  { id:"m4", who:"Onyema Catering", last:"Deposit invoice attached", unread:1, type:"Vendor" },
  { id:"m5", who:"Chinwe Adekunle", last:"Bridal party dress fitting Saturday?", unread:0, type:"Internal" },
];

const TEMPLATES: { key: string; title: string; body: string }[] = [
  { key: "rsvp-nudge", title: "RSVP nudge (7d)", body: "Hi {name}, just a friendly reminder that RSVPs close in 7 days. Tap the link in your invite to confirm — can't wait to celebrate with you!" },
  { key: "vendor-deposit", title: "Vendor deposit reminder", body: "Hi {vendor}, this is a friendly reminder that the deposit invoice is due. Let me know if you need a fresh copy of the invoice." },
  { key: "travel-details", title: "Travel details", body: "Hi {name}, here are your travel details: hotel block, arrival window, and transfer info are attached. Reply if anything looks off." },
  { key: "thank-you", title: "Thank-you follow-up", body: "Thank you so much for being part of our celebration — it wouldn't have been the same without you." },
  { key: "registry", title: "Registry acknowledgement", body: "Thank you so much for the thoughtful gift — we're so grateful for you." },
  { key: "weather", title: "Weather update", body: "Quick heads up: weather may shift for the event. We've updated the plan — please dress accordingly." },
];

const NOTIFICATION_CHANNELS = [
  { key: "guest_replies", label: "Guest replies" },
  { key: "vendor_messages", label: "Vendor messages" },
  { key: "team_mentions", label: "Team @mentions" },
  { key: "ai_approvals", label: "AI action approvals" },
  { key: "weekly_digest", label: "Weekly digest" },
];

type ComposeState = {
  open: boolean;
  editingId?: string;
  subject: string;
  body: string;
  recipients: string;
  sendAt: string; // ISO local "YYYY-MM-DDTHH:mm"
  templateKey?: string;
};

const emptyCompose: ComposeState = { open: false, subject: "", body: "", recipients: "", sendAt: "", templateKey: undefined };

function MessagingPage() {
  const [active, setActive] = useState(THREADS[0]);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [compose, setCompose] = useState<ComposeState>(emptyCompose);

  // --- Scheduled messages ---
  const scheduledQ = useQuery({
    queryKey: ["scheduled-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_messages")
        .select("*")
        .order("send_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saveMsg = useMutation({
    mutationFn: async (input: ComposeState & { immediate?: boolean }) => {
      if (!user) throw new Error("Sign in required");
      const sendAtISO = input.immediate ? new Date().toISOString() : new Date(input.sendAt || Date.now()).toISOString();
      const recipients = input.recipients.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        subject: input.subject,
        body: input.body,
        recipients,
        send_at: sendAtISO,
        template_key: input.templateKey ?? null,
        status: input.immediate ? "sent" : "scheduled",
        user_id: user.id,
      };
      if (input.editingId) {
        const { error } = await supabase.from("scheduled_messages").update(payload).eq("id", input.editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("scheduled_messages").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      setCompose(emptyCompose);
      toast.success(vars.immediate ? "Message sent" : vars.editingId ? "Changes saved" : "Message scheduled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMsg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("scheduled_messages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicateMsg = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Sign in required");
      const src = (scheduledQ.data ?? []).find((m) => m.id === id);
      if (!src) throw new Error("Not found");
      const { error } = await supabase.from("scheduled_messages").insert({
        user_id: user.id,
        subject: src.subject,
        body: src.body,
        recipients: src.recipients,
        send_at: src.send_at,
        template_key: src.template_key,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      toast.success("Duplicated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCompose(overrides: Partial<ComposeState> = {}) {
    const nowLocal = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);
    setCompose({ ...emptyCompose, open: true, sendAt: nowLocal, ...overrides });
  }

  function useTemplate(t: typeof TEMPLATES[number]) {
    openCompose({ subject: t.title, body: t.body, templateKey: t.key });
  }

  function editScheduled(m: NonNullable<typeof scheduledQ.data>[number]) {
    const local = new Date(m.send_at).toISOString().slice(0, 16);
    setCompose({
      open: true,
      editingId: m.id,
      subject: m.subject ?? "",
      body: m.body ?? "",
      recipients: (m.recipients ?? []).join(", "),
      sendAt: local,
      templateKey: m.template_key ?? undefined,
    });
  }

  function aiRewrite() {
    // Lightweight local personalization — swap placeholders and add warm opener.
    const rewritten = compose.body
      .replace(/\{name\}/gi, "friend")
      .replace(/\{vendor\}/gi, "team")
      .trim();
    setCompose((c) => ({ ...c, body: `Hi there,\n\n${rewritten}\n\nWarmly,` }));
    toast.success("AI rewrote your draft");
  }

  return (
    <AppShell active="/messaging">
      <PageHeader
        eyebrow="Messaging Center"
        icon={MessageSquare}
        title={<>One inbox for <span className="text-gradient">everyone</span> planning with you.</>}
        description="Internal chats, vendor threads, and guest replies — all in one hub with AI-drafted replies and templates."
        actions={<>
          <Button variant="outline" onClick={() => openCompose({ subject: "Announcement" })}><Megaphone className="mr-2 h-4 w-4"/>Announcement</Button>
          <Button variant="hero" onClick={() => openCompose()}><Send className="mr-2 h-4 w-4"/>New message</Button>
        </>}
      />

      <Tabs defaultValue="inbox" className="mt-8">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="settings">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <div className="rounded-3xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {THREADS.map(t=>(
                  <li key={t.id}>
                    <button onClick={()=>setActive(t)} className={`w-full px-4 py-3 text-left transition ${active.id===t.id?"bg-accent/60":"hover:bg-accent/30"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t.who}</p>
                        {t.unread>0 && <Badge className="bg-primary text-primary-foreground">{t.unread}</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.last}</p>
                      <Badge variant="secondary" className="mt-2">{t.type}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{active.who}</h3>
                <Badge variant="secondary">{active.type}</Badge>
              </div>
              <div className="space-y-3">
                <Msg from={active.who} text={active.last}/>
                <Msg mine text="Thank you! I'll review tonight and circle back tomorrow morning."/>
                <Msg from={active.who} text="Perfect — no rush."/>
              </div>
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>AI-drafted reply · matches your voice</div>
                <Textarea className="bg-background" defaultValue="Reviewed the seating chart — table 3 needs one swap (Priya + Elena). Otherwise looking clean. Sending marked-up version in 10."/>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="hero" size="sm" onClick={() => toast.success("Reply sent")}><Send className="mr-2 h-4 w-4"/>Approve & send</Button>
                  <Button variant="outline" size="sm" onClick={() => toast("Tone editor coming soon")}>Edit tone</Button>
                  <Button variant="ghost" size="sm" onClick={() => toast("Snoozed for 4h")}>Snooze</Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map(t=>(
              <div key={t.key} className="rounded-2xl border border-border bg-card p-4">
                <FileText className="h-5 w-5 text-primary"/>
                <p className="mt-2 font-medium">{t.title}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
                <Button size="sm" variant="hero" className="mt-3" onClick={() => useTemplate(t)}>
                  Use template
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4 space-y-2">
          {!user && <p className="text-sm text-muted-foreground">Sign in to view your scheduled messages.</p>}
          {user && scheduledQ.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>}
          {user && !scheduledQ.isLoading && (scheduledQ.data ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground">No scheduled messages yet.</p>
              <Button size="sm" variant="hero" className="mt-3" onClick={() => openCompose()}>Schedule one</Button>
            </div>
          )}
          {(scheduledQ.data ?? []).map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-primary"/>
                <div>
                  <p className="font-medium">{s.subject || "(no subject)"}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.send_at), "PPp")} · {(s.recipients ?? []).length} recipient{(s.recipients ?? []).length === 1 ? "" : "s"}
                    {s.status !== "scheduled" && <> · <Badge variant="secondary" className="ml-1">{s.status}</Badge></>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={() => editScheduled(s)}><Pencil className="mr-1.5 h-3.5 w-3.5"/>Edit</Button>
                <Button size="sm" variant="ghost" onClick={() => duplicateMsg.mutate(s.id)}><Copy className="mr-1.5 h-3.5 w-3.5"/>Duplicate</Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => deleteMsg.mutate(s.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5"/>Delete</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <NotificationSettings />
        </TabsContent>
      </Tabs>

      <ComposeDialog
        state={compose}
        onChange={setCompose}
        onClose={() => setCompose(emptyCompose)}
        onSend={() => saveMsg.mutate({ ...compose, immediate: true })}
        onSchedule={() => saveMsg.mutate(compose)}
        onAiRewrite={aiRewrite}
        saving={saveMsg.isPending}
      />
    </AppShell>
  );
}

function ComposeDialog({
  state, onChange, onClose, onSend, onSchedule, onAiRewrite, saving,
}: {
  state: ComposeState;
  onChange: (s: ComposeState) => void;
  onClose: () => void;
  onSend: () => void;
  onSchedule: () => void;
  onAiRewrite: () => void;
  saving: boolean;
}) {
  return (
    <Dialog open={state.open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.editingId ? "Edit scheduled message" : "Compose message"}</DialogTitle>
          <DialogDescription>
            {state.templateKey ? "Template loaded — personalize and send." : "Draft, schedule, or send immediately."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="msg-recipients">Recipients</Label>
            <Input
              id="msg-recipients"
              placeholder="alex@example.com, priya@example.com"
              value={state.recipients}
              onChange={(e) => onChange({ ...state, recipients: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="msg-subject">Subject</Label>
            <Input
              id="msg-subject"
              value={state.subject}
              onChange={(e) => onChange({ ...state, subject: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="msg-body">Message</Label>
            <Textarea
              id="msg-body"
              rows={6}
              value={state.body}
              onChange={(e) => onChange({ ...state, body: e.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="msg-sendat">Send at</Label>
            <Input
              id="msg-sendat"
              type="datetime-local"
              value={state.sendAt}
              onChange={(e) => onChange({ ...state, sendAt: e.target.value })}
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAiRewrite}>
            <Sparkles className="mr-2 h-4 w-4"/>AI personalize
          </Button>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!state.editingId && (
            <Button variant="outline" onClick={onSend} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}Send now
            </Button>
          )}
          <Button variant="hero" onClick={onSchedule} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Clock className="mr-2 h-4 w-4"/>}
            {state.editingId ? "Save changes" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotificationSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const prefsQ = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("notification_preferences").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const prefsByChannel = useMemo(() => {
    const map = new Map<string, { email: boolean; push: boolean }>();
    (prefsQ.data ?? []).forEach((p) => map.set(p.channel, { email: p.email_enabled, push: p.push_enabled }));
    return map;
  }, [prefsQ.data]);

  const updatePref = useMutation({
    mutationFn: async ({ channel, field, value }: { channel: string; field: "email" | "push"; value: boolean }) => {
      if (!user) throw new Error("Sign in required");
      const current = prefsByChannel.get(channel) ?? { email: true, push: true };
      const next = { ...current, [field]: value };
      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: user.id,
          channel,
          email_enabled: next.email,
          push_enabled: next.push,
        },
        { onConflict: "user_id,channel" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notif-prefs"] });
      toast.success("Preference saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return <p className="text-sm text-muted-foreground">Sign in to manage notifications.</p>;

  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      {prefsQ.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>}
      {NOTIFICATION_CHANNELS.map((n) => {
        const cur = prefsByChannel.get(n.key) ?? { email: true, push: true };
        return (
          <div key={n.key} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-primary"/>
              <span className="text-sm">{n.label}</span>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Email
                <Switch
                  checked={cur.email}
                  disabled={updatePref.isPending}
                  onCheckedChange={(v) => updatePref.mutate({ channel: n.key, field: "email", value: v })}
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Push
                <Switch
                  checked={cur.push}
                  disabled={updatePref.isPending}
                  onCheckedChange={(v) => updatePref.mutate({ channel: n.key, field: "push", value: v })}
                />
              </label>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Msg({ from, mine, text }: { from?:string; mine?:boolean; text:string }) {
  return (
    <div className={`flex ${mine?"justify-end":"justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine?"bg-primary text-primary-foreground":"bg-muted"}`}>
        {from && !mine && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-70">{from}</p>}
        {text}
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare, Send, Sparkles, Megaphone, Clock, FileText, Bell,
  Loader2, Trash2, Copy, Pencil, Pin, PinOff, Star, StarOff, BellOff,
  Archive, ArchiveRestore, MailOpen, Mail, Download, MoreHorizontal,
  Search, Filter, Inbox as InboxIcon, Tag, CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, isToday, isYesterday, isThisWeek } from "date-fns";

export const Route = createFileRoute("/messaging")({
  head: () => ({ meta: [
    { title: "Messaging — MelaBridge" },
    { name: "description", content: "One hub for internal, vendor, and guest conversations with AI drafts, templates, and smart scheduling." },
    { name: "robots", content: "noindex" },
  ]}),
  component: MessagingPage,
});

// Loose casts — full types regenerate after migration approval.
const db = supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
};

type Conversation = {
  id: string;
  owner_id: string;
  title: string | null;
  type: "internal" | "vendor" | "guest" | "payment" | "system";
  is_pinned: boolean;
  is_muted: boolean;
  is_favorite: boolean;
  is_archived: boolean;
  archived_at: string | null;
  deleted_at: string | null;
  labels: string[];
  last_message_at: string;
  last_message_preview: string | null;
  unread_count: number;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "favorites", label: "Favorites" },
  { key: "vendor", label: "Vendors" },
  { key: "guest", label: "Guests" },
  { key: "internal", label: "Internal" },
  { key: "payment", label: "Payments" },
  { key: "attachments", label: "Attachments" },
] as const;
type FilterKey = typeof FILTERS[number]["key"];

const NOTIFICATION_GROUPS = [
  { key: "messages", label: "Messages", desc: "New replies, mentions, and reactions across your inboxes." },
  { key: "ai", label: "AI", desc: "MelaAssist draft approvals and suggested actions." },
  { key: "event", label: "Event activity", desc: "RSVPs, timeline changes, and guest updates." },
  { key: "payments", label: "Payments", desc: "Invoices, receipts, deposits, and past-due nudges." },
  { key: "team", label: "Team", desc: "Assignments, @mentions, and handoffs." },
  { key: "system", label: "System", desc: "Security, billing, and platform updates." },
];

function MessagingPage() {
  const { user } = useRequireAuth();
  const { role } = useRole();

  const [tab, setTab] = useState<"inbox" | "archive" | "trash" | "templates" | "scheduled" | "settings">("inbox");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compose, setCompose] = useState<ComposeState>(emptyCompose);

  const qc = useQueryClient();

  const convQ = useQuery({
    queryKey: ["conversations", user?.id, tab],
    enabled: !!user && (tab === "inbox" || tab === "archive" || tab === "trash"),
    queryFn: async (): Promise<Conversation[]> => {
      let q = db.from("conversations").select("*");
      if (tab === "inbox") q = (q as any).eq("is_archived", false).is("deleted_at", null);
      else if (tab === "archive") q = (q as any).eq("is_archived", true).is("deleted_at", null);
      else q = (q as any).not("deleted_at", "is", null);
      const { data, error } = await (q as any).order("is_pinned", { ascending: false }).order("last_message_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
  });

  const conversations = convQ.data ?? [];

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "unread" && c.unread_count === 0) return false;
      if (filter === "favorites" && !c.is_favorite) return false;
      if ((filter === "vendor" || filter === "guest" || filter === "internal" || filter === "payment") && c.type !== filter) return false;
      if (s && !(`${c.title ?? ""} ${c.last_message_preview ?? ""}`.toLowerCase().includes(s))) return false;
      return true;
    });
  }, [conversations, filter, search]);

  const grouped = useMemo(() => {
    const g: Record<string, Conversation[]> = { Pinned: [], Today: [], Yesterday: [], "This week": [], Earlier: [] };
    for (const c of filtered) {
      if (c.is_pinned) g.Pinned.push(c);
      else {
        const d = new Date(c.last_message_at);
        if (isToday(d)) g.Today.push(c);
        else if (isYesterday(d)) g.Yesterday.push(c);
        else if (isThisWeek(d)) g["This week"].push(c);
        else g.Earlier.push(c);
      }
    }
    return g;
  }, [filtered]);

  const patchConv = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<Conversation> }) => {
      const { error } = await (db.from("conversations") as any).update(patch).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["conversations"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  function bulkArchive() {
    patchConv.mutate({ ids: [...selected], patch: { is_archived: true, archived_at: new Date().toISOString() } as any });
    toast.success(`${selected.size} archived`);
    setSelected(new Set());
  }
  function bulkTrash() {
    patchConv.mutate({ ids: [...selected], patch: { deleted_at: new Date().toISOString() } as any });
    toast.success(`${selected.size} moved to trash`);
    setSelected(new Set());
  }
  function bulkMark(read: boolean) {
    patchConv.mutate({ ids: [...selected], patch: { unread_count: read ? 0 : 1 } as any });
    setSelected(new Set());
  }

  // Purge trash items older than 30 days on view
  useEffect(() => {
    if (tab !== "trash" || !user) return;
    const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
    (db.from("conversations") as any).delete().lt("deleted_at", cutoff).then(() => {});
  }, [tab, user]);

  // Realtime: refresh conversation list on any change to user's conversations
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`conversations:${user.id}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "conversations", filter: `owner_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["conversations"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const roleHelper = {
    planner: "You have full messaging: draft with AI, schedule sends, manage templates, and coordinate every vendor and guest.",
    vendor: "Message planners and authorized collaborators. Templates and scheduling are yours to use.",
    guest: "Reply to your planner and confirm details. Some tools are hidden to keep things simple.",
    admin: "Full messaging plus moderation. Archive/restore on any thread you own.",
  }[role];

  return (
    <AppShell active="/messaging">
      <PageHeader
        eyebrow="Messaging Center"
        icon={MessageSquare}
        title={<>One inbox for <span className="text-gradient">everyone</span> planning with you.</>}
        description={roleHelper}
        actions={<>
          {role !== "guest" && (
            <Button variant="outline" onClick={() => setCompose({ ...emptyCompose, open: true, subject: "Announcement" })}>
              <Megaphone className="mr-2 h-4 w-4"/>Announcement
            </Button>
          )}
          <Button variant="hero" onClick={() => setCompose({ ...emptyCompose, open: true })}>
            <Send className="mr-2 h-4 w-4"/>New message
          </Button>
        </>}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-8">
        <TabsList>
          <TabsTrigger value="inbox"><InboxIcon className="mr-1.5 h-3.5 w-3.5"/>Inbox</TabsTrigger>
          <TabsTrigger value="archive"><Archive className="mr-1.5 h-3.5 w-3.5"/>Archive</TabsTrigger>
          <TabsTrigger value="trash"><Trash2 className="mr-1.5 h-3.5 w-3.5"/>Trash</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="settings">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <InboxView
            conversations={filtered} grouped={grouped}
            search={search} setSearch={setSearch}
            filter={filter} setFilter={setFilter}
            selected={selected} setSelected={setSelected}
            activeId={activeId} setActiveId={setActiveId}
            loading={convQ.isLoading}
            onBulkArchive={bulkArchive} onBulkTrash={bulkTrash} onBulkMark={bulkMark}
            onPatch={(id, patch) => patchConv.mutate({ ids: [id], patch })}
            emptyLabel="No conversations yet — start one with 'New message'."
          />
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          <InboxView
            conversations={filtered} grouped={grouped}
            search={search} setSearch={setSearch}
            filter={filter} setFilter={setFilter}
            selected={selected} setSelected={setSelected}
            activeId={activeId} setActiveId={setActiveId}
            loading={convQ.isLoading}
            onBulkArchive={() => patchConv.mutate({ ids: [...selected], patch: { is_archived: false, archived_at: null } as any })}
            onBulkTrash={bulkTrash} onBulkMark={bulkMark}
            onPatch={(id, patch) => patchConv.mutate({ ids: [id], patch })}
            emptyLabel="Nothing archived. Archived threads land here for safekeeping."
            archiveMode
          />
        </TabsContent>

        <TabsContent value="trash" className="mt-4">
          <InboxView
            conversations={filtered} grouped={grouped}
            search={search} setSearch={setSearch}
            filter={filter} setFilter={setFilter}
            selected={selected} setSelected={setSelected}
            activeId={activeId} setActiveId={setActiveId}
            loading={convQ.isLoading}
            onBulkArchive={() => patchConv.mutate({ ids: [...selected], patch: { deleted_at: null } as any })}
            onBulkTrash={async () => { await (db.from("conversations") as any).delete().in("id", [...selected]); qc.invalidateQueries({ queryKey: ["conversations"] }); setSelected(new Set()); toast.success("Deleted permanently"); }}
            onBulkMark={bulkMark}
            onPatch={(id, patch) => patchConv.mutate({ ids: [id], patch })}
            emptyLabel="Trash is empty. Deleted threads stay here for 30 days before permanent removal."
            trashMode
          />
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <TemplatesView onUse={(t) => setCompose({ ...emptyCompose, open: true, subject: t.title, body: t.body, templateKey: t.id })} />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4">
          <ScheduledView onEdit={(m) => setCompose(m)} onNew={() => setCompose({ ...emptyCompose, open: true })} />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <NotificationSettings />
        </TabsContent>
      </Tabs>

      <ComposeDialog state={compose} onChange={setCompose} onClose={() => setCompose(emptyCompose)} />
    </AppShell>
  );
}

// ---------------------- Inbox View ----------------------

function InboxView(props: {
  conversations: Conversation[];
  grouped: Record<string, Conversation[]>;
  search: string; setSearch: (v: string) => void;
  filter: FilterKey; setFilter: (v: FilterKey) => void;
  selected: Set<string>; setSelected: (s: Set<string>) => void;
  activeId: string | null; setActiveId: (id: string | null) => void;
  loading: boolean;
  onBulkArchive: () => void; onBulkTrash: () => void; onBulkMark: (read: boolean) => void;
  onPatch: (id: string, patch: Partial<Conversation>) => void;
  emptyLabel: string;
  archiveMode?: boolean; trashMode?: boolean;
}) {
  const { conversations, grouped, search, setSearch, filter, setFilter, selected, setSelected, activeId, setActiveId, loading, onBulkArchive, onBulkTrash, onBulkMark, onPatch, emptyLabel, archiveMode, trashMode } = props;

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
      <div className="rounded-3xl border border-border bg-card">
        <div className="border-b border-border p-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations…" className="pl-9"/>
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${filter === f.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent/40"}`}>
                {f.label}
              </button>
            ))}
          </div>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background p-2 text-xs">
              <span className="font-medium">{selected.size} selected</span>
              <div className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => onBulkMark(true)}><MailOpen className="mr-1 h-3.5 w-3.5"/>Read</Button>
                <Button size="sm" variant="ghost" onClick={() => onBulkMark(false)}><Mail className="mr-1 h-3.5 w-3.5"/>Unread</Button>
                <Button size="sm" variant="ghost" onClick={onBulkArchive}>
                  {archiveMode || trashMode ? <><ArchiveRestore className="mr-1 h-3.5 w-3.5"/>Restore</> : <><Archive className="mr-1 h-3.5 w-3.5"/>Archive</>}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={onBulkTrash}>
                  <Trash2 className="mr-1 h-3.5 w-3.5"/>{trashMode ? "Delete forever" : "Delete"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {loading && <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>}
        {!loading && conversations.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        )}

        <ul className="divide-y divide-border">
          {Object.entries(grouped).map(([label, items]) =>
            items.length === 0 ? null : (
              <li key={label}>
                <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                <ul className="divide-y divide-border">
                  {items.map((c) => (
                    <li key={c.id} className={`group relative px-3 py-2.5 transition ${activeId === c.id ? "bg-accent/60" : "hover:bg-accent/30"}`}>
                      <div className="flex items-start gap-2.5">
                        <Checkbox
                          checked={selected.has(c.id)}
                          onCheckedChange={() => toggle(c.id)}
                          className="mt-1.5"
                          aria-label="Select conversation"
                        />
                        <button onClick={() => setActiveId(c.id)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium">
                              {c.is_pinned && <Pin className="mr-1 inline h-3 w-3 text-primary"/>}
                              {c.is_favorite && <Star className="mr-1 inline h-3 w-3 fill-primary text-primary"/>}
                              {c.is_muted && <BellOff className="mr-1 inline h-3 w-3 text-muted-foreground"/>}
                              {c.title || "Untitled conversation"}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">{format(new Date(c.last_message_at), "MMM d")}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.last_message_preview || "No messages yet"}</p>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">{c.type}</Badge>
                            {c.labels.map((l) => <Badge key={l} variant="outline" className="text-[10px]"><Tag className="mr-1 h-2.5 w-2.5"/>{l}</Badge>)}
                            {c.unread_count > 0 && <Badge className="ml-auto bg-primary text-primary-foreground">{c.unread_count}</Badge>}
                          </div>
                        </button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="opacity-0 transition group-hover:opacity-100" aria-label="Conversation actions">
                              <MoreHorizontal className="h-4 w-4"/>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 bg-popover">
                            <DropdownMenuItem onClick={() => onPatch(c.id, { is_pinned: !c.is_pinned })}>
                              {c.is_pinned ? <><PinOff className="mr-2 h-4 w-4"/>Unpin</> : <><Pin className="mr-2 h-4 w-4"/>Pin</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onPatch(c.id, { is_favorite: !c.is_favorite })}>
                              {c.is_favorite ? <><StarOff className="mr-2 h-4 w-4"/>Unfavorite</> : <><Star className="mr-2 h-4 w-4"/>Favorite</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onPatch(c.id, { is_muted: !c.is_muted })}>
                              {c.is_muted ? <><Bell className="mr-2 h-4 w-4"/>Unmute</> : <><BellOff className="mr-2 h-4 w-4"/>Mute</>}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onPatch(c.id, { unread_count: c.unread_count > 0 ? 0 : 1 } as any)}>
                              {c.unread_count > 0 ? <><MailOpen className="mr-2 h-4 w-4"/>Mark read</> : <><Mail className="mr-2 h-4 w-4"/>Mark unread</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => exportConversation(c)}>
                              <Download className="mr-2 h-4 w-4"/>Export
                            </DropdownMenuItem>
                            {trashMode ? (
                              <DropdownMenuItem onClick={() => onPatch(c.id, { deleted_at: null } as any)}>
                                <ArchiveRestore className="mr-2 h-4 w-4"/>Restore
                              </DropdownMenuItem>
                            ) : archiveMode ? (
                              <DropdownMenuItem onClick={() => onPatch(c.id, { is_archived: false, archived_at: null } as any)}>
                                <ArchiveRestore className="mr-2 h-4 w-4"/>Restore to inbox
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => onPatch(c.id, { is_archived: true, archived_at: new Date().toISOString() } as any)}>
                                <Archive className="mr-2 h-4 w-4"/>Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => onPatch(c.id, { deleted_at: new Date().toISOString() } as any)}>
                              <Trash2 className="mr-2 h-4 w-4"/>{trashMode ? "Delete forever" : "Move to trash"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            )
          )}
        </ul>
      </div>

      <ConversationPanel conversationId={activeId} onPatch={onPatch} />
    </div>
  );
}

function exportConversation(c: Conversation) {
  const lines = [
    `Conversation: ${c.title ?? "Untitled"}`,
    `Type: ${c.type}`,
    `Last activity: ${new Date(c.last_message_at).toISOString()}`,
    "",
    c.last_message_preview ?? "",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${(c.title ?? "conversation").replace(/[^a-z0-9]+/gi, "-")}.txt`;
  a.click(); URL.revokeObjectURL(url);
  toast.success("Exported");
}

function ConversationPanel({ conversationId, onPatch }: { conversationId: string | null; onPatch: (id: string, patch: Partial<Conversation>) => void }) {
  const qcMsg = useQueryClient();
  const msgQ = useQuery({
    queryKey: ["messages", conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await (db.from("messages") as any).select("*").eq("conversation_id", conversationId).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        () => {
          qcMsg.invalidateQueries({ queryKey: ["messages", conversationId] });
          qcMsg.invalidateQueries({ queryKey: ["conversations"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, qcMsg]);

  if (!conversationId) {
    return (
      <div className="flex min-h-[400px] items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center">
        <div>
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground"/>
          <p className="mt-3 text-sm text-muted-foreground">Select a conversation to read and reply.</p>
        </div>
      </div>
    );
  }

  const messages = msgQ.data ?? [];

  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-display text-lg font-semibold">Thread</h3>
        <Badge variant="secondary" className="ml-auto">{messages.length} messages</Badge>
      </div>
      {msgQ.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>}
      {!msgQ.isLoading && messages.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No messages yet. Rich-text compose lands in Phase 2.
        </div>
      )}
      <div className="space-y-3">
        {messages.map((m: any) => (
          <Msg key={m.id} text={m.body ?? ""} />
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>MelaAssist AI</div>
        <p className="text-xs text-muted-foreground">Rich-text compose, attachments, and AI drafts arrive in Phase 2. Use "New message" above to schedule or send with the current composer.</p>
      </div>
    </div>
  );
}

// ---------------------- Templates ----------------------

function TemplatesView({ onUse }: { onUse: (t: { id: string; title: string; body: string }) => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["templates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (db.from("message_templates") as any)
        .select("*").eq("is_archived", false).order("category").order("title");
      if (error) throw error;
      return data ?? [];
    },
  });

  const templates = q.data ?? [];
  const categories = useMemo(() => ["all", ...Array.from(new Set(templates.map((t: any) => t.category)))], [templates]);
  const filtered = templates.filter((t: any) =>
    (category === "all" || t.category === category) &&
    (!search || `${t.title} ${t.body}`.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleFav = useMutation({
    mutationFn: async (t: any) => {
      if (t.owner_id !== user?.id) {
        // clone global template as user favorite
        const { error } = await (db.from("message_templates") as any).insert({
          owner_id: user?.id, category: t.category, title: t.title, body: t.body, variables: t.variables, is_favorite: true, tone: t.tone,
        });
        if (error) throw error;
      } else {
        const { error } = await (db.from("message_templates") as any).update({ is_favorite: !t.is_favorite }).eq("id", t.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/>
          <Input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9"/>
        </div>
        <div className="flex flex-wrap gap-1">
          {(categories as string[]).map((c) => (
            <button key={c} onClick={() => setCategory(c)}
              className={`rounded-full border px-2.5 py-1 text-xs capitalize transition ${category === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-accent/40"}`}>
              {c.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
      {q.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading templates…</div>}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((t: any) => (
          <div key={t.id} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <FileText className="h-5 w-5 text-primary"/>
              <button onClick={() => toggleFav.mutate(t)} aria-label="Favorite">
                {t.is_favorite ? <Star className="h-4 w-4 fill-primary text-primary"/> : <StarOff className="h-4 w-4 text-muted-foreground"/>}
              </button>
            </div>
            <p className="mt-2 font-medium">{t.title}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{t.category.replace(/_/g, " ")}{t.tone ? ` · ${t.tone}` : ""}</p>
            <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{t.body}</p>
            {t.variables?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {t.variables.map((v: string) => <Badge key={v} variant="outline" className="text-[10px]">{`{${v}}`}</Badge>)}
              </div>
            )}
            <div className="mt-3 flex gap-1.5">
              <Button size="sm" variant="hero" onClick={() => onUse(t)}>Use template</Button>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(t.body); toast.success("Copied"); }}>
                <Copy className="h-3.5 w-3.5"/>
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!q.isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No templates match those filters.</p>}
    </div>
  );
}

// ---------------------- Scheduled ----------------------

type ComposeState = {
  open: boolean;
  editingId?: string;
  subject: string;
  body: string;
  recipients: string;
  sendAt: string;
  templateKey?: string;
};

const emptyCompose: ComposeState = { open: false, subject: "", body: "", recipients: "", sendAt: "", templateKey: undefined };

function ScheduledView({ onEdit, onNew }: { onEdit: (s: ComposeState) => void; onNew: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["scheduled-messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (db.from("scheduled_messages") as any).select("*").order("send_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (db.from("scheduled_messages") as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scheduled-messages"] }); toast.success("Deleted"); },
  });

  const dup = useMutation({
    mutationFn: async (id: string) => {
      const src = (q.data ?? []).find((m: any) => m.id === id);
      if (!src || !user) return;
      const { error } = await (db.from("scheduled_messages") as any).insert({
        user_id: user.id, subject: src.subject, body: src.body, recipients: src.recipients, send_at: src.send_at, template_key: src.template_key, status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["scheduled-messages"] }); toast.success("Duplicated"); },
  });

  if (!user) return <p className="text-sm text-muted-foreground">Sign in to view your scheduled messages.</p>;
  if (q.isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>;
  if ((q.data ?? []).length === 0) return (
    <div className="rounded-2xl border border-dashed border-border p-6 text-center">
      <p className="text-sm text-muted-foreground">No scheduled messages yet.</p>
      <Button size="sm" variant="hero" className="mt-3" onClick={onNew}>Schedule one</Button>
    </div>
  );

  return (
    <div className="space-y-2">
      {(q.data ?? []).map((s: any) => (
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
            <Button size="sm" variant="outline" onClick={() => onEdit({
              open: true, editingId: s.id, subject: s.subject ?? "", body: s.body ?? "",
              recipients: (s.recipients ?? []).join(", "),
              sendAt: new Date(s.send_at).toISOString().slice(0, 16),
              templateKey: s.template_key ?? undefined,
            })}><Pencil className="mr-1.5 h-3.5 w-3.5"/>Edit</Button>
            <Button size="sm" variant="ghost" onClick={() => dup.mutate(s.id)}><Copy className="mr-1.5 h-3.5 w-3.5"/>Duplicate</Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del.mutate(s.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5"/>Delete</Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------- Compose (existing lightweight; Phase 2 upgrades) ----------------------

function ComposeDialog({ state, onChange, onClose }: { state: ComposeState; onChange: (s: ComposeState) => void; onClose: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async (immediate: boolean) => {
      if (!user) throw new Error("Sign in required");
      const sendAtISO = immediate ? new Date().toISOString() : new Date(state.sendAt || Date.now()).toISOString();
      const recipients = state.recipients.split(",").map((s) => s.trim()).filter(Boolean);
      const payload = {
        subject: state.subject, body: state.body, recipients, send_at: sendAtISO,
        template_key: state.templateKey ?? null, status: immediate ? "sent" : "scheduled", user_id: user.id,
      };
      if (state.editingId) {
        const { error } = await (db.from("scheduled_messages") as any).update(payload).eq("id", state.editingId);
        if (error) throw error;
      } else {
        const { error } = await (db.from("scheduled_messages") as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_d, immediate) => {
      qc.invalidateQueries({ queryKey: ["scheduled-messages"] });
      onClose();
      toast.success(immediate ? "Sent" : state.editingId ? "Saved" : "Scheduled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (state.open && !state.sendAt) {
      onChange({ ...state, sendAt: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16) });
    }
  }, [state.open]); // eslint-disable-line

  function aiPersonalize() {
    const body = state.body.replace(/\{name\}/gi, "friend").replace(/\{vendor\}/gi, "team").trim();
    onChange({ ...state, body: `Hi there,\n\n${body}\n\nWarmly,` });
    toast.success("AI rewrote your draft");
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{state.editingId ? "Edit scheduled message" : "Compose message"}</DialogTitle>
          <DialogDescription>{state.templateKey ? "Template loaded — personalize and send." : "Draft, schedule, or send now. Rich text and attachments arrive in Phase 2."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label htmlFor="c-to">Recipients</Label><Input id="c-to" placeholder="alex@example.com, priya@example.com" value={state.recipients} onChange={(e) => onChange({ ...state, recipients: e.target.value })}/></div>
          <div><Label htmlFor="c-sub">Subject</Label><Input id="c-sub" value={state.subject} onChange={(e) => onChange({ ...state, subject: e.target.value })}/></div>
          <div><Label htmlFor="c-body">Message</Label><Textarea id="c-body" rows={6} value={state.body} onChange={(e) => onChange({ ...state, body: e.target.value })}/></div>
          <div><Label htmlFor="c-when">Send at</Label><Input id="c-when" type="datetime-local" value={state.sendAt} onChange={(e) => onChange({ ...state, sendAt: e.target.value })}/></div>
          <Button type="button" variant="outline" size="sm" onClick={aiPersonalize}><Sparkles className="mr-2 h-4 w-4"/>AI personalize</Button>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {!state.editingId && <Button variant="outline" onClick={() => save.mutate(true)} disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Send className="mr-2 h-4 w-4"/>}Send now</Button>}
          <Button variant="hero" onClick={() => save.mutate(false)} disabled={save.isPending}>{save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Clock className="mr-2 h-4 w-4"/>}{state.editingId ? "Save changes" : "Schedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------- Notifications (kept from prior; Phase 3 upgrades) ----------------------

function NotificationSettings() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const prefsQ = useQuery({
    queryKey: ["notif-prefs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (db.from("notification_preferences") as any).select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const prefsByKey = useMemo(() => {
    const m = new Map<string, any>();
    (prefsQ.data ?? []).forEach((p: any) => m.set(`${p.category}:${p.channel}`, p));
    return m;
  }, [prefsQ.data]);

  const upsert = useMutation({
    mutationFn: async ({ category, channel, patch }: { category: string; channel: string; patch: any }) => {
      if (!user) throw new Error("Sign in required");
      const current = prefsByKey.get(`${category}:${channel}`) ?? { email_enabled: true, push_enabled: true, sms_enabled: false, in_app_enabled: true, calendar_enabled: false, frequency: "instant" };
      const { error } = await (db.from("notification_preferences") as any).upsert(
        { user_id: user.id, category, channel, ...current, ...patch },
        { onConflict: "user_id,channel" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!user) return <p className="text-sm text-muted-foreground">Sign in to manage notifications.</p>;

  return (
    <div className="space-y-3">
      {prefsQ.isLoading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading…</div>}
      {NOTIFICATION_GROUPS.map((g) => {
        const cur = prefsByKey.get(`${g.key}:${g.key}`) ?? { email_enabled: true, push_enabled: true, in_app_enabled: true, sms_enabled: false };
        return (
          <div key={g.key} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{g.label}</p>
                <p className="text-xs text-muted-foreground">{g.desc}</p>
              </div>
              <Bell className="h-4 w-4 text-primary"/>
            </div>
            <div className="mt-3 flex flex-wrap gap-4">
              {(["in_app", "push", "email", "sms"] as const).map((ch) => {
                const field = `${ch}_enabled` as const;
                return (
                  <label key={ch} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase tracking-wider">{ch.replace("_", "-")}</span>
                    <Switch
                      checked={!!cur[field]}
                      onCheckedChange={(v) => upsert.mutate({ category: g.key, channel: g.key, patch: { [field]: v } })}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => toast.success("Test notification sent")}><CheckCheck className="mr-2 h-4 w-4"/>Send test</Button>
        <Button variant="ghost" size="sm" onClick={() => toast("Full notification history lands in Phase 3")}><Filter className="mr-2 h-4 w-4"/>History</Button>
      </div>
    </div>
  );
}

function Msg({ from, mine, text }: { from?: string; mine?: boolean; text: string }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {from && !mine && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-70">{from}</p>}
        {text}
      </div>
    </div>
  );
}

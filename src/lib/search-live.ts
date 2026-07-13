import { supabase } from "@/integrations/supabase/client";
import {
  Calendar, Users, Store, ClipboardList, FolderOpen, MessageSquare, Wallet,
  type LucideIcon,
} from "lucide-react";

export type LiveKind =
  | "event" | "guest" | "vendor" | "task" | "file" | "message" | "budget";

export type LiveHit = {
  id: string;
  kind: LiveKind;
  title: string;
  subtitle?: string;
  to: string;
  icon: LucideIcon;
};

const ICONS: Record<LiveKind, LucideIcon> = {
  event: Calendar, guest: Users, vendor: Store, task: ClipboardList,
  file: FolderOpen, message: MessageSquare, budget: Wallet,
};

const like = (q: string) => `%${q.replace(/[%_]/g, (m) => "\\" + m)}%`;

/** Runs parallel ilike queries across the main entity tables. RLS applies. */
export async function liveSearch(query: string, perKind = 5): Promise<LiveHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const p = like(q);

  const [events, guests, vendors, tasks, files, messages, budget] = await Promise.all([
    supabase.from("events")
      .select("id,name,event_type,location,event_date")
      .or(`name.ilike.${p},event_type.ilike.${p},location.ilike.${p}`)
      .limit(perKind),
    supabase.from("guests")
      .select("id,full_name,email,rsvp_status,event_id")
      .or(`full_name.ilike.${p},email.ilike.${p},household.ilike.${p}`)
      .limit(perKind),
    supabase.from("vendor_profiles_public")
      .select("id,business_name,business_category,city")
      .or(`business_name.ilike.${p},business_category.ilike.${p},city.ilike.${p}`)
      .limit(perKind),
    supabase.from("tasks")
      .select("id,title,status,due_date,event_id")
      .or(`title.ilike.${p},description.ilike.${p}`)
      .limit(perKind),
    supabase.from("event_files")
      .select("id,filename,category,event_id")
      .or(`filename.ilike.${p},category.ilike.${p}`)
      .limit(perKind),
    supabase.from("messages")
      .select("id,body,conversation_id")
      .ilike("body", p)
      .limit(perKind),
    supabase.from("budget_items")
      .select("id,label,category,vendor_name,event_id")
      .or(`label.ilike.${p},category.ilike.${p},vendor_name.ilike.${p}`)
      .limit(perKind),
  ]);

  const out: LiveHit[] = [];

  (events.data ?? []).forEach((e: any) => out.push({
    id: `event-${e.id}`, kind: "event", title: e.name,
    subtitle: [e.event_type, e.location, e.event_date].filter(Boolean).join(" · "),
    to: `/events/${e.id}`, icon: ICONS.event,
  }));
  (guests.data ?? []).forEach((g: any) => out.push({
    id: `guest-${g.id}`, kind: "guest", title: g.full_name,
    subtitle: [g.email, g.rsvp_status && `RSVP: ${g.rsvp_status}`].filter(Boolean).join(" · "),
    to: "/guests", icon: ICONS.guest,
  }));
  (vendors.data ?? []).forEach((v: any) => out.push({
    id: `vendor-${v.id}`, kind: "vendor", title: v.business_name,
    subtitle: [v.business_category, v.city].filter(Boolean).join(" · "),
    to: "/vendors", icon: ICONS.vendor,
  }));
  (tasks.data ?? []).forEach((t: any) => out.push({
    id: `task-${t.id}`, kind: "task", title: t.title,
    subtitle: [t.status, t.due_date && `Due ${t.due_date}`].filter(Boolean).join(" · "),
    to: "/tasks", icon: ICONS.task,
  }));
  (files.data ?? []).forEach((f: any) => out.push({
    id: `file-${f.id}`, kind: "file", title: f.filename,
    subtitle: f.category ?? undefined, to: "/files", icon: ICONS.file,
  }));
  (messages.data ?? []).forEach((m: any) => out.push({
    id: `message-${m.id}`, kind: "message",
    title: (m.body ?? "").slice(0, 80) || "(message)",
    subtitle: "Conversation", to: "/messaging", icon: ICONS.message,
  }));
  (budget.data ?? []).forEach((b: any) => out.push({
    id: `budget-${b.id}`, kind: "budget", title: b.label,
    subtitle: [b.category, b.vendor_name].filter(Boolean).join(" · "),
    to: "/budget", icon: ICONS.budget,
  }));

  return out;
}

export const KIND_ORDER: LiveKind[] = ["event", "guest", "vendor", "task", "file", "message", "budget"];
export const KIND_LABEL: Record<LiveKind, string> = {
  event: "Events", guest: "Guests", vendor: "Vendors", task: "Tasks",
  file: "Files", message: "Messages", budget: "Budget",
};

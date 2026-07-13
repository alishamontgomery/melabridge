import { supabase } from "@/integrations/supabase/client";

export type Recent = {
  id: string;
  kind: "query" | "result";
  query: string | null;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  subtitle: string | null;
  href: string | null;
  opened_at: string;
};

export type Favorite = {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export async function getRecents(limit = 8): Promise<Recent[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("search_recents")
    .select("id,kind,query,entity_type,entity_id,title,subtitle,href,opened_at")
    .eq("user_id", u.user.id)
    .order("opened_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Recent[];
}

export async function pushRecent(input: {
  kind: "query" | "result";
  query?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  title: string;
  subtitle?: string | null;
  href?: string | null;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  // Best-effort dedupe: remove prior identical rows before insert.
  if (input.kind === "query" && input.query) {
    await supabase.from("search_recents").delete()
      .eq("user_id", u.user.id).eq("kind", "query").eq("query", input.query);
  } else if (input.kind === "result" && input.entity_id) {
    await supabase.from("search_recents").delete()
      .eq("user_id", u.user.id).eq("kind", "result")
      .eq("entity_type", input.entity_type ?? "")
      .eq("entity_id", input.entity_id);
  }
  await supabase.from("search_recents").insert({
    user_id: u.user.id,
    kind: input.kind,
    query: input.query ?? null,
    entity_type: input.entity_type ?? null,
    entity_id: input.entity_id ?? null,
    title: input.title,
    subtitle: input.subtitle ?? null,
    href: input.href ?? null,
  });
}

export async function clearRecents() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("search_recents").delete().eq("user_id", u.user.id);
}

export async function getFavorites(): Promise<Favorite[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase
    .from("search_favorites")
    .select("id,entity_type,entity_id,title,subtitle,href")
    .eq("user_id", u.user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as Favorite[];
}

export async function toggleFavorite(fav: Omit<Favorite, "id">): Promise<boolean> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return false;
  const { data: existing } = await supabase
    .from("search_favorites").select("id")
    .eq("user_id", u.user.id)
    .eq("entity_type", fav.entity_type)
    .eq("entity_id", fav.entity_id)
    .maybeSingle();
  if (existing?.id) {
    await supabase.from("search_favorites").delete().eq("id", existing.id);
    return false;
  }
  await supabase.from("search_favorites").insert({ user_id: u.user.id, ...fav });
  return true;
}

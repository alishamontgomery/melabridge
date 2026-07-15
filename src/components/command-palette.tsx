import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { KIND_LABEL, searchIndex, type SearchItem } from "@/lib/search-index";
import { liveSearch, KIND_LABEL as LIVE_LABEL, KIND_ORDER as LIVE_ORDER, type LiveHit } from "@/lib/search-live";
import { parseNLCommand } from "@/lib/nl-commands";
import {
  getRecents, pushRecent, clearRecents,
  getFavorites, toggleFavorite,
  type Recent, type Favorite,
} from "@/lib/search-personal";
import { useAuth } from "@/lib/auth";
import {
  Sparkles, Plus, Upload, UserPlus, Wand2, Calendar, Star, StarOff, X, Loader2,
} from "lucide-react";

type ActionItem = {
  id: string;
  title: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [hits, setHits] = useState<LiveHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load recents + favorites when the palette opens.
  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [r, f] = await Promise.all([getRecents(8), getFavorites()]);
      setRecents(r); setFavorites(f);
    })();
  }, [open, user]);

  // Debounce query.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 180);
    return () => clearTimeout(t);
  }, [query]);

  // Live search on debounced query.
  useEffect(() => {
    let cancel = false;
    if (!user || debounced.trim().length < 2) { setHits([]); setSearching(false); return; }
    setSearching(true);
    liveSearch(debounced).then((r) => { if (!cancel) { setHits(r); setSearching(false); } })
      .catch(() => { if (!cancel) setSearching(false); });
    return () => { cancel = true; };
  }, [debounced, user]);

  const close = () => { setOpen(false); setQuery(""); };
  const go = (to: string) => { close(); navigate({ to: to as "/dashboard" }); };

  const onSelectResult = async (item: {
    entity_type: string; entity_id: string; title: string; subtitle?: string; to: string;
  }) => {
    pushRecent({
      kind: "result",
      entity_type: item.entity_type, entity_id: item.entity_id,
      title: item.title, subtitle: item.subtitle ?? null, href: item.to,
    }).catch(() => void 0);
    go(item.to);
  };

  const onSubmitQuery = () => {
    if (query.trim().length >= 2) {
      pushRecent({ kind: "query", query: query.trim(), title: query.trim() }).catch(() => void 0);
    }
  };

  const onToggleFav = async (fav: Omit<Favorite, "id">) => {
    await toggleFavorite(fav);
    setFavorites(await getFavorites());
  };

  const isFav = (entity_type: string, entity_id: string) =>
    favorites.some((f) => f.entity_type === entity_type && f.entity_id === entity_id);

  const actions: ActionItem[] = useMemo(() => [
    { id: "a-new-event", title: "Create a new event", hint: "Start the wizard", icon: Plus, run: () => go("/events/new") },
    { id: "a-ask", title: "Ask MelaAssist™ anything", hint: "Open AI chat", icon: Sparkles, run: () => go("/concierge") },
    { id: "a-upload", title: "Upload files to BridgeVault™", icon: Upload, run: () => go("/bridgevault") },
    { id: "a-invite", title: "Invite collaborators", icon: UserPlus, run: () => go("/collaboration") },
    { id: "a-guest", title: "Add a guest", icon: UserPlus, run: () => go("/guests") },
    { id: "a-task", title: "Add a task", hint: "Plan next steps", icon: Wand2, run: () => go("/tasks") },
    { id: "a-schedule", title: "Schedule an event date", icon: Calendar, run: () => go("/timeline") },
  ], []);

  // Static module + curated index (used when no query, plus as extra hits).
  const staticResults = useMemo(() => searchIndex(query, 40), [query]);
  const staticGrouped = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const item of staticResults) {
      const label = KIND_LABEL[item.kind];
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Module") return -1;
      if (b === "Module") return 1;
      return a.localeCompare(b);
    });
  }, [staticResults]);

  const liveGrouped = useMemo(() => {
    const map = new Map<string, LiveHit[]>();
    for (const h of hits) {
      const label = LIVE_LABEL[h.kind];
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(h);
    }
    return LIVE_ORDER
      .map((k) => [LIVE_LABEL[k], map.get(LIVE_LABEL[k]) ?? []] as const)
      .filter(([, v]) => v.length > 0);
  }, [hits]);

  const nlCommands = useMemo(() => parseNLCommand(query), [query]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search events, guests, vendors, files, tasks… or ask MelaAssist™"
        onKeyDown={(e) => { if (e.key === "Enter") onSubmitQuery(); }}
      />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>
          {searching ? (
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</span>
          ) : "No matches. Try a different keyword."}
        </CommandEmpty>

        {!query && (
          <>
            <CommandGroup heading="Quick actions">
              {actions.map((a) => (
                <CommandItem key={a.id} onSelect={a.run} value={`action ${a.title}`}>
                  <a.icon className="mr-2 h-4 w-4 text-primary" />
                  <span>{a.title}</span>
                  {a.hint && <span className="ml-auto text-xs text-muted-foreground">{a.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>

            {favorites.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Favorites">
                  {favorites.map((f) => (
                    <CommandItem
                      key={f.id}
                      value={`fav ${f.title} ${f.subtitle ?? ""}`}
                      onSelect={() => onSelectResult({
                        entity_type: f.entity_type, entity_id: f.entity_id,
                        title: f.title, subtitle: f.subtitle ?? undefined, to: f.href,
                      })}
                    >
                      <Star className="mr-2 h-4 w-4 fill-primary text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{f.title}</p>
                        {f.subtitle && <p className="truncate text-xs text-muted-foreground">{f.subtitle}</p>}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {recents.length > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Recent">
                  {recents.map((r) => (
                    <CommandItem
                      key={r.id}
                      value={`recent ${r.title} ${r.subtitle ?? ""}`}
                      onSelect={() => {
                        if (r.href) go(r.href);
                        else setQuery(r.title);
                      }}
                    >
                      <Sparkles className="mr-2 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{r.title}</p>
                        {r.subtitle && <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>}
                      </div>
                      <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                        {r.kind === "query" ? "Search" : r.entity_type ?? ""}
                      </span>
                    </CommandItem>
                  ))}
                  <CommandItem value="clear-recents" onSelect={async () => { await clearRecents(); setRecents([]); }}>
                    <X className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Clear recent history</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </>
        )}

        {nlCommands.length > 0 && (
          <CommandGroup heading="MelaAssist™ suggestions">
            {nlCommands.map((c) => (
              <CommandItem key={c.to} value={`nl ${c.label}`} onSelect={() => go(c.to)}>
                <Wand2 className="mr-2 h-4 w-4 text-primary" />
                <span>{c.label}</span>
                {c.hint && <span className="ml-auto text-xs text-muted-foreground">{c.hint}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {liveGrouped.map(([label, items]) => (
          <CommandGroup key={`live-${label}`} heading={label}>
            {items.map((item) => {
              const [entity_type, entity_id] = item.id.split("-", 2);
              const favd = isFav(entity_type, entity_id);
              return (
                <CommandItem
                  key={item.id}
                  value={`${label} ${item.title} ${item.subtitle ?? ""}`}
                  onSelect={() => onSelectResult({
                    entity_type, entity_id,
                    title: item.title, subtitle: item.subtitle, to: item.to,
                  })}
                >
                  <item.icon className="mr-2 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.title}</p>
                    {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); e.preventDefault();
                      onToggleFav({
                        entity_type, entity_id,
                        title: item.title, subtitle: item.subtitle ?? null, href: item.to,
                      });
                    }}
                    className="ml-2 rounded p-1 hover:bg-muted"
                    aria-label={favd ? "Unfavorite" : "Add to favorites"}
                  >
                    {favd ? <Star className="h-3.5 w-3.5 fill-primary text-primary" /> : <StarOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        {staticGrouped.map(([label, items]) => (
          <CommandGroup key={`static-${label}`} heading={label}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${label} ${item.title} ${item.subtitle ?? ""}`}
                onSelect={() => onSelectResult({
                  entity_type: "module", entity_id: item.id,
                  title: item.title, subtitle: item.subtitle, to: item.to,
                })}
              >
                <item.icon className="mr-2 h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{item.title}</p>
                  {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
                </div>
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export function CommandTrigger() {
  const [platform, setPlatform] = useState<"mac" | "other">("other");
  useEffect(() => {
    if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
      setPlatform("mac");
    }
  }, []);
  const shortcut = platform === "mac" ? "⌘K" : "Ctrl K";
  return (
    <button
      onClick={() => {
        const e = new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true });
        window.dispatchEvent(e);
      }}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition hover:border-primary/30 hover:text-foreground"
      aria-label="Open command palette"
    >
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      <span className="hidden sm:inline">Search or ask MelaAssist™…</span>
      <span className="sm:hidden">Search…</span>
      <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium sm:inline">
        {shortcut}
      </kbd>
    </button>
  );
}

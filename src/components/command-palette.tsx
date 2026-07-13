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
import {
  Sparkles,
  Plus,
  Upload,
  UserPlus,
  Wand2,
  Calendar,
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
  const navigate = useNavigate();

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

  const go = (to: string) => {
    setOpen(false);
    setQuery("");
    // Cast to bypass typed-route inference — targets are real routes.
    navigate({ to: to as "/dashboard" });
  };

  const actions: ActionItem[] = useMemo(
    () => [
      { id: "a-new-event", title: "Create a new event", hint: "Start the wizard", icon: Plus, run: () => go("/new-event") },
      { id: "a-ask", title: "Ask MelaAssist™ anything", hint: "Open AI chat", icon: Sparkles, run: () => go("/decisions") },
      { id: "a-upload", title: "Upload files to BridgeVault™", icon: Upload, run: () => go("/bridgevault") },
      { id: "a-invite", title: "Invite collaborators", icon: UserPlus, run: () => go("/collaboration") },
      { id: "a-guest", title: "Add a guest", icon: UserPlus, run: () => go("/guests") },
      { id: "a-task", title: "Draft with AI", hint: "Message, invite, or plan", icon: Wand2, run: () => go("/messaging") },
      { id: "a-schedule", title: "Schedule an event date", icon: Calendar, run: () => go("/timeline") },
    ],
    []
  );

  const results = useMemo(() => searchIndex(query, 60), [query]);
  const grouped = useMemo(() => {
    const map = new Map<string, SearchItem[]>();
    for (const item of results) {
      const label = KIND_LABEL[item.kind];
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    }
    // Ensure Modules render first when present.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Module") return -1;
      if (b === "Module") return 1;
      return a.localeCompare(b);
    });
  }, [results]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search events, guests, vendors, files, tasks, messages…"
      />
      <CommandList className="max-h-[70vh]">
        <CommandEmpty>No matches. Try a different keyword.</CommandEmpty>

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
            <CommandSeparator />
          </>
        )}

        {grouped.map(([label, items]) => (
          <CommandGroup key={label} heading={label}>
            {items.map((item) => (
              <CommandItem
                key={item.id}
                value={`${label} ${item.title} ${item.subtitle ?? ""}`}
                onSelect={() => go(item.to)}
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

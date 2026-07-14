import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Sparkles, RefreshCw, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEcosystem } from "@/lib/ecosystem-store";
import { clearSampleWorkspace, reloadSampleWorkspace } from "@/lib/sample-workspace.functions";

/**
 * Rendered inside AppShell above the page content. Only shows when the
 * currently-active event is sample data. Provides one-click controls to
 * reload or remove the sample workspace.
 */
export function SampleBanner() {
  const { event, hasEvent } = useEcosystem();
  const clear = useServerFn(clearSampleWorkspace);
  const reload = useServerFn(reloadSampleWorkspace);
  const [busy, setBusy] = useState<"clear" | "reload" | null>(null);

  if (!hasEvent || !event.isSample) return null;

  async function handleReload() {
    setBusy("reload");
    try {
      const res = (await reload()) as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error);
      toast.success("Sample workspace reloaded");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reload failed");
      setBusy(null);
    }
  }

  async function handleClear() {
    if (!confirm("Remove sample data? You can bring it back anytime from Settings.")) return;
    setBusy("clear");
    try {
      const res = (await clear()) as { ok: boolean; error?: string };
      if (!res.ok) throw new Error(res.error);
      toast.success("Sample data removed");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent px-4 py-2.5 animate-fade-in">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 text-sm">
          <span className="font-semibold">You're exploring sample data.</span>{" "}
          <span className="text-muted-foreground">
            Create your first real event to replace it — everything you see is a demo.
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button asChild size="sm" variant="hero">
          <Link to="/events/new">Create real event</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={handleReload} disabled={busy !== null}>
          {busy === "reload" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          <span className="ml-1.5 hidden sm:inline">Reload</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={handleClear} disabled={busy !== null}>
          {busy === "clear" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          <span className="ml-1.5 hidden sm:inline">Remove</span>
        </Button>
      </div>
    </div>
  );
}

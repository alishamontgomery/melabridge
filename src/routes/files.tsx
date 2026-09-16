import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FolderOpen, Upload, FileText, Image as ImageIcon, Receipt,
  FileCheck2, Loader2, Download, Trash2, Pencil, File,
  Check, X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ModuleLoading, RouteError } from "@/components/module-states";
import { PremiumUpgradeGate } from "@/components/premium-upgrade-gate";
import { useFeatureGate } from "@/hooks/use-feature-gate";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "File Center — MelaBridge" },
      { name: "description", content: "Upload, organise, and share your business files." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FilesPage,
  errorComponent: RouteError,
});

const BUCKET = "bridgevault";
const MAX_FILE_MB = 25;

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/zip",
  "text/plain",
  "text/csv",
];

function isMimeAllowed(mimeType: string): boolean {
  if (!mimeType) return true; // allow unknown types (browser may not report)
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

type Category = "documents" | "photos" | "contracts" | "invoices" | "other";
const CATEGORIES: { key: Category; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { key: "documents",  icon: FileText,   label: "Documents"  },
  { key: "photos",     icon: ImageIcon,  label: "Photos & media" },
  { key: "contracts",  icon: FileCheck2, label: "Contracts"  },
  { key: "invoices",   icon: Receipt,    label: "Invoices"   },
  { key: "other",      icon: File,       label: "Other"      },
];

type UserFile = {
  id: string;
  user_id: string;
  category: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  deleted_at: string | null;
};

const db = supabase as any;

function FilesPage() {
  const { user } = useRequireAuth();
  const { allowed: filesAllowed } = useFeatureGate("document_storage_expanded");
  const qc = useQueryClient();
  const [category, setCategory] = useState<Category>("documents");
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<UserFile | null>(null);
  const [inlineRename, setInlineRename] = useState<{ id: string; value: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ── Fetch all user files ───────────────────────────────────────────
  const filesQ = useQuery({
    queryKey: ["user-files", user?.id],
    enabled: !!user?.id && filesAllowed,
    queryFn: async (): Promise<UserFile[]> => {
      const { data, error } = await db
        .from("user_files")
        .select("*")
        .eq("user_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UserFile[];
    },
  });

  const files = useMemo(() => filesQ.data ?? [], [filesQ.data]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of files) c[f.category] = (c[f.category] ?? 0) + 1;
    return c;
  }, [files]);

  // ── Upload ─────────────────────────────────────────────────────────
  const upload = useMutation({
    mutationFn: async (items: File[]) => {
      if (!user) throw new Error("Sign in to upload files.");
      if (items.length === 0) throw new Error("No files selected.");
      for (const file of items) {
        if (file.size > MAX_FILE_MB * 1024 * 1024)
          throw new Error(`${file.name} exceeds the ${MAX_FILE_MB} MB limit.`);
        if (file.type && !isMimeAllowed(file.type))
          throw new Error(`${file.name}: file type not permitted.`);
        const safeName = file.name.replace(/[^\w.-]+/g, "_").slice(0, 200);
        const path = `${user.id}/${category}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        const { error: insErr } = await db.from("user_files").insert({
          user_id: user.id,
          category,
          storage_path: path,
          filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        });
        if (insErr) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw insErr;
        }
      }
    },
    onSuccess: () => {
      toast.success(`${uploading ? "Files" : "File"} uploaded.`);
      qc.invalidateQueries({ queryKey: ["user-files", user?.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"),
    onSettled: () => setUploading(false),
  });

  // ── Rename ─────────────────────────────────────────────────────────
  const rename = useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      if (!user) throw new Error("Not authenticated");
      const trimmed = newName.trim().slice(0, 500);
      if (!trimmed) throw new Error("Filename cannot be empty.");
      const { error } = await db.from("user_files").update({ filename: trimmed }).eq("id", id).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("File renamed.");
      qc.invalidateQueries({ queryKey: ["user-files", user?.id] });
      setInlineRename(null);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Rename failed"),
  });

  // ── Delete (soft) ──────────────────────────────────────────────────
  const remove = useMutation({
    mutationFn: async (f: UserFile) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await db
        .from("user_files")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", f.id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("File deleted.");
      qc.invalidateQueries({ queryKey: ["user-files", user?.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  // ── Download / preview ─────────────────────────────────────────────
  async function handleOpen(f: UserFile) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 120);
    if (error || !data?.signedUrl) { toast.error("Could not create download link."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  // ── Commit inline rename ──────────────────────────────────────────
  function commitRename() {
    if (!inlineRename || !inlineRename.value.trim()) { setInlineRename(null); return; }
    rename.mutate({ id: inlineRename.id, newName: inlineRename.value });
  }

  const catInfo = (key: string) => CATEGORIES.find((c) => c.key === key) ?? CATEGORIES[4];

  return (
    <AppShell active="/files">
      <PremiumUpgradeGate
        feature="document_storage_expanded"
      >
      <PageHeader
        eyebrow="File Center"
        icon={FolderOpen}
        title={<>Your files, <span className="text-gradient">all in one place</span>.</>}
        description="Upload, rename and view your business documents, photos, contracts and more."
        actions={
          <Button
            variant="hero"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Upload className="mr-2 h-4 w-4" />}
            Upload files
          </Button>
        }
      />

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const items = e.target.files ? Array.from(e.target.files) : [];
          e.target.value = "";
          if (items.length) { setUploading(true); upload.mutate(items); }
        }}
      />

      {/* Category picker */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Upload as</span>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              category === c.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            <c.icon className="h-3.5 w-3.5" />
            {c.label}
          </button>
        ))}
      </div>

      {/* Category summary cards */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => { setCategory(c.key); inputRef.current?.click(); }}
            className="group rounded-xl border border-border bg-card p-4 text-left shadow-soft transition hover:border-primary/40 hover:shadow-md"
          >
            <c.icon className="h-5 w-5 text-primary" />
            <p className="mt-2 text-sm font-medium">{c.label}</p>
            <p className="text-xs text-muted-foreground">
              {counts[c.key] ?? 0} file{(counts[c.key] ?? 0) === 1 ? "" : "s"}
            </p>
          </button>
        ))}
      </div>

      {/* File list */}
      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">All files</h2>

        {filesQ.isLoading ? (
          <ModuleLoading rows={3} showStats={false} />
        ) : filesQ.isError ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Could not load files.{" "}
            <button className="underline" onClick={() => filesQ.refetch()}>Retry</button>
          </Card>
        ) : files.length === 0 ? (
          <Card className="border-2 border-dashed border-border bg-background p-10 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-lg font-semibold">No files yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Upload documents, photos, contracts and more. Files are private to your account.
            </p>
            <Button className="mt-4" variant="hero" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />Upload your first file
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border">
            <ul className="divide-y divide-border">
              {files.map((f) => {
                const cat = catInfo(f.category);
                const isRenaming = inlineRename?.id === f.id;
                return (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Icon */}
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <cat.icon className="h-4 w-4" />
                    </div>

                    {/* Name / inline rename */}
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            autoFocus
                            value={inlineRename.value}
                            onChange={(e) => setInlineRename({ id: f.id, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename();
                              if (e.key === "Escape") setInlineRename(null);
                            }}
                            className="h-7 text-sm"
                          />
                          <button
                            onClick={commitRename}
                            disabled={rename.isPending}
                            className="rounded p-1 text-primary hover:bg-primary/10"
                            aria-label="Save rename"
                          >
                            {rename.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setInlineRename(null)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                            aria-label="Cancel rename"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p
                            className="truncate text-sm font-medium cursor-pointer hover:text-primary"
                            onClick={() => handleOpen(f)}
                            title="Click to open"
                          >
                            {f.filename}
                          </p>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] capitalize">
                              {cat.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{formatSize(f.size_bytes)}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(f.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    {!isRenaming && (
                      <div className="shrink-0 flex items-center gap-0.5">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Rename ${f.filename}`}
                          onClick={() => setInlineRename({ id: f.id, value: f.filename })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Open ${f.filename}`}
                          onClick={() => handleOpen(f)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          aria-label={`Delete ${f.filename}`}
                          disabled={remove.isPending}
                          onClick={() => setPendingDelete(f)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        destructive
        title="Delete this file?"
        description={<p>&ldquo;{pendingDelete?.filename}&rdquo; will be permanently removed.</p>}
        confirmLabel="Delete"
        onConfirm={async () => { if (pendingDelete) await remove.mutateAsync(pendingDelete); }}
      />
      </PremiumUpgradeGate>
    </AppShell>
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  FolderOpen, Upload, Vault, FileText, Image as ImageIcon, Receipt,
  Utensils, Mail, MapPin, Loader2, Download, Trash2, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEcosystem } from "@/lib/ecosystem-store";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "File Center — MelaBridge" },
      { name: "description", content: "Contracts, photos, invoices and floor plans — securely stored in BridgeVault™." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FilesPage,
});

const BUCKET = "bridgevault";
const MAX_FILE_MB = 25;

type Category = "contracts" | "photos" | "invoices" | "floorplans" | "menus" | "invitations" | "other";
const CATEGORIES: { key: Category; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { key: "contracts", icon: FileText, label: "Contracts" },
  { key: "photos", icon: ImageIcon, label: "Photos & videos" },
  { key: "invoices", icon: Receipt, label: "Invoices & receipts" },
  { key: "floorplans", icon: MapPin, label: "Floor plans" },
  { key: "menus", icon: Utensils, label: "Menus" },
  { key: "invitations", icon: Mail, label: "Invitations" },
];

type EventFile = {
  id: string;
  event_id: string;
  uploaded_by: string;
  category: string;
  storage_path: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

// Loose cast so we can use event_files before regenerated types land.
const db = supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> };

function FilesPage() {
  const { user } = useAuth();
  const { event, hasEvent, loading: eventLoading } = useEcosystem();
  const qc = useQueryClient();
  const [category, setCategory] = useState<Category>("contracts");
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filesQ = useQuery({
    queryKey: ["event-files", event.id],
    enabled: !!event.id,
    queryFn: async (): Promise<EventFile[]> => {
      const { data, error } = await db
        .from("event_files")
        .select("*")
        .eq("event_id", event.id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EventFile[];
    },
  });

  const files = filesQ.data ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of files) c[f.category] = (c[f.category] ?? 0) + 1;
    return c;
  }, [files]);

  const upload = useMutation({
    mutationFn: async (fileList: FileList) => {
      if (!user || !event.id) throw new Error("Sign in and pick an event first.");
      for (const file of Array.from(fileList)) {
        if (file.size > MAX_FILE_MB * 1024 * 1024) {
          throw new Error(`${file.name} is larger than ${MAX_FILE_MB} MB.`);
        }
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${event.id}/${Date.now()}-${safeName}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || undefined,
        });
        if (up.error) throw up.error;
        const ins = await db.from("event_files").insert({
          event_id: event.id,
          uploaded_by: user.id,
          category,
          storage_path: path,
          filename: file.name,
          mime_type: file.type || null,
          size_bytes: file.size,
        } as never);
        if (ins.error) {
          await supabase.storage.from(BUCKET).remove([path]);
          throw ins.error;
        }
      }
    },
    onSuccess: () => {
      toast.success("Uploaded to BridgeVault");
      qc.invalidateQueries({ queryKey: ["event-files", event.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Upload failed"),
    onSettled: () => setUploading(false),
  });

  const remove = useMutation({
    mutationFn: async (f: EventFile) => {
      await supabase.storage.from(BUCKET).remove([f.storage_path]);
      const del = await db.from("event_files").delete().eq("id", f.id);
      if (del.error) throw del.error;
    },
    onSuccess: () => {
      toast.success("File deleted");
      qc.invalidateQueries({ queryKey: ["event-files", event.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function handleDownload(f: EventFile) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Could not create download link");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <AppShell active="/files">
      <PageHeader
        eyebrow="File Center · BridgeVault™"
        icon={FolderOpen}
        title={<>Every document, <span className="text-gradient">safely stored</span>.</>}
        description={
          hasEvent
            ? `${event.name} · ${files.length} file${files.length === 1 ? "" : "s"} in BridgeVault™.`
            : "Create an event to start uploading documents to BridgeVault™."
        }
        actions={
          hasEvent ? (
            <Button
              variant="hero"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload files
            </Button>
          ) : (
            <Button asChild variant="hero">
              <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create event</Link>
            </Button>
          )
        }
      />

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const f = e.target.files;
          if (f && f.length) {
            setUploading(true);
            upload.mutate(f);
          }
          e.target.value = "";
        }}
      />

      <Card className="mt-8 border-primary/20 bg-hero-radial p-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
          <Vault className="h-3.5 w-3.5" />BridgeVault™
        </div>
        <p className="font-display text-lg font-semibold">Private, per-event document storage</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Files are stored privately and only visible to members of this event. Downloads use short-lived signed links.
          Max file size {MAX_FILE_MB} MB.
        </p>
      </Card>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Upload as</span>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCategory(c.key)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
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

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Card key={c.key} className="border-border/60 p-5 shadow-soft">
            <c.icon className="h-6 w-6 text-primary" />
            <p className="mt-3 font-medium">{c.label}</p>
            <p className="text-xs text-muted-foreground">{counts[c.key] ?? 0} file{(counts[c.key] ?? 0) === 1 ? "" : "s"}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold">All files</h2>
        {eventLoading || filesQ.isLoading ? (
          <div className="grid min-h-[160px] place-items-center rounded-2xl border border-border bg-card">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasEvent ? (
          <Card className="border-2 border-dashed border-border bg-background p-10 text-center">
            <Vault className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-lg font-semibold">Create an event to start uploading</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              BridgeVault™ scopes files to an event so your team sees exactly what they need.
            </p>
            <Button asChild className="mt-4" variant="hero">
              <Link to="/events/new"><Plus className="mr-2 h-4 w-4" />Create event</Link>
            </Button>
          </Card>
        ) : files.length === 0 ? (
          <Card className="border-2 border-dashed border-border bg-background p-10 text-center">
            <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-display text-lg font-semibold">No files yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
              Upload contracts, invoices, photos and more. Files stay private to members of this event.
            </p>
            <Button className="mt-4" variant="hero" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload className="mr-2 h-4 w-4" />Upload files
            </Button>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">File</th>
                  <th className="px-4 py-2 text-left">Category</th>
                  <th className="px-4 py-2 text-left">Size</th>
                  <th className="px-4 py-2 text-left">Uploaded</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{f.filename}</p>
                      {f.mime_type && <p className="text-xs text-muted-foreground">{f.mime_type}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="secondary" className="capitalize">{f.category}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatSize(f.size_bytes)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleDownload(f)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={remove.isPending}
                          onClick={() => {
                            if (confirm(`Delete ${f.filename}?`)) remove.mutate(f);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function formatSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

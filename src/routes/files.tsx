import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { RippleFeed } from "@/components/ripple-feed";
import { FolderOpen, FileText, Image as ImageIcon, Video, Music, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/files")({
  head: () => ({
    meta: [
      { title: "Files — MelaBridge" },
      { name: "description", content: "Every document, image, and asset in your event, connected to the right people and tasks." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FilesPage,
});

const FILES = [
  { name: "Bloomhaus_final_contract.pdf", type: "Contract", size: "412 KB", when: "Yesterday", icon: FileText },
  { name: "Lake Como venue walkthrough.mp4", type: "Video", size: "184 MB", when: "2 days ago", icon: Video },
  { name: "Save the date — batch 2.png", type: "Invitation", size: "2.1 MB", when: "3 days ago", icon: ImageIcon },
  { name: "Julien's vows draft.txt", type: "Note", size: "6 KB", when: "Last week", icon: FileText },
  { name: "Reception playlist — v3.m3u", type: "Playlist", size: "18 KB", when: "Last week", icon: Music },
  { name: "Guest allergy summary.csv", type: "Data", size: "9 KB", when: "Last week", icon: FileText },
  { name: "Onyema catering menu v2.pdf", type: "Contract", size: "228 KB", when: "2 weeks ago", icon: FileText },
  { name: "Villa d'Este site map.png", type: "Image", size: "3.4 MB", when: "3 weeks ago", icon: ImageIcon },
];

function FilesPage() {
  return (
    <AppShell active="/files">
      <PageHeader
        eyebrow="Files"
        icon={FolderOpen}
        title={<>Every asset, <span className="text-gradient">tagged and findable</span>.</>}
        description="Everything auto-links to the guest, vendor, or task it belongs to — and every file lives forever in BridgeVault™."
        actions={<Button variant="hero" className="gap-1"><Upload className="h-4 w-4" /> Upload</Button>}
      />
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {FILES.map((f) => (
              <li key={f.name} className="flex items-center gap-3 p-4">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary/15 to-gold/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.type} · {f.size} · {f.when}</p>
                </div>
                <Badge variant="secondary">{f.type}</Badge>
                <Button size="sm" variant="ghost">Open</Button>
              </li>
            ))}
          </ul>
        </div>
        <RippleFeed />
      </section>
    </AppShell>
  );
}

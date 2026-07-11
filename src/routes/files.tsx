import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FolderOpen, Upload, Sparkles, FileText, Image, Video, Receipt, MapPin, Utensils, Mail, Vault } from "lucide-react";

export const Route = createFileRoute("/files")({
  head: () => ({ meta: [
    { title: "File Center — MelaBridge" },
    { name: "description", content: "Contracts, photos, invoices, floor plans and more — auto-organized by BridgeVault™." },
    { name: "robots", content: "noindex" },
  ]}),
  component: FilesPage,
});

const FOLDERS = [
  { name:"Contracts", icon:FileText, count:12 },
  { name:"Photos", icon:Image, count:184 },
  { name:"Videos", icon:Video, count:8 },
  { name:"Invoices & receipts", icon:Receipt, count:34 },
  { name:"Seating & floor plans", icon:MapPin, count:6 },
  { name:"Menus", icon:Utensils, count:9 },
  { name:"Invitations", icon:Mail, count:5 },
];

const RECENT = [
  { name:"Grand Hall — contract v3.pdf", folder:"Contracts", size:"320 KB", when:"12m ago" },
  { name:"Tasting photos.zip", folder:"Photos", size:"18.4 MB", when:"2h ago" },
  { name:"Onyema catering menu.pdf", folder:"Menus", size:"1.1 MB", when:"1d ago" },
  { name:"Floor plan v4.png", folder:"Seating & floor plans", size:"640 KB", when:"2d ago" },
  { name:"Studio Nero invoice #221.pdf", folder:"Invoices & receipts", size:"88 KB", when:"3d ago" },
];

function FilesPage() {
  return (
    <AppShell active="/files">
      <PageHeader
        eyebrow="File Center · BridgeVault™"
        icon={FolderOpen}
        title={<>Every document, <span className="text-gradient">organized for you</span>.</>}
        description="Upload once — BridgeVault™ auto-categorizes contracts, invoices, floor plans and photos. Encrypted, versioned, and searchable."
        actions={<>
          <Button variant="outline"><Sparkles className="mr-2 h-4 w-4"/>Auto-organize</Button>
          <Button variant="hero"><Upload className="mr-2 h-4 w-4"/>Upload files</Button>
        </>}
      />

      <Tabs defaultValue="library" className="mt-8">
        <TabsList>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="recent">Recent</TabsTrigger>
          <TabsTrigger value="vault"><Vault className="mr-1.5 h-3.5 w-3.5"/>BridgeVault™</TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {FOLDERS.map(f=>(
              <div key={f.name} className="rounded-2xl border border-border bg-card p-4 transition hover:border-primary/40">
                <div className="flex items-center justify-between">
                  <f.icon className="h-6 w-6 text-primary"/>
                  <Badge variant="secondary">{f.count}</Badge>
                </div>
                <p className="mt-3 font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">Updated recently</p>
              </div>
            ))}
            <div className="rounded-2xl border-2 border-dashed border-border bg-background p-4 text-center">
              <Upload className="mx-auto h-6 w-6 text-muted-foreground"/>
              <p className="mt-2 text-sm">Drop files anywhere</p>
              <p className="text-xs text-muted-foreground">AI files them for you</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recent" className="mt-4">
          <div className="rounded-3xl border border-border bg-card divide-y divide-border">
            {RECENT.map(r=>(
              <div key={r.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-primary"/><div><p className="text-sm font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.folder} · {r.size} · {r.when}</p></div></div>
                <div className="flex gap-2"><Button size="sm" variant="ghost">Open</Button><Button size="sm" variant="ghost">Share</Button></div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="vault" className="mt-4">
          <div className="rounded-3xl border border-primary/20 bg-hero-radial p-6">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Vault className="h-3.5 w-3.5"/>Encrypted vault</div>
            <p className="font-display text-lg font-semibold">Signed contracts, IDs, sensitive invoices</p>
            <p className="mt-1 text-sm text-muted-foreground">End-to-end encrypted. Only owners can grant access.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {["Wedding contract — signed.pdf","Photographer NDA — signed.pdf","Deposit receipts (all).zip","Marriage license.pdf"].map(f=>(
                <div key={f} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <FileText className="h-5 w-5 text-primary"/>
                  <span className="text-sm font-medium">{f}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

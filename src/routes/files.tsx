import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FolderOpen, Upload, Vault, FileText, Image as ImageIcon, Receipt, Utensils, Mail, MapPin } from "lucide-react";

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

const CATEGORIES = [
  { icon: FileText, label: "Contracts" },
  { icon: ImageIcon, label: "Photos & videos" },
  { icon: Receipt, label: "Invoices & receipts" },
  { icon: MapPin, label: "Floor plans" },
  { icon: Utensils, label: "Menus" },
  { icon: Mail, label: "Invitations" },
];

function FilesPage() {
  return (
    <AppShell active="/files">
      <PageHeader
        eyebrow="File Center · BridgeVault™"
        icon={FolderOpen}
        title={<>Every document, <span className="text-gradient">organized for you</span>.</>}
        description="Upload contracts, invoices, photos and more — MelaAssist™ auto-categorizes and keeps everything encrypted in BridgeVault™."
        actions={
          <Button variant="hero" disabled title="File uploads are launching soon">
            <Upload className="mr-2 h-4 w-4" />Upload files
          </Button>
        }
      />

      <Card className="mt-8 border-primary/20 bg-hero-radial p-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary">
          <Vault className="h-3.5 w-3.5" />BridgeVault™
        </div>
        <p className="font-display text-lg font-semibold">Secure storage for every planning document</p>
        <p className="mt-1 text-sm text-muted-foreground">
          BridgeVault™ securely stores contracts, invoices, receipts, menus, photos, videos, vendor documents,
          guest lists, permits, design inspiration and floor plans. MelaAssist™ automatically categorizes
          uploads and makes them searchable.
        </p>
      </Card>

      <div className="mt-8 grid gap-3 md:grid-cols-3 lg:grid-cols-3">
        {CATEGORIES.map((c) => (
          <Card key={c.label} className="border-border/60 p-5 shadow-soft">
            <c.icon className="h-6 w-6 text-primary" />
            <p className="mt-3 font-medium">{c.label}</p>
            <p className="text-xs text-muted-foreground">No files uploaded yet</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 border-2 border-dashed border-border bg-background p-10 text-center">
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-display text-lg font-semibold">No files uploaded</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          File uploads to BridgeVault™ are launching soon. In the meantime, keep your important documents ready
          to import when it goes live.
        </p>
      </Card>
    </AppShell>
  );
}

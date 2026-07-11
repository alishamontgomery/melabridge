import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Bell,
  LayoutDashboard,
  GitBranch,
  Users,
  Store,
  Wallet,
  ClipboardList,
  Calendar,
  Handshake,
  Lightbulb,
  Vault,
  Dna,
  Globe2,
  BarChart3,
  Ticket,
  HeartHandshake,
  MessageSquare,
  FolderOpen,
  FileBarChart,
  Settings as SettingsIcon,
  Network,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";
import { EcosystemProvider } from "@/lib/ecosystem-store";
import { CommandPalette, CommandTrigger } from "@/components/command-palette";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ecosystem",
    items: [
      { to: "/dashboard", label: "AI Command Center", icon: LayoutDashboard },
      { to: "/ecosystem", label: "Ecosystem Map", icon: Network },
      { to: "/workspace", label: "Event Workspace", icon: GitBranch },
    ],
  },
  {
    label: "Planning",
    items: [
      { to: "/guests", label: "Guests", icon: Users },
      { to: "/vendors", label: "Vendors", icon: Store },
      { to: "/budget", label: "Budget", icon: Wallet },
      { to: "/tasks", label: "Tasks", icon: ClipboardList },
      { to: "/timeline", label: "Timeline", icon: Calendar },
      { to: "/decisions", label: "Decision Center™", icon: Lightbulb },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/collaboration", label: "Collaboration", icon: Handshake },
      { to: "/messaging", label: "Messaging", icon: MessageSquare },
      { to: "/tickets", label: "Tickets", icon: Ticket },
      { to: "/fundraising", label: "Fundraising", icon: HeartHandshake },
    ],
  },
  {
    label: "Memory & insight",
    items: [
      { to: "/bridgeworld", label: "BridgeWorld™", icon: Globe2 },
      { to: "/bridgedna", label: "BridgeDNA™", icon: Dna },
      { to: "/bridgevault", label: "BridgeVault™", icon: Vault },
      { to: "/bridge-intelligence", label: "Bridge Intelligence™", icon: BarChart3 },
      { to: "/reports", label: "Reports", icon: FileBarChart },
      { to: "/files", label: "Files", icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [{ to: "/settings", label: "Settings", icon: SettingsIcon }],
  },
];

export function AppShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <EcosystemProvider>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <Sparkles className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-semibold">MelaBridge</span>
              <Badge variant="secondary" className="ml-2 hidden sm:inline-flex bg-accent text-accent-foreground">
                Ecosystem™
              </Badge>
            </Link>
            <div className="flex flex-1 justify-center px-2">
              <CommandTrigger />
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="gap-2">
                <Bell className="h-4 w-4" /> <span className="hidden sm:inline">3</span>
              </Button>
              <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-sm font-semibold text-primary-foreground">
                A
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 sm:px-6">
          <aside className="hidden w-60 shrink-0 lg:block">
            <nav className="sticky top-20 space-y-6">
              {NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = item.to === active;
                      return (
                        <li key={item.to}>
                          <Link
                            to={item.to as "/dashboard"}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
                              isActive
                                ? "bg-accent text-accent-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                            }`}
                          >
                            <item.icon className="h-4 w-4" />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>

        <CommandPalette />
      </div>
    </EcosystemProvider>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-hero-radial p-6 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function RipplePanel() {
  return null;
}

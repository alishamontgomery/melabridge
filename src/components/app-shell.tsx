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
  Briefcase,
  Menu,
  User,
  Crown,
  Share2,
  Palette,
  Radio,
  Boxes,
  LifeBuoy,
  ShieldCheck,
  CreditCard,
  UserCheck,
  Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { EcosystemProvider } from "@/lib/ecosystem-store";
import { CommandPalette, CommandTrigger } from "@/components/command-palette";
import { useAuth, signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ecosystem",
    items: [
      { to: "/events", label: "Your events", icon: Calendar },
      { to: "/concierge", label: "Bridge Concierge™", icon: Sparkles },
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
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/budget", label: "Budget", icon: Wallet },
      { to: "/bridgepay", label: "BridgePay™", icon: CreditCard },
      { to: "/tasks", label: "Tasks", icon: ClipboardList },
      { to: "/timeline", label: "Timeline", icon: Calendar },
      { to: "/decisions", label: "Decision Center™", icon: Lightbulb },
      { to: "/travel", label: "Travel", icon: Globe2 },
      { to: "/bridgestudio", label: "BridgeStudio™", icon: Palette },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/collaboration", label: "Collaboration", icon: Handshake },
      { to: "/team", label: "Team", icon: Users },
      { to: "/messaging", label: "Messaging", icon: MessageSquare },
      { to: "/notifications", label: "Notifications", icon: Bell },
      { to: "/tickets", label: "Tickets", icon: Ticket },
      { to: "/fundraising", label: "Fundraising", icon: HeartHandshake },
      { to: "/share", label: "Share event", icon: Share2 },
    ],
  },
  {
    label: "Live & memory",
    items: [
      { to: "/bridgelive", label: "BridgeLive™", icon: Radio },
      { to: "/digital-twin", label: "Digital Twin™", icon: Boxes },
      { to: "/bridgegraph", label: "BridgeGraph™", icon: Network },
      { to: "/bridgeworld", label: "BridgeWorld™", icon: Globe2 },
      { to: "/bridgedna", label: "BridgeDNA™", icon: Dna },
      { to: "/bridgevault", label: "BridgeVault™", icon: Vault },
      { to: "/bridge-intelligence", label: "Bridge Intelligence™", icon: BarChart3 },
    ],
  },
  {
    label: "Portals",
    items: [
      { to: "/guest-portal", label: "Guest Portal", icon: UserCheck },
      { to: "/vendor-portal", label: "Vendor Portal", icon: Briefcase },
      { to: "/bridgepilot", label: "MelaAssist™", icon: Briefcase },
    ],
  },
  {
    label: "Insight",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/reports", label: "Reports", icon: FileBarChart },
      { to: "/files", label: "Files", icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: User },
      { to: "/subscription", label: "Subscription", icon: Crown },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/admin", label: "AdminOS™", icon: ShieldCheck },
      { to: "/help", label: "Help Center", icon: LifeBuoy },
      { to: "/tutorials", label: "AI Tutorials", icon: Sparkles },
    ],
  },
];

function UserMenu() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!user) {
    return (
      <Button asChild size="sm" variant="hero" className="rounded-full">
        <Link to="/auth">Sign in</Link>
      </Button>
    );
  }

  const initial = (user.user_metadata?.display_name || user.email || "U").toString().charAt(0).toUpperCase();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Account menu"
          className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-sm font-semibold text-primary-foreground"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/events" })}>Your events</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavList({ active, onNavigate }: { active: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
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
                    onClick={onNavigate}
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
  );
}

export function AppShell({ active, children }: { active: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <EcosystemProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-1.5 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-6">
            <div className="flex items-center gap-2">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 overflow-y-auto p-4">
                  <SheetHeader className="mb-4 text-left">
                    <SheetTitle className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                        <Sparkles className="h-3.5 w-3.5" />
                      </span>
                      MelaBridge
                    </SheetTitle>
                  </SheetHeader>
                  <NavList active={active} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
              <Link to="/" className="flex items-center gap-2">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="font-display text-lg font-semibold">MelaBridge</span>
                <Badge variant="secondary" className="ml-1 hidden sm:inline-flex bg-accent text-accent-foreground">
                  Ecosystem™
                </Badge>
              </Link>
            </div>
            <div className="hidden flex-1 justify-center px-2 md:flex">
              <CommandTrigger />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                to="/notifications"
                className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
              </Link>
              <UserMenu />
            </div>
          </div>
          <div className="mx-auto flex max-w-[1500px] px-3 pb-3 md:hidden">
            <CommandTrigger />
          </div>
        </header>

        <div className="mx-auto flex max-w-[1500px] gap-6 px-3 py-4 sm:px-6 sm:py-6">
          <aside className="hidden w-60 shrink-0 lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
              <NavList active={active} />
            </div>
          </aside>

          <main id="main-content" className="min-w-0 flex-1">{children}</main>
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
    <section className="relative overflow-hidden rounded-3xl border border-border bg-hero-radial p-5 shadow-soft sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Icon className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </section>
  );
}

export function RipplePanel() {
  return null;
}

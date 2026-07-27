import { BrandMark } from "@/components/brand-logo";
import { Link } from "@tanstack/react-router";
import {
  Sparkles,
  Bell,
  LayoutDashboard,
  Users,
  Store,
  Wallet,
  ClipboardList,
  Calendar,
  
  FolderOpen,
  Settings as SettingsIcon,
  Menu,
  User,
  Crown,
  LifeBuoy,
  ShieldCheck,
  CreditCard,
  Briefcase,
  BarChart3,
  FileBarChart,
  Network,
  Brain,
  Inbox,
  ScrollText,
  Star,
  Building2,
  Home,
  Flag,
  Boxes,
  Mail,
  BellRing,
  Palette,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/hooks/use-notifications";

import { CommandPalette, CommandTrigger } from "@/components/command-palette";
import { MelaAssistFloatingButton } from "@/components/melaassist";
import { SampleBanner } from "@/components/sample-banner";
import { useAuth, signOut } from "@/lib/auth";
import { useRole, type AppRole } from "@/lib/use-role";
import { useIdleSignout } from "@/hooks/use-idle-signout";
import { useDisplayName } from "@/lib/use-display-name";
import { LogOut, Loader2 } from "lucide-react";



type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }> };
type NavGroup = { label: string; items: NavItem[] };

const PLANNER_NAV: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { to: "/dashboard", label: "Home", icon: Home },
      { to: "/events", label: "My Events", icon: Calendar },
    ],
  },
  {
    label: "Planning",
    items: [
      { to: "/calendar", label: "Calendar", icon: Calendar },
      { to: "/guests", label: "Guests", icon: Users },
      { to: "/vendors", label: "Vendors", icon: Store },
      { to: "/bookings", label: "Bookings", icon: Briefcase },
      { to: "/budget", label: "Budget", icon: Wallet },
      { to: "/timeline", label: "Timeline", icon: Flag },
      { to: "/tasks", label: "Tasks", icon: ClipboardList },
    ],
  },
  {
    label: "Team",
    items: [
      { to: "/team", label: "Team", icon: Users },
    ],
  },
  {
    label: "Resources",
    items: [
      { to: "/files", label: "Files", icon: FolderOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: User },
      { to: "/subscription", label: "Subscription", icon: Crown },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/help", label: "Help Center", icon: LifeBuoy },
    ],
  },
];

const VENDOR_NAV: NavGroup[] = [
  {
    label: "Dashboard",
    items: [{ to: "/vendor", label: "Home", icon: Home }],
  },
  {
    label: "Business",
    items: [
      { to: "/calendar", label: "Calendar", icon: Calendar },
      { to: "/calendar/requests", label: "Requests", icon: Inbox },
      { to: "/vendor-portal", label: "Leads & Contracts", icon: Briefcase },
      { to: "/bookings", label: "Bookings", icon: Briefcase },
      { to: "/vendor-settings", label: "Booking Rules", icon: SettingsIcon },
    ],
  },
  {
    label: "Marketplace",
    items: [
      { to: "/profile", label: "Marketplace Listing", icon: Store },
      { to: "/vendor-profile-builder", label: "Complete with MelaAssist", icon: Sparkles },
    ],
  },
  {
    label: "Resources",
    items: [{ to: "/files", label: "Files", icon: FolderOpen }],
  },
  {
    label: "Account",
    items: [
      { to: "/subscription", label: "Subscription", icon: Crown },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
      { to: "/help", label: "Help", icon: LifeBuoy },
    ],
  },
];

const GUEST_NAV: NavGroup[] = [
  {
    label: "Your Event",
    items: [
      { to: "/guest-portal", label: "Event & RSVP", icon: Calendar },
      { to: "/timeline", label: "Schedule", icon: Calendar },
      { to: "/travel", label: "Travel", icon: Boxes },
    ],
  },
];

const ADMIN_NAV: NavGroup[] = [
  {
    label: "Dashboard",
    items: [
      { to: "/admin", label: "AdminOS™", icon: ShieldCheck },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/admin/users", label: "Users", icon: Users },
      { to: "/admin/invite", label: "Invite Users", icon: Users },
      { to: "/vendors", label: "Vendors", icon: Store },
      { to: "/events", label: "Events", icon: Calendar },
      { to: "/marketplace", label: "Marketplace", icon: Store },
      { to: "/analytics", label: "Analytics", icon: BarChart3 },
      { to: "/reports", label: "Reports", icon: FileBarChart },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/bridgepilot", label: "AI Command Center", icon: Sparkles },
      { to: "/ecosystem", label: "Ecosystem Map", icon: Network },
      { to: "/ai-memory", label: "AI & Memory", icon: Brain },
    ],
  },
  {
    label: "Settings",
    items: [
      { to: "/settings", label: "Platform Settings", icon: SettingsIcon },
      { to: "/subscription", label: "Subscription Mgmt", icon: Crown },
    ],
  },
];

export const NAV_BY_ROLE: Record<AppRole, NavGroup[]> = {
  personal: PLANNER_NAV,
  organization: PLANNER_NAV,
  vendor: VENDOR_NAV,
  admin: ADMIN_NAV,
};

// Legacy export for any external references.
export const NAV_GROUPS: NavGroup[] = PLANNER_NAV;

function UserMenu() {
  const { user } = useAuth();
  const { role } = useRole();
  const { firstName, fullName, businessName } = useDisplayName();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  if (!user) {
    return (
      <Button asChild size="sm" variant="hero" className="rounded-full">
        <Link to="/auth">Sign in</Link>
      </Button>
    );
  }

  const displayLabel = role === "vendor" ? (businessName || fullName) : fullName;
  const initial = (displayLabel || firstName || "U").charAt(0).toUpperCase();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut();
    navigate({ to: "/auth", replace: true });
  }

  const home = role === "vendor" ? "/vendor" : role === "admin" ? "/admin" : "/dashboard";

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
        <DropdownMenuLabel className="truncate">
          <div className="truncate text-sm font-medium">{displayLabel}</div>
          <div className="mt-0.5 text-[10px] uppercase tracking-widest text-muted-foreground">{role}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: home as "/dashboard" })}>Home</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>{role === "vendor" ? "Marketplace Listing" : "Profile"}</DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavList({ groups, active, onNavigate }: { groups: NavGroup[]; active: string; onNavigate?: () => void }) {
  return (
    <nav className="space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = item.to === active;
              return (
                <li key={`${group.label}-${item.label}`}>
                  <Link
                    to={item.to as "/dashboard"}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${
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

// Paths that are exclusive to a set of roles. Any signed-in user whose role does
// not match will be redirected to their own role home.
const ROLE_EXCLUSIVE: Array<{ prefix: string; allow: AppRole[] }> = [
  { prefix: "/admin", allow: ["admin"] },
  { prefix: "/vendor-portal", allow: ["vendor"] },
  { prefix: "/vendor-settings", allow: ["vendor"] },
  { prefix: "/vendor-profile-builder", allow: ["vendor"] },
  { prefix: "/vendor", allow: ["vendor"] }, // matches /vendor and /vendor/*
  { prefix: "/dashboard", allow: ["personal", "organization", "admin"] },
  // Planner-only surfaces — vendors must not reach them via direct nav or refresh.
  { prefix: "/guests", allow: ["personal", "organization", "admin"] },
  { prefix: "/budget", allow: ["personal", "organization", "admin"] },
  { prefix: "/timeline", allow: ["personal", "organization", "admin"] },
  { prefix: "/team", allow: ["personal", "organization", "admin"] },
  { prefix: "/vendors", allow: ["personal", "organization", "admin"] },
  { prefix: "/events", allow: ["personal", "organization", "admin"] },
  { prefix: "/tasks", allow: ["personal", "organization", "admin"] },
];

function roleHome(role: AppRole): "/dashboard" {
  return (role === "admin" ? "/admin" : role === "vendor" ? "/vendor" : "/dashboard") as "/dashboard";
}

export function AppShell({ active, children }: { active: string; children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { role, loading: roleLoading } = useRole();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const groups = NAV_BY_ROLE[role];
  useIdleSignout(!!user);


  useEffect(() => {
    if (loading || user) return;
    try {
      const path = window.location.pathname + window.location.search;
      if (path && path.startsWith("/") && !path.startsWith("/auth")) {
        window.sessionStorage.setItem("melabridge.auth.next", path);
      }
    } catch {
      // sessionStorage may be blocked; safe to ignore.
    }
    navigate({ to: "/auth", replace: true });
  }, [loading, user, navigate]);

  // Cross-role access block: redirect to the user's own home when they land on
  // a surface that is reserved for a different role.
  useEffect(() => {
    if (loading || roleLoading || !user) return;
    const path = typeof window !== "undefined" ? window.location.pathname : active;
    const match = ROLE_EXCLUSIVE.find(
      (r) => path === r.prefix || path.startsWith(`${r.prefix}/`),
    );
    if (match && !match.allow.includes(role)) {
      navigate({ to: roleHome(role), replace: true });
    }
  }, [loading, roleLoading, user, role, active, navigate]);

  if (loading || roleLoading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">{loading ? "Loading your workspace…" : "Redirecting to sign in…"}</p>
        </div>
      </div>
    );
  }

  return (
    <>


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
                      <BrandMark size="sm" />
                      MelaBridge
                    </SheetTitle>
                  </SheetHeader>
                  <NavList groups={groups} active={active} onNavigate={() => setMobileOpen(false)} />
                </SheetContent>
              </Sheet>
              <Link
                to={(role === "admin" ? "/admin" : role === "vendor" ? "/vendor" : "/dashboard") as "/dashboard"}
                className="flex items-center gap-2"
                aria-label="Home"
              >
                <BrandMark size="md" />
                <span className="font-display text-lg font-semibold">MelaBridge</span>
                <Badge variant="secondary" className="ml-1 hidden sm:inline-flex bg-accent text-accent-foreground capitalize">
                  {role}
                </Badge>
              </Link>
            </div>
            <div className="hidden flex-1 justify-center px-2 md:flex">
              <CommandTrigger />
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <NotificationsBell />
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
              <NavList groups={groups} active={active} />
            </div>
          </aside>

          <main id="main-content" className="min-w-0 flex-1">
            <SampleBanner />
            {children}
          </main>
        </div>

        <CommandPalette />
        <MelaAssistFloatingButton />
      </div>
    </>
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

function NotificationsBell() {
  const { unreadCount } = useNotifications(20);
  return (
    <Link
      to="/notifications"
      className="relative grid h-9 w-9 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Bell className="h-4 w-4" />
      {unreadCount > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[1rem] place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

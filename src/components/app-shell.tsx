import { Link } from "@tanstack/react-router";
import { Sparkles, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Command Center" },
  { to: "/bridgeworld", label: "BridgeWorld™" },
  { to: "/bridgedna", label: "BridgeDNA™" },
  { to: "/bridgevault", label: "BridgeVault™" },
  { to: "/bridge-intelligence", label: "Intelligence" },
] as const;

export function AppShell({ active, children }: { active: (typeof NAV)[number]["to"]; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">MelaBridge</span>
            <Badge variant="secondary" className="ml-2 hidden sm:inline-flex bg-accent text-accent-foreground">
              Intelligence™
            </Badge>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-md px-3 py-1.5 transition ${
                  n.to === active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
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
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-hero-radial p-8 shadow-soft">
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
        <Icon className="h-3.5 w-3.5" />
        {eyebrow}
      </div>
      <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-3xl text-muted-foreground">{description}</p>
    </section>
  );
}

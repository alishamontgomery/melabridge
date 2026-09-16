import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

const sectionLinks = [
  { label: "Hosts", href: "/#hosts" },
  { label: "Vendors", href: "/#vendors" },
  { label: "Planners", href: "/#planners" },
] as const;

const routeLinks = [
  { label: "Marketplace", to: "/marketplace" },
  { label: "Pricing", to: "/pricing" },
] as const;

export function SiteHeader({ user = false }: { user?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link
          to="/"
          aria-label="MelaBridge home"
          className="flex min-w-0 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={closeMenu}
        >
          <BrandLogo
            size="md"
            wordmarkClass="font-display text-lg font-semibold tracking-tight sm:text-xl"
          />
        </Link>

        <nav className="ml-auto hidden items-center gap-5 xl:flex" aria-label="Primary">
          {sectionLinks.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="whitespace-nowrap rounded-md px-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </a>
          ))}
          {routeLinks.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="whitespace-nowrap rounded-md px-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 xl:ml-5">
          {user ? (
            <Button variant="hero" size="sm" className="rounded-full px-3 sm:px-4" asChild>
              <Link to="/dashboard">Open app</Link>
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="rounded-full px-2.5 sm:px-3" asChild>
                <Link to="/auth">Log in</Link>
              </Button>
              <Button variant="hero" size="sm" className="rounded-full px-3 sm:px-4" asChild>
                <Link to="/auth" search={{ intent: "signup" } as never}>Sign up</Link>
              </Button>
            </>
          )}
          <button
            ref={menuButtonRef}
            type="button"
            className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border/70 px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="public-navigation-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
            <span>Menu</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="public-navigation-menu" className="border-t border-border/60 bg-background px-4 py-3 sm:px-6 xl:hidden">
          <nav className="mx-auto grid max-w-7xl gap-1" aria-label="Mobile primary">
            {sectionLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="rounded-md px-3 py-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={closeMenu}
              >
                {item.label}
              </a>
            ))}
            {routeLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-md px-3 py-3 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={closeMenu}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
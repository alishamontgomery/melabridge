import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-logo";
import { SiteFooter } from "@/components/site-footer";
import { useAuth } from "@/lib/auth";

/**
 * PublicShell — marketing-site chrome (SiteHeader + SiteFooter) that
 * preserves rich in-page content. Use for public product / marketing pages
 * that should NOT render the authenticated AppShell (sidebar, command
 * palette, etc.).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <BrandMark size="md" />
            <span className="font-display text-xl font-semibold tracking-tight">MelaBridge</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/how-it-works" className="text-sm text-muted-foreground hover:text-foreground">How it works</Link>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Button variant="hero" size="sm" className="rounded-full" asChild>
                <Link to="/dashboard">Open app</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="rounded-full" asChild>
                  <Link to="/auth">Log in</Link>
                </Button>
                <Button variant="hero" size="sm" className="rounded-full" asChild>
                  <Link to="/auth" search={{ intent: "signup" } as never}>Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}

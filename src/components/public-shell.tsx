import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
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
      <SiteHeader user={Boolean(user)} />

      <main className="mx-auto max-w-7xl px-6 py-10 sm:py-14">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}

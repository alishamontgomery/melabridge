import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";

function MarketingLogo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <div className="relative h-8 w-8">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary-glow to-primary" />
        <div className="absolute inset-1 rounded-full border border-gold/70" />
        <div className="absolute inset-2.5 rounded-full bg-gold" />
      </div>
      <span className="font-display text-xl font-semibold tracking-tight">MelaBridge</span>
    </Link>
  );
}

export function MarketingPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <MarketingLogo />
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <Link to="/features" className="text-sm text-muted-foreground hover:text-foreground">Features</Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground">About</Link>
            <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground">Contact</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-full" asChild>
              <Link to="/dashboard">Log in</Link>
            </Button>
            <Button variant="hero" size="sm" className="rounded-full" asChild>
              <Link to="/dashboard">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="bg-hero-radial relative overflow-hidden border-b border-border/60">
        <div className="mx-auto max-w-4xl px-6 py-20 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            {eyebrow}
          </div>
          <h1 className="mt-5 font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{description}</p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
        <div className="prose-content space-y-8 text-[15px] leading-relaxed text-foreground/90 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:mt-10 [&_h2]:mb-3 [&_h3]:font-display [&_h3]:text-lg [&_h3]:mt-6 [&_h3]:mb-2 [&_p]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
          {children}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-gold/5 p-8">
          <div>
            <p className="font-display text-2xl tracking-tight">Ready to plan your next moment?</p>
            <p className="mt-1 text-sm text-muted-foreground">Get started with MelaBridge in minutes.</p>
          </div>
          <Button variant="hero" size="lg" asChild>
            <Link to="/dashboard">Open MelaBridge <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

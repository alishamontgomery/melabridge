import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

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
      <SiteHeader />

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
            <Link to="/auth">Open MelaBridge <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

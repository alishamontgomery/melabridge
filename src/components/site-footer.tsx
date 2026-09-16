import { Link } from "@tanstack/react-router";
import { Instagram, Facebook, Mail } from "lucide-react";

type FooterLink = { label: string; to?: string; href?: string };
type FooterColumn = { title: string; links: FooterLink[] };

const COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Features", to: "/features" },
      { label: "How It Works", to: "/how-it-works" },
      { label: "Pricing", to: "/pricing" },
      { label: "Marketplace", to: "/marketplace" },
      { label: "AI Planning", to: "/ai-planning" },
      { label: "Vendors", to: "/marketplace" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Our Vision", to: "/vision" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help Center", to: "/help" },
      { label: "Frequently Asked Questions", to: "/faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of Service", to: "/terms" },
      { label: "Privacy Policy", to: "/privacy" },
      { label: "Refund Policy", to: "/refund" },
      { label: "Cancellation Policy", to: "/cancellation" },
      { label: "Vendor Terms", to: "/vendor-terms" },
      { label: "Organizer Terms", to: "/organizer-terms" },
      { label: "Ticketing Terms", to: "/ticketing-terms" },
      { label: "Payment Terms", to: "/payment-terms" },
      { label: "Cookie Policy", to: "/cookies" },
      { label: "Accessibility Statement", to: "/accessibility" },
    ],
  },
];

import { BrandLogo } from "@/components/brand-logo";
function FooterLogo() {
  return <BrandLogo size="lg" />;
}

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border/70 bg-background" aria-labelledby="site-footer-heading">
      <h2 id="site-footer-heading" className="sr-only">
        MelaBridge site footer
      </h2>

      {/* Soft divider glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />

      <div className="mx-auto max-w-7xl px-6 pt-20 pb-10 sm:pt-24">
        {/* Top: brand + newsletter */}
        <div className="grid gap-14 lg:grid-cols-[1.15fr_1fr]">
          <div className="max-w-xl">
            <FooterLogo />
            <h3 className="mt-8 font-display text-3xl leading-tight tracking-tight sm:text-4xl">
              Where Every Event Comes Together.
            </h3>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
              MelaBridge is the all-in-one AI-powered platform for planning weddings,
              birthdays, baby showers, reunions, conferences, fundraisers, vacations,
              celebrations of life, and every milestone in between.
            </p>
          </div>

          <div className="lg:pl-6">
            <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-primary/[0.04] via-background to-gold/[0.05] p-6 shadow-soft sm:p-8">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Stay Connected
              </div>
              <p className="mt-3 font-display text-2xl leading-snug tracking-tight sm:text-[26px]">
                Product updates, planning tips & inspiration.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Get feature releases, planning tips, and event inspiration delivered
                straight to your inbox.
              </p>

              <p
                className="mt-5 rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground"
                role="status"
              >
                Email updates are coming soon. No email address is collected yet.
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                No spam. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>

        {/* Middle: nav grid */}
        <nav
          aria-label="Footer navigation"
          className="mt-16 grid gap-10 border-t border-border/60 pt-14 sm:grid-cols-2 lg:grid-cols-5"
        >
          {COLUMNS.map((col) => (
            <div key={col.title} className={col.title === "Product" ? "lg:col-span-2" : ""}>
              <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70">
                {col.title}
              </div>
              <ul
                className={`mt-5 space-y-3 text-sm ${
                  col.title === "Product" ? "sm:grid sm:grid-cols-2 sm:gap-x-6 sm:space-y-0 sm:gap-y-3" : ""
                }`}
              >
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to as "/dashboard"}
                        className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Socials */}
        <div className="mt-14 flex flex-col items-start justify-between gap-6 border-t border-border/60 pt-10 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-foreground/70">
              Follow Us
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Everyday inspiration from real MelaBridge events.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://instagram.com/mela.bridge"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Follow MelaBridge on Instagram (@mela.bridge)"
              className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-4 py-2 text-sm text-muted-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary via-primary-glow to-gold text-primary-foreground transition-transform group-hover:scale-105">
                <Instagram className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">@mela.bridge</span>
            </a>
            <a
              href="https://www.facebook.com/melabridge"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Follow MelaBridge on Facebook"
              className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-background px-4 py-2 text-sm text-muted-foreground shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:text-foreground hover:shadow-elegant focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground transition-transform group-hover:scale-105">
                <Facebook className="h-3.5 w-3.5" />
              </span>
              <span className="font-medium">Facebook</span>
            </a>
          </div>
        </div>

        {/* Contact info */}
        <div className="mt-10 border-t border-border/60 pt-8 text-sm text-muted-foreground">
          <p>
            <span className="mr-2 text-[11px] font-semibold uppercase tracking-widest text-foreground/70">Email</span>
            <a href="mailto:hello@melabridge.com" className="text-foreground hover:text-primary">
              hello@melabridge.com
            </a>
          </p>
        </div>
      </div>



      {/* Bottom bar */}
      <div className="border-t border-border/60">
        <div className="mx-auto grid max-w-7xl gap-3 px-6 py-6 text-xs text-muted-foreground sm:grid-cols-3 sm:items-center">
          <div className="sm:text-left">© 2026 MelaBridge. All Rights Reserved.</div>
          <div className="font-display text-[13px] tracking-tight text-foreground/80 sm:text-center">
            Where Every Event Comes Together.
          </div>
          <div className="sm:text-right">
            Connecting people through life's most meaningful moments.
          </div>
        </div>
      </div>
    </footer>
  );
}

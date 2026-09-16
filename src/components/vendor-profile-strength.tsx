import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ChevronRight, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type VendorPhotoEntry = { url: string; type: string };

export type StrengthProfile = {
  logo_url?: string | null;
  portfolio_urls?: string[] | null;
  vendor_photos?: VendorPhotoEntry[] | null;
  business_description?: string | null;
  business_hours?: Record<string, string> | null;
  city?: string | null;
  phone?: string | null;
  website?: string | null;
  faqs?: { question: string; answer: string }[] | null;
};

type StrengthItem = {
  key: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
  hash?: string;
};

type ProfileStrengthProps = {
  profile: StrengthProfile | null;
  packageCount: number;
  faqCount?: number;
  compact?: boolean;
  onPublish?: () => void;
  publishPending?: boolean;
};

/** Minimum items completed to be eligible for public publishing. */
export const PUBLISH_THRESHOLD = 5;
export const STRENGTH_TOTAL = 8;

export function buildStrengthItems(
  profile: StrengthProfile | null,
  packageCount: number,
  faqCount = 0,
): StrengthItem[] {
  const vendorPhotos = profile?.vendor_photos ?? [];

  // Cover photo: prefer vendor_photos cover/both labels; fall back to portfolio_urls
  const hasCover =
    vendorPhotos.length > 0
      ? vendorPhotos.some((p) => p.type === "cover" || p.type === "both")
      : (profile?.portfolio_urls?.length ?? 0) >= 1;

  // Portfolio: prefer vendor_photos portfolio/both; fall back to portfolio_urls count
  const portfolioCount =
    vendorPhotos.length > 0
      ? vendorPhotos.filter(
          (p) => p.type === "portfolio" || p.type === "both",
        ).length
      : (profile?.portfolio_urls?.length ?? 0);

  // FAQs: prefer profile.faqs if present, otherwise use the passed-in prop
  const realFaqCount = Array.isArray(profile?.faqs)
    ? profile!.faqs!.length
    : faqCount;

  return [
    {
      key: "logo",
      label: "Add a logo",
      description: "A logo makes your listing stand out in search results.",
      done: !!profile?.logo_url,
      href: "/vendor-profile-builder",
      hash: "business-details",
    },
    {
      key: "cover",
      label: "Add a cover photo",
      description: "Photos help planners understand your work before reaching out.",
      done: hasCover,
      href: "/vendor-profile-builder",
      hash: "photos",
    },
    {
      key: "description",
      label: "Write a business description (100+ characters)",
      description: "Tell planners what makes you unique.",
      done: (profile?.business_description?.length ?? 0) >= 100,
      href: "/vendor-profile-builder",
      hash: "description",
    },
    {
      key: "package",
      label: "Add at least one package",
      description: "Planners filter by price — be discoverable.",
      done: packageCount >= 1,
      href: "/vendor-packages",
    },
    {
      key: "service_area",
      label: "Set your service area",
      description: "City and travel radius help planners find you.",
      done: !!profile?.city,
      href: "/vendor-profile-builder",
      hash: "business-details",
    },
    {
      key: "photos",
      label: "Add 3+ portfolio photos",
      description: "Listings with galleries convert best.",
      done: portfolioCount >= 3,
      href: "/vendor-profile-builder",
      hash: "photos",
    },
    {
      key: "availability",
      label: "Set your availability",
      description: "Show planners when you're available to take on events.",
      done:
        !!profile?.business_hours &&
        Object.keys(profile.business_hours as object).length > 0,
      href: "/calendar/settings",
    },
    {
      key: "faqs",
      label: "Add FAQs",
      description: "Answer common questions to reduce back-and-forth.",
      done: realFaqCount >= 1,
      href: "/vendor-profile-builder",
      hash: "faqs",
    },
  ];
}

export function ProfileStrength({
  profile,
  packageCount,
  faqCount = 0,
  compact = false,
  onPublish,
  publishPending,
}: ProfileStrengthProps) {
  const items = buildStrengthItems(profile, packageCount, faqCount);
  const doneCount = items.filter((i) => i.done).length;
  const pct = Math.round((doneCount / STRENGTH_TOTAL) * 100);
  const canPublish = doneCount >= PUBLISH_THRESHOLD;

  const barColor =
    pct >= 100
      ? "bg-emerald-500"
      : pct >= 62
        ? "bg-primary"
        : pct >= 37
          ? "bg-amber-400"
          : "bg-red-400";

  return (
    <Card className="border-border/60 shadow-soft">
      <div className={cn("p-5", compact && "p-4")}>
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold">
              Profile Strength
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {doneCount} of {STRENGTH_TOTAL} complete
            </p>
          </div>
          {canPublish && onPublish && (
            <Button
              size="sm"
              variant="hero"
              onClick={onPublish}
              disabled={publishPending}
              className="shrink-0"
            >
              {publishPending ? "Publishing…" : "Go Live"}
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              barColor,
            )}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Profile strength ${pct}%`}
          />
        </div>

        {!canPublish && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-950/30">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
              Complete at least {PUBLISH_THRESHOLD} items (
              {PUBLISH_THRESHOLD}/{STRENGTH_TOTAL}) to publish your listing.
            </p>
          </div>
        )}

        {/* Checklist */}
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.key}>
              <Link
                to={item.href as "/vendor-profile-builder"}
                hash={item.hash}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-accent/60",
                  item.done && "opacity-60",
                )}
                aria-label={
                  item.done
                    ? `${item.label} — complete`
                    : `${item.label} — ${item.description}`
                }
              >
                {item.done ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-emerald-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block font-medium leading-snug",
                      item.done &&
                        "font-normal line-through text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </span>
                  {!item.done && !compact && (
                    <span className="block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </div>
                {!item.done && (
                  <ChevronRight
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

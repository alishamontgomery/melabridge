import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PublicShell } from "@/components/public-shell";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  MapPin, Globe, Clock, ExternalLink, BadgeCheck, Star, CheckCircle2,
  DollarSign, ChevronRight, Loader2, Heart, Send,
  MessageCircle, ChevronDown, ChevronUp, ArrowLeft, X, ChevronLeft, Phone, Mail,
  Eye,
} from "lucide-react";
import { ensureAbsoluteUrl } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { VendorPackage } from "@/lib/vendor-packages.functions";
import {
  formatCategoryFieldSummary,
  getCategorySpec,
} from "@/lib/vendor-category-fields";
import { submitInquiry } from "@/lib/bookings.functions";
import { getVendorCategories } from "@/lib/vendor-categories";
import { getVendorServiceTypes } from "@/lib/vendor-categories";

export const Route = createFileRoute("/vendor-profile/$vendorId")({
  validateSearch: z.object({
    preview: z.enum(["1", "true"]).optional(),
  }),
  head: () => ({
    meta: [
      { title: "Vendor Profile — MelaBridge" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: VendorProfilePage,
});

type VendorPhoto = { url: string; type: string };
const PRICE_BASIS_LABELS: Record<NonNullable<VendorPackage["price_basis"]>, string> = {
  flat_rate: "Flat rate",
  per_person: "Per person",
  per_hour: "Per hour",
  per_event: "Per event",
  per_item: "Per item",
  custom_unit: "Custom unit",
  custom_quote: "Custom quote",
};

type VendorProfile = {
  id: string;
  business_name: string | null;
  business_category: string | null;
  business_categories: string[] | null;
  custom_service_types: string[] | null;
  business_description: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  portfolio_urls: string[] | null;
  vendor_photos: VendorPhoto[] | null;
  faqs: { question: string; answer: string }[] | null;
  starting_price: number | null;
  mobile_service: boolean | null;
  travel_radius: number | null;
  years_in_business: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  social_links: Record<string, string> | null;
  business_hours: Record<string, string> | null;
  onboarding_completed: boolean | null;
  is_verified: boolean | null;
};

// ── DB-backed favorite for this vendor ───────────────────────────────────────

function useVendorFavorite(userId: string | undefined, vendorId: string) {
  const qc = useQueryClient();
  const QUERY_KEY = ["vendor-favorite", userId, vendorId];

  const { data: isFavorited = false } = useQuery({
    queryKey: QUERY_KEY,
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("search_favorites")
        .select("id")
        .eq("user_id", userId!)
        .eq("entity_type", "vendor")
        .eq("entity_id", vendorId)
        .maybeSingle();
      return !!data;
    },
  });

  const addMut = useMutation({
    mutationFn: async (profile: VendorProfile) => {
      const { error } = await supabase.from("search_favorites").upsert({
        user_id: userId!,
        entity_type: "vendor",
        entity_id: vendorId,
        title: profile.business_name ?? "Vendor",
        subtitle: getVendorCategories(profile).join(", "),
        href: `/vendor-profile/${vendorId}`,
      }, { onConflict: "user_id,entity_type,entity_id" });
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      qc.setQueryData<boolean>(QUERY_KEY, true);
    },
    onError: () => {
      qc.setQueryData<boolean>(QUERY_KEY, false);
      toast.error("Couldn't save to favorites");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["vendor-favorites", userId] });
    },
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("search_favorites")
        .delete()
        .eq("user_id", userId!)
        .eq("entity_type", "vendor")
        .eq("entity_id", vendorId);
      if (error) throw error;
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      qc.setQueryData<boolean>(QUERY_KEY, false);
    },
    onError: () => {
      qc.setQueryData<boolean>(QUERY_KEY, true);
      toast.error("Couldn't remove from favorites");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
      qc.invalidateQueries({ queryKey: ["vendor-favorites", userId] });
    },
  });

  const toggle = useCallback(
    (profile: VendorProfile) => {
      if (!userId) { toast.info("Sign in to save favorites"); return; }
      if (isFavorited) removeMut.mutate();
      else addMut.mutate(profile);
    },
    [userId, isFavorited, addMut, removeMut],
  );

  return { isFavorited, toggle };
}

const EVENT_TYPES = [
  "Wedding", "Engagement Party", "Birthday", "Anniversary",
  "Baby Shower", "Bridal Shower", "Corporate Event", "Conference",
  "Cultural Celebration", "Graduation", "Other",
];

// ── Inquiry dialog (own component so typing doesn't re-render the whole page) ─

const InquiryDialog = memo(function InquiryDialog({
  open,
  onOpenChange,
  profile,
  user,
  navigate,
  initialMessage,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile: VendorProfile;
  user: { id: string } | null;
  navigate: ReturnType<typeof useNavigate>;
  initialMessage: string;
}) {
  const submitFn = useServerFn(submitInquiry);
  const [form, setForm] = useState({ eventName: "", eventDate: "", eventType: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [duplicate, setDuplicate] = useState(false);
  const prevOpen = useRef(false);

  // Reset form each time the dialog opens; pre-populate package message if provided.
  useEffect(() => {
    if (open && !prevOpen.current) {
      setForm({ eventName: "", eventDate: "", eventType: "", message: initialMessage });
      setSent(false);
      setDuplicate(false);
    }
    prevOpen.current = open;
  }, [open, initialMessage]);

  async function sendInquiry(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      toast.info("Sign in first — you'll be brought back here to complete your inquiry.");
      onOpenChange(false);
      navigate({ to: "/auth", search: { next: window.location.pathname } });
      return;
    }
    if (!form.eventDate) { toast.error("Please pick an event date"); return; }
    setSending(true);
    try {
      const result = await submitFn({
        data: {
          vendorId: profile.id,
          eventName: form.eventName.trim() || "Event inquiry",
          eventDate: form.eventDate,
          eventType: form.eventType || null,
          message: form.message.trim() || null,
        },
      });
      if (result.duplicate) {
        setDuplicate(true);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send inquiry. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!sending) onOpenChange(o); }}>
      <DialogContent
        className="flex max-h-[92svh] flex-col overflow-hidden sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="font-display text-lg">
            Send inquiry to {profile.business_name ?? "vendor"}
          </DialogTitle>
          <DialogDescription>
             Share a few event details so the vendor can review your note and contact you directly.
          </DialogDescription>
        </DialogHeader>

        {duplicate ? (
          <div className="py-6 text-center">
            <MessageCircle className="mx-auto mb-3 h-12 w-12 text-primary" />
            <p className="font-display text-lg font-semibold">
              You already have a pending inquiry with this vendor
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              View your existing inquiry instead of sending the vendor another copy.
            </p>
            <Button asChild className="mt-5 w-full gap-2">
              <Link to="/bookings">
                <Eye className="h-4 w-4" /> View inquiry
              </Link>
            </Button>
          </div>
        ) : sent ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
            <p className="font-display text-lg font-semibold">Inquiry sent!</p>
            <p className="mt-1 text-sm text-muted-foreground">
               Your note was saved to your event workspace. If the vendor wants to continue the conversation, they can contact you directly.
            </p>
            <div className="mt-5">
              <Button asChild className="w-full gap-2">
                <Link to="/bookings">
                  <CheckCircle2 className="h-4 w-4" /> View my inquiries
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <form onSubmit={sendInquiry} className="space-y-4 px-1 pt-1 pb-2">
              <div className="space-y-1.5">
                <Label htmlFor="inq-name">Event name</Label>
                <Input
                  id="inq-name"
                  placeholder="e.g. Priya & Jay's Wedding"
                  autoComplete="off"
                  value={form.eventName}
                  onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inq-date">Event date *</Label>
                <Input
                  id="inq-date"
                  type="date"
                  required
                  value={form.eventDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inq-type">Event type</Label>
                <Select value={form.eventType} onValueChange={(v) => setForm((f) => ({ ...f, eventType: v }))}>
                  <SelectTrigger id="inq-type">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="inq-msg">Message</Label>
                <Textarea
                  id="inq-msg"
                  placeholder="Tell them about your event, any special requirements, or questions you have…"
                  rows={4}
                  autoComplete="off"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={sending}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 gap-2" disabled={sending}>
                  {sending ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : <><Send className="h-4 w-4" /> Send inquiry</>}
                </Button>
              </div>

              <p className="text-center text-[11px] text-muted-foreground">
                Your inquiry goes directly to the vendor. MelaBridge does not facilitate payments or contracts at this stage.
              </p>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

// ── Page ─────────────────────────────────────────────────────────────────────

function VendorProfilePage() {
  const { vendorId } = Route.useParams();
  const { preview } = Route.useSearch();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [packages, setPackages] = useState<VendorPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Inquiry dialog state — form state lives inside <InquiryDialog> to isolate re-renders
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [inquiryInitialMessage, setInquiryInitialMessage] = useState("");

  const fav = useVendorFavorite(user?.id, vendorId);

  // Dynamic page title
  useEffect(() => {
    if (profile) {
      const name = profile.business_name ?? "Vendor";
      const cat = profile.business_category ?? "";
      const loc = [profile.city, profile.state].filter(Boolean).join(", ");
      document.title = [name, cat, loc, "MelaBridge"].filter(Boolean).join(" · ");
    }
    return () => { document.title = "MelaBridge"; };
  }, [profile]);

  // Lightbox state
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(vendorId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [vpResult, pkgResult] = await Promise.all([
          supabase
            .from("vendor_profiles_public")
            .select(
               "id, business_name, business_category, business_categories, custom_service_types, business_description, city, state, logo_url, portfolio_urls, vendor_photos, faqs, starting_price, mobile_service, travel_radius, years_in_business, phone, email, website, social_links, business_hours, onboarding_completed, is_verified",
            )
            .eq("id", vendorId)
            .maybeSingle(),
          supabase
            .from("vendor_packages")
            .select("*")
            .eq("vendor_id", vendorId)
            .eq("is_visible", true)
            .order("is_featured", { ascending: false })
            .order("sort_order", { ascending: true }),
        ]);
        if (cancelled) return;
        let profileData: any = vpResult.data;
        if ((!profileData || vpResult.error) && preview && user?.id) {
          const ownerResult = await (supabase as any)
            .from("vendor_profiles")
            .select(
              "id, business_name, business_category, business_categories, custom_service_types, business_description, city, state, logo_url, portfolio_urls, vendor_photos, faqs, starting_price, mobile_service, travel_radius, years_in_business, phone, email, website, social_links, business_hours, onboarding_completed, is_verified, contact_visibility",
            )
            .eq("id", vendorId)
            .eq("user_id", user.id)
            .maybeSingle();
          if (!ownerResult.error && ownerResult.data) {
            const ownerData = ownerResult.data as Record<string, any>;
            const visibility = (ownerData.contact_visibility ?? {}) as Record<string, string>;
            profileData = {
              ...ownerData,
              phone: visibility.phone === "public" ? ownerData.phone : null,
              email: visibility.email === "public" ? ownerData.email : null,
              website: visibility.website === "public" ? ownerData.website : null,
            };
          }
        }
        if (!profileData) {
          setNotFound(true);
          return;
        }
        if (pkgResult.error) throw pkgResult.error;
        setProfile(profileData as unknown as VendorProfile);
        setPackages(((pkgResult.data ?? []) as unknown as VendorPackage[]));
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [vendorId, preview, user?.id, authLoading]);

  const Shell = ({ children }: { children: React.ReactNode }) =>
    !authLoading && !user ? (
      <PublicShell>{children}</PublicShell>
    ) : (
      <AppShell active="/marketplace">{children}</AppShell>
    );

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" /> Loading profile…
        </div>
      </Shell>
    );
  }

  if (notFound || !profile) {
    return (
      <Shell>
        <Card className="p-10 text-center">
          <p className="font-display text-lg font-semibold">Vendor not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This profile may have been removed or the link may be incorrect.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/marketplace">Browse vendors</Link>
          </Button>
        </Card>
      </Shell>
    );
  }

  const location = [profile.city, profile.state].filter(Boolean).join(", ");

  const social =
    profile.social_links &&
    typeof profile.social_links === "object" &&
    !Array.isArray(profile.social_links)
      ? (profile.social_links as Record<string, string>)
      : null;

  const hours =
    profile.business_hours &&
    typeof profile.business_hours === "object" &&
    !Array.isArray(profile.business_hours)
      ? (profile.business_hours as Record<string, string>)
      : null;

  // Derive cover + gallery from vendor_photos, falling back to portfolio_urls
  const vendorPhotos = (profile.vendor_photos ?? []) as VendorPhoto[];
  const coverPhoto =
    vendorPhotos.find((p) => p.type === "cover" || p.type === "both")?.url ??
    profile.portfolio_urls?.[0] ??
    null;
  // Exclude cover-only photos from gallery (already shown in hero)
  const galleryPhotos: string[] =
    vendorPhotos.length > 0
      ? vendorPhotos
          .filter((p) => p.url !== coverPhoto && (p.type === "portfolio" || p.type === "both"))
          .map((p) => p.url)
      : (profile.portfolio_urls ?? []);

  const faqs = Array.isArray(profile.faqs) ? profile.faqs as { question: string; answer: string }[] : [];

  const featuredPkg = packages.find((p) => p.is_featured) ?? null;
  const otherPkgs = packages.filter((p) => p !== featuredPkg);
  const isOwnerPreview = preview === "1" && profile.onboarding_completed !== true;

  function openInquiry(pkgName?: string) {
    if (!user) {
      toast.info("Sign in to send an inquiry to this vendor.");
      navigate({ to: "/auth", search: { next: window.location.pathname } });
      return;
    }
    setInquiryInitialMessage(pkgName ? `I'm interested in your "${pkgName}" package.` : "");
    setInquiryOpen(true);
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl space-y-6 pb-16">
        {/* ── Breadcrumb ── */}
        <nav className="flex items-center gap-1.5 px-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
          <Link to="/marketplace" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Marketplace
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate text-foreground font-medium">{profile.business_name ?? "Vendor"}</span>
        </nav>

        {isOwnerPreview && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100" role="status">
            <Eye className="mt-0.5 h-4 w-4 shrink-0" />
            <p><span className="font-semibold">Private preview.</span> Only you can see this draft. It stays hidden from Marketplace until you publish it.</p>
          </div>
        )}

        {/* ── Hero ── */}
        <div className="relative overflow-hidden rounded-3xl">
          <div className="h-52 bg-gradient-to-br from-primary/30 via-gold/15 to-primary/5 sm:h-72">
            {coverPhoto && (
              <img
                src={coverPhoto}
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-65"
                loading="eager"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-background from-25% via-background/50 via-55% to-transparent" />
          </div>

          {/* Identity */}
          <div className="-mt-14 flex flex-wrap items-end gap-4 px-5 pb-0 sm:px-8">
            <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-background bg-background shadow-elegant">
              {profile.logo_url ? (
                <img src={profile.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-3xl font-bold text-primary">
                  {(profile.business_name ?? "?").charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                  {profile.business_name ?? "Unnamed vendor"}
                </h1>
                {profile.is_verified && (
                  <Badge className="gap-1 border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                    <BadgeCheck className="h-3.5 w-3.5" /> BridgeCheck™
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {getVendorServiceTypes(profile).join(" · ") || "Vendor"}
                {location ? ` · ${location}` : ""}
              </p>
            </div>
          </div>
        </div>

        {/* ── Action bar ── */}
         <div className="flex flex-wrap items-center gap-2 px-1">
           {!isOwnerPreview && <Button onClick={() => openInquiry()} className="gap-2" variant="hero">
            <Send className="h-4 w-4" />
            Send inquiry
           </Button>}

          <Button
            variant="outline"
            className={cn(
              "gap-2",
              fav.isFavorited && "border-rose-400/60 bg-rose-50 text-rose-600 hover:bg-rose-50 dark:bg-rose-950/20 dark:text-rose-400",
            )}
            onClick={() => fav.toggle(profile)}
            aria-label={fav.isFavorited ? "Remove from favorites" : "Save to favorites"}
          >
            <Heart className={cn("h-4 w-4", fav.isFavorited && "fill-current")} />
            {fav.isFavorited ? "Saved" : "Save"}
          </Button>

          {ensureAbsoluteUrl(profile.website) && (
            <Button asChild variant="outline" className="gap-1.5">
              <a href={ensureAbsoluteUrl(profile.website)!} target="_blank" rel="noreferrer noopener">
                <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          )}
        </div>

        {/* ── Quick facts ── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact
            label="Starting at"
            value={profile.starting_price != null ? `$${profile.starting_price.toLocaleString()}` : "By quote"}
            icon={<DollarSign className="h-4 w-4" />}
          />
          <Fact
            label="Service area"
            value={
              profile.mobile_service
                ? profile.travel_radius
                  ? `Up to ${profile.travel_radius} mi`
                  : "Available to travel"
                : location || "Local"
            }
            icon={<MapPin className="h-4 w-4" />}
          />
          <Fact
            label="Experience"
            value={typeof profile.years_in_business === "number" && profile.years_in_business > 0
              ? `${profile.years_in_business} year${profile.years_in_business === 1 ? "" : "s"}`
              : "New to platform"}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* Left */}
          <div className="space-y-8">
            {/* About */}
            {profile.business_description && (
              <ProfileSection title="About">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {profile.business_description}
                </p>
              </ProfileSection>
            )}

            {/* Packages */}
            {(featuredPkg || otherPkgs.length > 0) && (
              <ProfileSection title="Packages">
                <div className="space-y-3">
                  {featuredPkg && (
                    <PkgCard
                      pkg={featuredPkg}
                      category={profile.business_category}
                      featured
                       onInquire={isOwnerPreview ? undefined : openInquiry}
                    />
                  )}
                  {otherPkgs.map((pkg) => (
                    <PkgCard
                      key={pkg.id}
                      pkg={pkg}
                      category={profile.business_category}
                       onInquire={isOwnerPreview ? undefined : openInquiry}
                    />
                  ))}
                </div>
              </ProfileSection>
            )}

            {/* Gallery */}
            {galleryPhotos.length > 0 && (
              <ProfileSection title="Portfolio">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {galleryPhotos.slice(0, 9).map((url, i) => (
                    <button
                      key={`${url}-${i}`}
                      type="button"
                      onClick={() => setLightboxIndex(i)}
                      className="aspect-square overflow-hidden rounded-xl bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary group"
                      aria-label={`View ${profile.business_name ?? "portfolio"} image ${i + 1}`}
                    >
                      <img
                        src={url}
                        alt={`${profile.business_name ?? "Portfolio"} image ${i + 1}`}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
                {galleryPhotos.length > 9 && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    {galleryPhotos.length - 9} more photo{galleryPhotos.length - 9 !== 1 ? "s" : ""} — contact to see the full portfolio
                  </p>
                )}
              </ProfileSection>
            )}

            {/* FAQs */}
            {faqs.length > 0 && (
              <ProfileSection title="Frequently asked questions">
                <FaqList faqs={faqs} />
              </ProfileSection>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Inquiry CTA card */}
            <Card className="overflow-hidden border-primary/20 shadow-soft">
              <div className="bg-gradient-to-br from-primary/10 to-gold/5 p-5">
                <div className="mb-1 flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-primary" />
                  <h3 className="font-display text-base font-semibold">Get in touch</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Tell {profile.business_name ?? "this vendor"} about your event — they'll respond directly.
                </p>
                <Button onClick={() => openInquiry()} className="mt-4 w-full gap-2" variant="hero">
                  <Send className="h-4 w-4" /> Send inquiry
                </Button>
              </div>

              {/* External contact fallback */}
              {(profile.phone || profile.email || profile.website || (social && Object.keys(social).length > 0)) && (
                <div className="border-t border-border/50 p-4">
                  <p className="mb-2 text-xs text-muted-foreground">Or reach out directly</p>
                  <div className="flex flex-col gap-1.5">
                    {profile.phone && (
                      <Button asChild size="sm" variant="outline" className="w-full justify-start gap-2">
                        <a href={`tel:${profile.phone}`}>
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{profile.phone}</span>
                        </a>
                      </Button>
                    )}
                    {profile.email && (
                      <Button asChild size="sm" variant="outline" className="w-full justify-start gap-2">
                        <a href={`mailto:${profile.email}`}>
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{profile.email}</span>
                        </a>
                      </Button>
                    )}
                    {ensureAbsoluteUrl(profile.website) && (
                      <Button asChild size="sm" variant="outline" className="w-full justify-start gap-2">
                        <a href={ensureAbsoluteUrl(profile.website)!} target="_blank" rel="noreferrer noopener">
                          <Globe className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Visit website</span>
                          <ExternalLink className="ml-auto h-3 w-3 shrink-0" />
                        </a>
                      </Button>
                    )}
                    {social && Object.entries(social).slice(0, 2).map(([label, url]) => {
                      const href = ensureAbsoluteUrl(String(url));
                      return href ? (
                        <Button key={label} asChild size="sm" variant="outline" className="w-full justify-start gap-2">
                          <a href={href} target="_blank" rel="noreferrer noopener">
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{label}</span>
                            <ExternalLink className="ml-auto h-3 w-3 shrink-0" />
                          </a>
                        </Button>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </Card>

            {/* Service area */}
            {(profile.city || profile.mobile_service) && (
              <Card className="border-border/60 p-4 shadow-soft">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> Service area
                </h3>
                <p className="text-sm text-muted-foreground">
                  {location && <>Based in {location}. </>}
                  {profile.mobile_service
                    ? profile.travel_radius
                      ? `Travels up to ${profile.travel_radius} miles for events.`
                      : "Available for travel."
                    : "Serves the local area."}
                </p>
              </Card>
            )}

            {/* Hours */}
            {hours && Object.keys(hours).length > 0 && (
              <Card className="border-border/60 p-4 shadow-soft">
                <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" /> Business hours
                </h3>
                <dl className="space-y-1 text-sm">
                  {Object.entries(hours).map(([day, val]) => (
                    <div key={day} className="flex justify-between gap-2">
                      <dt className="font-medium capitalize">{day}</dt>
                      <dd className="text-muted-foreground">{String(val)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

            {/* Save */}
            <Card className="border-border/60 p-4 shadow-soft">
              <Button
                className={cn(
                  "w-full gap-2",
                  fav.isFavorited
                    ? "border border-rose-400/60 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/20 dark:text-rose-400"
                    : "",
                )}
                variant="outline"
                onClick={() => fav.toggle(profile)}
              >
                <Heart className={cn("h-4 w-4", fav.isFavorited && "fill-current text-rose-500")} />
                {fav.isFavorited ? "Saved to favorites" : "Save to favorites"}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Appears in your Vendors → Favorites tab.
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* ── Photo Lightbox ── */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={galleryPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNav={setLightboxIndex}
          vendorName={profile.business_name ?? "Portfolio"}
        />
      )}

      {/* ── Inquiry Dialog — isolated component to prevent page re-renders on typing ── */}
      <InquiryDialog
        open={inquiryOpen}
        onOpenChange={setInquiryOpen}
        profile={profile}
        user={user}
        navigate={navigate}
        initialMessage={inquiryInitialMessage}
      />
    </Shell>
  );
}

/* ── Helper components ────────────────────────────────────────────────────── */

function PkgCard({
  pkg,
  category,
  featured,
  onInquire,
}: {
  pkg: VendorPackage;
  category: string | null;
  featured?: boolean;
  onInquire?: (name: string) => void;
}) {
  const [expanded, setExpanded] = useState(featured ?? false);
  const [backdropLightboxIndex, setBackdropLightboxIndex] = useState<number | null>(null);
  const priceStr =
    pkg.price_type === "contact"
      ? "Custom quote"
      : pkg.price_cents != null
        ? `${pkg.price_type === "starting_at" ? "From " : ""}$${(pkg.price_cents / 100).toLocaleString()}${pkg.price_basis && pkg.price_basis !== "custom_quote" ? ` / ${PRICE_BASIS_LABELS[pkg.price_basis].toLowerCase().replace("flat rate", "package")}` : ""}`
        : "Contact for pricing";
  const effectiveCategory = pkg.service_category ?? category;
  const categorySpec = getCategorySpec(effectiveCategory);
  const categoryChips = categorySpec
    ? formatCategoryFieldSummary(pkg.category_fields ?? {}, categorySpec)
    : [];
  const backdropPhotos = Array.isArray(pkg.category_fields?.backdrop_from_profile)
    ? pkg.category_fields.backdrop_from_profile.filter(
        (photo): photo is string => typeof photo === "string" && photo.trim().length > 0,
      )
    : [];
  const hasDetails =
    Boolean(pkg.description) ||
    pkg.inclusions.length > 0 ||
    pkg.add_ons.length > 0 ||
    backdropPhotos.length > 0;
  const detailsId = `package-details-${pkg.id}`;

  return (
    <>
    <Card className={cn("overflow-hidden border-border/60 shadow-soft", featured && "border-primary/40 bg-primary/5 ring-1 ring-primary/10")}>
      {pkg.photos?.[0] && (
        <img
          src={pkg.photos[0]}
          alt={`${pkg.name} package`}
          className="h-44 w-full object-cover"
          loading="lazy"
        />
      )}
      <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display font-semibold">{pkg.name}</p>
            {featured && (
              <Badge className="gap-1 bg-primary/15 text-[10px] text-primary">
                <Star className="h-3 w-3 fill-current" /> Featured
              </Badge>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-2">
            <span className="text-sm font-medium text-primary">{priceStr}</span>
            {pkg.duration && (
              <span className="text-sm text-muted-foreground">· {pkg.duration}</span>
            )}
            {pkg.service_category && (
              <Badge variant="outline" className="text-[10px]">
                {pkg.service_category}
              </Badge>
            )}
          </div>
          {categoryChips.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {categoryChips.map((chip) => (
                <Badge key={chip} variant="outline" className="bg-background/70 text-xs font-normal">
                  {chip}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasDetails && (
        <>
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-lg py-1 text-left text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailsId}
          >
            {expanded ? "Hide package details" : "View package details"}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded && (
            <div id={detailsId} className="mt-2 border-t border-border/60 pt-3">
              {pkg.description && (
                <p className="text-sm leading-relaxed text-muted-foreground">{pkg.description}</p>
              )}
              {pkg.inclusions.length > 0 && (
                <div className={cn(pkg.description && "mt-3")}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Included</p>
                  <ul className="mt-1.5 space-y-1">
                    {pkg.inclusions.map((inc, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                        {inc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {pkg.add_ons.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-muted-foreground">Optional add-ons</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pkg.add_ons.map((a, i) => (
                      <span
                        key={i}
                        className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {backdropPhotos.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Available backdrops
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {backdropPhotos.map((photo, index) => (
                      <button
                        key={`${photo}-${index}`}
                        type="button"
                        className="aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        onClick={() => setBackdropLightboxIndex(index)}
                        aria-label={`View backdrop ${index + 1} of ${backdropPhotos.length}`}
                      >
                        <img
                          src={photo}
                          alt={`Backdrop option ${index + 1}`}
                          className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {onInquire && (
        <Button
          variant={featured ? "default" : "outline"}
          size="sm"
          className="mt-4 w-full gap-1.5"
          onClick={() => onInquire(pkg.name)}
        >
          <Send className="h-3.5 w-3.5" /> Inquire about this package
        </Button>
      )}
      </div>
    </Card>
    {backdropLightboxIndex !== null && (
      <PhotoLightbox
        photos={backdropPhotos}
        index={backdropLightboxIndex}
        onClose={() => setBackdropLightboxIndex(null)}
        onNav={setBackdropLightboxIndex}
        vendorName={`${pkg.name} backdrop`}
      />
    )}
    </>
  );
}

function Fact({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card className="border-border/60 p-3.5 shadow-soft">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <p className="text-[10px] uppercase tracking-widest">{label}</p>
      </div>
      <p className="mt-1 font-display text-sm font-semibold leading-snug">{value}</p>
    </Card>
  );
}

function ProfileSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ── Photo lightbox ────────────────────────────────────────────────────────────

function PhotoLightbox({
  photos,
  index,
  onClose,
  onNav,
  vendorName,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
  vendorName: string;
}) {
  const total = photos.length;
  const safeIndex = Math.max(0, Math.min(index, total - 1));
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNav((safeIndex + 1) % total);
      if (e.key === "ArrowLeft") onNav((safeIndex - 1 + total) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus();
    };
  }, [safeIndex, total, onClose, onNav]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label={`${vendorName} portfolio image ${safeIndex + 1} of ${total}`}
      onTouchStart={(event) => { touchStartX.current = event.changedTouches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchStartX.current;
        const end = event.changedTouches[0]?.clientX;
        if (start == null || end == null || total < 2) return;
        const distance = end - start;
        if (Math.abs(distance) > 48) onNav((safeIndex + (distance < 0 ? 1 : -1) + total) % total);
        touchStartX.current = null;
      }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        ref={closeRef}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Close"
      >
        <X className="h-5 w-5" />
      </button>

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNav((safeIndex - 1 + total) % total); }}
          className="absolute left-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Previous image"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Image */}
      <img
        src={photos[safeIndex]}
        alt={`${vendorName} — image ${safeIndex + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85svh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        loading="eager"
      />

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onNav((safeIndex + 1) % total); }}
          className="absolute right-4 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label="Next image"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Counter */}
      {total > 1 && (
        <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {safeIndex + 1} / {total}
        </p>
      )}
    </div>
  );
}

function FaqList({ faqs }: { faqs: { question: string; answer: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
      {faqs.map((faq, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium hover:bg-accent/40 transition"
          >
            <span>{faq.question}</span>
            {open === i ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </button>
          {open === i && (
            <div className="px-4 pb-4 pt-1 text-sm text-muted-foreground leading-relaxed">
              {faq.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getVendorSettings } from "@/lib/bookings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings2, Phone, Mail, Globe, Save, Star } from "lucide-react";
import { normalizeUrl } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { VENDOR_OFFER_CATEGORIES, getVendorCategories } from "@/lib/vendor-categories";

export const Route = createFileRoute("/_authenticated/vendor-settings")({
  head: () => ({ meta: [{ title: "Vendor Settings — MelaBridge" }] }),
  component: VendorSettingsPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-destructive">
      Could not load vendor settings. {import.meta.env.DEV ? error.message : ""}
    </div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function VendorSettingsPage() {
  const { user } = useAuth();
  const getFn = useServerFn(getVendorSettings);
  const qc = useQueryClient();
  const { data, isLoading, isError } = useQuery({ queryKey: ["vendor-settings"], queryFn: () => getFn() });

  // Contact info state
  const [contact, setContact] = useState({ phone: "", email: "", website: "" });
  const [contactLoading, setContactLoading] = useState(true);
  const [contactSaving, setContactSaving] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [primaryCategory, setPrimaryCategory] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!mounted) return;
        if (!user) { setContactLoading(false); return; }
        const { data: vp } = await supabase
          .from("vendor_profiles")
          .select("phone, email, website, business_category, business_categories")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!mounted) return;
        if (vp) {
          setContact({
            phone: vp.phone ?? "",
            email: vp.email ?? "",
            website: vp.website ?? "",
          });
            const selected = getVendorCategories(vp);
            setCategories(selected);
            setPrimaryCategory(vp.business_category ?? selected[0] ?? "");
        }
      } catch {
        // silently degrade — contact form shows empty fields
      } finally {
        if (mounted) setContactLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [user]);

  async function saveContact(e: React.FormEvent) {
    e.preventDefault();
    setContactSaving(true);
    try {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("vendor_profiles")
        .update({
          phone: contact.phone.trim() || null,
          email: contact.email.trim() || null,
          website: normalizeUrl(contact.website) || null,
        })
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Contact info saved");
      qc.invalidateQueries({ queryKey: ["vendor-profile"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save contact info");
    } finally {
      setContactSaving(false);
    }
  }

  async function saveCategories() {
    if (!user) return;
    if (categories.length === 0) {
      toast.error("Select at least one service category.");
      return;
    }
    setCategorySaving(true);
    try {
      const primary = categories.includes(primaryCategory) ? primaryCategory : categories[0];
      const { error } = await supabase
        .from("vendor_profiles")
        .update({ business_category: primary, business_categories: categories })
        .eq("user_id", user.id);
      if (error) throw error;
      setPrimaryCategory(primary);
      toast.success("Services saved");
      qc.invalidateQueries({ queryKey: ["vendor-settings"] });
      qc.invalidateQueries({ queryKey: ["vendor-profile-snapshot"] });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to save services");
    } finally {
      setCategorySaving(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell active="/vendor-settings">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (!data && !isLoading) {
    return (
      <AppShell active="/vendor-settings">
        <Card className="p-8 text-center">
          {isError ? (
            <>
              <p className="font-semibold text-destructive">Couldn't load settings</p>
              <p className="mt-1 text-sm text-muted-foreground">Check your connection and refresh the page.</p>
            </>
          ) : (
            <>
              <p className="font-semibold">Complete your vendor profile first</p>
              <Button asChild className="mt-3">
                <Link to="/vendor-profile-builder">Open profile</Link>
              </Button>
            </>
          )}
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell active="/vendor-settings">
      <div className="max-w-2xl space-y-8">
        <PageHeader
          eyebrow="Vendor"
          icon={Settings2}
          title="Vendor settings"
          description="Manage the contact information shown on your public listing."
        />

        {/* ── Contact information ── */}
        <Card className="space-y-6 p-6">
          <div>
            <h2 className="font-display text-base font-semibold">Contact information</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              This information helps people understand how to contact your business.
              Your phone and email are never shown publicly on your storefront.
            </p>
          </div>

          {contactLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading contact info…
            </div>
          ) : (
            <form onSubmit={saveContact} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="vendor-phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Phone
                  </Label>
                  <Input
                    id="vendor-phone"
                    type="tel"
                    placeholder="+1 (555) 000-0000"
                    value={contact.phone}
                    onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vendor-email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Business email
                  </Label>
                  <Input
                    id="vendor-email"
                    type="email"
                    placeholder="hello@yourbusiness.com"
                    value={contact.email}
                    onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendor-website" className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" /> Website
                </Label>
                <Input
                  id="vendor-website"
                  type="url"
                  placeholder="https://yourbusiness.com"
                  value={contact.website}
                  onChange={(e) => setContact((c) => ({ ...c, website: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  Your website is shown publicly on your vendor storefront.
                </p>
              </div>
              <Button type="submit" disabled={contactSaving} className="gap-2">
                {contactSaving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                ) : (
                  <><Save className="h-4 w-4" /> Save contact info</>
                )}
              </Button>
            </form>
          )}
        </Card>

        <Card className="space-y-5 p-6">
          <div>
            <h2 className="font-display text-base font-semibold">Services you offer</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Keep one vendor profile for all your services. Planners can find you under every selected category.
            </p>
          </div>
          <Input
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder="Search services…"
            aria-label="Search service categories"
          />
          <div className="flex flex-wrap gap-2">
            {VENDOR_OFFER_CATEGORIES
              .filter((category) => !categorySearch || category.toLowerCase().includes(categorySearch.toLowerCase()))
              .map((category) => {
                const selected = categories.includes(category);
                const primary = primaryCategory === category;
                return (
                  <div key={category} className="flex items-center gap-0.5">
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setCategories((current) => {
                          const next = selected ? current.filter((item) => item !== category) : [...current, category];
                          setPrimaryCategory((currentPrimary) =>
                            currentPrimary === category ? (next[0] ?? "") : currentPrimary || next[0] || "",
                          );
                          return next;
                        });
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        selected ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40 hover:border-primary/50"
                      }`}
                    >
                      {selected && "✓ "}{category}
                    </button>
                    {selected && (
                      <button
                        type="button"
                        aria-label={`Set ${category} as primary service`}
                        aria-pressed={primary}
                        onClick={() => setPrimaryCategory(category)}
                        className={`grid h-7 w-7 place-items-center rounded-full ${primary ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
                      >
                        <Star className="h-3.5 w-3.5" fill={primary ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
          {categories.length > 0 && (
            <p className="text-xs font-medium text-primary">
              {categories.length} selected · Primary: {primaryCategory || categories[0]}
            </p>
          )}
          <Button type="button" onClick={saveCategories} disabled={categorySaving || categories.length === 0} className="gap-2">
            {categorySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save services
          </Button>
        </Card>

      </div>
    </AppShell>
  );
}

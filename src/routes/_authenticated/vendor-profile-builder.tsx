import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Building2,
  Loader2,
  Save,
  AlertTriangle,
  X,
  ImageIcon,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Plus,
  Trash2,
  Globe,
  Boxes,
  Calendar,
  Star,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  generateVendorProfileDraft,
  saveVendorProfileDraft,
  getVendorProfileSnapshot,
  publishVendorProfile,
  type VendorProfileDraft,
} from "@/lib/vendor-ai.functions";
import { z } from "zod";
import { SaveInput } from "@/lib/vendor-ai.functions";
import { normalizeUrl } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { getVendorCategories, VENDOR_OFFER_CATEGORIES } from "@/lib/vendor-categories";
import { listVendorPackages } from "@/lib/vendor-packages.functions";
import { mergeVendorPhotoSources, portfolioUrlsForSave } from "@/lib/vendor-photo-compat";
type SavePayload = z.infer<typeof SaveInput>;

export type VendorPhoto = {
  url: string;
  type: "portfolio" | "cover" | "backdrop" | "both";
  /** Temporary blob URL shown while the file is uploading — stripped before saving */
  _localUrl?: string;
  /** True while the file is in-flight to Supabase storage */
  _pending?: boolean;
  /** Set to an error message if the upload failed */
  _error?: string;
};

// ── Vendor offer categories ───────────────────────────────────────────────────
export const Route = createFileRoute("/_authenticated/vendor-profile-builder")({
  head: () => ({
    meta: [
      { title: "My Profile — MelaBridge" },
      { name: "description", content: "Edit your MelaBridge vendor listing." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VendorProfileBuilder,
});

function VendorProfileBuilder() {
  const { user } = useAuth();
  const generateFn = useServerFn(generateVendorProfileDraft);
  const saveFn = useServerFn(saveVendorProfileDraft);
  const snapshotFn = useServerFn(getVendorProfileSnapshot);
  const publishFn = useServerFn(publishVendorProfile);
  const qc = useQueryClient();

  const logoInputRef = useRef<HTMLInputElement>(null);
  const portfolioInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const backdropInputRef = useRef<HTMLInputElement>(null);
  // Track initialization so we don't clobber in-progress edits on refetch
  const initialized = useRef({ biz: false, desc: false, services: false, faqs: false, photos: false });

  const snapshot = useQuery({
    queryKey: ["vendor-profile-snapshot"],
    queryFn: () => snapshotFn(),
  });
  const packageQuery = useQuery({
    queryKey: ["vendor-packages"],
    queryFn: () => listVendorPackages(),
  });

  // ── Business details ─────────────────────────────────────────────────
  const [biz, setBiz] = useState({
    businessName: "",
    logoUrl: "",
    phone: "",
    email: "",
    website: "",
    city: "",
    state: "",
    zipCode: "",
    mobileService: false,
    travelRadius: "",
    startingPrice: "",
    categories: [] as string[],
    primaryCategory: "",
    contactVisibility: {
      phone: "private" as "public" | "private",
      email: "private" as "public" | "private",
      website: "public" as "public" | "private",
    },
  });
  const [step, setStep] = useState(1);
  const [categorySearch, setCategorySearch] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [bizSaving, setBizSaving] = useState(false);

  // ── Photos ───────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<VendorPhoto[]>([]);
  // Ref always mirrors photos state — upload handlers read this to avoid stale-closure race conditions
  const photosRef = useRef<VendorPhoto[]>([]);
  const legacyPortfolioUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => { photosRef.current = photos; }, [photos]);
  const [coverUploading, setCoverUploading] = useState(false);
  const [portfolioUploading, setPortfolioUploading] = useState(false);
  const [backdropUploading, setBackdropUploading] = useState(false);
  const [photosSaving, setPhotosSaving] = useState(false);

  // ── Content sections ─────────────────────────────────────────────────
  const [description, setDescription] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [packageDrafts, setPackageDrafts] = useState<VendorProfileDraft["packages"]>([]);

  const [descSaving, setDescSaving] = useState(false);
  const [servicesSaving, setServicesSaving] = useState(false);
  const [faqsSaving, setFaqsSaving] = useState(false);

  // ── AI state ─────────────────────────────────────────────────────────
  const [busy, setBusy] = useState<
    false | "description" | "services" | "faqs" | "packages"
  >(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiRetrySection, setAiRetrySection] = useState<
    "description" | "services" | "faqs" | "packages" | null
  >(null);
  const [aiSuggestion, setAiSuggestion] = useState<{
    section: "description" | "services" | "faqs";
    description?: string;
    services?: string[];
    highlights?: string[];
    faqs?: { question: string; answer: string }[];
  } | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Populate from snapshot on first load; photos always sync with server
  useEffect(() => {
    const p = snapshot.data?.profile;
    if (!p) return;

    if (!initialized.current.biz) {
      const categories = getVendorCategories(p);
      setBiz({
        businessName: p.business_name ?? "",
        logoUrl: p.logo_url ?? "",
        phone: p.phone ?? "",
        email: p.email ?? "",
        website: p.website ?? "",
        city: p.city ?? "",
        state: p.state ?? "",
        zipCode: (p.zip_code as string | null) ?? "",
        mobileService: p.mobile_service === true,
        travelRadius: p.travel_radius != null ? String(p.travel_radius) : "",
        startingPrice: p.starting_price != null ? String(p.starting_price) : "",
        categories,
        primaryCategory: p.business_category ?? categories[0] ?? "",
        contactVisibility: {
          phone: p.contact_visibility?.phone === "public" ? "public" : "private",
          email: p.contact_visibility?.email === "public" ? "public" : "private",
          website: p.contact_visibility?.website === "private" ? "private" : "public",
        },
      });
      initialized.current.biz = true;
    }

    // Photos: only sync on initial load so in-progress uploads aren't wiped by snapshot refetches
    if (!initialized.current.photos) {
      const labeledPhotos = (p.vendor_photos as VendorPhoto[] | null) ?? [];
      const legacyPortfolio = Array.isArray(p.portfolio_urls)
        ? (p.portfolio_urls as string[])
        : [];
      legacyPortfolioUrlsRef.current = new Set(legacyPortfolio);
      setPhotos(mergeVendorPhotoSources(labeledPhotos, legacyPortfolio));
      initialized.current.photos = true;
    }

    if (!initialized.current.desc) {
      setDescription(p.business_description ?? "");
      initialized.current.desc = true;
    }

    if (!initialized.current.services) {
      try {
        const vs = p.virtual_services
          ? JSON.parse(p.virtual_services as string)
          : null;
        if (Array.isArray(p.custom_service_types) && p.custom_service_types.length > 0) {
          setServices(p.custom_service_types as string[]);
        } else if (vs?.services) {
          setServices(vs.services as string[]);
        }
        if (vs?.highlights) setHighlights(vs.highlights as string[]);
      } catch {
        // malformed JSON — leave empty
      }
      initialized.current.services = true;
    }

    if (!initialized.current.faqs) {
      const f = (p.faqs as { question: string; answer: string }[] | null) ?? [];
      setFaqs(f);
      initialized.current.faqs = true;
    }
  }, [snapshot.data?.profile]);

  // ── Helpers ──────────────────────────────────────────────────────────
  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["vendor-profile-snapshot"] });
    qc.invalidateQueries({ queryKey: ["vendor-profile"] });
    snapshot.refetch();
  }

  // ── Logo upload ──────────────────────────────────────────────────────
  async function handleLogoUpload(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5 MB. Please resize and try again.");
      return;
    }
    setLogoUploading(true);
    try {
      if (!user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `logos/${user.id}/${Date.now()}.${ext}`;
      const { data: uploaded, error: upErr } = await supabase.storage
        .from("vendor-assets")
        .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
      if (upErr) throw new Error(upErr.message);
      const { data: urlData } = supabase.storage
        .from("vendor-assets")
        .getPublicUrl(uploaded.path);
      await saveFn({ data: { logo_url: urlData.publicUrl } });
      setBiz((b) => ({ ...b, logoUrl: urlData.publicUrl }));
      toast.success("Logo saved.");
      invalidateAll();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Upload failed");
    } finally {
      setLogoUploading(false);
    }
  }

  // ── Save photos (auto-called after uploads) ──────────────────────────
  async function savePhotosData(photosData: VendorPhoto[]) {
    const clean = photosData
      .filter((p) => !p._pending && !p._error && p.url)
      .map(({ _localUrl: _l, _pending: _p, _error: _e, ...rest }) => rest);
    setPhotosSaving(true);
    try {
      const portfolioUrls = portfolioUrlsForSave(clean, legacyPortfolioUrlsRef.current);
      const res = await saveFn({ data: { vendor_photos: clean, portfolio_urls: portfolioUrls } });
      if (res.saved) {
        invalidateAll();
        qc.invalidateQueries({ queryKey: ["vendor-portfolio-urls"] });
        initialized.current.photos = false;
      }
    } catch (e: unknown) {
      toast.error("Couldn't save photos — " + ((e as Error)?.message ?? "please try again"));
    } finally {
      setPhotosSaving(false);
    }
  }

  // ── Cover photo upload ────────────────────────────────────────────────
  async function handleCoverUpload(files: FileList) {
    const file = files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Cover photo must be under 5 MB. Please resize and try again.");
      return;
    }
    if (!user) { toast.error("Not signed in"); return; }

    const photosBase = photosRef.current.filter((p) => p.type !== "cover");
    const localUrl = URL.createObjectURL(file);
    setPhotos([...photosBase, { url: "", _localUrl: localUrl, type: "cover", _pending: true }]);
    setCoverUploading(true);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `photos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { data: uploaded, error: upErr } = await supabase.storage
      .from("vendor-assets")
      .upload(path, file, { upsert: false, contentType: file.type || `image/${ext}` });

    URL.revokeObjectURL(localUrl);
    if (upErr) {
      setPhotos(photosBase);
      toast.error("Cover upload failed: " + upErr.message);
      setCoverUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("vendor-assets").getPublicUrl(uploaded.path);
    const finalPhotos = [...photosBase, { url: urlData.publicUrl, type: "cover" as const }];
    setPhotos(finalPhotos);
    setCoverUploading(false);
    toast.success("Cover photo updated.");
    await savePhotosData(finalPhotos);
  }

  // ── Portfolio upload ──────────────────────────────────────────────────
  async function handlePortfolioUpload(files: FileList) {
    if (!user) { toast.error("Not signed in"); return; }

    const photosBase = photosRef.current;
    const existingCount = photosBase.filter((photo) => photo.type === "portfolio" || photo.type === "both").length;
    const availableSlots = Math.max(0, 10 - existingCount);
    if (availableSlots === 0) {
      toast.error("You can upload up to 10 portfolio photos.");
      return;
    }
    const selectedFiles = Array.from(files);
    const fileArray = selectedFiles.slice(0, availableSlots);
    if (selectedFiles.length > availableSlots) {
      toast.info(`Only ${availableSlots} more photo${availableSlots === 1 ? "" : "s"} can be added. The rest were skipped.`);
    }
    const validFiles = fileArray.filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image — skipped.`);
        return false;
      }
      if (file.size >= 5 * 1024 * 1024) {
        toast.error(`${file.name} must be under 5 MB — skipped.`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return;

    const localUrls = validFiles.map((f) => URL.createObjectURL(f));
    setPhotos([
      ...photosBase,
      ...validFiles.map((_, i) => ({
        url: "", _localUrl: localUrls[i], type: "portfolio" as const, _pending: true,
      })),
    ]);
    setPortfolioUploading(true);

    const results = await Promise.all(
      validFiles.map(async (file, i) => {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `portfolio/${user.id}/${Date.now()}-${i}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploaded, error: upErr } = await supabase.storage
          .from("vendor-assets")
          .upload(path, file, { upsert: false, contentType: file.type || `image/${ext}` });
        URL.revokeObjectURL(localUrls[i]);
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); return null; }
        const { data: urlData } = supabase.storage.from("vendor-assets").getPublicUrl(uploaded.path);
        return urlData.publicUrl;
      }),
    );

    const newPhotos: VendorPhoto[] = results
      .filter((u): u is string => u !== null)
      .map((url) => ({ url, type: "portfolio" as const }));
    const finalPhotos = [...photosBase, ...newPhotos];
    setPhotos(finalPhotos);
    setPortfolioUploading(false);

    if (newPhotos.length > 0) {
      toast.success(`${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""} uploaded.`);
      await savePhotosData(finalPhotos);
    }
  }

  // ── Backdrop upload ───────────────────────────────────────────────────
  async function handleBackdropUpload(files: FileList) {
    const fileArray = Array.from(files);
    if (!user) { toast.error("Not signed in"); return; }

    const photosBase = photosRef.current;
    const localUrls = fileArray.map((f) => URL.createObjectURL(f));
    setPhotos([
      ...photosBase,
      ...fileArray.map((_, i) => ({
        url: "", _localUrl: localUrls[i], type: "backdrop" as const, _pending: true,
      })),
    ]);
    setBackdropUploading(true);

    const results = await Promise.all(
      fileArray.map(async (file, i) => {
        if (file.size > 5 * 1024 * 1024) {
          URL.revokeObjectURL(localUrls[i]);
          toast.error(`${file.name} is over 5 MB — skipped.`);
          return null;
        }
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
        const path = `photos/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploaded, error: upErr } = await supabase.storage
          .from("vendor-assets")
          .upload(path, file, { upsert: false, contentType: file.type || `image/${ext}` });
        URL.revokeObjectURL(localUrls[i]);
        if (upErr) { toast.error(`${file.name}: ${upErr.message}`); return null; }
        const { data: urlData } = supabase.storage.from("vendor-assets").getPublicUrl(uploaded.path);
        return urlData.publicUrl;
      }),
    );

    const newPhotos: VendorPhoto[] = results
      .filter((u): u is string => u !== null)
      .map((url) => ({ url, type: "backdrop" as const }));
    const finalPhotos = [...photosBase, ...newPhotos];
    setPhotos(finalPhotos);
    setBackdropUploading(false);

    if (newPhotos.length > 0) {
      toast.success(`${newPhotos.length} backdrop${newPhotos.length > 1 ? "s" : ""} uploaded.`);
      await savePhotosData(finalPhotos);
    }
  }

  // ── Remove photo ──────────────────────────────────────────────────────
  async function removePhoto(photo: VendorPhoto) {
    if (photo._localUrl) URL.revokeObjectURL(photo._localUrl);
    const next = photos.filter((p) =>
      photo._localUrl ? p._localUrl !== photo._localUrl : !(p.url === photo.url && p.type === photo.type),
    );
    if (photo.url && (photo.type === "portfolio" || photo.type === "both")) {
      legacyPortfolioUrlsRef.current.delete(photo.url);
    }
    setPhotos(next);
    if (!photo._error && photo.url) await savePhotosData(next);
  }

  // ── Save functions ───────────────────────────────────────────────────
  async function saveBusinessDetails() {
    setBizSaving(true);
    try {
      const payload: Partial<SavePayload> = {};
      if (biz.businessName.trim()) payload.business_name = biz.businessName.trim();
      if (biz.logoUrl.trim()) payload.logo_url = biz.logoUrl.trim();
      if (biz.phone.trim()) payload.phone = biz.phone.trim();
      if (biz.email.trim()) payload.email = biz.email.trim();
      if (biz.website.trim()) payload.website = normalizeUrl(biz.website) ?? biz.website.trim();
      if (biz.city.trim()) payload.city = biz.city.trim();
      if (biz.state.trim()) payload.state = biz.state.trim();
      if (biz.zipCode.trim()) payload.zip_code = biz.zipCode.trim();
      payload.mobile_service = biz.mobileService;
      const travelRadius = parseInt(biz.travelRadius, 10);
      if (!isNaN(travelRadius) && travelRadius >= 0) payload.travel_radius = travelRadius;
      const primaryCategory = biz.categories.includes(biz.primaryCategory)
        ? biz.primaryCategory
        : biz.categories[0];
      if (primaryCategory) payload.business_category = primaryCategory;
      if (biz.categories.length > 0) payload.business_categories = biz.categories;
      payload.contact_visibility = biz.contactVisibility;
      const price = parseInt(biz.startingPrice, 10);
      if (!isNaN(price) && price >= 0) payload.starting_price = price;
      if (!Object.keys(payload).length) {
        toast.info("Nothing to save — fill in at least one field.");
        return;
      }
      const res = await saveFn({ data: payload });
      if (res.saved) {
        toast.success("Business details saved.");
        invalidateAll();
      } else {
        toast.info("Nothing new to save.");
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Save failed");
    } finally {
      setBizSaving(false);
    }
  }

  async function saveDescription() {
    if (!description.trim()) {
      toast.info("Description is empty.");
      return;
    }
    setDescSaving(true);
    try {
      const res = await saveFn({
        data: { business_description: description.trim() },
      });
      if (res.saved) {
        toast.success("Description saved.");
        invalidateAll();
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Save failed");
    } finally {
      setDescSaving(false);
    }
  }

  async function saveServices() {
    setServicesSaving(true);
    try {
      const cleanServices = services.map((item) => item.trim()).filter(Boolean);
      const cleanHighlights = highlights.map((item) => item.trim()).filter(Boolean);
      const res = await saveFn({
        data: {
          virtual_services: JSON.stringify({
            services: cleanServices,
            highlights: cleanHighlights,
          }),
          custom_service_types: cleanServices,
        },
      });
      if (res.saved) {
        toast.success("Services & highlights saved.");
        invalidateAll();
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Save failed");
    } finally {
      setServicesSaving(false);
    }
  }

  async function saveFaqsData() {
    setFaqsSaving(true);
    try {
      const res = await saveFn({ data: { faqs } });
      if (res.saved) {
        toast.success("FAQs saved.");
        invalidateAll();
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Save failed");
    } finally {
      setFaqsSaving(false);
    }
  }

  // ── Per-section AI improvement ───────────────────────────────────────
  async function improveWithAI(
    section: "description" | "services" | "faqs" | "packages",
  ) {
    const existingDesc = description.trim();
    const businessName = (snapshot.data?.profile?.business_name as string | null) ?? "";
    const effectiveInput =
      existingDesc.length > 30 ? existingDesc : businessName;
    if (!effectiveInput) {
      toast.info(
        "Add a business name in Business Details first so MelaAssist has context.",
      );
      return;
    }
    const effectiveMode =
      existingDesc.length > 30 ? ("description" as const) : ("business_name" as const);
    const category =
      (snapshot.data?.profile?.business_category as string | null) ?? undefined;

    setBusy(section);
    setAiRetrySection(section);
    setAiError(null);
    try {
      const res = await generateFn({
        data: {
          mode: effectiveMode,
          input: effectiveInput,
          category: biz.primaryCategory || category,
          regenerateSection: section === "services" ? "services" : section,
          context: {
            businessName: biz.businessName || businessName,
            categories: biz.categories,
            description: existingDesc,
            services,
            highlights,
            location: [biz.city, biz.state, biz.zipCode].filter(Boolean).join(", "),
            pricingContext: biz.startingPrice,
            packageDetails: packageDrafts.map((pkg) =>
              `${pkg.name}: ${pkg.description}; includes ${pkg.inclusions.join(", ")}; ${pkg.price_placeholder || "price TBD"}; ${pkg.duration || "duration TBD"}`,
            ),
          },
        },
      });
      if (!res.draft) {
        setAiError(res.message ?? "MelaAssist is unavailable. Try again or continue manually.");
        return;
      }
      if (section === "description" && res.draft.description) {
        setAiSuggestion({ section, description: res.draft.description });
      }
      if (section === "services") {
        setAiSuggestion({
          section,
          services: res.draft.services,
          highlights: res.draft.highlights,
        });
      }
      if (section === "faqs" && res.draft.faqs.length) {
        setAiSuggestion({ section, faqs: res.draft.faqs });
      }
      if (section === "packages") {
        setPackageDrafts(res.draft.packages);
      }
      toast.success("MelaAssist suggestions are ready for review.");
    } catch (e: unknown) {
      setAiError(
        (e as Error)?.message ??
          "MelaAssist couldn't complete this request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function applyAiSuggestion() {
    if (!aiSuggestion) return;
    if (aiSuggestion.section === "description" && aiSuggestion.description) {
      setDescription(aiSuggestion.description);
    }
    if (aiSuggestion.section === "services") {
      setServices(aiSuggestion.services ?? []);
      setHighlights(aiSuggestion.highlights ?? []);
    }
    if (aiSuggestion.section === "faqs") {
      setFaqs(aiSuggestion.faqs ?? []);
    }
    setAiSuggestion(null);
    toast.success("Suggestions applied. Review the fields, then save.");
  }

  async function publishListing() {
    setPublishing(true);
    try {
      await publishFn();
      toast.success("Your listing is now published in the marketplace.");
      invalidateAll();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Your listing is not ready to publish yet.");
    } finally {
      setPublishing(false);
    }
  }

  const completion = snapshot.data?.completion ?? 0;
  const missing = snapshot.data?.missing ?? [];
  const profileId = (snapshot.data?.profile as { id?: string } | null)?.id ?? "";

  // ── Derived photo lists for each section ─────────────────────────────
  const isPhotoBooth = (
    (snapshot.data?.profile?.business_category as string | null) ?? ""
  ).toLowerCase().includes("photo booth");

  const coverPhoto = photos.find((p) => p.type === "cover" && (p.url || p._localUrl || p._pending));
  const portfolioPhotos = photos.filter(
    (p) => (p.type === "portfolio" || p.type === "both"),
  );
  const backdropPhotos = photos.filter(
    (p) => (p.type === "backdrop" || p.type === "both"),
  );

  return (
    <AppShell active="/vendor-profile-builder">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          eyebrow="Vendor profile"
          icon={Building2}
          title="Build your public listing"
          description="Work through the five steps. Your changes stay in this draft until you choose to publish."
          actions={
            profileId ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/vendor-profile/$vendorId" params={{ vendorId: profileId }}>
                  View public listing
                </Link>
              </Button>
            ) : null
          }
        />

        <nav aria-label="Profile setup steps" className="grid grid-cols-5 gap-1 rounded-2xl border border-border/70 bg-card p-1.5 sm:gap-2 sm:p-2">
          {[
            ["1", "Business"],
            ["2", "Contact"],
            ["3", "Services"],
            ["4", "Media"],
            ["5", "Preview"],
          ].map(([number, label], index) => {
            const active = step === index + 1;
            const complete = step > index + 1;
            return (
              <button
                key={number}
                type="button"
                onClick={() => setStep(index + 1)}
                className={`min-w-0 rounded-xl px-1.5 py-2 text-center text-[11px] font-semibold transition sm:px-3 sm:text-xs ${
                  active ? "bg-primary text-primary-foreground shadow-sm" : complete ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                }`}
                aria-current={active ? "step" : undefined}
              >
                <span className="mr-1 hidden sm:inline">{number}.</span>{label}
              </button>
            );
          })}
        </nav>
        <input
          ref={portfolioInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          aria-label="Choose portfolio photos"
          onChange={(event) => {
            if (event.target.files?.length) void handlePortfolioUpload(event.target.files);
            event.target.value = "";
          }}
        />

        {aiError && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">MelaAssist is temporarily unavailable</p>
              <p className="mt-0.5 text-muted-foreground">Fill in your details manually, or try again in a few minutes.</p>
            </div>
            {aiRetrySection && <Button variant="outline" size="sm" onClick={() => { if (aiRetrySection) void improveWithAI(aiRetrySection); }} disabled={!!busy}>Try again</Button>}
            <button type="button" onClick={() => setAiError(null)} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {aiSuggestion && (
          <Card className="border-primary/30 bg-primary/[0.035] p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Review MelaAssist suggestions</p>
                <p className="mt-1 text-sm text-muted-foreground">Nothing has been saved yet. Apply only after you review the draft.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAiSuggestion(null)}>Discard</Button>
                <Button size="sm" onClick={applyAiSuggestion}>Apply to editor</Button>
              </div>
            </div>
            {aiSuggestion?.section === "description" && <p className="mt-3 rounded-lg border border-border/60 bg-background p-3 text-sm">{aiSuggestion.description}</p>}
            {aiSuggestion?.section === "services" && <div className="mt-3 grid gap-3 sm:grid-cols-2"><SuggestionList label="Services" items={aiSuggestion.services ?? []} /><SuggestionList label="Highlights" items={aiSuggestion.highlights ?? []} /></div>}
            {aiSuggestion?.section === "faqs" && <div className="mt-3 space-y-2">{(aiSuggestion.faqs ?? []).slice(0, 4).map((faq, index) => <div key={index} className="rounded-lg border border-border/60 bg-background p-3 text-sm"><p className="font-medium">{faq.question}</p><p className="mt-1 text-muted-foreground">{faq.answer}</p></div>)}</div>}
          </Card>
        )}

        {step === 1 && (
          <Card className="space-y-5 border-border/60 p-5 shadow-soft sm:p-6">
            <StepIntro number="01" title="Business details" description="Start with the basics planners need to recognize your business." />
            <div className="space-y-1.5">
              <Label htmlFor="guided-business-name">Business name <span className="text-destructive">*</span></Label>
              <Input id="guided-business-name" value={biz.businessName} onChange={(e) => setBiz((current) => ({ ...current, businessName: e.target.value }))} placeholder="e.g. Juniper & Co. Events" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="City"><Input value={biz.city} onChange={(e) => setBiz((current) => ({ ...current, city: e.target.value }))} placeholder="Atlanta" /></Field>
              <Field label="State"><Input value={biz.state} onChange={(e) => setBiz((current) => ({ ...current, state: e.target.value }))} placeholder="GA" /></Field>
              <Field label="ZIP code"><Input value={biz.zipCode} onChange={(e) => setBiz((current) => ({ ...current, zipCode: e.target.value.replace(/[^0-9-]/g, "") }))} placeholder="30301" inputMode="numeric" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Starting price"><Input inputMode="numeric" value={biz.startingPrice} onChange={(e) => setBiz((current) => ({ ...current, startingPrice: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="Optional" /></Field>
              <div className="space-y-1.5">
                <Label>Logo</Label>
                <div className="flex items-center gap-2">
                  {biz.logoUrl && <img src={biz.logoUrl} alt="Logo preview" className="h-10 w-10 rounded-lg object-cover ring-1 ring-border" />}
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file); e.target.value = ""; }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>{logoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}<span className="ml-2">{logoUploading ? "Uploading…" : "Upload"}</span></Button>
                </div>
              </div>
            </div>
            <div className="space-y-3 border-t border-border/60 pt-5">
              <div>
                <p className="text-sm font-semibold">Portfolio photos</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Add 1–10 images, each under 5 MB. Your profile check completes when you have at least 3.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {portfolioPhotos.map((photo, index) => (
                  <div key={photo._localUrl ?? photo.url ?? index} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted">
                    <img src={photo._localUrl ?? photo.url} alt={`Portfolio ${index + 1}`} className="h-full w-full object-cover" />
                    {photo._pending && <div className="absolute inset-0 grid place-items-center bg-background/60"><Loader2 className="h-5 w-5 animate-spin" /></div>}
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo)}
                      disabled={photo._pending || photosSaving}
                      aria-label={`Remove portfolio photo ${index + 1}`}
                      className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/90 text-foreground shadow hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {portfolioPhotos.length < 10 && (
                  <button type="button" onClick={() => portfolioInputRef.current?.click()} disabled={portfolioUploading} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60">
                    {portfolioUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                    {portfolioUploading ? "Uploading…" : "Add photos"}
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{portfolioPhotos.length}/10 photos</p>
            </div>
            <StepActions onNext={async () => { await saveBusinessDetails(); setStep(2); }} nextLabel="Save and continue" busy={bizSaving} />
          </Card>
        )}

        {step === 2 && (
          <Card className="space-y-5 border-border/60 p-5 shadow-soft sm:p-6">
            <StepIntro number="02" title="Contact and links" description="Choose exactly what can appear on your public listing. These choices are saved with your profile." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business phone"><Input type="tel" value={biz.phone} onChange={(e) => setBiz((current) => ({ ...current, phone: e.target.value }))} placeholder="+1 (555) 000-0000" /></Field>
              <Field label="Business email"><Input type="email" value={biz.email} onChange={(e) => setBiz((current) => ({ ...current, email: e.target.value }))} placeholder="hello@yourbusiness.com" /></Field>
            </div>
            <Field label="Website"><Input value={biz.website} onChange={(e) => setBiz((current) => ({ ...current, website: e.target.value }))} placeholder="https://yourbusiness.com" /></Field>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Travel radius (miles)" description="Optional — show planners how far you travel.">
                <Input inputMode="numeric" value={biz.travelRadius} onChange={(e) => setBiz((current) => ({ ...current, travelRadius: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="e.g. 50" />
              </Field>
              <div className="flex items-center gap-3 rounded-xl border border-border/70 px-3 py-2 sm:min-w-48">
                <Switch checked={biz.mobileService} onCheckedChange={(value) => setBiz((current) => ({ ...current, mobileService: value }))} />
                <div><p className="text-sm font-medium">I travel to events</p><p className="text-xs text-muted-foreground">Show service area</p></div>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Public contact visibility</p>
              <VisibilityRow label="Phone number" value={biz.contactVisibility.phone} onChange={(value) => setBiz((current) => ({ ...current, contactVisibility: { ...current.contactVisibility, phone: value } }))} />
              <VisibilityRow label="Business email" value={biz.contactVisibility.email} onChange={(value) => setBiz((current) => ({ ...current, contactVisibility: { ...current.contactVisibility, email: value } }))} />
              <VisibilityRow label="Website" value={biz.contactVisibility.website} onChange={(value) => setBiz((current) => ({ ...current, contactVisibility: { ...current.contactVisibility, website: value } }))} />
            </div>
            <StepActions onBack={() => setStep(1)} onNext={async () => { await saveBusinessDetails(); setStep(3); }} nextLabel="Save and continue" busy={bizSaving} />
          </Card>
        )}

        {step === 3 && (
          <Card className="space-y-5 border-border/60 p-5 shadow-soft sm:p-6">
            <StepIntro number="03" title="Services" description="Select every service you offer, then mark one as Primary. Search keeps larger lists easy to scan." />
            <Input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} placeholder="Search services…" aria-label="Search services" />
            <div className="grid gap-2 sm:grid-cols-2">
              {VENDOR_OFFER_CATEGORIES.filter((category) => !categorySearch || category.toLowerCase().includes(categorySearch.toLowerCase())).map((category) => {
                const selected = biz.categories.includes(category);
                const primary = biz.primaryCategory === category;
                return (
                  <div key={category} className={`flex items-center justify-between rounded-xl border p-3 transition ${selected ? "border-primary/50 bg-primary/5" : "border-border/70"}`}>
                    <button type="button" className="flex min-h-10 items-center gap-2 text-left text-sm font-medium" aria-pressed={selected} onClick={() => setBiz((current) => { const categories = selected ? current.categories.filter((item) => item !== category) : [...current.categories, category]; return { ...current, categories, primaryCategory: current.primaryCategory === category ? (categories[0] ?? "") : current.primaryCategory || categories[0] || "" }; })}>
                      <span className={`grid h-5 w-5 place-items-center rounded-md border text-xs ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>{selected ? "✓" : ""}</span>{category}
                    </button>
                    {selected && <button type="button" onClick={() => setBiz((current) => ({ ...current, primaryCategory: category }))} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${primary ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" : "text-muted-foreground hover:bg-muted"}`} aria-label={`Set ${category} as primary service`}>{primary ? "Primary" : "Make primary"}</button>}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">{biz.categories.length} selected{biz.primaryCategory ? ` · Primary: ${biz.primaryCategory}` : ""}</p>
            <StepActions onBack={() => setStep(2)} onNext={async () => { await saveBusinessDetails(); setStep(4); }} nextLabel="Save and continue" busy={bizSaving} />
          </Card>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <Card className="space-y-5 border-border/60 p-5 shadow-soft sm:p-6">
              <StepIntro number="04" title="Packages and portfolio" description="Give planners enough detail to understand what you offer before they open your public listing." />
              <div className="rounded-xl border border-dashed border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="text-sm font-semibold">Packages</p><p className="mt-1 text-xs text-muted-foreground">Create packages yourself or ask MelaAssist for a starting point.</p></div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => void improveWithAI("packages")} disabled={!!busy}>
                      {busy === "packages" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      Draft packages
                    </Button>
                    <Button asChild variant="outline" size="sm"><Link to="/vendor-packages"><Boxes className="mr-2 h-4 w-4" />Manage packages</Link></Button>
                  </div>
                </div>
                {packageDrafts.length > 0 && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {packageDrafts.map((pkg, index) => (
                      <div key={`${pkg.name}-${index}`} className="flex flex-col rounded-xl border border-border/60 bg-background p-4">
                        <p className="font-medium">{pkg.name}</p>
                        <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{pkg.description}</p>
                        <p className="mt-2 text-xs font-medium text-muted-foreground">{pkg.price_placeholder || "Price TBD"}</p>
                        <Button asChild size="sm" className="mt-4 self-start">
                          <Link
                            to="/vendor-packages"
                            search={{
                              draftName: pkg.name,
                              draftDescription: pkg.description,
                              draftPrice: pkg.price_placeholder,
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create package
                          </Link>
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="mb-2 text-sm font-semibold">Portfolio photos</p>
                <p className="mb-4 text-xs text-muted-foreground">Upload photos that represent your work. They save as soon as each upload finishes.</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {portfolioPhotos.map((photo, index) => <div key={photo._localUrl ?? photo.url ?? index} className="group relative aspect-square overflow-hidden rounded-xl border bg-muted"><img src={photo._localUrl ?? photo.url} alt={`Portfolio ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => void removePhoto(photo)} disabled={photo._pending || photosSaving} aria-label={`Remove portfolio photo ${index + 1}`} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-background/90 shadow hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50"><X className="h-4 w-4" /></button></div>)}
                  {portfolioPhotos.length < 10 && <button type="button" onClick={() => portfolioInputRef.current?.click()} disabled={portfolioUploading} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:border-primary hover:text-primary"><Plus className="h-5 w-5" />{portfolioUploading ? "Uploading…" : "Add photos"}</button>}
                </div>
              </div>
              <StepActions onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Continue to preview" />
            </Card>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <Card className="border-border/60 p-5 shadow-soft sm:p-6">
              <StepIntro number="05" title="Preview and publish" description="Review the information you entered. Publishing makes this profile visible in the marketplace." />
              <div className="mt-5 overflow-hidden rounded-2xl border border-border/70">
                <div className="bg-hero-radial p-5">
                  <div className="flex items-center gap-3">
                    {biz.logoUrl ? <img src={biz.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-border" /> : <div className="grid h-14 w-14 place-items-center rounded-xl bg-primary/10 text-xl font-semibold text-primary">{biz.businessName.charAt(0) || "?"}</div>}
                    <div className="min-w-0"><h2 className="truncate font-display text-xl font-semibold">{biz.businessName || "Your business name"}</h2><p className="mt-1 text-sm text-muted-foreground">{biz.categories.join(" · ") || "Add at least one service"}</p></div>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <p className="text-sm text-muted-foreground">{description || "Add a description in your profile to help planners understand your work."}</p>
                  <div className="flex flex-wrap gap-2">{biz.categories.map((category) => <span key={category} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{category}{category === biz.primaryCategory ? " · Primary" : ""}</span>)}</div>
                   <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3"><PreviewMetric label="Photos" value={String(portfolioPhotos.length)} /><PreviewMetric label="Packages" value={String(packageQuery.data?.length ?? 0)} /><PreviewMetric label="Status" value={snapshot.data?.published ? "Published" : "Private draft"} /></div>
                   {(packageQuery.data?.length ?? 0) > 0 && (
                     <div className="space-y-2 pt-2">
                       <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Package preview</p>
                       <div className="grid gap-2 sm:grid-cols-3">
                         {packageQuery.data?.slice(0, 3).map((pkg) => (
                           <div key={pkg.id} className="rounded-xl border border-border/60 bg-muted/20 p-3">
                             <p className="truncate text-sm font-medium">{pkg.name}</p>
                             <p className="mt-1 text-xs text-muted-foreground">
                               {pkg.price_type === "contact" ? "Custom quote" : pkg.price_cents != null ? `$${(pkg.price_cents / 100).toLocaleString()}` : "Price TBD"}
                             </p>
                           </div>
                         ))}
                       </div>
                     </div>
                   )}
                   {missing.length > 0 && !snapshot.data?.published && (
                     <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                       <p className="font-medium">Complete before publishing</p>
                       <p className="mt-1 text-xs">{missing.join(" · ")}</p>
                     </div>
                   )}
                </div>
              </div>
              <div className="mt-5 flex flex-wrap justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(4)}>Back</Button>
                <div className="flex flex-wrap gap-2">
                  {profileId && <Button asChild variant="outline"><Link to="/vendor-profile/$vendorId" params={{ vendorId: profileId }} search={{ preview: "1" }}><Eye className="mr-2 h-4 w-4" />Open preview</Link></Button>}
                  <Button variant={snapshot.data?.published ? "outline" : "hero"} onClick={publishListing} disabled={publishing || snapshot.data?.published || missing.length > 0}>{publishing ? "Publishing…" : snapshot.data?.published ? "Published" : "Publish listing"}</Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );

  return (
    <AppShell active="/vendor-profile-builder">
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          eyebrow="Vendor"
          icon={Building2}
          title="My Profile"
           description="Build a clear public listing with your services, packages, and business details."
          actions={
            profileId ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  to="/vendor-profile/$vendorId"
                  params={{ vendorId: profileId }}
                >
                  View public listing
                </Link>
              </Button>
            ) : null
          }
        />

        {/* AI error banner */}
        {aiError && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">
                MelaAssist is temporarily unavailable
              </p>
              <p className="mt-0.5 text-muted-foreground">
                AI isn't working right now. Fill in your details manually, or
                try again in a few minutes.
              </p>
            </div>
            <div className="ml-2 flex shrink-0 items-center gap-2">
              {aiRetrySection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => aiRetrySection ? improveWithAI(aiRetrySection) : undefined}
                  disabled={!!busy}
                >
                  Try again
                </Button>
              )}
              <button
                onClick={() => setAiError(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {aiSuggestion && (
          <Card className="border-primary/30 bg-primary/[0.035] p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Review MelaAssist suggestions</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nothing has been saved yet. Apply these suggestions to the editor only after you review them.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAiSuggestion(null)}>
                  Discard
                </Button>
                <Button size="sm" onClick={applyAiSuggestion}>
                  Apply to editor
                </Button>
              </div>
            </div>
            {aiSuggestion?.section === "description" && (
              <p className="mt-3 rounded-lg border border-border/60 bg-background p-3 text-sm">
                {aiSuggestion?.description}
              </p>
            )}
            {aiSuggestion?.section === "services" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SuggestionList label="Services" items={aiSuggestion?.services ?? []} />
                <SuggestionList label="Highlights" items={aiSuggestion?.highlights ?? []} />
              </div>
            )}
            {aiSuggestion?.section === "faqs" && (
              <div className="mt-3 space-y-2">
                {(aiSuggestion?.faqs ?? []).slice(0, 4).map((faq, index) => (
                  <div key={index} className="rounded-lg border border-border/60 bg-background p-3 text-sm">
                    <p className="font-medium">{faq.question}</p>
                    <p className="mt-1 text-muted-foreground">{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Profile completion */}
        <Card className="border-border/60 p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Profile completion</p>
              <p className="font-display text-2xl font-semibold">{completion}%</p>
            </div>
            <Button
              variant={snapshot.data?.published ? "outline" : "hero"}
              size="sm"
              onClick={publishListing}
              disabled={publishing || snapshot.data?.published || missing.length > 0}
            >
              {publishing ? "Publishing…" : snapshot.data?.published ? "Published" : "Publish listing"}
            </Button>
            <div className="min-w-[200px] flex-1">
              <Progress value={completion} className="h-2" />
              {missing.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Missing:{" "}
                  {missing.slice(0, 4).join(", ")}
                  {missing.length > 4 ? "…" : ""}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* ── Business Details ── */}
        <Card
          id="business-details"
          className="scroll-mt-4 border-border/60 p-5 shadow-soft"
        >
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold">
              Business details
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">
              Saves directly to your profile
            </span>
          </div>

          <div className="space-y-4">
            {/* Business name */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 font-medium">
                <Building2 className="h-3.5 w-3.5" />
                Business name <span className="text-destructive ml-0.5">*</span>
              </Label>
              <Input
                value={biz.businessName}
                onChange={(e) => setBiz((b) => ({ ...b, businessName: e.target.value }))}
                placeholder="e.g., Your Business Name"
              />
            </div>

            {/* What do you offer? */}
            <div className="space-y-2">
                 <Label className="flex items-center gap-1.5 font-medium">
                <Boxes className="h-3.5 w-3.5" />
                 What do you offer? <span className="text-destructive ml-0.5">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                 Select all that apply. One vendor profile can showcase multiple services. Choose one primary service for your profile.
              </p>
              <Input
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
                placeholder="Search categories…"
                className="h-8 text-sm"
              />
              <div className="flex flex-wrap gap-1.5">
                {VENDOR_OFFER_CATEGORIES
                  .filter((cat) =>
                    !categorySearch || cat.toLowerCase().includes(categorySearch.toLowerCase())
                  )
                   .map((cat) => {
                    const selected = biz.categories.includes(cat);
                    return (
                       <div key={cat} className="flex items-center gap-0.5">
                         <button
                           type="button"
                           aria-pressed={selected}
                           onClick={() =>
                             setBiz((b) => {
                               const next = b.categories.includes(cat)
                                 ? b.categories.filter((c) => c !== cat)
                                 : [...b.categories, cat];
                               return {
                                 ...b,
                                 categories: next,
                                 primaryCategory: b.primaryCategory === cat
                                   ? (next[0] ?? "")
                                   : b.primaryCategory || next[0] || "",
                               };
                             })
                           }
                           className={`px-2.5 py-1 rounded-full text-xs border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                             selected
                               ? "bg-primary text-primary-foreground border-primary"
                               : "bg-muted/40 text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                           }`}
                         >
                           {selected && "✓ "}{cat}
                         </button>
                         {selected && (
                           <button
                             type="button"
                             aria-label={`Set ${cat} as primary service`}
                             aria-pressed={biz.primaryCategory === cat}
                             onClick={() => setBiz((b) => ({ ...b, primaryCategory: cat }))}
                             className={`grid h-6 w-6 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                               biz.primaryCategory === cat ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"
                             }`}
                           >
                             <Star className="h-3.5 w-3.5" fill={biz.primaryCategory === cat ? "currentColor" : "none"} />
                           </button>
                         )}
                       </div>
                    );
                  })}
              </div>
              {biz.categories.length > 0 && (
                <p className="text-xs font-medium text-primary">
                   {biz.categories.length} selected · Primary: {biz.primaryCategory || biz.categories[0]}
                </p>
              )}
            </div>

            {/* Logo */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5" />
                Logo
              </Label>
              <div className="flex flex-wrap items-center gap-2">
                {biz.logoUrl && (
                  <img
                    src={biz.logoUrl}
                    alt="Logo preview"
                    className="h-14 w-14 rounded-xl object-cover ring-1 ring-border"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                )}
                <Input
                  value={biz.logoUrl}
                  onChange={(e) =>
                    setBiz((b) => ({ ...b, logoUrl: e.target.value }))
                  }
                  placeholder="Paste logo URL or upload below…"
                  className="min-w-0 flex-1"
                />
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleLogoUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading}
                  className="shrink-0"
                >
                  {logoUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5">
                    {logoUploading ? "Uploading…" : "Upload"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Contact */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={biz.phone}
                  onChange={(e) =>
                    setBiz((b) => ({ ...b, phone: e.target.value }))
                  }
                  placeholder="e.g., +1 (555) 000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Business email
                </Label>
                <Input
                  type="email"
                  value={biz.email}
                  onChange={(e) =>
                    setBiz((b) => ({ ...b, email: e.target.value }))
                  }
                  placeholder="hello@yourbusiness.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </Label>
                <Input
                  value={biz.website}
                  onChange={(e) =>
                    setBiz((b) => ({ ...b, website: e.target.value }))
                  }
                  placeholder="https://yourbusiness.com"
                />
              </div>
            </div>

            {/* Location */}
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  City
                </Label>
                <Input
                  value={biz.city}
                  onChange={(e) => setBiz((b) => ({ ...b, city: e.target.value }))}
                  placeholder="e.g., Atlanta"
                />
              </div>
              <div className="space-y-1.5">
                <Label>State</Label>
                <Input
                  value={biz.state}
                  onChange={(e) => setBiz((b) => ({ ...b, state: e.target.value }))}
                  placeholder="e.g., GA"
                />
              </div>
              <div className="space-y-1.5">
                <Label>ZIP Code</Label>
                <Input
                  value={biz.zipCode}
                  onChange={(e) =>
                    setBiz((b) => ({ ...b, zipCode: e.target.value.replace(/[^0-9-]/g, "") }))
                  }
                  placeholder="e.g., 30301"
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
            </div>

            {/* Starting price */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Starting price (USD $)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={biz.startingPrice}
                  onChange={(e) =>
                    setBiz((b) => ({ ...b, startingPrice: e.target.value.replace(/[^0-9]/g, "") }))
                  }
                  placeholder="e.g., 500"
                  className="max-w-[160px]"
                />
                <p className="text-xs text-muted-foreground leading-tight">
                  Optional. Add packages for detailed pricing — they take precedence on your listing.
                </p>
              </div>
            </div>

            <Button onClick={saveBusinessDetails} disabled={bizSaving}>
              {bizSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save business details
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* ── Photos & Media ── */}
        <Card
          id="photos"
          className="scroll-mt-4 border-border/60 p-5 shadow-soft"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <ImageIcon className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold">Photos & Media</h2>
            {photosSaving && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            )}
          </div>
          <p className="mb-5 text-xs text-muted-foreground">
            Photos save automatically when uploads finish. Use 5 MB max per image.
          </p>

          {/* ── Cover Photo ── */}
          <div className="mb-6">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Cover photo</h3>
              <span className="text-xs text-muted-foreground">Hero banner on your listing</span>
            </div>

            {coverPhoto ? (
              <div className="group relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={coverPhoto!._localUrl ?? coverPhoto!.url}
                  alt="Cover"
                  className="h-full w-full object-cover"
                />
                {coverPhoto!._pending && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                  </div>
                )}
                {!coverPhoto!._pending && (
                  <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 via-transparent p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="bg-white/90 text-xs"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={coverUploading}
                    >
                      Replace
                    </Button>
                    <button
                      onClick={() => removePhoto(coverPhoto!)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-black/70 p-2 text-white hover:bg-black/90"
                      aria-label="Remove cover photo"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {coverUploading
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <ImageIcon className="h-8 w-8" />
                }
                <span className="text-sm font-medium">
                  {coverUploading ? "Uploading…" : "Add cover photo"}
                </span>
                <span className="text-xs">Landscape photo recommended (16:9)</span>
              </button>
            )}

            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handleCoverUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* ── Portfolio Photos ── */}
          <div className={isPhotoBooth ? "mb-6" : ""}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Portfolio photos</h3>
              <span className="text-xs text-muted-foreground">
                {portfolioPhotos.filter((p) => !p._pending).length} photo{portfolioPhotos.filter((p) => !p._pending).length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {portfolioPhotos.map((photo, i) => (
                <div
                  key={photo._localUrl ?? photo.url ?? i}
                  className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                >
                  <div className="aspect-square w-full overflow-hidden">
                    <img
                      src={photo._localUrl ?? photo.url}
                      alt={`Portfolio ${i + 1}`}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                    />
                    {photo._pending && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                        <span className="text-xs font-medium text-white">Uploading…</span>
                      </div>
                    )}
                  </div>
                  {!photo._pending && (
                    <button
                      onClick={() => removePhoto(photo)}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-100 transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={`Remove portfolio photo ${i + 1}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={() => portfolioInputRef.current?.click()}
                disabled={portfolioUploading}
                className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Upload portfolio photos"
              >
                {portfolioUploading
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <Plus className="h-6 w-6" />
                }
                <span className="text-xs font-medium">
                  {portfolioUploading ? "Uploading…" : "Add photos"}
                </span>
              </button>
            </div>

            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.length) handlePortfolioUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          {/* ── Photo Booth Backdrops ── */}
          {isPhotoBooth && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Backdrop catalog</h3>
                <span className="text-xs text-muted-foreground">
                  Selectable in your Photo Booth packages
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {backdropPhotos.map((photo, i) => (
                  <div
                    key={photo._localUrl ?? photo.url ?? i}
                    className="group relative overflow-hidden rounded-xl border border-border bg-muted"
                  >
                    <div className="aspect-square w-full overflow-hidden">
                      <img
                        src={photo._localUrl ?? photo.url}
                        alt={`Backdrop ${i + 1}`}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
                      />
                      {photo._pending && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50">
                          <Loader2 className="h-6 w-6 animate-spin text-white" />
                          <span className="text-xs font-medium text-white">Uploading…</span>
                        </div>
                      )}
                    </div>
                    {!photo._pending && (
                      <button
                        onClick={() => removePhoto(photo)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white opacity-100 transition hover:bg-black/80 sm:opacity-0 sm:group-hover:opacity-100"
                        aria-label={`Remove backdrop ${i + 1}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={() => backdropInputRef.current?.click()}
                  disabled={backdropUploading}
                  className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Upload backdrop photos"
                >
                  {backdropUploading
                    ? <Loader2 className="h-6 w-6 animate-spin" />
                    : <Plus className="h-6 w-6" />
                  }
                  <span className="text-xs font-medium">
                    {backdropUploading ? "Uploading…" : "Add backdrops"}
                  </span>
                </button>
              </div>

              <input
                ref={backdropInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleBackdropUpload(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </Card>

        {/* ── Business Description ── */}
        <Card
          id="description"
          className="scroll-mt-4 border-border/60 p-5 shadow-soft"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">
              Business description
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => improveWithAI("description")}
              disabled={busy === "description"}
              className="gap-1.5"
            >
              {busy === "description" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Improve with AI
            </Button>
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-[130px]"
             placeholder="Tell people what makes your business unique — your style, experience, and what your services include."
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span
              className={`text-xs ${
                description.length >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground"
              }`}
            >
              {description.length} characters
              {description.length >= 100 ? " ✓" : " (100+ recommended)"}
            </span>
            <Button
              onClick={saveDescription}
              disabled={descSaving}
              size="sm"
            >
              {descSaving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* ── Services & Highlights ── */}
        <Card
          id="services"
          className="scroll-mt-4 border-border/60 p-5 shadow-soft"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">
              Services & highlights
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => improveWithAI("services")}
              disabled={busy === "services"}
              className="gap-1.5"
            >
              {busy === "services" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Improve with AI
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-sm">
                Searchable services and specialties{" "}
                <span className="font-normal text-muted-foreground">
                  (one per line)
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Add any service that does not fit a preset category, such as Ice Sculpting, Live Painting, or Custom Installations. Planners can search these names.
              </p>
               <div className="space-y-2">
                 {services.map((service, index) => (
                   <div key={index} className="flex items-center gap-2">
                     <Input
                       value={service}
                       onChange={(e) =>
                         setServices((prev) =>
                           prev.map((item, itemIndex) =>
                             itemIndex === index ? e.target.value : item,
                           ),
                         )
                       }
                       placeholder="Service offered"
                     />
                     <button
                       type="button"
                       onClick={() => setServices((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                       className="rounded p-2 text-muted-foreground hover:text-destructive"
                       aria-label={`Remove service ${index + 1}`}
                     >
                       <Trash2 className="h-4 w-4" />
                     </button>
                   </div>
                 ))}
                 <Button
                   type="button"
                   variant="outline"
                   size="sm"
                   onClick={() => setServices((prev) => [...prev, ""])}
                   className="gap-1.5"
                 >
                   <Plus className="h-3.5 w-3.5" /> Add service
                 </Button>
               </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">
                Highlights{" "}
                <span className="font-normal text-muted-foreground">
                  (one per line)
                </span>
              </Label>
              <Textarea
                value={highlights.join("\n")}
                onChange={(e) => setHighlights(e.target.value.split("\n"))}
                onBlur={(e) =>
                  setHighlights(
                    e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  )
                }
                className="min-h-[150px] font-mono text-sm"
                 placeholder={"Describe a strength, credential, or service detail"}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              onClick={saveServices}
              disabled={servicesSaving}
              size="sm"
            >
              {servicesSaving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Save
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* ── FAQs ── */}
        <Card
          id="faqs"
          className="scroll-mt-4 border-border/60 p-5 shadow-soft"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">FAQs</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => improveWithAI("faqs")}
              disabled={busy === "faqs"}
              className="gap-1.5"
            >
              {busy === "faqs" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              Generate with AI
            </Button>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Q{i + 1}
                  </span>
                  <button
                    onClick={() =>
                      setFaqs((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    className="ml-auto rounded p-1 text-muted-foreground hover:text-destructive"
                    aria-label={`Remove FAQ ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  value={faq.question}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((f, idx) =>
                        idx === i ? { ...f, question: e.target.value } : f,
                      ),
                    )
                  }
                  className="mb-2 font-medium"
                  placeholder="e.g. How far in advance should I book?"
                />
                <Textarea
                  value={faq.answer}
                  onChange={(e) =>
                    setFaqs((prev) =>
                      prev.map((f, idx) =>
                        idx === i ? { ...f, answer: e.target.value } : f,
                      ),
                    )
                  }
                  className="min-h-[70px]"
                  placeholder="Your answer…"
                />
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setFaqs((prev) => [...prev, { question: "", answer: "" }])
              }
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add a question
            </Button>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={saveFaqsData} disabled={faqsSaving} size="sm">
              {faqsSaving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Save FAQs
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* ── Quick links to other sections ── */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/vendor-packages"
            className="flex items-center gap-3 rounded-xl border border-border p-4 transition hover:bg-accent/60"
          >
            <Boxes className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Manage packages</p>
              <p className="truncate text-xs text-muted-foreground">
                Set pricing and what's included
              </p>
            </div>
          </Link>
          <Link
            to="/calendar/settings"
            className="flex items-center gap-3 rounded-xl border border-border p-4 transition hover:bg-accent/60"
          >
            <Calendar className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium">Set your availability</p>
              <p className="truncate text-xs text-muted-foreground">
                 Configure the hours shown on your listing
              </p>
            </div>
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function StepIntro({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Step {number}</p>
      <h2 className="mt-1 font-display text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

function VisibilityRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "public" | "private";
  onChange: (value: "public" | "private") => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
      <span className="text-sm">{label}</span>
      <div className="flex rounded-lg border border-border/70 p-0.5" role="group" aria-label={`${label} visibility`}>
        {(["public", "private"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={value === option}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition ${
              value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function StepActions({
  onBack,
  onNext,
  nextLabel,
  busy,
}: {
  onBack?: () => void;
  onNext: () => void | Promise<void>;
  nextLabel: string;
  busy?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 border-t border-border/60 pt-4">
      {onBack ? <Button type="button" variant="outline" onClick={onBack}>Back</Button> : <span />}
      <Button type="button" onClick={() => void onNext()} disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {busy ? "Saving…" : nextLabel}
      </Button>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function SuggestionList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      {items.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {items.slice(0, 8).map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No suggestions returned.</p>
      )}
    </div>
  );
}

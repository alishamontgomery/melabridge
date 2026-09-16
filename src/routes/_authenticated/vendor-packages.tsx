import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Star,
  Pencil,
  Copy,
  Trash2,
  GripVertical,
  DollarSign,
  TrendingUp,
  MessageCircle,
  Check,
  X,
  Sparkles,
  Clock,
  Loader2,
  ChevronRight,
  Layers,
  ImagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  listVendorPackages,
  upsertVendorPackage,
  deleteVendorPackage,
  reorderVendorPackages,
  getVendorCategory,
  getVendorPortfolioUrls,
  queuePackagePhotoCleanup,
  type VendorPackage,
} from "@/lib/vendor-packages.functions";
import {
  getCategorySpec,
  formatCategoryFieldSummary,
  type CategoryFieldSpec,
  type CatFieldDef,
} from "@/lib/vendor-category-fields";
import { getCategoryTemplate } from "@/lib/vendor-category-templates";
import { generateVendorPackageDescription } from "@/lib/vendor-ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

// ─── Route ────────────────────────────────────────────────────────────────────

const packageSearchSchema = z.object({
  draftName: z.string().max(200).optional(),
  draftDescription: z.string().max(4000).optional(),
  draftPrice: z.string().max(120).optional(),
});

export const Route = createFileRoute("/_authenticated/vendor-packages")({
  validateSearch: (search) => packageSearchSchema.parse(search),
  component: VendorPackagesPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PriceType = "fixed" | "starting_at" | "contact";
type PriceBasis =
  | "flat_rate"
  | "per_person"
  | "per_hour"
  | "per_event"
  | "per_item"
  | "custom_unit"
  | "custom_quote";

type AddOnDraft = {
  id: string;
  name: string;
  price: string; // dollar amount as string, "" = no price
  enabled: boolean;
  isCustom: boolean;
};

type PackageForm = {
  name: string;
  serviceCategory: string;
  price_type: PriceType;
  price_basis: PriceBasis | "";
  price_unit: string;
  price_dollars: string;
  duration: string;
  customDuration: string;
  selectedFeatures: string[];
  customFeatures: string[];
  addOns: AddOnDraft[];
  description: string;
  is_featured: boolean;
  categoryFields: Record<string, unknown>;
  photos: string[];
  is_visible: boolean;
};

type PackageDraftPrefill = {
  name: string;
  description: string;
  price: string;
};

const PRICE_BASIS_OPTIONS: { value: PriceBasis; label: string }[] = [
  { value: "flat_rate", label: "Flat rate" },
  { value: "per_person", label: "Per person" },
  { value: "per_hour", label: "Per hour" },
  { value: "per_event", label: "Per event" },
  { value: "per_item", label: "Per item" },
  { value: "custom_unit", label: "Custom unit" },
  { value: "custom_quote", label: "Custom quote" },
];

const PRICE_BASIS_LABELS: Record<PriceBasis, string> = Object.fromEntries(
  PRICE_BASIS_OPTIONS.map((option) => [option.value, option.label]),
) as Record<PriceBasis, string>;

// ─── Category-aware package choices ───────────────────────────────────────────

// Keep these labels recognized when editing packages created before the
// category templates were wired into the builder.
const LEGACY_FEATURE_ITEMS = [
  "Professional service",
  "Consultation included",
  "Setup & breakdown",
  "Travel to venue",
  "Custom pricing available",
  "Responsive communication",
  "Clear scope of work",
  "Preparation guidance",
  "On-site support",
];

const LEGACY_DURATIONS = [
  "1 hour",
  "2 hours",
  "3 hours",
  "4 hours",
  "6 hours",
  "8 hours",
  "Half day",
  "Full day",
  "Multi-day",
  "Custom",
];

function featureItemsFor(category: string | null | undefined): string[] {
  return [
    ...new Set([
      ...getCategoryTemplate(category).featureGroups.flatMap((group) => group.items),
      ...LEGACY_FEATURE_ITEMS,
    ]),
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _uid = 0;
const uid = () => `ao_${++_uid}`;

function parseAddOnStr(s: string): { name: string; price: string } {
  const m = s.match(/^(.+?)\s*\(\+\$(\d+(?:\.\d+)?)\)$/);
  if (m) return { name: m[1].trim(), price: m[2] };
  return { name: s.trim(), price: "" };
}

function serializeAddOn(name: string, price: string): string {
  const n = Number(price);
  return n > 0 ? `${name} (+$${n})` : name;
}

function draftPriceFields(price: string): Pick<PackageForm, "price_type" | "price_dollars"> {
  const match = price.replace(/,/g, "").match(/\$?\s*(\d+(?:\.\d{1,2})?)/);
  return match
    ? { price_type: "fixed", price_dollars: match[1] }
    : { price_type: "contact", price_dollars: "" };
}

function initForm(
  pkg: VendorPackage | null,
  draft?: PackageDraftPrefill | null,
  fallbackCategory?: string | null,
): PackageForm {
  const category = pkg?.service_category ?? fallbackCategory ?? null;
  const template = getCategoryTemplate(category);
  const availableFeatures = featureItemsFor(category);
  const addOnTemplates = template.addOns;
  const durationOptions = [...new Set([...template.durationOptions, ...LEGACY_DURATIONS])];

  if (!pkg) {
    const draftPrice = draftPriceFields(draft?.price ?? "");
    return {
      name: draft?.name ?? "",
      serviceCategory: fallbackCategory ?? "",
      price_type: draftPrice.price_type,
      price_basis: "",
      price_unit: "",
      price_dollars: draftPrice.price_dollars,
      duration: "",
      customDuration: "",
      selectedFeatures: [],
      customFeatures: [],
      addOns: addOnTemplates.map((ta) => ({
        id: uid(),
        name: ta.name,
        price: ta.defaultPrice ? String(ta.defaultPrice) : "",
        enabled: false,
        isCustom: false,
      })),
      description: draft?.description ?? "",
      is_featured: false,
      categoryFields: {},
      photos: [],
      is_visible: true,
    };
  }

  const selectedFeatures = pkg.inclusions.filter((i) =>
    availableFeatures.includes(i)
  );
  const customFeatures = pkg.inclusions.filter(
    (i) => !availableFeatures.includes(i)
  );
  const parsedExisting = pkg.add_ons.map(parseAddOnStr);
  const universalNames = new Set(
    addOnTemplates.map((t) => t.name.toLowerCase())
  );

  const addOns: AddOnDraft[] = [
    ...addOnTemplates.map((ta) => {
      const match = parsedExisting.find(
        (p) => p.name.toLowerCase() === ta.name.toLowerCase()
      );
      return {
        id: uid(),
        name: ta.name,
        price: match?.price ?? (ta.defaultPrice ? String(ta.defaultPrice) : ""),
        enabled: !!match,
        isCustom: false,
      };
    }),
    ...parsedExisting
      .filter((p) => !universalNames.has(p.name.toLowerCase()))
      .map((p) => ({
        id: uid(),
        name: p.name,
        price: p.price,
        enabled: true,
        isCustom: true,
      })),
  ];

  const pkgDur = pkg.duration ?? "";
  const inOpts = durationOptions.includes(pkgDur);

  return {
    name: pkg.name,
    serviceCategory: pkg.service_category ?? "",
    price_type: pkg.price_type as PriceType,
    price_basis: (pkg.price_basis as PriceBasis | null) ?? "",
    price_unit: pkg.price_unit ?? "",
    price_dollars:
      pkg.price_cents != null
        ? String(Math.round(pkg.price_cents / 100))
        : "",
    duration: inOpts ? pkgDur : pkgDur ? "Custom" : "",
    customDuration: inOpts ? "" : pkgDur,
    selectedFeatures,
    customFeatures,
    addOns,
    description: pkg.description ?? "",
    is_featured: pkg.is_featured,
    categoryFields: pkg.category_fields ?? {},
    photos: pkg.photos ?? [],
    is_visible: pkg.is_visible !== false,
  };
}

function buildPackageFields(form: PackageForm, sortOrder = 0) {
  return {
    name: form.name.trim(),
    service_category: form.serviceCategory || null,
    price_type: form.price_type,
    price_basis: form.price_basis || null,
    price_unit: form.price_unit.trim() || null,
    price_cents:
      form.price_type === "contact"
        ? null
        : form.price_dollars
          ? Math.round(Number(form.price_dollars) * 100)
          : null,
    duration:
      form.duration === "Custom" ? form.customDuration : form.duration,
    description: form.description.trim(),
    is_featured: form.is_featured,
    sort_order: sortOrder,
    inclusions: [
      ...form.selectedFeatures,
      ...form.customFeatures.filter((f) => f.trim()),
    ],
    add_ons: form.addOns
      .filter((a) => a.enabled && a.name.trim())
      .map((a) => serializeAddOn(a.name, a.price)),
    category_fields: form.categoryFields,
    photos: form.photos,
    is_visible: form.is_visible,
  };
}

function formatPrice(pkg: VendorPackage): string {
  if (pkg.price_type === "contact") return "Contact for pricing";
  if (pkg.price_cents == null) return "Price on request";
  const amt = (pkg.price_cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const basis = pkg.price_basis && pkg.price_basis !== "custom_quote"
    ? ` / ${pkg.price_basis === "custom_unit" ? (pkg.price_unit || "unit") : PRICE_BASIS_LABELS[pkg.price_basis].toLowerCase().replace("flat rate", "package")}`
    : "";
  return `${pkg.price_type === "starting_at" ? `From ${amt}` : amt}${basis}`;
}

// ─── Section title ────────────────────────────────────────────────────────────

function FormSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-1.5">
      {children}
    </p>
  );
}

function LocalPhotoPreview({ file, alt }: { file: File; alt: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return <img src={src} alt={alt} className="h-full w-full object-cover" />;
}

// ─── Price-type card ──────────────────────────────────────────────────────────

function PriceTypeCard({
  value,
  current,
  label,
  sub,
  icon: Icon,
  onClick,
}: {
  value: PriceType;
  current: PriceType;
  label: string;
  sub: string;
  icon: React.ElementType;
  onClick: () => void;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 p-3.5 rounded-xl border-2 text-left transition-all w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active
          ? "border-primary bg-primary/5"
          : "border-border hover:border-muted-foreground/40 hover:bg-muted/30"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
          active
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-semibold leading-tight",
            active ? "text-primary" : "text-foreground"
          )}
        >
          {label}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{sub}</p>
      </div>
    </button>
  );
}

// ─── Feature chip ─────────────────────────────────────────────────────────────

function FeatureChip({
  label,
  selected,
  onToggle,
  removable,
  onRemove,
}: {
  label: string;
  selected: boolean;
  onToggle?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        selected
          ? "bg-primary/10 border-primary/25 text-primary hover:bg-primary/15"
          : "bg-muted/40 border-transparent text-muted-foreground hover:border-border hover:text-foreground hover:bg-muted/60"
      )}
    >
      <span
        className={cn(
          "w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-all",
          selected
            ? "bg-primary border-primary"
            : "border-muted-foreground/30"
        )}
      >
        {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
      </span>
      {label}
      {removable && (
        <X
          className="w-3 h-3 text-muted-foreground hover:text-destructive flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
        />
      )}
    </button>
  );
}

// ─── Add-on row ───────────────────────────────────────────────────────────────

function AddOnRow({
  item,
  onChange,
  onRemove,
}: {
  item: AddOnDraft;
  onChange: (patch: Partial<AddOnDraft>) => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all",
        item.enabled
          ? "border-primary/20 bg-primary/5"
          : "border-border opacity-60 hover:opacity-80"
      )}
    >
      <Switch
        checked={item.enabled}
        onCheckedChange={(v) => onChange({ enabled: v })}
        className="flex-shrink-0 scale-90"
      />
      <div className="flex-1 min-w-0">
        {item.isCustom ? (
          <Input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Add-on name"
            className="h-7 text-sm border-0 bg-transparent p-0 focus-visible:ring-0 font-medium placeholder:text-muted-foreground/50"
          />
        ) : (
          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <span className="text-sm text-muted-foreground font-medium">$</span>
        <Input
          value={item.price}
          onChange={(e) =>
            onChange({ price: e.target.value.replace(/[^0-9.]/g, "") })
          }
          disabled={!item.enabled}
          placeholder="—"
          className="w-20 h-7 text-sm text-right disabled:opacity-40"
          inputMode="decimal"
        />
      </div>
      {item.isCustom && (
        <button
          type="button"
          onClick={onRemove}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ─── Category-specific fields section ────────────────────────────────────────

function CategorySpecificSection({
  spec,
  values,
  onChange,
  portfolioUrls = [],
}: {
  spec: CategoryFieldSpec;
  values: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  portfolioUrls?: string[];
}) {
  const set = (key: string, val: unknown) =>
    onChange({ ...values, [key]: val });

  const isVisible = (field: CatFieldDef): boolean => {
    if (!field.showWhen) return true;
    return values[field.showWhen.key] === field.showWhen.value;
  };

  const renderSingleField = (field: CatFieldDef): React.ReactNode => {
    switch (field.kind) {
      case "chips": {
        const sel = Array.isArray(values[field.key])
          ? (values[field.key] as string[])
          : [];
        return (
          <div key={field.key} className="space-y-2">
            <Label className="text-sm font-medium">{field.label}</Label>
            <div className="flex flex-wrap gap-2">
              {field.options!.map((opt) => (
                <FeatureChip
                  key={opt}
                  label={opt}
                  selected={sel.includes(opt)}
                  onToggle={() =>
                    set(
                      field.key,
                      sel.includes(opt)
                        ? sel.filter((s) => s !== opt)
                        : [...sel, opt]
                    )
                  }
                />
              ))}
            </div>
          </div>
        );
      }

      case "number": {
        const raw = values[field.key];
        const strVal = raw != null && raw !== 0 ? String(raw) : "";
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`cf-${field.key}`} className="text-sm font-medium">
              {field.label}
            </Label>
            <div className="relative">
              <Input
                id={`cf-${field.key}`}
                value={strVal}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^0-9]/g, "");
                  set(field.key, v === "" ? null : Number(v));
                }}
                placeholder={field.placeholder}
                className={cn("h-9 text-sm", field.suffix && "pr-14")}
                inputMode="numeric"
              />
              {field.suffix && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground select-none pointer-events-none">
                  {field.suffix}
                </span>
              )}
            </div>
          </div>
        );
      }

      case "toggle": {
        return (
          <div key={field.key} className="flex items-center gap-3 py-0.5">
            <Switch
              id={`cf-${field.key}`}
              checked={values[field.key] === true}
              onCheckedChange={(v) => set(field.key, v)}
              className="flex-shrink-0 scale-90"
            />
            <Label
              htmlFor={`cf-${field.key}`}
              className="text-sm font-medium cursor-pointer leading-tight"
            >
              {field.label}
            </Label>
          </div>
        );
      }

      case "text": {
        return (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`cf-${field.key}`} className="text-sm font-medium">
              {field.label}
            </Label>
            <Input
              id={`cf-${field.key}`}
              value={
                typeof values[field.key] === "string"
                  ? (values[field.key] as string)
                  : ""
              }
              onChange={(e) => set(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="h-9 text-sm"
              maxLength={200}
            />
          </div>
        );
      }

      case "backdrop_picker": {
        const sel = Array.isArray(values[field.key])
          ? (values[field.key] as string[])
          : [];
        if (portfolioUrls.length === 0) {
          return (
            <div key={field.key} className="space-y-2">
              <Label className="text-sm font-medium">{field.label}</Label>
              <div className="flex items-start gap-2 py-3 px-3 rounded-xl border border-dashed border-border bg-muted/20">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  No portfolio photos uploaded yet.{" "}
                  <Link to="/vendor-profile-builder" className="text-primary underline underline-offset-2">
                    Add photos in your profile
                  </Link>{" "}
                  to select backdrops here.
                </p>
              </div>
            </div>
          );
        }
        return (
          <div key={field.key} className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-sm font-medium">{field.label}</Label>
              {sel.length > 0 && (
                <span className="text-xs text-primary font-medium">
                  {sel.length} selected
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {portfolioUrls.map((url) => {
                const isSel = sel.includes(url);
                return (
                  <button
                    key={url}
                    type="button"
                    onClick={() =>
                      set(
                        field.key,
                        isSel
                          ? sel.filter((u) => u !== url)
                          : [...sel, url]
                      )
                    }
                    className={cn(
                      "relative aspect-square rounded-lg overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isSel
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/40"
                    )}
                  >
                    <img
                      src={url}
                      alt="Backdrop"
                      className="w-full h-full object-cover"
                    />
                    {isSel && (
                      <div className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // Walk fields in spec order. Pair adjacent number fields (max 2) side-by-side;
  // pair adjacent toggles on larger screens.
  const visible = spec.fields.filter(isVisible);
  const rows: React.ReactNode[] = [];
  let i = 0;
  while (i < visible.length) {
    const f = visible[i];
    const next = visible[i + 1];
    if (f.kind === "number" && next?.kind === "number") {
      rows.push(
        <div key={`np-${i}`} className="grid grid-cols-2 gap-3">
          {renderSingleField(f)}
          {renderSingleField(next)}
        </div>
      );
      i += 2;
    } else if (
      f.kind === "toggle" &&
      next?.kind === "toggle" &&
      !next.showWhen
    ) {
      rows.push(
        <div key={`tp-${i}`} className="grid sm:grid-cols-2 gap-1">
          {renderSingleField(f)}
          {renderSingleField(next)}
        </div>
      );
      i += 2;
    } else {
      rows.push(renderSingleField(f));
      i++;
    }
  }

  return <div className="space-y-4">{rows}</div>;
}

// ─── Step 1: Basics ───────────────────────────────────────────────────────────

function BasicsStep({
  form,
  onChange,
  vendorCategories,
  category,
}: {
  form: PackageForm;
  onChange: (patch: Partial<PackageForm>) => void;
  vendorCategories: string[];
  category: string | null | undefined;
}) {
  const categoryDurations = [
    ...new Set([...getCategoryTemplate(category).durationOptions, ...LEGACY_DURATIONS]),
  ];

  return (
    <div className="space-y-6">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="pkg-name" className="text-sm font-semibold">
          Package name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="pkg-name"
          autoFocus
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g., Premium Vendor Package"
          className="h-11 text-base"
          maxLength={100}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pkg-service-category" className="text-sm font-semibold">
          Service category{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Select
          value={form.serviceCategory || "__all__"}
          onValueChange={(value) =>
            onChange({
              serviceCategory: value === "__all__" ? "" : value,
            })
          }
        >
          <SelectTrigger id="pkg-service-category" className="h-11 text-base">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">
              All services / not category-specific
            </SelectItem>
            {vendorCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Use this when the package, pricing, details, or photos apply to one
          service only.
        </p>
      </div>

      {/* Price type */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">Pricing model</Label>
        <div className="grid grid-cols-3 gap-2">
          <PriceTypeCard
            value="fixed"
            current={form.price_type}
            label="Fixed price"
            sub="Set an exact amount"
            icon={DollarSign}
            onClick={() => onChange({ price_type: "fixed" })}
          />
          <PriceTypeCard
            value="starting_at"
            current={form.price_type}
            label="Starting at"
            sub="Base price shown"
            icon={TrendingUp}
            onClick={() => onChange({ price_type: "starting_at" })}
          />
          <PriceTypeCard
            value="contact"
            current={form.price_type}
            label="On request"
            sub="Price hidden"
            icon={MessageCircle}
            onClick={() => onChange({ price_type: "contact" })}
          />
        </div>

        {form.price_type !== "contact" && (
          <div className="space-y-1.5 mt-2">
            <Label className="text-sm font-medium">
              {form.price_type === "fixed" ? "Package price" : "Starting price"}
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">
                $
              </span>
              <Input
                value={form.price_dollars}
                onChange={(e) =>
                  onChange({
                    price_dollars: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
                placeholder={form.price_type === "fixed" ? "e.g., 1500" : "e.g., 500"}
                className="pl-7 h-11 text-base"
                inputMode="decimal"
              />
            </div>
          </div>
        )}
      </div>

      {/* Duration */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">
          Duration <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Select
          value={form.duration}
          onValueChange={(v) =>
            onChange({ duration: v === "__none__" ? "" : v, customDuration: "" })
          }
        >
          <SelectTrigger className="h-11 text-base">
            <SelectValue placeholder="Select duration or skip…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Not applicable / varies</SelectItem>
            {categoryDurations.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.duration === "Custom" && (
          <Input
            autoFocus
            value={form.customDuration}
            onChange={(e) => onChange({ customDuration: e.target.value })}
            placeholder="e.g., 7 hours, 2 days, weekend…"
            className="h-11 text-base mt-2"
            maxLength={60}
          />
        )}
        <div className="mt-2 space-y-1.5">
          <Label htmlFor="pkg-price-basis" className="text-sm font-medium">
            Price basis <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Select
            value={form.price_basis || "__none__"}
            onValueChange={(value) =>
              onChange({ price_basis: value === "__none__" ? "" : value as PriceBasis })
            }
          >
            <SelectTrigger id="pkg-price-basis" className="h-11 text-base">
              <SelectValue placeholder="Choose how this is priced…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No unit — use the package price</SelectItem>
              {PRICE_BASIS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Use a unit when planners need context, such as per person or per hour.
          </p>
          {form.price_basis === "custom_unit" && (
            <Input
              value={form.price_unit}
              onChange={(event) => onChange({ price_unit: event.target.value })}
              placeholder="e.g. sculpture, installation, design, performance, commission"
              maxLength={60}
              className="h-11 text-base"
              aria-label="Custom pricing unit"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2: Features / What's Included ──────────────────────────────────────

function FeaturesStep({
  form,
  onChange,
  category,
}: {
  form: PackageForm;
  onChange: (patch: Partial<PackageForm>) => void;
  category: string | null | undefined;
}) {
  const [customInput, setCustomInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = (item: string) => {
    const sel = form.selectedFeatures;
    onChange({
      selectedFeatures: sel.includes(item)
        ? sel.filter((f) => f !== item)
        : [...sel, item],
    });
  };

  const addCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    onChange({ customFeatures: [...form.customFeatures, val] });
    setCustomInput("");
    inputRef.current?.focus();
  };

  const removeCustom = (idx: number) =>
    onChange({
      customFeatures: form.customFeatures.filter((_, i) => i !== idx),
    });

  const totalSelected =
    form.selectedFeatures.length + form.customFeatures.length;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">What's included?</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select everything this package covers
          </p>
        </div>
        {totalSelected > 0 && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {totalSelected} selected
          </Badge>
        )}
      </div>

      {getCategoryTemplate(category).featureGroups.map((group) => (
        <div key={group.group} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {group.group}
          </p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((item) => (
              <FeatureChip
                key={item}
                label={item}
                selected={form.selectedFeatures.includes(item)}
                onToggle={() => toggle(item)}
              />
            ))}
          </div>
        </div>
      ))}

      <Separator />

      {/* Custom features */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Custom features
        </p>
        {form.customFeatures.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {form.customFeatures.map((f, i) => (
              <FeatureChip
                key={`cf-${i}`}
                label={f}
                selected
                removable
                onRemove={() => removeCustom(i)}
              />
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add a custom feature…"
            className="h-9 text-sm"
            maxLength={80}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            disabled={!customInput.trim()}
            className="h-9 w-9 p-0 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 3: Add-ons ──────────────────────────────────────────────────────────

function AddOnsStep({
  form,
  onChange,
}: {
  form: PackageForm;
  onChange: (patch: Partial<PackageForm>) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");

  const updateAddOn = (id: string, patch: Partial<AddOnDraft>) =>
    onChange({
      addOns: form.addOns.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    });

  const removeAddOn = (id: string) =>
    onChange({ addOns: form.addOns.filter((a) => a.id !== id) });

  const addCustom = () => {
    const name = newName.trim();
    if (!name) return;
    onChange({
      addOns: [
        ...form.addOns,
        {
          id: uid(),
          name,
          price: newPrice,
          enabled: true,
          isCustom: true,
        },
      ],
    });
    setNewName("");
    setNewPrice("");
  };

  const enabledCount = form.addOns.filter((a) => a.enabled).length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Add-ons</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Optional extras you offer alongside this package
          </p>
        </div>
        {enabledCount > 0 && (
          <Badge variant="secondary" className="text-xs flex-shrink-0">
            {enabledCount} enabled
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {form.addOns.map((item) => (
          <AddOnRow
            key={item.id}
            item={item}
            onChange={(patch) => updateAddOn(item.id, patch)}
            onRemove={item.isCustom ? () => removeAddOn(item.id) : undefined}
          />
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Add custom
        </p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Add-on name…"
            className="h-9 text-sm flex-1"
            maxLength={80}
          />
          <div className="relative w-24 flex-shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm select-none">
              $
            </span>
            <Input
              value={newPrice}
              onChange={(e) =>
                setNewPrice(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0"
              className="pl-6 h-9 text-sm"
              inputMode="decimal"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            disabled={!newName.trim()}
            className="h-9 w-9 p-0 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4: Details & Preview ────────────────────────────────────────────────

function DetailsStep({
  form,
  onChange,
  categoryFields,
}: {
  form: PackageForm;
  onChange: (patch: Partial<PackageForm>) => void;
  categoryFields?: Record<string, unknown>;
}) {
  const generateDescription = useServerFn(generateVendorPackageDescription);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const MAX_DESC = 500;

  const handleAISuggest = async () => {
    if (aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    try {
      const result = await generateDescription({
        data: {
          name: form.name,
          serviceCategory: form.serviceCategory,
          features: [...form.selectedFeatures, ...form.customFeatures.filter((feature) => feature.trim())],
          addOns: form.addOns.filter((addOn) => addOn.enabled && addOn.name.trim()).map((addOn) => addOn.name),
          price: form.price_type === "contact"
            ? "Custom quote"
            : form.price_dollars
              ? `${form.price_type === "starting_at" ? "Starting at " : ""}$${form.price_dollars}${form.price_basis === "custom_unit" && form.price_unit ? ` per ${form.price_unit}` : ""}`
              : undefined,
          duration: form.duration === "Custom" ? form.customDuration : form.duration,
          categoryFields,
        },
      });
      if (result.degraded || !result.description) {
        setAiError(result.message ?? "MelaAssist could not generate a description. Please try again.");
      } else {
        onChange({ description: result.description.slice(0, MAX_DESC) });
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "MelaAssist could not generate a description. Please try again.");
    } finally {
      setAiBusy(false);
    }
  };

  // Build preview values
  const inclusions = [
    ...form.selectedFeatures,
    ...form.customFeatures.filter((f) => f.trim()),
  ];
  const previewInclusions = inclusions.slice(0, 5);
  const moreCount = inclusions.length - previewInclusions.length;
  const enabledAddOns = form.addOns.filter((a) => a.enabled && a.name.trim());

  const priceDisplay =
    form.price_type === "contact"
      ? "Custom quote"
      : form.price_dollars
        ? `${form.price_type === "starting_at" ? "From " : ""}$${Number(form.price_dollars).toLocaleString()}${form.price_basis && form.price_basis !== "custom_quote" ? ` / ${form.price_basis === "custom_unit" ? (form.price_unit || "unit") : PRICE_BASIS_LABELS[form.price_basis].toLowerCase().replace("flat rate", "package")}` : ""}`
        : "Price TBD";
  const durationDisplay =
    form.duration === "Custom" ? form.customDuration : form.duration;

  return (
    <div className="space-y-5">
      {/* Description */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm font-semibold">Description</Label>
          <button
            type="button"
            onClick={handleAISuggest}
            disabled={aiBusy}
            aria-busy={aiBusy}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:cursor-wait disabled:opacity-60"
          >
            {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiBusy ? "Writing description…" : "Suggest with MelaAssist"}
          </button>
        </div>
        <Textarea
          value={form.description}
          onChange={(e) => {
            if (e.target.value.length <= MAX_DESC)
              onChange({ description: e.target.value });
          }}
          placeholder="Describe what makes this package unique, what clients can expect when working with you, and why you're the right choice for their event."
          className="min-h-[88px] text-sm resize-none"
        />
        <p
          className={cn(
            "text-xs text-right",
            form.description.length > MAX_DESC * 0.9
              ? "text-amber-500"
              : "text-muted-foreground"
          )}
        >
          {form.description.length}/{MAX_DESC}
        </p>
        {aiError && (
          <p className="text-xs text-destructive" role="alert">
            {aiError}
          </p>
        )}
      </div>

      {/* Featured toggle */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
        <Switch
          id="featured-pkg"
          checked={form.is_featured}
          onCheckedChange={(v) => onChange({ is_featured: v })}
          className="mt-0.5"
        />
        <div>
          <Label
            htmlFor="featured-pkg"
            className="text-sm font-semibold cursor-pointer"
          >
            Featured package
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Highlighted first on your public profile. Only one package can be featured at a time.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-muted/20">
        <Switch
          id="visible-pkg"
          checked={form.is_visible}
          onCheckedChange={(v) => onChange({ is_visible: v })}
          className="mt-0.5"
        />
        <div>
          <Label htmlFor="visible-pkg" className="text-sm font-semibold cursor-pointer">
            Show on public profile
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Keep this package saved privately when it is not ready to share.
          </p>
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Preview
        </p>
        <div className="rounded-xl border overflow-hidden shadow-sm">
          <div className="h-1.5 w-full bg-gradient-to-r from-primary to-primary-glow" />
          <div className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm leading-snug truncate">
                  {form.name || (
                    <span className="italic text-muted-foreground">
                      Untitled package
                    </span>
                  )}
                </p>
                <p className="text-sm font-bold text-primary mt-0.5">
                  {priceDisplay}
                </p>
              </div>
              {form.is_featured && (
                <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-0.5" />
              )}
            </div>

            {durationDisplay && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {durationDisplay}
              </div>
            )}

            {form.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {form.description}
              </p>
            )}

            {previewInclusions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {previewInclusions.map((inc) => (
                  <span
                    key={inc}
                    className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground"
                  >
                    {inc}
                  </span>
                ))}
                {moreCount > 0 && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-primary font-medium">
                    +{moreCount} more
                  </span>
                )}
              </div>
            )}

            {enabledAddOns.length > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3 flex-shrink-0" />
                {enabledAddOns.length} add-on
                {enabledAddOns.length !== 1 ? "s" : ""} available
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Package form dialog (single-scroll) ─────────────────────────────────────

function PackageWizard({
  open,
  onClose,
  editingPackage,
  initialDraft,
  vendorCategory,
  vendorCategories,
  vendorId,
  onSave,
  onRollbackNew,
}: {
  open: boolean;
  onClose: () => void;
  editingPackage: VendorPackage | null;
  initialDraft: PackageDraftPrefill | null;
  vendorCategory: string | null;
  vendorCategories: string[];
  vendorId: string | null;
  onSave: (
    fields: ReturnType<typeof buildPackageFields>,
    id?: string
  ) => Promise<string>;
  onRollbackNew: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<PackageForm>(() =>
    initForm(editingPackage, initialDraft, vendorCategory)
  );
  const [saving, setSaving] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const createdIdRef = useRef<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setForm(initForm(editingPackage, initialDraft, vendorCategory));
      setPendingPhotos([]);
      createdIdRef.current = null;
    }
  }, [open, editingPackage, initialDraft, vendorCategory]);

  const onChange = useCallback(
    (patch: Partial<PackageForm>) =>
      setForm((prev) => ({ ...prev, ...patch })),
    []
  );

  const effectiveCategory = form.serviceCategory || vendorCategory;
  const spec = getCategorySpec(effectiveCategory);

  // Fetch portfolio photos for backdrop picker (Photo Booth only)
  const isPhotoBooth =
    effectiveCategory?.toLowerCase() === "photo booth";
  const { data: portfolioData } = useQuery({
    queryKey: ["vendor-portfolio-urls"],
    queryFn: () => getVendorPortfolioUrls(),
    enabled: open && isPhotoBooth,
    staleTime: 5 * 60 * 1000,
  });
  const portfolioUrls = portfolioData?.urls ?? [];

  const handleSave = async () => {
    setSaving(true);
    let canRollbackNew = true;
    try {
      const packageId = await onSave(
        buildPackageFields(form, editingPackage?.sort_order ?? 0),
        editingPackage?.id ?? createdIdRef.current ?? undefined
      );
      createdIdRef.current = packageId;

      if (pendingPhotos.length > 0) {
        if (!vendorId) throw new Error("Vendor profile is not ready yet");
        const uploadedUrls: string[] = [];
        const uploadedPaths: string[] = [];
        try {
          for (const file of pendingPhotos) {
            const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
            const path = `package-photos/${vendorId}/${packageId}/${crypto.randomUUID()}.${extension}`;
            const { error } = await supabase.storage
              .from("vendor-assets")
              .upload(path, file, {
                cacheControl: "3600",
                upsert: false,
                contentType: file.type,
              });
            if (error) throw error;
            uploadedPaths.push(path);
            uploadedUrls.push(
              supabase.storage.from("vendor-assets").getPublicUrl(path).data.publicUrl
            );
          }
          const nextForm = { ...form, photos: [...form.photos, ...uploadedUrls] };
          await onSave(
            buildPackageFields(nextForm, editingPackage?.sort_order ?? 0),
            packageId
          );
        } catch (error) {
          if (uploadedPaths.length) {
            canRollbackNew = false;
            await queuePackagePhotoCleanup({
              data: { packageId, urls: uploadedUrls },
            });
            canRollbackNew = true;
          }
          throw error;
        }
      }
      onClose();
      toast.success(editingPackage ? "Package updated" : "Package created");
    } catch (error) {
      if (!editingPackage && createdIdRef.current && canRollbackNew) {
        try {
          await onRollbackNew(createdIdRef.current);
          createdIdRef.current = null;
        } catch {
          toast.error("The photo upload failed and the empty package could not be removed");
        }
      }
      toast.error(error instanceof Error ? error.message : "Failed to save package");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg sm:max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <DialogTitle className="text-base font-semibold">
              {editingPackage ? "Edit package" : "New package"}
            </DialogTitle>
            <Badge
              variant="outline"
              className="ml-auto text-[10px] px-2 py-0.5 font-medium"
            >
              Vendor
            </Badge>
          </div>
        </DialogHeader>

        {/* Single-scroll body */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="px-6 py-6 space-y-8">

            {/* ── 1. Package details ── */}
            <div className="space-y-5">
              <FormSectionTitle>Package details</FormSectionTitle>
              <BasicsStep
                form={form}
                onChange={onChange}
                vendorCategories={vendorCategories}
                category={effectiveCategory}
              />
            </div>

            {/* ── 2. Category-specific fields (conditional) ── */}
            {spec && (
              <div className="space-y-4">
                <FormSectionTitle>
                  Additional details
                </FormSectionTitle>
                <CategorySpecificSection
                  spec={spec}
                  values={form.categoryFields}
                  onChange={(cf) => onChange({ categoryFields: cf })}
                  portfolioUrls={portfolioUrls}
                />
              </div>
            )}

            <Separator />

            <div className="space-y-4">
              <FormSectionTitle>Package photos</FormSectionTitle>
              <p className="text-sm text-muted-foreground">
                Add up to 3 photos that show clients what this package looks like.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {form.photos.map((url, index) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-xl border">
                    <img src={url} alt={`Package preview ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      aria-label={`Remove package photo ${index + 1}`}
                      onClick={() => onChange({ photos: form.photos.filter((item) => item !== url) })}
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-foreground shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {pendingPhotos.map((file, index) => (
                  <div key={`${file.name}-${file.lastModified}`} className="group relative aspect-square overflow-hidden rounded-xl border">
                    <LocalPhotoPreview file={file} alt={`New package preview ${index + 1}`} />
                    <button
                      type="button"
                      aria-label={`Remove new package photo ${index + 1}`}
                      onClick={() => setPendingPhotos((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1 text-foreground shadow"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {form.photos.length + pendingPhotos.length < 3 && (
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm text-muted-foreground hover:border-primary/50 hover:text-primary"
                  >
                    <ImagePlus className="h-5 w-5" />
                    Add photo
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const available = 3 - form.photos.length - pendingPhotos.length;
                  const valid = files.filter((file) => {
                    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                      toast.error(`${file.name} must be a JPG, PNG, or WebP image`);
                      return false;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error(`${file.name} is larger than 5 MB`);
                      return false;
                    }
                    return true;
                  });
                  if (valid.length > available) {
                    toast.info("Each package can have up to 3 photos");
                  }
                  setPendingPhotos((current) => [...current, ...valid.slice(0, available)]);
                  event.target.value = "";
                }}
              />
            </div>

            <Separator />

            {/* ── 3. What's included ── */}
            <div className="space-y-4">
              <FeaturesStep
                form={form}
                onChange={onChange}
                category={effectiveCategory}
              />
            </div>

            <Separator />

            {/* ── 4. Add-ons ── */}
            <div className="space-y-4">
              <AddOnsStep form={form} onChange={onChange} />
            </div>

            <Separator />

            {/* ── 5. Description & settings ── */}
            <div className="space-y-4">
              <FormSectionTitle>Description & settings</FormSectionTitle>
              <DetailsStep
                form={form}
                onChange={onChange}
                categoryFields={form.categoryFields}
              />
            </div>

          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-between gap-3 flex-shrink-0 bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={saving}
            className="text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="gap-1.5 min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Saving…
              </>
            ) : editingPackage ? (
              "Save changes"
            ) : (
              "Create package"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  spec,
  onEdit,
  onDuplicate,
  onDelete,
  onFeature,
  onVisibility,
  dragProps,
  isDragging,
  isDropTarget,
}: {
  pkg: VendorPackage;
  spec: CategoryFieldSpec | null;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFeature: () => void;
  onVisibility: () => void;
  dragProps: React.HTMLAttributes<HTMLDivElement>;
  isDragging: boolean;
  isDropTarget: boolean;
}) {
  const catChips =
    spec && pkg.category_fields
      ? formatCategoryFieldSummary(pkg.category_fields, spec)
      : [];
  const previewInc = pkg.inclusions.slice(0, 4);
  const moreCount = pkg.inclusions.length - previewInc.length;

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card overflow-hidden transition-all duration-200",
        isDragging && "shadow-2xl ring-2 ring-primary/30 scale-[1.02] opacity-75",
        isDropTarget && !isDragging && "ring-2 ring-primary/40",
        !isDragging && "hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      {/* Accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary to-primary-glow" />
      {pkg.photos?.[0] && (
        <img
          src={pkg.photos[0]}
          alt={`${pkg.name} package`}
          className="h-36 w-full object-cover"
          loading="lazy"
        />
      )}

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start gap-2">
          <div
            {...dragProps}
            className="cursor-grab active:cursor-grabbing mt-0.5 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
              {pkg.name}
            </h3>
          </div>
          {pkg.is_featured && (
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0 mt-0.5" />
          )}
          {!pkg.is_visible && (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Hidden
            </Badge>
          )}
        </div>

        {/* Price + duration */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-foreground">
            {formatPrice(pkg)}
          </span>
          {pkg.duration && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {pkg.duration}
              </span>
            </>
          )}
          {pkg.price_basis && pkg.price_basis !== "custom_quote" && (
            <>
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40 flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                {pkg.price_basis === "custom_unit" ? (pkg.price_unit || "Custom unit") : PRICE_BASIS_LABELS[pkg.price_basis]}
              </span>
            </>
          )}
        </div>

        {/* Category-specific field chips */}
        {catChips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {catChips.map((chip) => (
              <span
                key={chip}
                className="text-[11px] bg-primary/8 text-primary px-2 py-0.5 rounded-full leading-tight border border-primary/15 font-medium"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Feature chips */}
        {previewInc.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {previewInc.map((inc) => (
              <span
                key={inc}
                className="text-[11px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-full leading-tight"
              >
                {inc}
              </span>
            ))}
            {moreCount > 0 && (
              <span className="text-[11px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium leading-tight">
                +{moreCount} more
              </span>
            )}
          </div>
        )}

        {/* Add-ons */}
        {pkg.add_ons.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Layers className="w-3 h-3 flex-shrink-0" />
            {pkg.add_ons.length} add-on{pkg.add_ons.length !== 1 ? "s" : ""}{" "}
            available
          </p>
        )}

        <Separator />

        {/* Actions */}
        <div className="flex items-center gap-0.5 -mx-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={onDuplicate}
          >
            <Copy className="w-3.5 h-3.5" />
            Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "flex-1 h-8 text-xs gap-1",
              pkg.is_featured
                ? "text-amber-500 hover:text-amber-500/80"
                : "text-muted-foreground hover:text-amber-500"
            )}
            onClick={onFeature}
          >
            <Star
              className={cn(
                "w-3.5 h-3.5",
                pkg.is_featured && "fill-amber-400"
              )}
            />
            {pkg.is_featured ? "Featured" : "Feature"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
            onClick={onVisibility}
          >
            {pkg.is_visible ? "Hide" : "Show"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 rounded-2xl border-2 border-dashed border-border">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <Layers className="w-7 h-7 text-muted-foreground" />
      </div>
      <div className="space-y-1 max-w-xs">
        <h2 className="text-base font-semibold">Create your first package</h2>
        <p className="text-sm text-muted-foreground">
          Packages help planners quickly understand your services and pricing — and decide who to contact.
        </p>
      </div>
      <Button onClick={onAdd} className="gap-2 mt-2">
        <Plus className="w-4 h-4" />
        Create package
      </Button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function VendorPackagesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const search = useSearch({ from: "/_authenticated/vendor-packages" });
  const openedDraftRef = useRef<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingPkg, setEditingPkg] = useState<VendorPackage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VendorPackage | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const { data: packages = [], isLoading: pkgsLoading } = useQuery({
    queryKey: ["vendor-packages"],
    queryFn: () => listVendorPackages(),
  });

  const { data: vendorCategoryData = null } = useQuery({
    queryKey: ["vendor-category"],
    queryFn: () => getVendorCategory(),
  });
  const vendorCategory = vendorCategoryData?.category ?? null;
  const vendorCategories =
    vendorCategoryData?.categories ??
    (vendorCategory ? [vendorCategory] : []);
  const vendorId = vendorCategoryData?.vendorId ?? null;
  const initialDraft = useMemo(
    () =>
      search.draftName
        ? {
            name: search.draftName,
            description: search.draftDescription ?? "",
            price: search.draftPrice ?? "",
          }
        : null,
    [search.draftDescription, search.draftName, search.draftPrice],
  );

  useEffect(() => {
    if (!initialDraft) return;
    const signature = JSON.stringify(initialDraft);
    if (openedDraftRef.current === signature) return;
    openedDraftRef.current = signature;
    setEditingPkg(null);
    setWizardOpen(true);
  }, [initialDraft]);

  const isLoading = pkgsLoading;

  const sorted = [...packages].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const upsertMut = useMutation({
    mutationFn: upsertVendorPackage,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["vendor-packages"] });
      void qc.invalidateQueries({ queryKey: ["vendor-profile-snapshot"] });
    },
    onError: () => toast.error("Failed to save package"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteVendorPackage,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendor-packages"] });
      toast.success("Package deleted");
    },
    onError: () => toast.error("Failed to delete package"),
  });

  const reorderMut = useMutation({
    mutationFn: reorderVendorPackages,
    onError: () => qc.invalidateQueries({ queryKey: ["vendor-packages"] }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = async (
    fields: ReturnType<typeof buildPackageFields>,
    id?: string
  ): Promise<string> => {
    const result = await upsertMut.mutateAsync({ data: { ...fields, ...(id ? { id } : {}) } });
    return result.id;
  };

  const handleDuplicate = (pkg: VendorPackage) => {
    upsertMut.mutate({
      data: {
        name: `${pkg.name} (copy)`,
        service_category: pkg.service_category ?? null,
        price_type: pkg.price_type,
        price_cents: pkg.price_cents,
        price_basis: pkg.price_basis,
        price_unit: pkg.price_unit,
        duration: pkg.duration,
        description: pkg.description,
        inclusions: pkg.inclusions,
        add_ons: pkg.add_ons,
        is_featured: false,
        sort_order: pkg.sort_order,
        category_fields: pkg.category_fields ?? {},
        photos: [],
        is_visible: true,
      },
    });
    toast.success("Package duplicated");
  };

  const handleFeature = (pkg: VendorPackage) => {
    upsertMut.mutate({
      data: {
        id: pkg.id,
        name: pkg.name,
        service_category: pkg.service_category ?? null,
        price_type: pkg.price_type,
        price_cents: pkg.price_cents,
        price_basis: pkg.price_basis,
        price_unit: pkg.price_unit,
        duration: pkg.duration,
        description: pkg.description,
        inclusions: pkg.inclusions,
        add_ons: pkg.add_ons,
        is_featured: !pkg.is_featured,
        sort_order: pkg.sort_order,
        category_fields: pkg.category_fields ?? {},
        photos: pkg.photos ?? [],
        is_visible: pkg.is_visible,
      },
    });
  };

  const handleVisibility = (pkg: VendorPackage) => {
    upsertMut.mutate({
      data: {
        id: pkg.id,
        name: pkg.name,
        service_category: pkg.service_category ?? null,
        price_type: pkg.price_type,
        price_cents: pkg.price_cents,
        price_basis: pkg.price_basis,
        price_unit: pkg.price_unit,
        duration: pkg.duration,
        description: pkg.description,
        inclusions: pkg.inclusions,
        add_ons: pkg.add_ons,
        is_featured: pkg.is_featured,
        sort_order: pkg.sort_order,
        category_fields: pkg.category_fields ?? {},
        photos: pkg.photos ?? [],
        is_visible: !pkg.is_visible,
      },
    });
  };

  // ── Drag to reorder ────────────────────────────────────────────────────────

  const onDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropId(id);
  };
  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDropId(null);
      return;
    }
    const ids = sorted.map((p) => p.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    reorderMut.mutate({ data: { orderedIds: next } });
    setDragId(null);
    setDropId(null);
  };
  const onDragEnd = () => {
    setDragId(null);
    setDropId(null);
  };

  // ── Open wizard ────────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingPkg(null);
    setWizardOpen(true);
  };
  const openEdit = (pkg: VendorPackage) => {
    setEditingPkg(pkg);
    setWizardOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Back nav */}
      <div>
        <Link
          to="/vendor"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to dashboard
        </Link>
      </div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight">Packages</h1>
            {sorted.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {sorted.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Describe your services so planners know exactly what you offer
          </p>
        </div>
        {sorted.length > 0 && (
          <Button onClick={openCreate} className="gap-2 flex-shrink-0">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add package</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {/* Grid */}
      {sorted.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((pkg) => (
            <div
              key={pkg.id}
              onDragOver={(e) => onDragOver(e, pkg.id)}
              onDrop={(e) => onDrop(e, pkg.id)}
            >
              <PackageCard
                pkg={pkg}
                spec={getCategorySpec(pkg.service_category ?? vendorCategory)}
                onEdit={() => openEdit(pkg)}
                onDuplicate={() => handleDuplicate(pkg)}
                onDelete={() => setDeleteTarget(pkg)}
                onFeature={() => handleFeature(pkg)}
                onVisibility={() => handleVisibility(pkg)}
                dragProps={{
                  draggable: true,
                  onDragStart: (e: React.DragEvent) => onDragStart(e, pkg.id),
                  onDragEnd,
                }}
                isDragging={dragId === pkg.id}
                isDropTarget={dropId === pkg.id && dragId !== pkg.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState onAdd={openCreate} />
      )}

      {/* Wizard */}
      <PackageWizard
        open={wizardOpen}
        onClose={() => {
          setWizardOpen(false);
          if (search.draftName) {
            void navigate({ to: "/vendor-packages", search: {}, replace: true });
          }
        }}
        editingPackage={editingPkg}
        initialDraft={editingPkg ? null : initialDraft}
        vendorCategory={vendorCategory}
        vendorCategories={vendorCategories}
        vendorId={vendorId}
        onSave={handleSave}
        onRollbackNew={async (id) => {
          await deleteVendorPackage({ data: { id } });
          await qc.invalidateQueries({ queryKey: ["vendor-packages"] });
        }}
      />

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete package?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>"{deleteTarget?.name}"</strong> will be permanently
              removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
              onClick={() => {
                if (deleteTarget) {
                  deleteMut.mutate({ data: { id: deleteTarget.id } });
                  setDeleteTarget(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

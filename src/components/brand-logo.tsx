import logoAsset from "@/assets/melabridge-logo.png.asset.json";

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-9 w-9",
};

export function BrandMark({ size = "md", className = "" }: { size?: Size; className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="MelaBridge"
      width={64}
      height={64}
      className={`${sizes[size]} rounded-lg object-contain ${className}`}
    />
  );
}

export function BrandLogo({
  size = "md",
  showWordmark = true,
  wordmarkClass = "font-display text-xl font-semibold tracking-tight",
}: {
  size?: Size;
  showWordmark?: boolean;
  wordmarkClass?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <BrandMark size={size} />
      {showWordmark && <span className={wordmarkClass}>MelaBridge</span>}
    </div>
  );
}

export const brandLogoUrl = logoAsset.url;

import { ArrowRight, Building2, PartyPopper, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PROFILE_TYPE_OPTIONS,
  type PublicProfileType,
} from "@/lib/profile-types";

const icons = { host: PartyPopper, planner: Building2, vendor: Store } as const;

export function ProfileTypeChoices({
  value,
  onChange,
  disabled = false,
}: {
  value: PublicProfileType | null;
  onChange: (value: PublicProfileType) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3">
      {PROFILE_TYPE_OPTIONS.map((option) => {
        const Icon = icons[option.icon];
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`${option.title}. ${option.description}`}
            onClick={() => onChange(option.value)}
            className={cn(
              "group flex items-start gap-4 rounded-xl border p-4 text-left transition",
              "hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60",
              selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border",
            )}
          >
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{option.title}</p>
                {option.recommended && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                    Recommended
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{option.description}</p>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
          </button>
        );
      })}
    </div>
  );
}
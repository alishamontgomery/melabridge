/**
 * TimezoneSelector — searchable IANA timezone combobox.
 *
 * Uses Intl.supportedValuesOf('timeZone') for the full list (modern browsers)
 * with a curated fallback for older environments. Shows the UTC offset next to
 * each timezone name for easy scanning.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// ── Timezone list ────────────────────────────────────────────────────────────

const FALLBACK_TZ = [
  "UTC",
  "Africa/Cairo", "Africa/Lagos", "Africa/Nairobi",
  "America/Anchorage", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/New_York", "America/Sao_Paulo",
  "America/Toronto", "America/Vancouver",
  "Asia/Calcutta", "Asia/Dubai", "Asia/Hong_Kong",
  "Asia/Jerusalem", "Asia/Karachi", "Asia/Singapore", "Asia/Tokyo",
  "Australia/Melbourne", "Australia/Perth", "Australia/Sydney",
  "Europe/Amsterdam", "Europe/Athens", "Europe/Berlin",
  "Europe/Istanbul", "Europe/London", "Europe/Madrid",
  "Europe/Moscow", "Europe/Paris", "Europe/Rome",
  "Pacific/Auckland", "Pacific/Honolulu",
];

const ALL_TZ: string[] = (() => {
  try {
    return (Intl as any).supportedValuesOf("timeZone") as string[];
  } catch {
    return FALLBACK_TZ;
  }
})();

// ── UTC offset helper ────────────────────────────────────────────────────────

function getUtcOffset(tz: string, now: Date): string {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    }).formatToParts(now);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "UTC";
  } catch {
    return "UTC";
  }
}

// ── Component ────────────────────────────────────────────────────────────────

type Option = { tz: string; label: string; offset: string; search: string };

export function TimezoneSelector({
  value,
  onChange,
  disabled,
  className,
}: {
  value: string;
  onChange: (tz: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Build the option list once — offsets are computed at mount time so they
  // reflect today's DST status.
  const now = useMemo(() => new Date(), []);
  const options = useMemo<Option[]>(() => {
    return ALL_TZ.map((tz) => {
      const offset = getUtcOffset(tz, now);
      const label = tz.replace(/_/g, " ");
      return { tz, label, offset, search: `${tz} ${label} ${offset}`.toLowerCase() };
    });
  }, [now]);

  const selected = options.find((o) => o.tz === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="flex items-center gap-2 overflow-hidden">
            <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {selected ? (
              <>
                <span className="truncate">{selected.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{selected.offset}</span>
              </>
            ) : (
              <span className="text-muted-foreground">Select timezone…</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search timezones…" />
          <CommandList className="max-h-[260px] overflow-y-auto">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.tz}
                  value={o.search}
                  onSelect={() => {
                    onChange(o.tz);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("mr-2 h-4 w-4 shrink-0", value === o.tz ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate text-sm">{o.label}</span>
                  <span className="ml-2 shrink-0 font-mono text-[11px] text-muted-foreground">{o.offset}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

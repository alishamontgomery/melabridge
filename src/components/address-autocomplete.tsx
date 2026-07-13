import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { autocompletePlaces, getPlaceDetails, type PlaceDetails, type PlaceSuggestion } from "@/lib/places.functions";
import { Input } from "@/components/ui/input";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSelect: (d: PlaceDetails & { placeId: string }) => void;
  placeholder?: string;
  id?: string;
};

export function AddressAutocomplete({ value, onChange, onSelect, placeholder, id }: Props) {
  const runAutocomplete = useServerFn(autocompletePlaces);
  const runDetails = useServerFn(getPlaceDetails);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleChange(v: string) {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    if (v.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { suggestions } = await runAutocomplete({ data: { input: v } });
        setSuggestions(suggestions);
        setOpen(suggestions.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 220);
  }

  async function pick(s: PlaceSuggestion) {
    setOpen(false);
    onChange(`${s.primary}${s.secondary ? ", " + s.secondary : ""}`);
    try {
      const details = await runDetails({ data: { placeId: s.placeId } });
      onSelect({ ...details, placeId: s.placeId });
    } catch {
      // ignore; manual entry still valid
    }
  }

  return (
    <div ref={box} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          placeholder={placeholder ?? "Start typing an address…"}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          {suggestions.map((s) => (
            <button
              key={s.placeId}
              type="button"
              onClick={() => pick(s)}
              className={cn(
                "flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.primary}</span>
                {s.secondary && <span className="block truncate text-xs text-muted-foreground">{s.secondary}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

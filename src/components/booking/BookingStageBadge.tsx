import { Badge } from "@/components/ui/badge";
import { stageMeta, type BookingStage } from "@/lib/booking-stages";
import { cn } from "@/lib/utils";

export function BookingStageBadge({ stage, className }: { stage: BookingStage; className?: string }) {
  const m = stageMeta(stage);
  const Icon = m.icon;
  return (
    <Badge variant="secondary" className={cn("gap-1.5 border-transparent", m.tone, className)}>
      <Icon className="h-3 w-3" />
      {m.label}
    </Badge>
  );
}

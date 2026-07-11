import type { ReactNode, ComponentType } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight } from "lucide-react";

export type Feature = {
  icon: ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  badge?: string;
};

export type Metric = {
  label: string;
  value: string | number;
  hint?: string;
};

export function ModuleGrid({ features }: { features: Feature[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => (
        <Card key={f.title} className="border-border/60 p-5 shadow-soft transition hover:shadow-elegant">
          <div className="mb-3 flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 text-primary">
              <f.icon className="h-4 w-4" />
            </span>
            {f.badge && <Badge variant="secondary" className="text-[10px]">{f.badge}</Badge>}
          </div>
          <p className="text-sm font-semibold">{f.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.detail}</p>
        </Card>
      ))}
    </div>
  );
}

export function MetricRow({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metrics.map((m) => (
        <Card key={m.label} className="border-border/60 p-4 shadow-soft">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{m.label}</p>
          <p className="mt-1 font-display text-2xl font-semibold">{m.value}</p>
          {m.hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{m.hint}</p>}
        </Card>
      ))}
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ChecklistCard({ title, items }: { title: string; items: string[] }) {
  return (
    <Card className="border-border/60 p-5 shadow-soft">
      <p className="mb-3 text-sm font-semibold">{title}</p>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CTARow({ label, note, cta }: { label: string; note?: string; cta: string }) {
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent p-5 shadow-soft">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
      <Button className="gap-2 bg-gradient-to-r from-primary to-gold text-primary-foreground">
        {cta} <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: string;
}) {
  return (
    <Card className="flex flex-col items-center justify-center gap-3 border-dashed border-border/60 p-10 text-center shadow-none">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      {cta && <Button variant="outline">{cta}</Button>}
    </Card>
  );
}

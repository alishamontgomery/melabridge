import { type ReactNode } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useMelaAssistOptional } from "@/components/melaassist";

type Action = {
  label: string;
  to?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost" | "hero";
};

export function PageEmptyState({
  icon: Icon = Sparkles,
  title,
  description,
  primary,
  secondary,
  aiSuggestion,
  aiPrompt,
  aiPromptLabel = "Ask MelaAssist",
  className,
  children,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  primary?: Action;
  secondary?: Action;
  aiSuggestion?: string;
  /** When set, renders an "Ask MelaAssist" button that opens the assistant with this prompt. */
  aiPrompt?: string;
  aiPromptLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const assist = useMelaAssistOptional();
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-dashed border-border bg-gradient-to-br from-card via-card to-primary/5 p-8 sm:p-12 text-center animate-fade-in",
        className,
      )}
    >
      <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative mx-auto max-w-xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-soft">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {(primary || secondary) && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {primary && <ActionButton action={primary} variant={primary.variant ?? "default"} />}
            {secondary && <ActionButton action={secondary} variant={secondary.variant ?? "outline"} />}
          </div>
        )}
        {aiSuggestion && (
          <div className="mt-6 mx-auto max-w-md rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-xs text-muted-foreground">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> MelaAssist™
            </div>
            {aiSuggestion}
            {aiPrompt && assist && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="hero"
                  onClick={() => assist.openAssistant({ initialPrompt: aiPrompt, task: title })}
                >
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" /> {aiPromptLabel}
                </Button>
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ActionButton({ action, variant }: { action: Action; variant: Action["variant"] }) {
  if (action.to) {
    return (
      <Button asChild variant={variant}>
        <Link to={action.to as "/events"}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

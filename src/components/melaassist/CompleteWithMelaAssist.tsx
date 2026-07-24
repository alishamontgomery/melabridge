import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMelaAssistOptional } from "./context";

/**
 * "Complete with MelaAssist" — foundation-only.
 *
 * Opens the assistant with a contextual prompt. The assistant produces a draft
 * for the user to review; nothing is auto-saved. Callers may pass `onDraft` in
 * the future to receive structured draft content once autonomous actions land.
 */
export function CompleteWithMelaAssist({
  prompt,
  label = "Complete with MelaAssist",
  size = "sm",
  variant = "outline",
  className,
}: {
  prompt: string;
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "ghost" | "hero" | "secondary" | "default";
  className?: string;
}) {
  const assist = useMelaAssistOptional();
  if (!assist) return null;
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={() => assist.openAssistant({ initialPrompt: prompt })}
    >
      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

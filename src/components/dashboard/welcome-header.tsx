import { greeting, greetingEmoji, getDailyMessage } from "@/lib/dashboard-intelligence";
import { Sparkles } from "lucide-react";

type Props = {
  firstName: string;
  eventLabel: string;
  daysAway: number;
  onTrack: number;
};

export function WelcomeHeader({ firstName, eventLabel, daysAway, onTrack }: Props) {
  const daily = getDailyMessage();
  return (
    <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-6 md:p-8 shadow-soft">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{greeting()}, {firstName} {greetingEmoji()}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold md:text-4xl">
            {eventLabel}
            {daysAway > 0 && (
              <span className="ml-3 text-gradient">· {daysAway} day{daysAway === 1 ? "" : "s"} away</span>
            )}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            You're currently <span className="font-semibold text-foreground">{onTrack}% on track</span>. MelaAssist has prepared today's personalized planning brief.
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-primary">
            <Sparkles className="h-3.5 w-3.5" /> {daily}
          </p>
        </div>
        <div className="hidden md:grid h-24 w-24 place-items-center rounded-full border border-primary/30 bg-card text-2xl font-display font-semibold text-primary shadow-soft">
          {onTrack}%
        </div>
      </div>
    </section>
  );
}

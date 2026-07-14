import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Calendar, Store, MessageSquare, Mail, Users, Wallet, FileText } from "lucide-react";

const ACTIONS = [
  { to: "/timeline", label: "Build timeline", icon: Calendar },
  { to: "/vendors", label: "Find vendors", icon: Store },
  { to: "/messaging", label: "Send reminders", icon: MessageSquare },
  { to: "/messaging", label: "Draft invitations", icon: Mail },
  { to: "/guests", label: "Organize seating", icon: Users },
  { to: "/budget", label: "Track budget", icon: Wallet },
  { to: "/bookings", label: "Compare quotes", icon: FileText },
];

export function AIConcierge() {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Your AI concierge
      </div>
      <h2 className="mt-2 font-display text-xl font-semibold">I can help you with…</h2>
      <p className="mt-1 text-sm text-muted-foreground">Pick a shortcut and MelaAssist takes it from there.</p>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {ACTIONS.map((a) => (
          <Button key={a.label} asChild variant="outline" className="h-auto justify-start rounded-2xl py-3">
            <Link to={a.to}>
              <a.icon className="mr-2 h-4 w-4 text-primary" />
              <span className="text-sm">{a.label}</span>
            </Link>
          </Button>
        ))}
      </div>
    </section>
  );
}

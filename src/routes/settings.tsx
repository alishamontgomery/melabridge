import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Settings as SettingsIcon, Bell, ShieldCheck, Globe2, Palette, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRequireAuth } from "@/lib/use-require-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MelaBridge" },
      { name: "description", content: "Account, notifications, and privacy preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

type NotifPref = {
  event_updates_email: boolean;
  event_updates_inapp: boolean;
  weekly_digest_email: boolean;
};

function SettingsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [prefs, setPrefs] = useState<NotifPref | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      setPrefs({
        event_updates_email: data?.email_enabled ?? true,
        event_updates_inapp: data?.in_app_enabled ?? true,
        weekly_digest_email: data?.frequency === "weekly",
      });
      setLoading(false);
    })();
  }, [user, authLoading]);

  async function save(next: NotifPref) {
    if (!user) return;
    setSaving(true);
    setPrefs(next);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          category: "event_updates",
          channel: "all",
          email_enabled: next.event_updates_email,
          in_app_enabled: next.event_updates_inapp,
          frequency: next.weekly_digest_email ? "weekly" : "instant",
        },
        { onConflict: "user_id,channel" }
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved");
  }

  return (
    <AppShell active="/settings">
      <PageHeader
        eyebrow="Settings"
        icon={SettingsIcon}
        title={<>Your <span className="text-gradient">workspace, your way</span>.</>}
        description="Account, notifications, privacy, and integrations."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <SettingsCard icon={Users} title="Account">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{user?.email ?? "—"}</span>.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline"><Link to="/profile">Edit profile</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/subscription">Manage plan</Link></Button>
          </div>
        </SettingsCard>

        <SettingsCard icon={Bell} title="Notifications">
          {loading || !prefs ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="space-y-3">
              <PrefRow
                label="Email updates about your events"
                checked={prefs.event_updates_email}
                onChange={(v) => save({ ...prefs, event_updates_email: v })}
                disabled={saving}
              />
              <PrefRow
                label="In-app notifications"
                checked={prefs.event_updates_inapp}
                onChange={(v) => save({ ...prefs, event_updates_inapp: v })}
                disabled={saving}
              />
              <PrefRow
                label="Weekly digest email"
                checked={prefs.weekly_digest_email}
                onChange={(v) => save({ ...prefs, weekly_digest_email: v })}
                disabled={saving}
              />
            </div>
          )}
        </SettingsCard>

        <SettingsCard icon={ShieldCheck} title="Privacy & security">
          <p className="text-sm text-muted-foreground">
            Your event data is private by default and encrypted at rest. Only people you invite can see it.
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!user?.email) return;
                const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success("Password reset email sent");
              }}
            >
              Reset password
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard icon={Palette} title="Workspace">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Language: English (US)</p>
            <p>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
          </div>
        </SettingsCard>

        <SettingsCard icon={Globe2} title="Calendar">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Manage availability, bookings, and rules in MelaBridge Calendar. External sync (Google, Outlook, Apple) is coming soon.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <Link to="/calendar/settings">Availability & rules</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/settings/calendar">External sync</Link>
              </Button>
            </div>
          </div>
        </SettingsCard>
      </div>
    </AppShell>
  );
}

function SettingsCard({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <Card className="border-border/60 p-6 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </Card>
  );
}

function PrefRow({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { User, Mail, Globe2, Camera, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/module-page";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useRequireAuth } from "@/lib/use-require-auth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — MelaBridge" },
      { name: "description", content: "Manage your MelaBridge identity and account details." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [eventsCount, setEventsCount] = useState<number | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      const [{ data: p }, { count }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("events").select("*", { count: "exact", head: true }).eq("owner_id", user.id),
      ]);
      setProfile(p ?? null);
      setName(p?.display_name ?? "");
      setEventsCount(count ?? 0);
      setLoading(false);
    })();
  }, [user, authLoading]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile saved");
    setProfile((p) => (p ? { ...p, display_name: name.trim() || null } : p));
  }

  if (authLoading || loading) {
    return (
      <AppShell active="/profile">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="mt-6 h-60 w-full rounded-2xl" />
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell active="/profile">
        <Card className="p-10 text-center">
          <p className="text-sm">Please <Link to="/auth" className="text-primary underline">sign in</Link> to view your profile.</p>
        </Card>
      </AppShell>
    );
  }

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Your profile";
  const initial = (displayName[0] || "?").toUpperCase();

  return (
    <AppShell active="/profile">
      <div className="space-y-6">
        <PageHeader eyebrow="Your profile" title={displayName} description="Your identity and account details." icon={User} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <Card className="border-border/60 p-6 text-center shadow-soft">
            <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-2xl font-semibold text-primary-foreground">
              {initial}
            </div>
            <p className="mt-3 font-semibold">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              Joined {profile?.created_at ? new Date(profile.created_at).getFullYear() : "recently"}
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {profile?.account_type && (
                <Badge variant="secondary" className="capitalize">{profile.account_type}</Badge>
              )}
              {eventsCount !== null && eventsCount > 0 && (
                <Badge variant="secondary">Events hosted · {eventsCount}</Badge>
              )}
              {profile?.onboarding_completed && (
                <Badge variant="secondary" className="gap-1"><Sparkles className="h-3 w-3" />AI profile complete</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" className="mt-4 gap-2" disabled>
              <Camera className="h-4 w-4" /> Change photo
            </Button>
          </Card>
          <Card className="border-border/60 p-6 shadow-soft">
            <p className="mb-4 text-sm font-semibold">Account details</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> Display name
                </label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" /> Email
                </label>
                <Input value={user.email ?? ""} disabled />
              </div>
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe2 className="h-3.5 w-3.5" /> Timezone
                </label>
                <Input value={Intl.DateTimeFormat().resolvedOptions().timeZone} disabled />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setName(profile?.display_name ?? "")} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving || name === (profile?.display_name ?? "")}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </Card>
        </div>
        <Section title="Personalization" description="MelaAssist™ learns your planning style as you use MelaBridge.">
          <Card className="border-border/60 p-5 shadow-soft">
            {profile?.planning_priorities && profile.planning_priorities.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {profile.planning_priorities.map((p) => (
                  <Badge key={p} variant="secondary">{p}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete <Link to="/onboarding" className="text-primary underline">onboarding</Link> to unlock personalized AI recommendations.
              </p>
            )}
          </Card>
        </Section>
      </div>
    </AppShell>
  );
}

import { RouteError } from "@/components/module-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Users, UserPlus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/module-page";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEvent } from "@/lib/use-active-event";
import { useRequireAuth } from "@/lib/use-require-auth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Member = Database["public"]["Tables"]["event_members"]["Row"] & {
  profile?: { display_name: string | null; email: string | null } | null;
};

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — MelaBridge" },
      { name: "description", content: "Invite collaborators and assign roles across your event." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
  errorComponent: RouteError,
});

function TeamPage() {
  const { user } = useRequireAuth();
  const { event, loading: eventLoading } = useActiveEvent();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!event) {
      if (!eventLoading) setMembers([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("event_members")
        .select("*")
        .eq("event_id", event.id);
      const userIds = (rows ?? []).map((r) => r.user_id);
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("id, display_name, email").in("id", userIds)
        : { data: [] as { id: string; display_name: string | null; email: string | null }[] };
      const map = new Map((profiles ?? []).map((p) => [p.id, p]));
      const merged: Member[] = (rows ?? []).map((r) => ({
        ...r,
        profile: map.get(r.user_id) ?? null,
      }));
      if (!cancelled) setMembers(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [event, eventLoading]);

  async function invite() {
    if (!event || !inviteEmail.trim()) return;
    setInviting(true);
    const email = inviteEmail.trim().toLowerCase();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("email", email)
      .maybeSingle();
    if (!profile) {
      setInviting(false);
      toast.error("No MelaBridge account found for that email. Ask them to sign up first.");
      return;
    }
    const { error } = await supabase
      .from("event_members")
      .insert({ event_id: event.id, user_id: profile.id, role: "editor", invited_email: email });
    setInviting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setInviteEmail("");
    toast.success(`Invited ${profile.display_name || email}`);
    setMembers((prev) => [
      ...(prev ?? []),
      {
        event_id: event.id,
        user_id: profile.id,
        role: "editor",
        invited_email: email,
        created_at: new Date().toISOString(),
        is_sample: false,
        profile,
      },
    ]);
  }

  return (
    <AppShell active="/team">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Team"
          title="Everyone helping bring it to life"
          description="Invite co-hosts, planners, and vendors. Assign roles per event."
          icon={Users}
        />

        {eventLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : !event ? (
          <Card className="border-border/60 p-10 text-center shadow-soft">
            <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold">No event yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Create your first event, then invite your team to help plan it.
            </p>
            <Button className="mt-4" asChild>
              <Link to="/events/new">Create your event</Link>
            </Button>
          </Card>
        ) : (
          <>
            <Card className="flex flex-col gap-3 border-border/60 p-4 shadow-soft sm:flex-row">
              <Input
                placeholder="Invite by email…"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && invite()}
                className="flex-1"
              />
              <Button className="gap-2" onClick={invite} disabled={!inviteEmail.trim() || inviting}>
                <UserPlus className="h-4 w-4" /> {inviting ? "Sending…" : "Send invite"}
              </Button>
            </Card>

            <Section title={`Members · ${members?.length ?? 0}`}>
              {members === null ? (
                <Skeleton className="h-40 rounded-2xl" />
              ) : members.length === 0 ? (
                <Card className="border-border/60 p-8 text-center shadow-soft">
                  <p className="text-sm text-muted-foreground">
                    You're the only member of this event so far. Invite someone above to collaborate.
                  </p>
                </Card>
              ) : (
                <Card className="divide-y divide-border/60 border-border/60 shadow-soft">
                  {members.map((m) => {
                    const label = m.profile?.display_name || m.profile?.email || m.invited_email || m.user_id;
                    const isYou = m.user_id === user?.id;
                    return (
                      <div key={m.user_id} className="flex items-center justify-between gap-3 p-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                            {(label[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {label} {isYou && <span className="text-xs text-muted-foreground">(you)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{m.profile?.email || m.invited_email}</p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                      </div>
                    );
                  })}
                </Card>
              )}
            </Section>

            <Card className="border-border/60 p-5 shadow-soft">
              <div className="mb-2 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Role permissions</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Owners control everything. Admins manage the team. Editors update plans. Commenters and viewers have read access.
              </p>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

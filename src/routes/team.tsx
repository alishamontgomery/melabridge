import { RouteError } from "@/components/module-states";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Users, UserPlus, ShieldCheck, Trash2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Section } from "@/components/module-page";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useActiveEvent } from "@/lib/use-active-event";
import { useRequireAuth } from "@/lib/use-require-auth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { notifyTeamMemberAdded } from "@/lib/team.functions";

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
  const [pendingRemove, setPendingRemove] = useState<Member | null>(null);
  const [removing, setRemoving] = useState(false);
  const sendTeamInviteEmail = useServerFn(notifyTeamMemberAdded);

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
    return () => { cancelled = true; };
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
    const alreadyMember = members?.some((m) => m.user_id === profile.id);
    if (alreadyMember) {
      setInviting(false);
      toast.error("This person is already a member of this event.");
      return;
    }
    const { error } = await supabase
      .from("event_members")
      .insert({ event_id: event.id, user_id: profile.id, role: "editor", invited_email: email });
    setInviting(false);
    if (error) { toast.error(error.message); return; }
    setInviteEmail("");
    toast.success(`Added ${profile.display_name || email} to the team`);
    // Fire-and-forget — email failure must never block team management.
    void sendTeamInviteEmail({
      data: {
        to: email,
        eventId: event.id,
        eventName: event.name || "your event",
        invitedUserId: profile.id,
      },
    }).catch(() => {});
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

  async function removeMember() {
    if (!pendingRemove || !event) return;
    setRemoving(true);
    const { error } = await supabase
      .from("event_members")
      .delete()
      .eq("event_id", event.id)
      .eq("user_id", pendingRemove.user_id);
    setRemoving(false);
    if (error) { toast.error(error.message); setPendingRemove(null); return; }
    const name = pendingRemove.profile?.display_name || pendingRemove.profile?.email || pendingRemove.invited_email || "Member";
    toast.success(`${name} removed from the team`);
    setMembers((prev) => (prev ?? []).filter((m) => m.user_id !== pendingRemove.user_id));
    setPendingRemove(null);
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
              <Button className="gap-2 min-h-[44px]" onClick={invite} disabled={!inviteEmail.trim() || inviting}>
                <UserPlus className="h-4 w-4" /> {inviting ? "Adding…" : "Add to team"}
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
                      <div key={m.user_id} className="flex items-center gap-3 p-4 min-h-[60px]">
                        {/* Avatar */}
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                          {(label?.[0] || "?").toUpperCase()}
                        </div>
                        {/* Name / email — min-w-0 ensures truncate works */}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {label}{isYou && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{m.profile?.email || m.invited_email}</p>
                        </div>
                        {/* Role badge + remove button */}
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                          {!isYou && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${label} from team`}
                              onClick={() => setPendingRemove(m)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
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

      {/* Remove member confirmation */}
      <AlertDialog open={!!pendingRemove} onOpenChange={(o) => !o && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove && (
                <>
                  <strong>
                    {pendingRemove.profile?.display_name || pendingRemove.profile?.email || pendingRemove.invited_email}
                  </strong>{" "}
                  will lose access to this event. You can re-invite them any time.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeMember}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Removing…</> : "Remove member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

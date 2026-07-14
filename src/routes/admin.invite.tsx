import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserPlus, Lock, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { inviteAdminUser } from "@/lib/admin-users.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin/invite")({
  head: () => ({ meta: [{ title: "Invite Users — AdminOS" }, { name: "robots", content: "noindex" }] }),
  component: AdminInvitePage,
});

type Role = "personal" | "organization" | "vendor" | "admin";

function AdminInvitePage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";

  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("planner");
  const [message, setMessage] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);

  const invite = useServerFn(inviteAdminUser);
  const mut = useMutation({
    mutationFn: (v: { email: string; role: Role; message?: string }) => invite({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast.success(`Invitation sent to ${email}`);
        setEmail(""); setMessage("");
      } else {
        toast.error(res?.error ?? "Invite failed");
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Invite failed"),
  });

  if (authLoading || roleLoading) {
    return <AppShell active="/admin/invite"><Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card></AppShell>;
  }
  if (!user || !isAdmin) {
    return (
      <AppShell active="/admin/invite">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Lock className="h-5 w-5" /></div>
          <h1 className="font-display text-xl font-semibold">Restricted</h1>
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(null);
    mut.mutate({ email: trimmed, role: inviteRole, message: message.trim() || undefined });
  };

  return (
    <AppShell active="/admin/invite">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          icon={UserPlus}
          title="Invite users"
          description="Send secure invitations to planners, vendors, guests, or fellow admins. They'll receive an email with a sign-in link."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/admin/users" })}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />Back to users
            </Button>
          }
        />
        <Card className="max-w-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="teammate@example.com"
                required
                aria-invalid={!!emailError}
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-message">Personal note (optional)</Label>
              <Textarea
                id="invite-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Welcome to the MelaBridge workspace…"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">{message.length}/500</p>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "Sending…" : "Send invitation"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => navigate({ to: "/admin/users" })}>Cancel</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

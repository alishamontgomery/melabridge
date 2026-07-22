import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Users, Search, UserPlus, Lock, ShieldCheck, Ban, RotateCcw,
  Eye, Pencil, KeyRound, MailCheck, PlayCircle, Trash2, MoreHorizontal, CheckCircle2, XCircle,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAdminUsers, setUserRole, setUserBanned, deleteAdminUser,
  resetAdminUserPassword, resendAdminUserVerification, updateAdminUser,
  type AdminUserRow,
} from "@/lib/admin-users.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { useAuth } from "@/lib/auth";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [
    { title: "User Management — AdminOS" },
    { name: "robots", content: "noindex" },
  ]}),
  component: AdminUsersPage,
});

type Role = "personal" | "organization" | "vendor" | "admin";

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function primaryRoleOf(u: AdminUserRow): Role {
  return (u.roles[0] ?? u.account_type ?? "personal") as Role;
}
function isSuspended(u: AdminUserRow) {
  return !!u.banned_until && new Date(u.banned_until) > new Date();
}
function isVerified(u: AdminUserRow) {
  return !!u.email_confirmed_at;
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <Badge variant={role === "admin" ? "default" : "secondary"} className="capitalize whitespace-nowrap">
      {role === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
      {role}
    </Badge>
  );
}
function StatusBadge({ u }: { u: AdminUserRow }) {
  if (isSuspended(u)) return <Badge variant="destructive" className="whitespace-nowrap">Suspended</Badge>;
  if (!isVerified(u)) return <Badge variant="outline" className="whitespace-nowrap">Pending</Badge>;
  return <Badge variant="secondary" className="whitespace-nowrap">Active</Badge>;
}

function AdminUsersPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const { user: currentAuthUser } = useAuth();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "pending">("all");

  const [viewUser, setViewUser] = useState<AdminUserRow | null>(null);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [deleteUser, setDeleteUser] = useState<AdminUserRow | null>(null);

  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const changeRole = useServerFn(setUserRole);
  const changeBan = useServerFn(setUserBanned);
  const removeUser = useServerFn(deleteAdminUser);
  const resetPw = useServerFn(resetAdminUserPassword);
  const resendVerify = useServerFn(resendAdminUserVerification);
  const editUserFn = useServerFn(updateAdminUser);

  const query = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetchUsers({ data: undefined } as never);
      if (res && "error" in res) throw new Error(res.error);
      return res;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => changeRole({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) { toast.success("Role updated"); invalidate(); }
      else toast.error(res?.error ?? "Failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const banMut = useMutation({
    mutationFn: (v: { userId: string; suspend: boolean }) => changeBan({ data: v } as never),
    onSuccess: (res: any, vars) => {
      if (res?.ok) { toast.success(vars.suspend ? "Account suspended" : "Account reactivated"); invalidate(); }
      else toast.error(res?.error ?? "Failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (v: { userId: string }) => removeUser({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) { toast.success("User deleted"); setDeleteUser(null); invalidate(); }
      else toast.error(res?.error ?? "Delete failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Delete failed"),
  });

  const resetMut = useMutation({
    mutationFn: (v: { email: string }) => resetPw({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) toast.success("Password reset email sent.");
      else toast.error(res?.error ?? "Failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const resendMut = useMutation({
    mutationFn: (v: { userId: string; email: string }) => resendVerify({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) toast.success("Verification email sent.");
      else toast.error(res?.error ?? "Failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const editMut = useMutation({
    mutationFn: (v: any) => editUserFn({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) { toast.success("User updated"); setEditUser(null); invalidate(); }
      else toast.error(res?.error ?? "Failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = useMemo(() => {
    const list = query.data?.users ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((u) => {
      if (term && !(u.email?.toLowerCase().includes(term) || u.display_name?.toLowerCase().includes(term))) return false;
      if (roleFilter !== "all") {
        const primary = primaryRoleOf(u);
        if (primary !== roleFilter && !u.roles.includes(roleFilter)) return false;
      }
      const suspended = isSuspended(u);
      const verified = isVerified(u);
      if (statusFilter === "active" && (suspended || !verified)) return false;
      if (statusFilter === "suspended" && !suspended) return false;
      if (statusFilter === "pending" && (verified || suspended)) return false;
      return true;
    });
  }, [query.data, q, roleFilter, statusFilter]);

  if (authLoading || roleLoading) {
    return <AppShell active="/admin/users"><Card className="p-10 text-center text-sm text-muted-foreground">Checking access…</Card></AppShell>;
  }
  if (!user || !isAdmin) {
    return (
      <AppShell active="/admin/users">
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary"><Lock className="h-5 w-5" /></div>
          <h1 className="font-display text-xl font-semibold">Restricted</h1>
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
        </Card>
      </AppShell>
    );
  }

  const renderActions = (u: AdminUserRow) => {
    const suspended = isSuspended(u);
    const verified = isVerified(u);
    const isSelf = currentAuthUser?.id === u.id;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Actions for ${u.display_name ?? u.email ?? "user"}`}>
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-1">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => setViewUser(u)}>
            <Eye className="mr-2 h-4 w-4" />View profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setEditUser(u)}>
            <Pencil className="mr-2 h-4 w-4" />Edit user
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => u.email && resetMut.mutate({ email: u.email })}
            disabled={!u.email || resetMut.isPending}
          >
            <KeyRound className="mr-2 h-4 w-4" />Reset password
          </DropdownMenuItem>
          {!verified && (
            <DropdownMenuItem
              onClick={() => u.email && resendMut.mutate({ userId: u.id, email: u.email })}
              disabled={!u.email || resendMut.isPending}
            >
              <MailCheck className="mr-2 h-4 w-4" />Resend verification
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {suspended ? (
            <DropdownMenuItem onClick={() => banMut.mutate({ userId: u.id, suspend: false })}>
              <PlayCircle className="mr-2 h-4 w-4" />Reactivate account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => banMut.mutate({ userId: u.id, suspend: true })}
              disabled={isSelf}
              className="text-destructive focus:text-destructive"
            >
              <Ban className="mr-2 h-4 w-4" />Suspend account
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteUser(u)}
            disabled={isSelf}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <AppShell active="/admin/users">
      <div className="space-y-6">
        <PageHeader
          eyebrow="AdminOS™"
          icon={Users}
          title="User management"
          description={`${query.data?.total ?? 0} total users across all roles.`}
          actions={<Button asChild size="sm"><Link to="/admin/invite"><UserPlus className="mr-1.5 h-4 w-4" />Invite users</Link></Button>}
        />

        <Card className="p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative min-w-0 flex-1 sm:min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name or email…"
                className="pl-8"
                aria-label="Search users"
              />
            </div>
            <div className="flex gap-2">
              <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by role">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filter by status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" onClick={() => query.refetch()} aria-label="Refresh users">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>

        {query.isLoading ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">Loading users…</Card>
        ) : query.isError ? (
          <Card className="p-10 text-center text-sm text-destructive">Failed to load users.</Card>
        ) : rows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-muted-foreground">No users match your filters.</Card>
        ) : (
          <>
            {/* Mobile: card list */}
            <div className="grid gap-3 md:hidden">
              {rows.map((u) => (
                <Card key={u.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{u.display_name ?? "—"}</div>
                      <div className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</div>
                    </div>
                    {renderActions(u)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <RoleBadge role={primaryRoleOf(u)} />
                    <StatusBadge u={u} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd className="text-right">{formatDate(u.created_at)}</dd>
                    <dt className="text-muted-foreground">Last sign-in</dt>
                    <dd className="text-right">{formatDate(u.last_sign_in_at)}</dd>
                  </dl>
                </Card>
              ))}
            </div>

            {/* Desktop / tablet: table */}
            <Card className="hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">User</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Role</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Status</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Joined</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Last sign-in</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((u) => (
                      <tr
                        key={u.id}
                        className="cursor-pointer align-middle transition-colors hover:bg-muted/40"
                        onClick={() => setViewUser(u)}
                      >
                        <td className="px-4 py-3 align-middle">
                          <div className="min-w-[180px] max-w-[280px]">
                            <div className="truncate font-medium">{u.display_name ?? "—"}</div>
                            <div className="truncate text-xs text-muted-foreground">{u.email ?? "—"}</div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle"><RoleBadge role={primaryRoleOf(u)} /></td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle"><StatusBadge u={u} /></td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">{formatDate(u.created_at)}</td>
                        <td className="whitespace-nowrap px-4 py-3 align-middle text-muted-foreground">{formatDate(u.last_sign_in_at)}</td>
                        <td
                          className="whitespace-nowrap px-4 py-3 text-right align-middle"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderActions(u)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </div>

      {/* View profile */}
      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>User profile</DialogTitle>
            <DialogDescription>Read-only overview of this account.</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-sm">
              <ProfileRow label="Full name" value={
                [viewUser.first_name, viewUser.last_name].filter(Boolean).join(" ") || viewUser.display_name || "—"
              } />
              <ProfileRow label="Display name" value={viewUser.display_name ?? "—"} />
              <ProfileRow label="Email" value={viewUser.email ?? "—"} />
              <ProfileRow label="Role" value={<RoleBadge role={primaryRoleOf(viewUser)} />} />
              <ProfileRow label="Status" value={<StatusBadge u={viewUser} />} />
              <ProfileRow
                label="Verified"
                value={
                  isVerified(viewUser)
                    ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Yes</span>
                    : <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" />No</span>
                }
              />
              <ProfileRow label="Joined" value={formatDate(viewUser.created_at)} />
              <ProfileRow label="Last sign-in" value={formatDate(viewUser.last_sign_in_at)} />
              <ProfileRow label="User ID" value={<code className="break-all text-xs">{viewUser.id}</code>} />
            </dl>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>Close</Button>
            {viewUser && (
              <Button onClick={() => { const u = viewUser; setViewUser(null); setEditUser(u); }}>
                <Pencil className="mr-1.5 h-4 w-4" />Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit user */}
      <EditUserDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSave={(patch) => editMut.mutate(patch)}
        saving={editMut.isPending}
        selfId={currentAuthUser?.id ?? null}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This action permanently deletes the user account and all associated test data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteUser && deleteMut.mutate({ userId: deleteUser.id })}
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? "Deleting…" : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <>
      <dt className="col-span-1 text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="col-span-2 text-sm">{value}</dd>
    </>
  );
}

function EditUserDialog({
  user, onClose, onSave, saving, selfId,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onSave: (patch: any) => void;
  saving: boolean;
  selfId: string | null;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("personal");
  const [suspended, setSuspended] = useState(false);

  const isSelf = user && selfId === user.id;

  // Reset form whenever a new user opens
  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? "");
      setLastName(user.last_name ?? "");
      setDisplayName(user.display_name ?? "");
      setRole(primaryRoleOf(user));
      setSuspended(isSuspended(user));
    }
  }, [user]);

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update profile details, role, and status.</DialogDescription>
        </DialogHeader>
        {user && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-first">First name</Label>
                <Input id="edit-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-last">Last name</Label>
                <Input id="edit-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-display">Display name</Label>
              <Input id="edit-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal</SelectItem>
                    <SelectItem value="organization">Organization</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={suspended ? "suspended" : "active"}
                  onValueChange={(v) => setSuspended(v === "suspended")}
                  disabled={!!isSelf}
                >
                  <SelectTrigger id="edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                {isSelf && <p className="text-xs text-muted-foreground">You can't suspend your own account.</p>}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={() => user && onSave({
              userId: user.id,
              first_name: firstName || null,
              last_name: lastName || null,
              display_name: displayName || null,
              role,
              suspend: isSelf ? undefined : suspended,
            })}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

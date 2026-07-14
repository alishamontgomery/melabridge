import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, UserPlus, Lock, ShieldCheck, Ban, RotateCcw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminUsers, setUserRole, setUserBanned } from "@/lib/admin-users.functions";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [
    { title: "User Management — AdminOS" },
    { name: "robots", content: "noindex" },
  ]}),
  component: AdminUsersPage,
});

type Role = "planner" | "vendor" | "guest" | "admin";

function AdminUsersPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { role, loading: roleLoading } = useRole();
  const isAdmin = role === "admin";
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all");

  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAdminUsers);
  const changeRole = useServerFn(setUserRole);
  const changeBan = useServerFn(setUserBanned);

  const query = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetchUsers({ data: undefined } as never);
      if (res && "error" in res) throw new Error(res.error);
      return res;
    },
  });

  const roleMut = useMutation({
    mutationFn: (v: { userId: string; role: Role }) => changeRole({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
      else toast.error(res?.error ?? "Failed");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const banMut = useMutation({
    mutationFn: (v: { userId: string; suspend: boolean }) => changeBan({ data: v } as never),
    onSuccess: (res: any) => {
      if (res?.ok) { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin-users"] }); }
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
        const primary = (u.roles[0] ?? u.account_type ?? "planner") as string;
        if (primary !== roleFilter && !u.roles.includes(roleFilter)) return false;
      }
      const suspended = !!u.banned_until && new Date(u.banned_until) > new Date();
      if (statusFilter === "active" && suspended) return false;
      if (statusFilter === "suspended" && !suspended) return false;
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
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="pl-8" />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="planner">Planner</SelectItem>
                <SelectItem value="vendor">Vendor</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => query.refetch()} aria-label="Refresh">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden">
          {query.isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading users…</div>
          ) : query.isError ? (
            <div className="p-10 text-center text-sm text-destructive">Failed to load users.</div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No users match your filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">User</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Joined</th>
                    <th className="px-4 py-2">Last sign-in</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((u) => {
                    const primary = (u.roles[0] ?? u.account_type ?? "planner") as Role;
                    const suspended = !!u.banned_until && new Date(u.banned_until) > new Date();
                    return (
                      <tr key={u.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <div className="font-medium">{u.display_name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={primary === "admin" ? "default" : "secondary"} className="capitalize">
                            {primary === "admin" && <ShieldCheck className="mr-1 h-3 w-3" />}
                            {primary}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {suspended ? <Badge variant="destructive">Suspended</Badge> : <Badge variant="secondary">Active</Badge>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">Actions</Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {(["admin","planner","vendor","guest"] as Role[]).filter((r) => r !== primary).map((r) => (
                                <DropdownMenuItem key={r} onClick={() => roleMut.mutate({ userId: u.id, role: r })}>
                                  Set as {r}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuItem
                                onClick={() => banMut.mutate({ userId: u.id, suspend: !suspended })}
                                className={suspended ? "" : "text-destructive"}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                {suspended ? "Reactivate" : "Suspend"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

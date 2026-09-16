import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Settings as SettingsIcon, Bell, ShieldCheck, Globe2, Palette, Users, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/lib/use-require-auth";
import { useRole } from "@/lib/use-role";
import { toast } from "sonner";
import { TimezoneSelector } from "@/components/timezone-selector";
import { saveTimezone } from "@/lib/calendar.functions";
import { deleteAccount } from "@/lib/account.functions";
import { signOut } from "@/lib/auth";
import { useClerk } from "@clerk/tanstack-react-start";
import { ProfileTypeChoices } from "@/components/profile-type-choices";
import { profileTypeLabel, type PublicProfileType } from "@/lib/profile-types";
import { changeOwnProfileType } from "@/lib/profile-type.functions";
import { deleteVendorBusiness } from "@/lib/vendor-account.functions";

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

// Per-category notification preferences
type CategoryPref = { in_app: boolean; email: boolean };
type NotifPrefs = Record<string, CategoryPref>;

const NOTIF_CATEGORIES: {
  key: string;
  label: string;
  description: string;
  vendorLabel?: string;
  vendorDescription?: string;
}[] = [
  { key: "rsvp", label: "RSVP activity", description: "When guests respond to your event invitation" },
  { key: "budget", label: "Budget warnings", description: "When committed spend reaches 80% or 100% of your target" },
  { key: "task_deadline", label: "Task deadlines", description: "48 hours before a task is due, and when it becomes overdue" },
  {
    key: "booking",
    label: "Vendor responses",
    description: "Inquiry updates and messages from vendors",
    vendorLabel: "Lead activity",
    vendorDescription: "New inquiries, confirmations, and messages from clients",
  },
  {
    key: "calendar",
    label: "Calendar updates",
    description: "Changes to your calendar events and confirmed schedule",
    vendorLabel: "Calendar updates",
    vendorDescription: "Changes to your confirmed events and schedule",
  },
  { key: "event_updates", label: "Event digests", description: "Weekly summary of your event planning progress" },
];

const DEFAULT_PREFS: NotifPrefs = Object.fromEntries(
  NOTIF_CATEGORIES.map((c) => [c.key, { in_app: true, email: c.key === "event_updates" }]),
);

function SettingsPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const { openUserProfile } = useClerk();
  const { role, loading: roleLoading } = useRole();
  const queryClient = useQueryClient();
  const saveTzFn = useServerFn(saveTimezone);
  const deleteAccountFn = useServerFn(deleteAccount);
  const deleteVendorBusinessFn = useServerFn(deleteVendorBusiness);
  const changeProfileTypeFn = useServerFn(changeOwnProfileType);
  const isAdmin = role === "admin";
  const isVendor = role === "vendor";
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deletingBusiness, setDeletingBusiness] = useState(false);
  const [businessDeleteConfirmation, setBusinessDeleteConfirmation] = useState("");
  const [pendingProfileType, setPendingProfileType] = useState<PublicProfileType | null>(null);
  const [profileTypeSaving, setProfileTypeSaving] = useState(false);

  const currentProfileType: PublicProfileType | null =
    role === "vendor" ? "vendor" : role === "organization" ? "planner" : role === "personal" ? "host" : null;

  // ── Timezone state ─────────────────────────────────────────
  const [timezone, setTimezone] = useState<string>("");
  const [tzLoading, setTzLoading] = useState(true);
  const [tzSaving, setTzSaving] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return;
    (async () => {
      // Load notification prefs
      const { data } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id);
      const rows = (data ?? []) as Array<{ category: string; in_app_enabled: boolean; email_enabled: boolean }>;
      const merged: NotifPrefs = { ...DEFAULT_PREFS };
      for (const row of rows) {
        merged[row.category] = { in_app: row.in_app_enabled ?? true, email: row.email_enabled ?? false };
      }
      setPrefs(merged);
      setLoading(false);

      // Load timezone from calendar_settings
      const { data: tzData } = await supabase
        .from("calendar_settings")
        .select("timezone")
        .eq("user_id", user.id)
        .maybeSingle();

      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const stored = tzData?.timezone;

      if (!stored || stored === "UTC") {
        // Auto-detect on first login or when unset
        const tz = detected || "UTC";
        setTimezone(tz);
        try {
          await saveTzFn({ data: { timezone: tz } });
        } catch {
          // Non-fatal — user can set it manually
        }
      } else {
        setTimezone(stored);
      }
      setTzLoading(false);
    })();
  }, [user, authLoading, saveTzFn]);

  async function handleTimezoneChange(tz: string) {
    setTimezone(tz);
    setTzSaving(true);
    try {
      await saveTzFn({ data: { timezone: tz } });
      toast.success("Timezone updated");
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Could not save timezone");
    } finally {
      setTzSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    try {
      await deleteAccountFn({ data: {} });
      toast.success("Account deleted");
      await signOut();
      window.location.href = "/";
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Could not delete account — please contact hello@melabridge.com");
      setDeletingAccount(false);
    }
  }

  async function handleDeleteVendorBusiness() {
    if (businessDeleteConfirmation !== "DELETE BUSINESS") return;
    setDeletingBusiness(true);
    try {
      await deleteVendorBusinessFn({ data: { confirmation: "DELETE BUSINESS" } });
      toast.success("Your vendor business was permanently deleted.");
      queryClient.invalidateQueries({ queryKey: ["vendor-profile-snapshot"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-packages"] });
      window.location.href = "/vendor-profile-builder";
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Could not delete the vendor business.");
      setDeletingBusiness(false);
    }
  }

  async function savePref(category: string, next: CategoryPref) {
    if (!user || !prefs) return;
    setSaving(true);
    const nextPrefs = { ...prefs, [category]: next };
    setPrefs(nextPrefs);
    const { error } = await supabase
      .from("notification_preferences")
      .upsert(
        {
          user_id: user.id,
          category,
          channel: "all",
          in_app_enabled: next.in_app,
          email_enabled: next.email,
          frequency: category === "event_updates" ? (next.email ? "weekly" : "instant") : "instant",
        },
        // category is now part of the unique key — each category row is independent
        { onConflict: "user_id,category,channel" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preference saved");
  }

  async function confirmProfileTypeChange() {
    if (!pendingProfileType || pendingProfileType === currentProfileType) return;
    setProfileTypeSaving(true);
    try {
      await changeProfileTypeFn({ data: { profileType: pendingProfileType } });
      await queryClient.invalidateQueries({ queryKey: ["user-role", user?.id] });
      toast.success("Profile type updated. Your events and workspace data are unchanged.");
      setPendingProfileType(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your profile type.");
    } finally {
      setProfileTypeSaving(false);
    }
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
            <Button asChild size="sm" variant="outline"><Link to="/subscription" search={{ audience: undefined, billing: "monthly" }}>Manage plan</Link></Button>
          </div>
        </SettingsCard>

        {isVendor && !roleLoading && (
          <SettingsCard icon={Trash2} title="Vendor business">
            <p className="text-sm text-muted-foreground">
              Permanently delete this business profile, its public listing, packages, business photos, and vendor-specific inquiries or bookings.
              Your sign-in, personal events, guests, budgets, and other personal workspace data will not be deleted.
            </p>
            <div className="mt-4">
              <AlertDialog
                onOpenChange={(open) => {
                  if (!open && !deletingBusiness) setBusinessDeleteConfirmation("");
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deletingBusiness}>
                    {deletingBusiness ? "Deleting business…" : "Delete business"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Permanently delete this business?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently removes the vendor listing, packages, package photos, portfolio files, and vendor-specific inquiry or booking records.
                      It does not delete your MelaBridge sign-in, personal events, guests, budgets, or personal workspace data.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="delete-business-confirmation">Type DELETE BUSINESS to continue</Label>
                    <Input
                      id="delete-business-confirmation"
                      value={businessDeleteConfirmation}
                      onChange={(event) => setBusinessDeleteConfirmation(event.target.value)}
                      autoComplete="off"
                      placeholder="DELETE BUSINESS"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deletingBusiness}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={(event) => {
                        event.preventDefault();
                        void handleDeleteVendorBusiness();
                      }}
                      disabled={deletingBusiness || businessDeleteConfirmation !== "DELETE BUSINESS"}
                    >
                      Permanently delete business
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </SettingsCard>
        )}

        {!isAdmin && !isVendor && !roleLoading && (
          <SettingsCard icon={Users} title="Profile type">
            <p className="text-sm text-muted-foreground">
              Current profile: <span className="font-medium text-foreground">{profileTypeLabel(currentProfileType)}</span>.
              Changing this updates your dashboard and capabilities but preserves your events, guests, budgets, tasks, files, team members, and subscription.
            </p>
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">What brings you to MelaBridge?</p>
              <ProfileTypeChoices
                value={pendingProfileType ?? currentProfileType}
                onChange={setPendingProfileType}
                disabled={roleLoading || profileTypeSaving}
              />
            </div>
            {pendingProfileType && pendingProfileType !== currentProfileType && (
              <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium">Confirm this profile change</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pendingProfileType === "host"
                    ? "You’re switching to Host for events you’re organizing yourself."
                    : "You’re creating a professional business profile for event work with clients or customers."}
                  {" "}Your account data stays in place.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void confirmProfileTypeChange()} disabled={profileTypeSaving}>
                    {profileTypeSaving ? "Saving…" : "Confirm profile change"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPendingProfileType(null)} disabled={profileTypeSaving}>
                    Go back
                  </Button>
                </div>
              </div>
            )}
          </SettingsCard>
        )}

        <SettingsCard icon={Bell} title="Notifications">
          {loading || !prefs ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="space-y-4">
              {NOTIF_CATEGORIES.filter((c) => {
                // Admins don't need booking/calendar noise
                if (isAdmin && ["booking", "calendar"].includes(c.key)) return false;
                // Vendors only see booking-relevant categories
                if (isVendor && !["booking", "calendar"].includes(c.key)) return false;
                // "Vendor responses" and "Calendar updates" don't apply to personal/host accounts
                if (["booking", "calendar"].includes(c.key) && role === "personal") return false;
                return true;
              }).map((cat) => {
                const label = isVendor && cat.vendorLabel ? cat.vendorLabel : cat.label;
                const description = isVendor && cat.vendorDescription ? cat.vendorDescription : cat.description;
                const p = prefs[cat.key] ?? { in_app: true, email: false };
                return (
                  <div key={cat.key} className="space-y-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-4">
                      <PrefRow
                        label="In-app"
                        checked={p.in_app}
                        onChange={(v) => savePref(cat.key, { ...p, in_app: v })}
                        disabled={saving}
                      />
                      <PrefRow
                        label="Email"
                        checked={p.email}
                        onChange={(v) => savePref(cat.key, { ...p, email: v })}
                        disabled={saving}
                      />
                    </div>
                  </div>
                );
              })}
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
              onClick={() => openUserProfile()}
            >
              Manage password
            </Button>
          </div>
        </SettingsCard>

        <SettingsCard icon={Palette} title="Workspace">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm font-medium">
                <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
                Timezone
              </Label>
              {tzLoading ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <div className="flex items-center gap-2">
                  <TimezoneSelector
                    value={timezone}
                    onChange={handleTimezoneChange}
                    disabled={tzSaving}
                    className="flex-1"
                  />
                  {tzSaving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                All calendar dates and event times display in this timezone.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Language</Label>
              <p className="text-sm text-muted-foreground">English (US)</p>
              <p className="text-xs text-muted-foreground">Additional languages coming soon.</p>
            </div>
          </div>
        </SettingsCard>

        {isVendor && (
          <SettingsCard icon={Globe2} title="Calendar">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Manage your availability, blocked dates, and lead settings. External sync (Google, Outlook, Apple) is coming soon.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/calendar/settings">Availability &amp; rules</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/settings/calendar">External sync — coming soon</Link>
                </Button>
              </div>
            </div>
          </SettingsCard>
        )}
        {!isAdmin && !isVendor && (
          <SettingsCard icon={Globe2} title="Calendar">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                View your event calendar and timeline in one place.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/calendar">Open calendar</Link>
              </Button>
            </div>
          </SettingsCard>
        )}

        {/* Danger zone — full width at the bottom */}
        <div className="lg:col-span-2">
          <SettingsCard icon={Trash2} title="Danger zone">
            <p className="text-sm text-muted-foreground">
              Remove your sign-in identity. Your MelaBridge application records are retained and access is disabled.
            </p>
            <div className="mt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={deletingAccount}>
                    {deletingAccount ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>
                    ) : (
                      "Delete account"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove your sign-in identity?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes your Clerk sign-in identity and disables the linked application account.
                      Your events, guests, vendor data, files, and account records are retained.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={handleDeleteAccount}
                      disabled={deletingAccount}
                    >
                      Yes, remove my sign-in identity
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </SettingsCard>
        </div>
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

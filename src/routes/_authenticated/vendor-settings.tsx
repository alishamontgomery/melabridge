import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getVendorSettings, updateVendorSettings } from "@/lib/bookings.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CONFIRMATION_RULES, type ConfirmationRule } from "@/lib/booking-stages";
import { Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vendor-settings")({
  head: () => ({ meta: [{ title: "Vendor Settings — MelaBridge" }] }),
  component: VendorSettingsPage,
  errorComponent: ({ error }) => <div className="p-8 text-sm text-destructive">{error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function VendorSettingsPage() {
  const getFn = useServerFn(getVendorSettings);
  const updateFn = useServerFn(updateVendorSettings);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["vendor-settings"], queryFn: () => getFn() });

  const [rule, setRule] = useState<ConfirmationRule>("contract_and_deposit");
  const [requiresDeposit, setRequiresDeposit] = useState(true);

  useEffect(() => {
    if (data) {
      setRule((data.confirmation_rule as ConfirmationRule) ?? "contract_and_deposit");
      setRequiresDeposit(data.requires_deposit ?? true);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { confirmationRule: rule, requiresDeposit } }),
    onSuccess: () => { toast.success("Settings saved"); qc.invalidateQueries({ queryKey: ["vendor-settings"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (isLoading) {
    return (
      <AppShell active="/vendor-settings">
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell active="/vendor-settings">
        <Card className="p-8 text-center">
          <p className="font-semibold">Complete your vendor profile first</p>
          <Button asChild className="mt-3"><Link to="/profile">Open profile</Link></Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell active="/vendor-settings">
      <div className="max-w-2xl space-y-6">
        <PageHeader
          eyebrow="Vendor"
          icon={Settings2}
          title="Booking Confirmation Rules"
          description="Choose when a booking is officially confirmed. Bookings only move to “Booked” once these conditions are met — never before."
        />

        <Card className="space-y-6 p-6">
          <div className="space-y-4">
            <Label className="text-base">Confirm a booking when…</Label>
            <RadioGroup value={rule} onValueChange={(v) => setRule(v as ConfirmationRule)} className="space-y-3">
              {CONFIRMATION_RULES.map((r) => (
                <label key={r.key} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <RadioGroupItem value={r.key} id={r.key} className="mt-0.5" />
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.hint}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Require a deposit</p>
              <p className="text-xs text-muted-foreground">If off, bookings on the “Contract + Deposit” rule confirm as soon as the contract is signed.</p>
            </div>
            <Switch checked={requiresDeposit} onCheckedChange={setRequiresDeposit} />
          </div>

          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save settings"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

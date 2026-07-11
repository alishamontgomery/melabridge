import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — MelaBridge" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const password = z.string().min(8).max(128).parse(pw);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      navigate({ to: "/events" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-hero-radial px-4 py-10">
      <div className="mx-auto max-w-md">
        <Card className="mt-16 border-border/60 p-6 shadow-soft">
          <h1 className="font-display text-xl font-semibold">Set a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter a new password for your account.</p>
          <form onSubmit={handle} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input id="new-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" required />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

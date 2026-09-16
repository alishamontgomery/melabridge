import "./_group.css";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function Current() {
  const [open, setOpen] = useState(true);
  const [rsvp, setRsvp] = useState("pending");

  return (
    <main className="min-h-screen bg-[#141218] p-8">
      <div className="mx-auto max-w-3xl pt-10 text-white/90">
        <p className="text-3xl font-semibold">Every guest, accounted for.</p>
        <p className="mt-2 text-sm text-white/50">10 guests · 8 on the list · 10 incl. plus-ones.</p>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add guest</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-name">Full name <span className="text-destructive">*</span></Label>
              <Input id="current-name" placeholder="Guest name" autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="current-email">Email</Label><Input id="current-email" type="email" placeholder="email@example.com" /></div>
              <div className="space-y-1.5"><Label htmlFor="current-phone">Phone</Label><Input id="current-phone" type="tel" placeholder="+1 (555) 000-0000" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="current-household">Household / Group</Label><Input id="current-household" placeholder="e.g. Smith Family" /></div>
              <div className="space-y-1.5"><Label htmlFor="current-plusones">Plus-ones</Label><Input id="current-plusones" type="number" min="0" max="10" defaultValue="0" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="current-rsvp">RSVP status</Label>
                <Select value={rsvp} onValueChange={setRsvp}>
                  <SelectTrigger id="current-rsvp"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="yes">Attending</SelectItem>
                    <SelectItem value="maybe">Maybe</SelectItem>
                    <SelectItem value="no">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label htmlFor="current-meal">Meal choice</Label><Input id="current-meal" placeholder="e.g. Vegetarian" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled className="gap-1.5">Add guest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
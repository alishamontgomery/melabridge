import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Handshake, UserPlus, AtSign, Sparkles, CalendarDays, FileText, MessageCircle, ShieldCheck, Activity } from "lucide-react";

export const Route = createFileRoute("/collaboration")({
  head: () => ({ meta: [
    { title: "Collaboration Workspace™ — MelaBridge" },
    { name: "description", content: "Roles, mentions, shared notes, and AI meeting summaries." },
    { name: "robots", content: "noindex" },
  ]}),
  component: CollabPage,
});

const MEMBERS = [
  { name:"Amara Okonkwo", role:"Owner", init:"A", initials:"AO" },
  { name:"Julien Marchetti", role:"Owner", init:"J", initials:"JM" },
  { name:"Chinwe Adekunle", role:"Maid of Honor · Editor", init:"C", initials:"CA" },
  { name:"Marcus Bell", role:"Best Man · Editor", init:"M", initials:"MB" },
  { name:"Sofia Onyema", role:"Planner · Editor", init:"S", initials:"SO" },
  { name:"Priya Rao", role:"Guest · Viewer", init:"P", initials:"PR" },
];
const ACTIVITY = [
  { who:"Sofia", what:"posted meeting notes from Nov 18 planning call", when:"12m" },
  { who:"Julien", what:"approved florist upgrade (+$800)", when:"1h" },
  { who:"Chinwe", what:"commented on Guest table 3 seating", when:"3h" },
  { who:"Amara", what:"mentioned @Marcus in ceremony script draft", when:"5h" },
  { who:"MelaAssist", what:"summarized last week's activity and updated Health Score to 92", when:"1d" },
];

function CollabPage() {
  return (
    <AppShell active="/collaboration">
      <PageHeader
        eyebrow="Collaboration Workspace™"
        icon={Handshake}
        title={<>Plan <span className="text-gradient">together</span>, without the chaos.</>}
        description="Roles, permissions, mentions, shared notes, and a live activity feed keep everyone aligned."
        actions={<>
          <Button variant="outline"><CalendarDays className="mr-2 h-4 w-4"/>Shared calendar</Button>
          <Button variant="hero"><UserPlus className="mr-2 h-4 w-4"/>Invite people</Button>
        </>}
      />

      <Tabs defaultValue="team" className="mt-8">
        <TabsList>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notes">Shared notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="mt-4">
          <div className="rounded-3xl border border-border bg-card">
            <ul className="divide-y divide-border">
              {MEMBERS.map(m=>(
                <li key={m.name} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-gold text-sm font-semibold text-primary-foreground">{m.initials}</span>
                  <div className="min-w-0 flex-1"><p className="font-medium">{m.name}</p><p className="text-xs text-muted-foreground">{m.role}</p></div>
                  <Badge variant="secondary">{m.role.includes("Owner")?"Full access":m.role.includes("Editor")?"Can edit":"Can view"}</Badge>
                  <Button size="sm" variant="ghost"><ShieldCheck className="mr-1 h-4 w-4"/>Manage</Button>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5"/><span>Shared note · edited by Sofia · 12m ago</span>
              </div>
              <h3 className="font-display text-xl font-semibold">Ceremony run-of-show — draft 3</h3>
              <Textarea className="mt-3 min-h-[280px]" defaultValue={"4:45 PM — Guest arrival + prelude music (@Marcus confirm playlist)\n5:00 PM — Processional (aisle length: 78ft)\n5:10 PM — Vows & rings\n5:30 PM — Recessional to cocktail hour\n\nOpen items:\n• Aisle runner color — see Decision Center™\n• Reader for second reading — @Chinwe volunteering\n"}/>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="hero"><Sparkles className="mr-2 h-4 w-4"/>AI polish tone</Button>
                <Button variant="outline"><AtSign className="mr-2 h-4 w-4"/>Mention</Button>
              </div>
            </div>
            <div className="rounded-3xl border border-border bg-hero-radial p-5">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>AI meeting summary</div>
              <p className="text-sm">Nov 18 call · 42 min · 4 attendees</p>
              <ul className="mt-3 space-y-2 text-sm">
                <li>• Locked ceremony time at 5 PM (see poll)</li>
                <li>• Chinwe volunteered for second reading</li>
                <li>• Julien to sign photographer contract by Dec 12</li>
                <li>• Sofia to send updated seating v3 by Friday</li>
              </ul>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ul className="rounded-3xl border border-border bg-card divide-y divide-border">
            {ACTIVITY.map(a=>(
              <li key={a.what} className="flex items-start gap-3 px-5 py-3">
                <Activity className="mt-0.5 h-4 w-4 text-primary"/>
                <div className="flex-1"><p className="text-sm"><span className="font-medium">{a.who}</span> {a.what}</p></div>
                <span className="text-xs text-muted-foreground">{a.when}</span>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2">
            {["Guest list v4 (adds 12)","Menu final selection","Final vendor payment schedule","Ceremony script v3"].map(t=>(
              <div key={t} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary"/><p className="font-medium">{t}</p></div>
                <p className="mt-1 text-xs text-muted-foreground">2 of 3 owners approved</p>
                <div className="mt-3 flex gap-2"><Button size="sm" variant="hero">Approve</Button><Button size="sm" variant="outline">Comment</Button></div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

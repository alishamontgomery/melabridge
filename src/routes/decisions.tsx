import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Lightbulb, Sparkles, Check, ThumbsUp, Plus, Vote, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/decisions")({
  head: () => ({ meta: [
    { title: "Decision Center™ — MelaBridge" },
    { name: "description", content: "Polls, vendor comparisons, and approvals with AI-summarized recommendations." },
    { name: "robots", content: "noindex" },
  ]}),
  component: DecisionsPage,
});

type Poll = { id:string; title:string; options: { id:string; label:string; votes:number; note?:string }[]; recommendation:string; status:"Open"|"Decided"; };

const INITIAL: Poll[] = [
  { id:"p1", title:"Ceremony start time", status:"Open", recommendation:"5:00 PM balances golden-hour photos with dinner service.", options: [
    { id:"a", label:"4:00 PM", votes:2 },
    { id:"b", label:"5:00 PM", votes:6, note:"AI pick" },
    { id:"c", label:"6:00 PM", votes:3 },
  ]},
  { id:"p2", title:"Vendor: Photographer", status:"Open", recommendation:"Studio Nero — 98 DNA match, portfolio aligns with your BridgeDNA™.",
    options: [
      { id:"a", label:"Studio Nero · $6,200", votes:5, note:"Recommended" },
      { id:"b", label:"Lumen Collective · $5,400", votes:2 },
      { id:"c", label:"North Light Co · $7,800", votes:1 },
    ]},
  { id:"p3", title:"First course", status:"Decided", recommendation:"Heirloom tomato tartlet chosen — vegan-friendly with modification.",
    options: [
      { id:"a", label:"Heirloom tomato tartlet", votes:9 },
      { id:"b", label:"Butternut bisque", votes:4 },
      { id:"c", label:"Caesar wedge", votes:2 },
    ]},
];

function DecisionsPage() {
  const [polls, setPolls] = useState(INITIAL);
  const vote = (pid:string, oid:string) => setPolls(prev=>prev.map(p=>p.id===pid?{...p, options:p.options.map(o=>o.id===oid?{...o,votes:o.votes+1}:o)}:p));
  const decide = (pid:string) => setPolls(prev=>prev.map(p=>p.id===pid?{...p,status:"Decided"}:p));

  return (
    <AppShell active="/decisions">
      <PageHeader
        eyebrow="Decision Center™"
        icon={Lightbulb}
        title={<>Big calls, <span className="text-gradient">made together</span>.</>}
        description="Create polls, compare vendors, vote on menus and dates. BridgeMind summarizes results and recommends the strongest option."
        actions={<>
          <Button variant="outline"><Sparkles className="mr-2 h-4 w-4"/>Ask BridgeMind</Button>
          <Button variant="hero"><Plus className="mr-2 h-4 w-4"/>New decision</Button>
        </>}
      />

      <Tabs defaultValue="open" className="mt-8">
        <TabsList>
          <TabsTrigger value="open">Open ({polls.filter(p=>p.status==="Open").length})</TabsTrigger>
          <TabsTrigger value="decided">Decided ({polls.filter(p=>p.status==="Decided").length})</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="open" className="mt-4 space-y-4">
          {polls.filter(p=>p.status==="Open").map(p=>{
            const total = p.options.reduce((s,o)=>s+o.votes,0);
            return (
              <div key={p.id} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2"><Vote className="h-4 w-4 text-primary"/><h3 className="font-display text-lg font-semibold">{p.title}</h3></div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-primary"><Sparkles className="h-3 w-3"/>{p.recommendation}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={()=>decide(p.id)}><Check className="mr-1.5 h-4 w-4"/>Mark decided</Button>
                </div>
                <div className="mt-4 space-y-3">
                  {p.options.map(o=>{
                    const pct = total?Math.round((o.votes/total)*100):0;
                    return (
                      <div key={o.id}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{o.label}</span>
                            {o.note && <Badge className="bg-primary/10 text-primary">{o.note}</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{o.votes} votes · {pct}%</span>
                            <Button size="sm" variant="ghost" onClick={()=>vote(p.id,o.id)}><ThumbsUp className="mr-1 h-3.5 w-3.5"/>Vote</Button>
                          </div>
                        </div>
                        <Progress value={pct} className="mt-1.5"/>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="decided" className="mt-4 space-y-3">
          {polls.filter(p=>p.status==="Decided").map(p=>(
            <div key={p.id} className="rounded-2xl border border-emerald-300 bg-emerald-50/40 p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.title}</p>
                <Badge className="bg-emerald-500/10 text-emerald-700 gap-1"><Check className="h-3 w-3"/>Decided</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{p.recommendation}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="approvals" className="mt-4 space-y-3">
          {[
            { title:"Approve Onyema Catering deposit · $4,200", by:"Julien", tone:"warn" as const },
            { title:"Approve florist upgrade · +$800", by:"Amara", tone:"info" as const },
            { title:"Approve guest addition (4 new)", by:"Amara", tone:"info" as const },
          ].map(a=>(
            <div key={a.title} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className={`h-5 w-5 ${a.tone==="warn"?"text-amber-600":"text-primary"}`}/>
                <div><p className="font-medium">{a.title}</p><p className="text-xs text-muted-foreground">Requested by {a.by}</p></div>
              </div>
              <div className="flex gap-2"><Button size="sm" variant="outline">Deny</Button><Button size="sm" variant="hero">Approve</Button></div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

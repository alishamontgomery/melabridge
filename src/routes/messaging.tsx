import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MessageSquare, Send, Sparkles, Megaphone, Clock, FileText, Bell } from "lucide-react";

export const Route = createFileRoute("/messaging")({
  head: () => ({ meta: [
    { title: "Messaging — MelaBridge" },
    { name: "description", content: "One hub for internal, vendor, and guest conversations with AI drafts." },
    { name: "robots", content: "noindex" },
  ]}),
  component: MessagingPage,
});

type Thread = { id:string; who:string; last:string; unread:number; type:"Internal"|"Vendor"|"Guest"; };
const THREADS: Thread[] = [
  { id:"m1", who:"Sofia Onyema · Planner", last:"Sent updated seating v3 — take a look?", unread:2, type:"Internal" },
  { id:"m2", who:"Studio Nero · Photography", last:"Timeline looks great. See you Oct 17!", unread:0, type:"Vendor" },
  { id:"m3", who:"Priya Rao", last:"Confirming vegan meal for me and my +1", unread:1, type:"Guest" },
  { id:"m4", who:"Onyema Catering", last:"Deposit invoice attached", unread:1, type:"Vendor" },
  { id:"m5", who:"Chinwe Adekunle", last:"Bridal party dress fitting Saturday?", unread:0, type:"Internal" },
];

function MessagingPage() {
  const [active, setActive] = useState(THREADS[0]);

  return (
    <AppShell active="/messaging">
      <PageHeader
        eyebrow="Messaging Center"
        icon={MessageSquare}
        title={<>One inbox for <span className="text-gradient">everyone</span> planning with you.</>}
        description="Internal chats, vendor threads, and guest replies — all in one hub with AI-drafted replies and templates."
        actions={<>
          <Button variant="outline"><Megaphone className="mr-2 h-4 w-4"/>Announcement</Button>
          <Button variant="hero"><Send className="mr-2 h-4 w-4"/>New message</Button>
        </>}
      />

      <Tabs defaultValue="inbox" className="mt-8">
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="settings">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
            <div className="rounded-3xl border border-border bg-card">
              <ul className="divide-y divide-border">
                {THREADS.map(t=>(
                  <li key={t.id}>
                    <button onClick={()=>setActive(t)} className={`w-full px-4 py-3 text-left transition ${active.id===t.id?"bg-accent/60":"hover:bg-accent/30"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{t.who}</p>
                        {t.unread>0 && <Badge className="bg-primary text-primary-foreground">{t.unread}</Badge>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.last}</p>
                      <Badge variant="secondary" className="mt-2">{t.type}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">{active.who}</h3>
                <Badge variant="secondary">{active.type}</Badge>
              </div>
              <div className="space-y-3">
                <Msg from={active.who} text={active.last}/>
                <Msg mine text="Thank you! I'll review tonight and circle back tomorrow morning."/>
                <Msg from={active.who} text="Perfect — no rush."/>
              </div>
              <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>AI-drafted reply · matches your voice</div>
                <Textarea className="bg-background" defaultValue="Reviewed the seating chart — table 3 needs one swap (Priya + Elena). Otherwise looking clean. Sending marked-up version in 10."/>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="hero" size="sm"><Send className="mr-2 h-4 w-4"/>Approve & send</Button>
                  <Button variant="outline" size="sm">Edit tone</Button>
                  <Button variant="ghost" size="sm">Snooze</Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {["RSVP nudge (7d)","Vendor deposit reminder","Travel details","Thank-you follow-up","Registry acknowledgement","Weather update"].map(t=>(
              <div key={t} className="rounded-2xl border border-border bg-card p-4">
                <FileText className="h-5 w-5 text-primary"/>
                <p className="mt-2 font-medium">{t}</p>
                <p className="text-xs text-muted-foreground">Personalized per recipient by AI</p>
                <Button size="sm" variant="ghost" className="mt-2">Use template</Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="scheduled" className="mt-4 space-y-2">
          {[
            { when:"Tomorrow 10 AM", what:"RSVP nudge · 3 pending guests" },
            { when:"Fri 9 AM", what:"Travel details + hotel block" },
            { when:"Event week", what:"Weather + arrival timing" },
          ].map(s=>(
            <div key={s.what} className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3"><Clock className="h-4 w-4 text-primary"/><div><p className="font-medium">{s.what}</p><p className="text-xs text-muted-foreground">{s.when}</p></div></div>
              <Button size="sm" variant="ghost">Edit</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
            {["Guest replies","Vendor messages","Team @mentions","AI action approvals","Weekly digest"].map(n=>(
              <label key={n} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                <div className="flex items-center gap-3"><Bell className="h-4 w-4 text-primary"/><span className="text-sm">{n}</span></div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Badge variant="secondary">Email</Badge><Badge variant="secondary">Push</Badge></div>
              </label>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
function Msg({ from, mine, text }: { from?:string; mine?:boolean; text:string }) {
  return (
    <div className={`flex ${mine?"justify-end":"justify-start"}`}>
      <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine?"bg-primary text-primary-foreground":"bg-muted"}`}>
        {from && !mine && <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-70">{from}</p>}
        {text}
      </div>
    </div>
  );
}

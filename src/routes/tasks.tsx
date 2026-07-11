import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEcosystem } from "@/lib/ecosystem-store";
import { ClipboardList, Sparkles, Plus, Calendar, LayoutGrid, GanttChart, ListChecks, Check, AlertTriangle, Repeat } from "lucide-react";

export const Route = createFileRoute("/tasks")({
  head: () => ({ meta: [
    { title: "Timeline & Tasks — MelaBridge" },
    { name: "description", content: "Kanban, Gantt, calendar and checklist views with AI-generated tasks and reminders." },
    { name: "robots", content: "noindex" },
  ]}),
  component: TasksPage,
});

type Status = "Backlog" | "In progress" | "Waiting" | "Done";
type Priority = "Low" | "Med" | "High" | "Urgent";
type Task = { id:string; title:string; status:Status; priority:Priority; due:string; owner:string; category:string; startDay:number; span:number; deps?:string[]; recurring?:boolean; };

const INITIAL: Task[] = [
  { id:"t1", title:"Book venue tour · Grand Hall", status:"Done", priority:"High", due:"Nov 15", owner:"A", category:"Venue", startDay:0, span:3 },
  { id:"t2", title:"Finalize catering menu", status:"In progress", priority:"High", due:"Dec 05", owner:"A", category:"Catering", startDay:4, span:6, deps:["t1"] },
  { id:"t3", title:"Send Save-the-Dates", status:"Done", priority:"Urgent", due:"Nov 20", owner:"J", category:"Guests", startDay:2, span:2 },
  { id:"t4", title:"Photographer contract signature", status:"Waiting", priority:"Med", due:"Dec 12", owner:"J", category:"Vendors", startDay:8, span:2 },
  { id:"t5", title:"Weekly RSVP nudge", status:"In progress", priority:"Low", due:"Every Mon", owner:"AI", category:"Guests", startDay:5, span:1, recurring:true },
  { id:"t6", title:"Draft ceremony script", status:"Backlog", priority:"Med", due:"Jan 20", owner:"A", category:"Ceremony", startDay:14, span:5 },
  { id:"t7", title:"Book hotel block", status:"In progress", priority:"High", due:"Dec 20", owner:"J", category:"Travel", startDay:9, span:4 },
  { id:"t8", title:"Order rings", status:"Backlog", priority:"High", due:"Feb 10", owner:"J", category:"Attire", startDay:18, span:3 },
  { id:"t9", title:"Confirm florist proposal", status:"Waiting", priority:"Med", due:"Dec 08", owner:"A", category:"Florals", startDay:7, span:2 },
];

const STATUSES: Status[] = ["Backlog","In progress","Waiting","Done"];
const PRI_TONE: Record<Priority,string> = {
  Low:"bg-muted text-muted-foreground",
  Med:"bg-primary/10 text-primary",
  High:"bg-amber-500/10 text-amber-700",
  Urgent:"bg-rose-500/10 text-rose-700",
};

function TasksPage() {
  const { completeTask } = useEcosystem();
  const [tasks, setTasks] = useState(INITIAL);
  const done = tasks.filter(t=>t.status==="Done").length;
  const pct = Math.round((done/tasks.length)*100);
  const overdue = tasks.filter(t=>t.status!=="Done" && ["Nov 15","Nov 20"].includes(t.due)).length;

  const setStatus = (id:string, s:Status) => setTasks(prev=>prev.map(t=>t.id===id?{...t,status:s}:t));
  const finish = (id:string) => { setStatus(id,"Done"); completeTask(); };

  return (
    <AppShell active="/tasks">
      <PageHeader
        eyebrow="Timeline & Task Center"
        icon={ClipboardList}
        title={<>Every task, <span className="text-gradient">on the right day</span>.</>}
        description="Kanban, Gantt, calendar, and checklist views on the same tasks. AI generates the plan, watches for dependencies, and updates the Event Health Score™ as you complete work."
        actions={<>
          <Button variant="outline"><Sparkles className="mr-2 h-4 w-4"/>AI: generate tasks</Button>
          <Button variant="hero"><Plus className="mr-2 h-4 w-4"/>Add task</Button>
        </>}
      />

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <TStat label="Total tasks" value={String(tasks.length)}/>
        <TStat label="Completed" value={`${done} (${pct}%)`} tone="good"/>
        <TStat label="Overdue" value={String(overdue)} tone={overdue?"warn":"good"}/>
        <TStat label="AI-generated" value={String(tasks.filter(t=>t.owner==="AI").length)} tone="info"/>
      </section>

      <Progress value={pct} className="mt-6 h-2"/>

      <Tabs defaultValue="kanban" className="mt-8">
        <TabsList>
          <TabsTrigger value="kanban"><LayoutGrid className="mr-1.5 h-3.5 w-3.5"/>Kanban</TabsTrigger>
          <TabsTrigger value="list"><ListChecks className="mr-1.5 h-3.5 w-3.5"/>Checklist</TabsTrigger>
          <TabsTrigger value="calendar"><Calendar className="mr-1.5 h-3.5 w-3.5"/>Calendar</TabsTrigger>
          <TabsTrigger value="gantt"><GanttChart className="mr-1.5 h-3.5 w-3.5"/>Gantt</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <div className="grid gap-4 md:grid-cols-4">
            {STATUSES.map(s=>(
              <div key={s} className="rounded-2xl border border-border bg-muted/30 p-3">
                <div className="mb-3 flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s}</p>
                  <Badge variant="secondary">{tasks.filter(t=>t.status===s).length}</Badge>
                </div>
                <ul className="space-y-2">
                  {tasks.filter(t=>t.status===s).map(t=>(
                    <li key={t.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        <Badge className={PRI_TONE[t.priority]}>{t.priority}</Badge>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.category} · {t.due}</span>
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{t.owner}</span>
                      </div>
                      {t.recurring && <Badge variant="secondary" className="mt-2 gap-1"><Repeat className="h-3 w-3"/>Recurring</Badge>}
                      {s!=="Done" && <Button size="sm" variant="ghost" className="mt-2 h-7 w-full" onClick={()=>finish(t.id)}><Check className="mr-1 h-3.5 w-3.5"/>Complete</Button>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <div className="rounded-3xl border border-border bg-card divide-y divide-border">
            {tasks.map(t=>(
              <label key={t.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/30">
                <input type="checkbox" checked={t.status==="Done"} onChange={()=>finish(t.id)} className="h-4 w-4 rounded border-border"/>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${t.status==="Done"?"line-through text-muted-foreground":""}`}>{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.category} · Due {t.due} · Owner {t.owner}</p>
                </div>
                <Badge className={PRI_TONE[t.priority]}>{t.priority}</Badge>
                {t.deps && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3"/>Depends</Badge>}
              </label>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="mt-4">
          <CalendarView tasks={tasks}/>
        </TabsContent>

        <TabsContent value="gantt" className="mt-4">
          <GanttView tasks={tasks}/>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function CalendarView({ tasks }: { tasks: Task[] }) {
  const days = Array.from({length: 35},(_,i)=>i-2);
  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-lg font-semibold">December 2025</p>
        <div className="flex gap-2"><Button size="sm" variant="ghost">‹</Button><Button size="sm" variant="ghost">›</Button></div>
      </div>
      <div className="grid grid-cols-7 gap-px bg-border overflow-hidden rounded-xl">
        {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(<div key={d} className="bg-muted p-2 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{d}</div>))}
        {days.map(d=>{
          const inMonth = d>0 && d<=31;
          const dayTasks = tasks.filter((_,i)=>[3,5,8,12,20][i%5]===d);
          return (
            <div key={d} className={`min-h-[90px] bg-card p-2 ${!inMonth?"bg-muted/30":""}`}>
              <p className="text-xs font-medium text-muted-foreground">{inMonth?d:""}</p>
              {inMonth && dayTasks.slice(0,2).map(t=>(
                <div key={t.id} className="mt-1 truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t.title}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GanttView({ tasks }: { tasks: Task[] }) {
  const total = 24;
  return (
    <div className="rounded-3xl border border-border bg-card p-4 overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="mb-2 grid" style={{gridTemplateColumns: `220px repeat(${total}, minmax(24px,1fr))`}}>
          <div className="text-xs font-semibold text-muted-foreground">Task</div>
          {Array.from({length: total}).map((_,i)=>(<div key={i} className="text-center text-[10px] text-muted-foreground">W{Math.floor(i/2)+1}</div>))}
        </div>
        <div className="space-y-1.5">
          {tasks.map(t=>(
            <div key={t.id} className="grid items-center" style={{gridTemplateColumns: `220px repeat(${total}, minmax(24px,1fr))`}}>
              <div className="pr-2 text-xs truncate">{t.title}</div>
              {Array.from({length: total}).map((_,i)=>{
                const inSpan = i>=t.startDay && i<t.startDay+t.span;
                return <div key={i} className="h-6 border-r border-border/50">
                  {inSpan && <div className={`h-full rounded ${t.status==="Done"?"bg-emerald-400":t.status==="In progress"?"bg-primary":"bg-primary/30"}`}/>}
                </div>;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TStat({ label, value, tone }: { label:string; value:string; tone?:"warn"|"good"|"info" }) {
  const t = tone==="warn"?"text-amber-600":tone==="good"?"text-emerald-600":tone==="info"?"text-primary":"text-muted-foreground";
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 font-display text-2xl font-semibold ${t}`}>{value}</p></div>;
}

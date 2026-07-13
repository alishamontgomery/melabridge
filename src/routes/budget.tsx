import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEcosystem } from "@/lib/ecosystem-store";
import { Wallet, TrendingUp, TrendingDown, Upload, Download, Sparkles, PiggyBank, Users, FileText, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/budget")({
  head: () => ({ meta: [
    { title: "Budget Center — MelaBridge" },
    { name: "description", content: "Track categories, payments, receipts, and forecasts with proactive AI guidance." },
    { name: "robots", content: "noindex" },
  ]}),
  component: BudgetPage,
});

type Category = { name: string; planned: number; actual: number };
const CATEGORIES: Category[] = [
  { name: "Venue", planned: 18000, actual: 17200 },
  { name: "Catering", planned: 22000, actual: 14300 },
  { name: "Photography & video", planned: 8500, actual: 6200 },
  { name: "Florals & decor", planned: 7000, actual: 4800 },
  { name: "Attire", planned: 5500, actual: 3900 },
  { name: "Music & entertainment", planned: 4500, actual: 3200 },
  { name: "Stationery", planned: 1500, actual: 1400 },
  { name: "Travel & lodging", planned: 6000, actual: 0 },
];

const PAYMENTS = [
  { date: "Nov 20, 2025", vendor: "Studio Nero", amount: 3100, status: "Paid" },
  { date: "Dec 03, 2025", vendor: "Onyema Catering", amount: 4200, status: "Due" },
  { date: "Jan 15, 2026", vendor: "Bloomhaus Florals", amount: 1400, status: "Scheduled" },
  { date: "Mar 01, 2026", vendor: "Grand Hall Venue", amount: 8600, status: "Scheduled" },
  { date: "Sep 15, 2026", vendor: "DJ Kairo", amount: 1600, status: "Scheduled" },
];

const CONTRIBUTORS = [
  { name: "Amara & Julien", amount: 40000, pct: 59 },
  { name: "Marchetti family", amount: 18000, pct: 26 },
  { name: "Okonkwo family", amount: 10000, pct: 15 },
];

function BudgetPage() {
  const { event, budgetPct } = useEcosystem();
  const [cats] = useState(CATEGORIES);
  const totalPlanned = cats.reduce((s,c)=>s+c.planned,0);
  const totalActual = cats.reduce((s,c)=>s+c.actual,0);
  const remaining = event.budget - totalActual;
  const projection = useMemo(()=>Math.round(totalActual + cats.reduce((s,c)=>s+Math.max(0,c.planned-c.actual)*0.85,0)),[cats,totalActual]);

  return (
    <AppShell active="/budget">
      <PageHeader
        eyebrow="Budget Center"
        icon={Wallet}
        title={<>Money <span className="text-gradient">managed with intention</span>.</>}
        description={`$${event.budget.toLocaleString()} total budget · $${totalActual.toLocaleString()} committed · MelaAssist is watching for overspend, missed deposits, and savings opportunities.`}
        actions={<>
          <Button variant="outline"><Upload className="mr-2 h-4 w-4"/>Upload receipt</Button>
          <Button variant="hero"><Download className="mr-2 h-4 w-4"/>Export report</Button>
        </>}
      />

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <BStat label="Total budget" value={`$${event.budget.toLocaleString()}`} sub={`${budgetPct}% committed`} />
        <BStat label="Actual spend" value={`$${totalActual.toLocaleString()}`} sub={`vs $${totalPlanned.toLocaleString()} planned`} tone="info"/>
        <BStat label="Remaining" value={`$${remaining.toLocaleString()}`} sub="Includes deposits" tone={remaining<5000?"warn":"good"}/>
        <BStat label="Projected final" value={`$${projection.toLocaleString()}`} sub={projection>event.budget?"⚠ over budget":"On track"} tone={projection>event.budget?"warn":"good"}/>
      </section>

      <section className="mt-6 rounded-3xl border border-primary/20 bg-primary/5 p-5">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5"/>MelaAssist™ recommendations</div>
        <ul className="grid gap-2 text-sm md:grid-cols-2">
          <li className="flex gap-2"><PiggyBank className="mt-0.5 h-4 w-4 text-emerald-600"/><span>Switching from premium bar to house-select could save $1,900 without guest impact.</span></li>
          <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600"/><span>Onyema Catering deposit of $4,200 is due Dec 3 — 12 days out.</span></li>
          <li className="flex gap-2"><TrendingDown className="mt-0.5 h-4 w-4 text-primary"/><span>Florals are trending 30% under plan — reallocate $2,000 to guest travel?</span></li>
          <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 text-primary"/><span>Group contributions total $68k — send Q1 reminder to 2 contributors.</span></li>
        </ul>
      </section>

      <Tabs defaultValue="categories" className="mt-8">
        <TabsList className="flex-wrap">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="payments">Payment schedule</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="contributors">Contributors</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="mt-4 space-y-3">
          {cats.map(c=>{
            const pct = Math.round((c.actual/c.planned)*100);
            const over = pct>100;
            return (
              <div key={c.name} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">${c.actual.toLocaleString()} of ${c.planned.toLocaleString()}</p>
                  </div>
                  <Badge className={over?"bg-rose-500/10 text-rose-700":pct>90?"bg-amber-500/10 text-amber-700":"bg-emerald-500/10 text-emerald-700"}>{pct}%</Badge>
                </div>
                <Progress value={Math.min(100,pct)} className="mt-3"/>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="rounded-3xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-widest text-muted-foreground">
                <tr><th className="px-4 py-2 text-left">Date</th><th className="px-4 py-2 text-left">Vendor</th><th className="px-4 py-2 text-right">Amount</th><th className="px-4 py-2 text-left">Status</th></tr>
              </thead>
              <tbody>
                {PAYMENTS.map(p=>(
                  <tr key={p.vendor+p.date} className="border-t border-border">
                    <td className="px-4 py-2.5">{p.date}</td>
                    <td className="px-4 py-2.5 font-medium">{p.vendor}</td>
                    <td className="px-4 py-2.5 text-right">${p.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={p.status==="Paid"?"bg-emerald-500/10 text-emerald-700":p.status==="Due"?"bg-amber-500/10 text-amber-700":"bg-primary/10 text-primary"}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <div className="grid gap-3 md:grid-cols-3">
            {["Venue deposit.pdf","Florist invoice #4421.pdf","Photographer retainer.jpg","Cake tasting.jpg","Bar quote.pdf"].map(f=>(
              <div key={f} className="rounded-2xl border border-border bg-card p-4">
                <FileText className="h-6 w-6 text-primary"/>
                <p className="mt-2 truncate text-sm font-medium">{f}</p>
                <p className="text-xs text-muted-foreground">Auto-linked to category by AI</p>
              </div>
            ))}
            <div className="rounded-2xl border-2 border-dashed border-border bg-background p-4 text-center">
              <Upload className="mx-auto h-6 w-6 text-muted-foreground"/>
              <p className="mt-2 text-sm">Drop receipts here</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="contributors" className="mt-4">
          <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
            {CONTRIBUTORS.map(c=>(
              <div key={c.name}>
                <div className="flex justify-between text-sm"><span className="font-medium">{c.name}</span><span>${c.amount.toLocaleString()} · {c.pct}%</span></div>
                <Progress value={c.pct} className="mt-1"/>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forecast" className="mt-4">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/5 to-accent/20 p-6">
            <h3 className="font-display text-lg font-semibold">12-month projection</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Forecast label="Best case" value={`$${(projection*0.92).toLocaleString(undefined,{maximumFractionDigits:0})}`} tone="good"/>
              <Forecast label="Expected" value={`$${projection.toLocaleString()}`} tone="info"/>
              <Forecast label="Worst case" value={`$${(projection*1.15).toLocaleString(undefined,{maximumFractionDigits:0})}`} tone="warn"/>
            </div>
            <div className="mt-6 flex items-end gap-1.5 h-32">
              {[45,52,58,64,68,73,78,82,86,89,93,97].map((h,i)=>(
                <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/80 to-primary/40" style={{height:`${h}%`}}/>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">Monthly cumulative spend · projected</p>
          </div>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
function BStat({ label, value, sub, tone }: { label:string; value:string; sub:string; tone?:"warn"|"good"|"info" }) {
  const t = tone==="warn"?"text-amber-600":tone==="good"?"text-emerald-600":tone==="info"?"text-primary":"text-muted-foreground";
  return <div className="rounded-2xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value}</p><p className={`text-xs ${t}`}>{sub}</p></div>;
}
function Forecast({ label, value, tone }: { label:string; value:string; tone:"warn"|"good"|"info" }) {
  const bg = tone==="warn"?"border-amber-300 bg-amber-50":tone==="good"?"border-emerald-300 bg-emerald-50":"border-primary/30 bg-primary/5";
  return <div className={`rounded-2xl border ${bg} p-4`}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-semibold">{value}</p></div>;
}

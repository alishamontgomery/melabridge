// Pure, deterministic helpers powering the AI-companion dashboard.
// No external calls — everything is derived from data already loaded.

export type GuestLite = {
  id: string;
  plus_ones?: number | null;
  rsvp_status?: string | null;
  created_at?: string | null;
};
export type TaskLite = {
  id: string;
  title: string;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
};
export type BudgetLite = {
  id?: string;
  category?: string | null;
  estimated_amount?: number | null;
  actual_amount?: number | null;
  paid_amount?: number | null;
  vendor_name?: string | null;
};
export type EventLite = {
  id: string;
  name?: string | null;
  event_type?: string | null;
  event_date?: string | null;
  location?: string | null;
  budget_target?: number | null;
  guest_count_target?: number | null;
};

// -------- daily rotating message (deterministic by date) --------
const DAILY_MESSAGES = [
  "You're ahead of schedule. Great job!",
  "Today is a perfect day to tackle something small.",
  "You've already completed more than half your planning.",
  "Every little step brings your event closer.",
  "Small progress today, big celebration later.",
  "Your future self will thank you for what you do today.",
  "Planning is a marathon — you're pacing beautifully.",
  "One decision at a time is the professional's way.",
  "MelaAssist has your back — let's make today count.",
  "Consistency beats perfection. Keep going.",
  "You're closer than you were yesterday.",
  "Great events are built one thoughtful step at a time.",
  "You don't have to do it all today — just the next thing.",
  "Momentum is on your side. Keep the streak.",
  "A confident planner is a calm planner. Breathe, then act.",
];
export function getDailyMessage(seedOffset = 0): string {
  const d = new Date();
  const key = Number(`${d.getUTCFullYear()}${d.getUTCMonth() + 1}${d.getUTCDate()}`) + seedOffset;
  return DAILY_MESSAGES[key % DAILY_MESSAGES.length];
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
export function greetingEmoji(): string {
  const h = new Date().getHours();
  if (h < 12) return "☀️";
  if (h < 18) return "🌤️";
  return "🌙";
}

// -------- countdown --------
export type Countdown = { days: number; hours: number; minutes: number; total: number };
export function computeCountdown(iso?: string | null, now = new Date()): Countdown {
  if (!iso) return { days: 0, hours: 0, minutes: 0, total: 0 };
  const target = new Date(iso).getTime();
  const diff = Math.max(0, target - now.getTime());
  const total = diff;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { days, hours, minutes, total };
}

// -------- health score --------
export type HealthBreakdown = {
  overall: number;
  budget: number;
  guests: number;
  timeline: number;
  vendors: number;
  contracts: number;
};

function pct(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

export function computeHealthScore(input: {
  event: EventLite;
  guests: GuestLite[];
  tasks: TaskLite[];
  budget: BudgetLite[];
  vendorsBooked?: number;
  vendorsNeeded?: number;
  contractsSigned?: number;
  contractsTotal?: number;
}): HealthBreakdown {
  const { event, guests, tasks, budget } = input;
  const target = Number(event.budget_target ?? 0);
  const spent = budget.reduce((s, i) => s + Number(i.paid_amount ?? i.actual_amount ?? 0), 0);
  const budgetScore = target > 0
    ? pct(spent <= target ? 100 - (spent / target) * 20 : 60 - Math.min(60, ((spent - target) / target) * 100))
    : 80;

  const invited = guests.reduce((s, g) => s + 1 + Number(g.plus_ones ?? 0), 0);
  const confirmed = guests.filter((g) => g.rsvp_status === "yes").length;
  const guestTarget = Number(event.guest_count_target ?? invited ?? 0);
  const guestsScore = guestTarget > 0
    ? pct((confirmed / Math.max(1, guestTarget)) * 60 + (invited / Math.max(1, guestTarget)) * 40)
    : 70;

  const doneTasks = tasks.filter((t) => t.status === "done" || t.status === "completed" || !!t.completed_at).length;
  const timelineScore = tasks.length > 0 ? pct((doneTasks / tasks.length) * 100) : 75;

  const vendorsScore = input.vendorsNeeded && input.vendorsNeeded > 0
    ? pct(((input.vendorsBooked ?? 0) / input.vendorsNeeded) * 100)
    : 70;
  const contractsScore = input.contractsTotal && input.contractsTotal > 0
    ? pct(((input.contractsSigned ?? 0) / input.contractsTotal) * 100)
    : 80;

  const overall = pct(budgetScore * 0.2 + guestsScore * 0.25 + timelineScore * 0.25 + vendorsScore * 0.2 + contractsScore * 0.1);
  return { overall, budget: budgetScore, guests: guestsScore, timeline: timelineScore, vendors: vendorsScore, contracts: contractsScore };
}

export function scoreToStars(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score / 20)));
}

// -------- daily brief --------
export type BriefItem = { icon: "guests" | "budget" | "task" | "vendor" | "weather" | "tip" | "timeline"; text: string };

export function buildDailyBrief(input: {
  event: EventLite;
  guests: GuestLite[];
  tasks: TaskLite[];
  budget: BudgetLite[];
  countdown: Countdown;
}): BriefItem[] {
  const { event, guests, tasks, budget, countdown } = input;
  const items: BriefItem[] = [];
  const now = Date.now();

  const newRsvps = guests.filter((g) => {
    if (!g.created_at) return false;
    return now - new Date(g.created_at).getTime() < 48 * 3600_000
      && (g.rsvp_status === "yes");
  }).length;
  if (newRsvps > 0) items.push({ icon: "guests", text: `${newRsvps} guest${newRsvps === 1 ? "" : "s"} RSVP'd in the last 48 hours.` });

  const overdue = tasks.filter((t) => {
    if (!t.due_date) return false;
    const done = t.status === "done" || t.status === "completed" || !!t.completed_at;
    return !done && new Date(t.due_date).getTime() < now;
  }).length;
  if (overdue > 0) items.push({ icon: "task", text: `${overdue} task${overdue === 1 ? "" : "s"} slipped past their due date — a quick pass gets you back on track.` });

  const highPriority = tasks.filter((t) => t.priority === "high" && t.status !== "done" && t.status !== "completed" && !t.completed_at).length;
  if (highPriority > 0) items.push({ icon: "task", text: `You have ${highPriority} high-priority task${highPriority === 1 ? "" : "s"} in focus today.` });

  const target = Number(event.budget_target ?? 0);
  const spent = budget.reduce((s, i) => s + Number(i.paid_amount ?? i.actual_amount ?? 0), 0);
  if (target > 0) {
    if (spent <= target * 0.9) items.push({ icon: "budget", text: `Your budget is comfortably under target — ${Math.round((1 - spent / target) * 100)}% headroom remains.` });
    else if (spent > target) items.push({ icon: "budget", text: `You're currently ${Math.round((spent / target - 1) * 100)}% over your planned budget.` });
    else items.push({ icon: "budget", text: `Budget is close to target — track the next few purchases carefully.` });
  }

  if (countdown.days > 0 && countdown.days <= 60) items.push({ icon: "timeline", text: `${countdown.days} day${countdown.days === 1 ? "" : "s"} until the big day — timing recommendations are sharpening.` });

  const outdoorHints = ["outdoor", "beach", "garden", "park", "rooftop", "vineyard"];
  if (event.location && outdoorHints.some((k) => event.location!.toLowerCase().includes(k))) {
    items.push({ icon: "weather", text: `Outdoor venue detected — MelaAssist is watching the forecast for you.` });
  }

  // Never empty: pad with planning tips.
  const tips: string[] = [
    "Send a friendly RSVP nudge to guests who haven't replied yet.",
    "Review your seating layout — small tweaks now save big headaches later.",
    "Confirm arrival times with vendors 2 weeks before the event.",
    "Back up your contracts and receipts into a single folder today.",
    "Draft a short thank-you note template — you'll be glad post-event.",
  ];
  let i = 0;
  while (items.length < 4 && i < tips.length) items.push({ icon: "tip", text: tips[i++] });
  return items.slice(0, 6);
}

// -------- today's focus --------
export type FocusSuggestion = {
  id?: string;
  title: string;
  reason: string;
  estimatedMinutes: number;
  taskId?: string;
  cta: string;
  route?: string;
};

export function pickTodaysFocus(input: {
  event: EventLite;
  tasks: TaskLite[];
  guests: GuestLite[];
  budget: BudgetLite[];
  countdown: Countdown;
}): FocusSuggestion {
  const { event, tasks, guests, countdown } = input;
  const now = Date.now();

  // 1) an overdue high-priority task
  const overdue = tasks
    .filter((t) => {
      const done = t.status === "done" || t.status === "completed" || !!t.completed_at;
      return !done && t.due_date && new Date(t.due_date).getTime() < now;
    })
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  if (overdue[0]) {
    return {
      taskId: overdue[0].id,
      title: overdue[0].title,
      reason: "This task is overdue — clearing it now unblocks the rest of your timeline.",
      estimatedMinutes: 10,
      cta: "Complete now",
    };
  }
  // 2) soonest upcoming task
  const upcoming = tasks
    .filter((t) => t.status !== "done" && t.status !== "completed" && !t.completed_at && t.due_date)
    .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
  if (upcoming[0]) {
    return {
      taskId: upcoming[0].id,
      title: upcoming[0].title,
      reason: "Handling this early keeps availability open and your timeline calm.",
      estimatedMinutes: 8,
      cta: "Complete now",
    };
  }
  // 3) suggestions based on state
  const invited = guests.length;
  if (invited === 0) {
    return {
      title: "Add your first 10 guests",
      reason: "Guest list drives seating, catering estimates, and vendor quotes.",
      estimatedMinutes: 6,
      cta: "Open guest list",
      route: "/guests",
    };
  }
  if ((event.budget_target ?? 0) === 0) {
    return {
      title: "Set your budget target",
      reason: "A target unlocks smart savings alerts from MelaAssist.",
      estimatedMinutes: 3,
      cta: "Set budget",
      route: "/budget",
    };
  }
  if (countdown.days > 30) {
    return {
      title: "Draft your event timeline",
      reason: "Locking a rough runsheet now gives every vendor a shared reference.",
      estimatedMinutes: 12,
      cta: "Open timeline",
      route: "/timeline",
    };
  }
  return {
    title: "Review your open tasks",
    reason: "A quick pass keeps momentum and nothing slips through.",
    estimatedMinutes: 5,
    cta: "Open tasks",
    route: "/tasks",
  };
}

// -------- predictions --------
export function computePredictions(input: {
  event: EventLite;
  guests: GuestLite[];
  budget: BudgetLite[];
  countdown: Countdown;
}): string[] {
  const out: string[] = [];
  const { event, guests, budget, countdown } = input;
  const target = Number(event.budget_target ?? 0);
  const spent = budget.reduce((s, i) => s + Number(i.paid_amount ?? i.actual_amount ?? 0), 0);
  if (target > 0 && countdown.days > 0) {
    const burn = spent / Math.max(1, target);
    const expected = 1 - countdown.days / 180;
    if (burn > expected + 0.15) out.push("You may exceed your budget at the current spending pace.");
    else if (burn < expected - 0.15) out.push("Your spending pace is healthy — you're pacing under target.");
  }
  const confirmed = guests.filter((g) => g.rsvp_status === "yes").length;
  const invited = guests.length;
  if (invited >= 10) {
    const rate = confirmed / invited;
    if (rate > 0.7) out.push(`Your RSVP rate is ${Math.round(rate * 100)}% — above average for this stage.`);
    else if (rate < 0.3 && countdown.days < 60) out.push(`RSVP rate is ${Math.round(rate * 100)}%. A friendly nudge could lift it fast.`);
  }
  if (countdown.days > 0 && countdown.days < 90) {
    const type = (event.event_type ?? "event").toLowerCase();
    if (type.includes("wedding")) out.push("Most couples book transportation and hair/makeup this month.");
    else out.push("Weekend availability for popular vendors fills quickly at this stage.");
  }
  if (out.length === 0) out.push("MelaAssist is learning your event's patterns — deeper predictions arrive as data grows.");
  return out.slice(0, 3);
}

// -------- savings --------
export function computeSavings(input: {
  event: EventLite;
  budget: BudgetLite[];
  countdown: Countdown;
}): { items: string[]; total: number } {
  const { budget, countdown } = input;
  const items: string[] = [];
  let total = 0;
  const overCat = budget.filter((b) => Number(b.actual_amount ?? 0) > Number(b.estimated_amount ?? 0) * 1.1);
  if (overCat[0]) {
    const save = Math.round((Number(overCat[0].actual_amount ?? 0) - Number(overCat[0].estimated_amount ?? 0)) * 0.6);
    items.push(`Switching ${overCat[0].category ?? "this vendor"} could save around $${save}.`);
    total += save;
  }
  if (countdown.days > 45 && countdown.days < 120) {
    items.push("Book florals this month before seasonal pricing rises.");
    total += 300;
  }
  if (budget.length > 0 && !budget.some((b) => (b.category ?? "").toLowerCase().includes("bundle"))) {
    items.push("Bundling DJ + lighting with a preferred partner typically saves $300.");
    total += 300;
  }
  return { items: items.slice(0, 3), total };
}

// -------- milestones --------
export type Milestone = { key: string; label: string; emoji: string; big?: boolean };
export function getMilestones(input: {
  event: EventLite;
  guests: GuestLite[];
  budget: BudgetLite[];
  tasks: TaskLite[];
  countdown: Countdown;
}): Milestone[] {
  const { event, guests, budget, tasks, countdown } = input;
  const list: Milestone[] = [];
  const invited = guests.length;
  const confirmed = guests.filter((g) => g.rsvp_status === "yes").length;
  if (invited > 0 && confirmed / invited >= 0.5) list.push({ key: "rsvp-50", label: `Half of your guests have RSVP'd!`, emoji: "🥂" });
  const target = Number(event.budget_target ?? 0);
  const spent = budget.reduce((s, i) => s + Number(i.paid_amount ?? i.actual_amount ?? 0), 0);
  if (target > 0 && spent > 0 && spent <= target) list.push({ key: "under-budget", label: "You're still under budget.", emoji: "💰" });
  const doneTasks = tasks.filter((t) => t.status === "done" || t.status === "completed" || !!t.completed_at).length;
  if (tasks.length > 0 && doneTasks / tasks.length >= 0.5) list.push({ key: "tasks-half", label: "Half your tasks are done — great pace!", emoji: "✅" });
  const milestones = [100, 50, 30, 7, 1];
  for (const m of milestones) {
    if (countdown.days === m) list.push({ key: `days-${m}`, label: `Only ${m} day${m === 1 ? "" : "s"} left!`, emoji: "🎈", big: m <= 30 });
  }
  return list;
}

// -------- on-track percentage (headline) --------
export function computeOnTrack(input: {
  event: EventLite;
  guests: GuestLite[];
  tasks: TaskLite[];
  budget: BudgetLite[];
}): number {
  return computeHealthScore(input).overall;
}

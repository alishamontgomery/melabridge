import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sample workspace system.
 *
 * Every new personal user gets a rich, explorable demo event so no page ever
 * looks empty on first login. Sample rows are marked `is_sample = true` and
 * scoped to the user via RLS (owner_id = auth.uid()).
 *
 * - seedSampleWorkspace: idempotent seed of one fully-populated demo event.
 * - clearSampleWorkspace: removes all sample rows for the current user.
 * - reloadSampleWorkspace: clear + reseed.
 */

type Ok = { ok: true; event_id: string; created: boolean };
type Err = { ok: false; error: string };

// Public sample banner from Unsplash (stable, license-free hero image)
const WEDDING_BANNER =
  "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1600&q=80";

export const seedSampleWorkspace = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }): Promise<Ok | Err> => {
    const { supabase, userId } = context;

    // If user already has a sample event, no-op.
    const { data: existing } = await supabase
      .from("events")
      .select("id")
      .eq("owner_id", userId)
      .eq("is_sample", true)
      .limit(1)
      .maybeSingle();
    if (existing) return { ok: true, event_id: existing.id, created: false };

    const today = new Date();
    const eventDate = new Date(today);
    eventDate.setDate(today.getDate() + 90);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const { data: event, error: evErr } = await supabase
      .from("events")
      .insert({
        owner_id: userId,
        name: "Priya & Arjun Wedding",
        event_type: "Wedding",
        description:
          "A three-day celebration blending traditional South Asian ceremonies with a modern reception. Explore this sample workspace to see how MelaBridge organizes every detail.",
        event_date: iso(eventDate),
        event_time: "17:00",
        location: "The Grand Palazzo, Miami FL",
        budget_target: 85000,
        guest_target: 250,
        status: "confirmed",
        banner_url: WEDDING_BANNER,
        is_sample: true,
        sample_metadata: { type: "wedding", tone: "premium" },
      })
      .select("id")
      .single();
    if (evErr || !event) return { ok: false, error: evErr?.message ?? "Failed to create sample event" };

    const eventId = event.id;

    // Guests
    const guests = [
      ["Rajesh Kumar", "rajesh@example.com", "Kumar Family", "yes", 2, "Vegetarian"],
      ["Anita Sharma", "anita@example.com", "Sharma Family", "yes", 1, "Vegan"],
      ["Vikram Singh", "vikram@example.com", "Singh Family", "no", 0, null],
      ["Meera Patel", "meera@example.com", "Patel Family", "maybe", 1, "Non-Veg"],
      ["Deepak Iyer", "deepak@example.com", "Iyer Family", "yes", 0, "Vegetarian"],
      ["Kavya Reddy", "kavya@example.com", "Reddy Family", "pending", 0, null],
      ["Arjun Mehta", "arjun@example.com", "Mehta Family", "yes", 2, "Non-Veg"],
      ["Priya Desai", "priya.d@example.com", "Desai Family", "yes", 1, "Vegan"],
      ["Neha Shah", "neha@example.com", "Shah Family", "pending", 0, null],
      ["Rohan Malhotra", "rohan@example.com", "Malhotra Family", "yes", 2, "Vegetarian"],
    ] as const;
    await supabase.from("guests").insert(
      guests.map(([full_name, email, household, rsvp_status, plus_ones, meal_choice]) => ({
        event_id: eventId,
        full_name,
        email,
        household,
        rsvp_status,
        plus_ones,
        meal_choice,
        is_sample: true,
      })),
    );

    // Tasks — spread across 12 months to event day
    const daysOut = (d: number) => {
      const dt = new Date(eventDate);
      dt.setDate(dt.getDate() - d);
      return iso(dt);
    };
    const tasks = [
      ["Book venue & confirm date", "done", "urgent", daysOut(300)],
      ["Set overall budget", "done", "high", daysOut(280)],
      ["Draft guest list", "done", "high", daysOut(240)],
      ["Send save-the-dates", "done", "medium", daysOut(180)],
      ["Book photographer", "done", "high", daysOut(150)],
      ["Book caterer & finalize menu", "in_progress", "high", daysOut(60)],
      ["Confirm floral arrangements", "in_progress", "medium", daysOut(45)],
      ["Order welcome bags", "todo", "low", daysOut(30)],
      ["Send formal invitations", "todo", "high", daysOut(60)],
      ["Book DJ & confirm playlist", "todo", "urgent", daysOut(50)],
      ["Final headcount to caterer", "todo", "urgent", daysOut(14)],
      ["Rehearsal dinner", "todo", "high", daysOut(1)],
      ["Wedding Day", "todo", "urgent", daysOut(0)],
    ] as const;
    await supabase.from("tasks").insert(
      tasks.map(([title, status, priority, due_date]) => ({
        event_id: eventId,
        title,
        status,
        priority,
        due_date,
        created_by: userId,
        is_sample: true,
      })),
    );

    // Budget
    const budget = [
      ["Venue", "Grand Palazzo rental", 25000, 25000, 12500, "Grand Palazzo"],
      ["Catering", "Dinner, appetizers, bar", 22000, 21500, 8000, "Spice Route"],
      ["Photography", "Full-day + engagement shoot", 12000, 12000, 6000, "Lens Story Studio"],
      ["Florals", "Mandap, centerpieces, bouquets", 8000, 7200, 0, "Bloom & Petal"],
      ["Music", "DJ + live musicians", 7000, 0, 0, null],
      ["Attire", "Bridal & groom outfits", 9000, 8600, 8600, "Anokhi Couture"],
      ["Decor & Rentals", "Lighting, linens, chairs", 5000, 0, 0, null],
      ["Stationery", "Invitations, signage", 2000, 1800, 1800, "Paper Trail Co."],
    ] as const;
    await supabase.from("budget_items").insert(
      budget.map(([category, label, estimated_amount, actual_amount, paid_amount, vendor_name]) => ({
        event_id: eventId,
        category,
        label,
        estimated_amount,
        actual_amount,
        paid_amount,
        vendor_name,
        created_by: userId,
        is_sample: true,
      })),
    );

    // Files (metadata only — sample paths)
    await supabase.from("event_files").insert([
      {
        event_id: eventId, uploaded_by: userId, category: "contracts",
        storage_path: "sample/venue-contract.pdf", filename: "Grand Palazzo Contract.pdf",
        mime_type: "application/pdf", size_bytes: 245000, is_sample: true,
      },
      {
        event_id: eventId, uploaded_by: userId, category: "invoices",
        storage_path: "sample/catering-invoice.pdf", filename: "Spice Route Invoice.pdf",
        mime_type: "application/pdf", size_bytes: 85000, is_sample: true,
      },
      {
        event_id: eventId, uploaded_by: userId, category: "photos",
        storage_path: "sample/mood-board.jpg", filename: "Wedding Mood Board.jpg",
        mime_type: "image/jpeg", size_bytes: 420000, is_sample: true,
      },
    ]);

    // Mark profile so we don't reseed after user clears it
    await supabase
      .from("profiles")
      .update({ sample_seeded_at: new Date().toISOString() })
      .eq("id", userId);

    return { ok: true, event_id: eventId, created: true };
  },
);

export const clearSampleWorkspace = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }): Promise<{ ok: boolean; error?: string }> => {
    const { supabase, userId } = context;
    // Delete sample events; child rows follow via cascade or is_sample scoping.
    const { data: sampleEvents } = await supabase
      .from("events")
      .select("id")
      .eq("owner_id", userId)
      .eq("is_sample", true);
    const ids = (sampleEvents ?? []).map((e) => e.id);
    if (ids.length > 0) {
      await supabase.from("guests").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("tasks").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("budget_items").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("event_files").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("events").delete().in("id", ids);
    }
    await supabase.from("profiles").update({ sample_mode: false }).eq("id", userId);
    return { ok: true };
  },
);

export const reloadSampleWorkspace = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(
  async ({ context }): Promise<Ok | Err> => {
    // Force reseed: clear and re-run seed inline
    const { supabase, userId } = context;
    const { data: sampleEvents } = await supabase
      .from("events").select("id").eq("owner_id", userId).eq("is_sample", true);
    const ids = (sampleEvents ?? []).map((e) => e.id);
    if (ids.length > 0) {
      await supabase.from("guests").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("tasks").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("budget_items").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("event_files").delete().in("event_id", ids).eq("is_sample", true);
      await supabase.from("events").delete().in("id", ids);
    }
    await supabase.from("profiles").update({ sample_mode: true, sample_seeded_at: null }).eq("id", userId);
    // Call seed directly via a fresh insert (duplicate of seed logic kept short)
    const res = await seedSampleWorkspace({ data: undefined } as never);
    return res as Ok | Err;
  },
);

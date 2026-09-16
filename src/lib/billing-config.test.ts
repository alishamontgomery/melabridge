import { describe, expect, it } from "vitest";
import {
  billingConfig,
  findPlanByPriceId,
  getPlansFor,
  getPublicCatalogPlans,
  getPlannerPlan,
  planIncludes,
} from "./billing-config";

describe("launch billing catalog", () => {
  it("publishes the approved free plans and Planner Pro prices", () => {
    const myEvent = billingConfig.plans.host_free;
    const vendorProfile = billingConfig.plans.vendor_starter;
    const monthly = billingConfig.plans.planner_professional;
    const annual = billingConfig.plans.planner_professional_annual;

    expect(myEvent.name).toBe("My Event");
    expect(myEvent.price).toBe(0);
    expect(vendorProfile.name).toBe("Vendor Profile");
    expect(vendorProfile.price).toBe(0);

    expect(monthly).toMatchObject({
      name: "Planner Pro",
      price: 29,
      interval: "month",
      trialDays: 5,
      visible: true,
      priceId: "planner_professional_monthly",
    });
    expect(annual).toMatchObject({
      name: "Planner Pro",
      price: 290,
      interval: "year",
      trialDays: 5,
      visible: true,
      priceId: "planner_professional_annual",
    });
    expect(billingConfig.trialDaysDefault).toBe(5);
  });

  it("keeps future vendor paid tiers hidden and maps both Planner Pro prices", () => {
    expect(billingConfig.plans.vendor_professional.visible).toBe(false);
    expect(billingConfig.plans.vendor_premium.visible).toBe(false);
    expect(findPlanByPriceId("planner_professional_monthly")?.id).toBe("planner_professional");
    expect(findPlanByPriceId("planner_professional_annual")?.id).toBe("planner_professional_annual");
    expect(getPlansFor("vendor").map((plan) => plan.id)).toEqual(["vendor_starter"]);
    expect(planIncludes("planner_professional_annual", "multi_event")).toBe(true);
  });

  it("presents one Planner Pro catalog card with two billing choices", () => {
    expect(getPlansFor("host").map((plan) => plan.id)).toEqual([
      "host_free",
      "planner_professional",
    ]);
    expect(getPublicCatalogPlans().map((plan) => plan.id)).toEqual([
      "host_free",
      "vendor_starter",
      "planner_professional",
    ]);
    expect(getPlannerPlan("monthly").priceId).toBe("planner_professional_monthly");
    expect(getPlannerPlan("annual").priceId).toBe("planner_professional_annual");
    expect(getPlannerPlan("monthly").features).toEqual(getPlannerPlan("annual").features);
  });
});
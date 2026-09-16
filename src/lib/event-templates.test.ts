import { describe, expect, it } from "vitest";
import { getEventTemplate } from "./event-templates";

const NEW_EVENT_TYPES = [
  "Bridal Shower",
  "Engagement Party",
  "Anniversary Celebration",
  "Retirement Party",
  "Holiday Party",
  "Fundraiser or Gala",
  "Conference or Networking Event",
  "School Event or Prom",
  "Quinceañera",
  "Dinner Party",
];

describe("expanded event starter templates", () => {
  it.each(NEW_EVENT_TYPES)("seeds a complete, event-specific plan for %s", (eventType) => {
    const template = getEventTemplate(eventType);
    const taskTitles = template.tasks.map((task) => task.title);

    expect(template.tasks.length).toBeGreaterThanOrEqual(10);
    expect(new Set(taskTitles).size).toBe(taskTitles.length);
    expect(template.tasks.some((task) => task.days_before === 0)).toBe(true);
    expect(template.tasks.some((task) => task.days_before < 0)).toBe(true);
    expect(template.budget.length).toBeGreaterThanOrEqual(7);
    expect(template.budget.reduce((total, item) => total + item.share, 0)).toBeLessThanOrEqual(1.001);
    expect(template.runsheet.length).toBeGreaterThanOrEqual(6);
    expect(template.runsheet.some((item) => item.offset_min < 0)).toBe(true);
    expect(template.vendors.length).toBeGreaterThanOrEqual(6);
  });

  it("keeps the new event types addressable through the event type aliases", () => {
    expect(getEventTemplate("Fundraiser or Gala")).not.toBe(getEventTemplate("Corporate Event"));
    expect(getEventTemplate("Conference or Networking Event")).not.toBe(getEventTemplate("Corporate Event"));
    expect(getEventTemplate("School Event or Prom")).not.toBe(getEventTemplate("Birthday"));
    expect(getEventTemplate("Quinceañera")).not.toBe(getEventTemplate("Wedding"));
    expect(getEventTemplate("Dinner Party")).not.toBe(getEventTemplate("Birthday"));
  });
});
import { describe, expect, it } from "vitest";
import { buildStrengthItems } from "@/components/vendor-profile-strength";
import { SaveInput } from "@/lib/vendor-ai.functions";

describe("vendor FAQ saving", () => {
  it("accepts FAQs in the shared vendor profile save payload", () => {
    const faqs = [
      {
        question: "How far in advance should I inquire?",
        answer: "Most clients contact us six to twelve months before their event.",
      },
    ];

    expect(SaveInput.parse({ faqs })).toEqual({ faqs });
  });

  it("accepts an empty FAQ list so vendors can remove all saved FAQs", () => {
    expect(SaveInput.parse({ faqs: [] })).toEqual({ faqs: [] });
  });

  it("marks the Profile Strength FAQ item complete from saved profile data", () => {
    const items = buildStrengthItems(
      {
        faqs: [
          {
            question: "Do you travel?",
            answer: "Yes, travel is available throughout the region.",
          },
        ],
      },
      0,
    );

    expect(items.find((item) => item.key === "faqs")?.done).toBe(true);
  });
});
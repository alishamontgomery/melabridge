import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
  },
}));

import { callAi } from "./ai-client.server";

describe("shared MelaAssist client", () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = "test-key";
    delete process.env.GEMINI_MODEL;
    delete process.env.GEMINI_FALLBACK_MODEL;
    mocks.generateContent.mockReset();
  });

  it("retries a transient provider failure and returns the recovered response", async () => {
    mocks.generateContent
      .mockRejectedValueOnce(new Error("503 service unavailable"))
      .mockResolvedValueOnce({ text: "Recovered answer" });

    const result = await callAi([{ role: "user", content: "Help me plan this." }]);

    expect(result).toMatchObject({ ok: true, text: "Recovered answer" });
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
  });

  it("uses the fallback model after the configured model is unavailable", async () => {
    mocks.generateContent
      .mockRejectedValueOnce(new Error("404 model not found"))
      .mockResolvedValueOnce({ text: "Fallback answer" });

    const result = await callAi([{ role: "user", content: "Suggest a timeline." }]);

    expect(result).toMatchObject({ ok: true, text: "Fallback answer", provider: "gemini:gemini-2.5-flash-lite" });
    expect(mocks.generateContent.mock.calls[0][0].model).toBe("gemini-2.5-flash");
    expect(mocks.generateContent.mock.calls[1][0].model).toBe("gemini-2.5-flash-lite");
  });

  it("retries malformed structured output instead of accepting it", async () => {
    mocks.generateContent
      .mockResolvedValueOnce({ text: "not JSON" })
      .mockResolvedValueOnce({ text: '{"ready":true}' });

    const result = await callAi([{ role: "user", content: "Return JSON." }], {
      jsonMode: true,
      isAcceptable: (text) => {
        try {
          JSON.parse(text);
          return true;
        } catch {
          return false;
        }
      },
    });

    expect(result).toMatchObject({ ok: true, text: '{"ready":true}' });
    expect(mocks.generateContent).toHaveBeenCalledTimes(2);
  });
});
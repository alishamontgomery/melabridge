import { describe, expect, it } from "vitest";
import {
  getSyntheticMonitorStatus,
  recordSyntheticMonitorRun,
  type SyntheticMonitorRun,
} from "./reliability-monitor";

describe("synthetic monitor result classification", () => {
  it("keeps blocked and not-run checks visible without calling them failures", () => {
    const run: SyntheticMonitorRun = {
      startedAt: "2026-09-12T00:00:00.000Z",
      completedAt: "2026-09-12T00:00:01.000Z",
      overall: "blocked",
      checks: [
        {
          name: "authenticated_flow",
          status: "blocked",
          detail: "No stable test session",
          nonDestructive: true,
        },
        {
          name: "live_checkout",
          status: "not_run",
          detail: "No charge created",
          nonDestructive: true,
        },
      ],
    };

    recordSyntheticMonitorRun(run);

    expect(getSyntheticMonitorStatus()).toEqual(run);
    expect(getSyntheticMonitorStatus()?.checks.map((check) => check.status)).toEqual([
      "blocked",
      "not_run",
    ]);
  });
});
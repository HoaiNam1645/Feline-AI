import { isTaskEstimateExceeded, taskWorkedSeconds, elapsedSeconds, vietnamDateRange, vietnamDayBounds } from "./tasks.service";

describe("task time tracking", () => {
  it("counts whole active seconds from the moment work starts", () => {
    expect(elapsedSeconds("2026-11-17T08:00:00.000Z", new Date("2026-11-17T09:02:03.900Z"))).toBe(3723);
  });

  it("never returns negative active time", () => {
    expect(elapsedSeconds("2026-11-17T09:00:00.000Z", new Date("2026-11-17T08:00:00.000Z"))).toBe(0);
  });

  it("uses Vietnam midnight for daily task views", () => {
    const bounds = vietnamDayBounds(new Date("2026-11-17T20:30:00.000Z"));
    expect(bounds.start.toISOString()).toBe("2026-11-17T17:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-18T17:00:00.000Z");
  });

  it("combines completed work sessions with the currently running session", () => {
    expect(taskWorkedSeconds(
      { activeTimeSeconds: 10_800, activeTimerStartedAt: "2026-11-17T08:00:00.000Z" },
      new Date("2026-11-17T09:30:00.000Z")
    )).toBe(16_200);
  });

  it("does not mark a four-hour estimate as exceeded at exactly four hours", () => {
    expect(isTaskEstimateExceeded({ estimatedMinutes: 240, activeTimeSeconds: 14_400, activeTimerStartedAt: null })).toBe(false);
  });

  it("marks a four-hour estimate as exceeded once total work passes four hours", () => {
    expect(isTaskEstimateExceeded({ estimatedMinutes: 240, activeTimeSeconds: 14_401, activeTimerStartedAt: null })).toBe(true);
  });

  it("detects an overrun while a work session is still running", () => {
    expect(isTaskEstimateExceeded(
      { estimatedMinutes: 240, activeTimeSeconds: 13_800, activeTimerStartedAt: "2026-11-17T08:00:00.000Z" },
      new Date("2026-11-17T08:15:00.000Z")
    )).toBe(true);
  });

  it("builds inclusive calendar-date ranges in Vietnam time", () => {
    const range = vietnamDateRange("2026-10-01", "2026-10-31");
    expect(range.gte?.toISOString()).toBe("2026-09-30T17:00:00.000Z");
    expect(range.lt?.toISOString()).toBe("2026-10-31T17:00:00.000Z");
  });

  it("rejects an inverted calendar-date range", () => {
    expect(() => vietnamDateRange("2026-11-18", "2026-11-17")).toThrow("Khoảng thời gian không hợp lệ");
  });

  it("rejects a calendar date that does not exist", () => {
    expect(() => vietnamDateRange("2026-02-31", "2026-03-01")).toThrow("Ngày bắt đầu không hợp lệ");
  });
});

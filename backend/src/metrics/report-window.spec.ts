import { reportWindow, shiftReportDate } from "./report-window";

describe("reportWindow", () => {
  it("uses the same UTC calendar day as the Lemiex dashboard", () => {
    expect(reportWindow("2026-10-29")).toEqual({
      reportDate: "2026-10-29",
      timeZone: "UTC",
      startUtc: "2026-10-29 00:00:00",
      endUtc: "2026-10-30 00:00:00"
    });
  });

  it("rejects invalid calendar dates", () => {
    expect(() => reportWindow("2026-02-30")).toThrow("valid calendar date");
  });
});

describe("shiftReportDate", () => {
  it("handles month boundaries", () => {
    expect(shiftReportDate("2026-11-01", -1)).toBe("2026-10-31");
  });
});

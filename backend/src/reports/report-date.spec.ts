import { previousLocalDate } from "./report-date";

describe("previousLocalDate", () => {
  it("uses the configured business timezone", () => {
    const now = new Date("2026-10-30T01:00:00.000Z");
    expect(previousLocalDate(now, "Asia/Ho_Chi_Minh")).toBe("2026-10-29");
  });

  it("handles month boundaries", () => {
    const now = new Date("2026-11-01T01:00:00.000Z");
    expect(previousLocalDate(now, "Asia/Ho_Chi_Minh")).toBe("2026-10-31");
  });
});

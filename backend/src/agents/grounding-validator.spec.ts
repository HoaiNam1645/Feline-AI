import { assertNumericallyGrounded } from "./grounding-validator";

describe("assertNumericallyGrounded", () => {
  it("accepts numbers present in the curated context", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Có 57 đơn từ 72 giờ" },
      { backlog: 57, thresholdHours: 72 }
    )).not.toThrow();
  });

  it("rejects invented numerical claims", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Có 99 đơn lỗi" },
      { backlog: 57 }
    )).toThrow("unsupported numbers: 99");
  });

  it("treats Vietnamese decimal commas as equivalent to JSON decimals", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Giảm 5,7%" },
      { changePercent: -5.7 }
    )).not.toThrow();
  });

  it("accepts Vietnamese grouped currency values", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Doanh thu 2.366,05 USD, phí đã tính 2.858,95 USD" },
      {
        confirmedFulfillmentRevenue: 2366.05,
        calculatedFulfillmentFees: 2858.95
      }
    )).not.toThrow();
  });

  it("accepts US grouped currency values", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Revenue is 2,366.05 USD and calculated fees are 2,858.95 USD" },
      {
        confirmedFulfillmentRevenue: 2366.05,
        calculatedFulfillmentFees: 2858.95
      }
    )).not.toThrow();
  });

  it("accepts equivalent trailing decimal zeros", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Giá cơ bản 12.50 USD và phụ phí 3.00 USD" },
      { baseCost: 12.5, fee: 3 }
    )).not.toThrow();
  });

  it("accepts approved numbers embedded in metric labels and keys", () => {
    expect(() => assertNumericallyGrounded(
      { summary: "Có đơn tồn từ 72 giờ trở lên" },
      { byAgeBand: [{ ageBand: ">=72h" }], atLeast72Hours: 1 }
    )).not.toThrow();
  });

  it("ignores Markdown ordered-list positions while validating numbers inside each item", () => {
    expect(() => assertNumericallyGrounded(
      "1. Nguyễn Văn A\n2. Trần Văn B\n16. Lê Văn C",
      { members: ["Nguyễn Văn A", "Trần Văn B", "Lê Văn C"] }
    )).not.toThrow();

    expect(() => assertNumericallyGrounded(
      "1. Nguyễn Văn A có 999 đơn",
      { members: ["Nguyễn Văn A"] }
    )).toThrow("unsupported numbers: 999");
  });

  it("ignores a numeric ranking column in Markdown tables", () => {
    expect(() => assertNumericallyGrounded(
      "| STT | Nhân sự |\n|---:|---|\n| 1 | Nguyễn Văn A |\n| 2 | Trần Văn B |",
      { members: ["Nguyễn Văn A", "Trần Văn B"] }
    )).not.toThrow();
  });

  it("continues to reject unsupported business numbers outside presentation markers", () => {
    expect(() => assertNumericallyGrounded(
      "Team có 16 thành viên và doanh thu 999 USD.",
      { activeMemberCount: 16, revenue: 120 }
    )).toThrow("unsupported numbers: 999");
  });
});

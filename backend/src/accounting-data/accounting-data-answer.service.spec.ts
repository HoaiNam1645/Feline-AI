import { AccountingDataAnswerService } from "./accounting-data-answer.service";

describe("AccountingDataAnswerService", () => {
  const service = new AccountingDataAnswerService({} as never, {} as never, {} as never, {} as never);
  const fallback = (service as unknown as {
    fallback: (route: Record<string, unknown>, payload: Record<string, unknown>) => string;
  }).fallback.bind(service);

  it("trả đủ tổng thu chi khi phải dùng câu trả lời deterministic", () => {
    const answer = fallback(
      { domain: "transactions", startDate: "2026-11-01", endDate: "2026-11-19" },
      { summary: { count: 53, income: 485_000_000, expense: 312_000_000, netCashFlow: 173_000_000 }, transactions: [] }
    );

    expect(answer).toContain("485.000.000 VND");
    expect(answer).toContain("312.000.000 VND");
    expect(answer).toContain("173.000.000 VND");
    expect(answer).toContain("53");
  });

  it("xếp tài khoản theo dòng tiền ra", () => {
    const answer = fallback(
      { domain: "accounts", startDate: "2026-11-01", endDate: "2026-11-19" },
      { accounts: [
        { accountName: "Tài khoản A", bankName: "Bank A", income: 10, expense: 20, netMovement: -10 },
        { accountName: "Tài khoản B", bankName: "Bank B", income: 40, expense: 90, netMovement: -50 }
      ] }
    );

    expect(answer.indexOf("Tài khoản B")).toBeLessThan(answer.indexOf("Tài khoản A"));
  });
});

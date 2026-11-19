import { AccountingQuestionRouterService } from "./accounting-question-router.service";

describe("AccountingQuestionRouterService", () => {
  const router = new AccountingQuestionRouterService();
  const now = new Date("2026-11-19T04:00:00Z");

  test.each([
    ["Tổng thu chi tháng này là bao nhiêu?", "transactions"],
    ["Có bao nhiêu yêu cầu mua hàng đang chờ duyệt?", "purchases"],
    ["Công nợ chưa thu hiện còn bao nhiêu?", "receivables"],
    ["Tài khoản nào có dòng tiền ra nhiều nhất?", "accounts"],
    ["Các lần quy đổi USD gần đây?", "conversions"],
    ["Tình hình tài chính hôm nay thế nào?", "overview"]
  ])("%s -> %s", (question, domain) => {
    expect(router.route(question, now)).toMatchObject({ kind: "data", domain });
  });

  it("giữ câu hỏi quy trình ở Knowledge Hub", () => {
    expect(router.route("Quy trình đề nghị chi và phê duyệt gồm những bước nào?", now)).toEqual({ kind: "knowledge" });
  });

  it("mặc định dùng tháng hiện tại và hiểu các khoảng ngày phổ biến", () => {
    expect(router.route("Tài khoản nào chi nhiều nhất?", now)).toMatchObject({ startDate: "2026-11-01", endDate: "2026-11-19" });
    expect(router.route("Thu chi quý 3 năm 2025", now)).toMatchObject({ startDate: "2025-07-01", endDate: "2025-09-30" });
    expect(router.route("Giao dịch từ 01/10/2026 đến 15/10/2026", now)).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-15" });
  });

  it("chỉ gửi từ khóa tìm kiếm khi người dùng nêu mã hoặc cụm được trích dẫn", () => {
    expect(router.route("Tổng thu chi tháng này", now).query).toBeUndefined();
    expect(router.route("Tìm mã giao dịch TX-2026-001", now).query).toBe("tx-2026-001");
    expect(router.route('Tìm giao dịch có nội dung "phí vận chuyển"', now).query).toBe("phí vận chuyển");
  });
});

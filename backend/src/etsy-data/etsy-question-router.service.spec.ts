import { EtsyQuestionRouterService } from "./etsy-question-router.service";

describe("EtsyQuestionRouterService", () => {
  const router = new EtsyQuestionRouterService();
  const now = new Date("2026-11-18T12:00:00Z");

  test.each([
    ["Team Tuyen có những ai?", "team"],
    ["Shop nào có lợi nhuận cao nhất tháng này?", "finance"],
    ["Các shop của seller Duy hiện có gì?", "shops"],
    ["Sản phẩm nào bán chạy nhất 30 ngày qua?", "products"],
    ["Hôm nay có bao nhiêu đơn Etsy?", "orders"],
    ["Chi phí fulfillment tháng 10 là bao nhiêu?", "fulfillment"],
    ["Refund của team Tuyen tuần trước thế nào?", "support"],
    ["Tổng quan Etsy hôm nay", "overview"]
  ])("%s -> %s", (question, domain) => {
    expect(router.route(question, now)).toMatchObject({ kind: "data", domain });
  });

  it("giữ câu hỏi quy trình ở kho tri thức", () => {
    expect(router.route("Quy trình tạo và duyệt một listing Etsy gồm những bước nào?", now)).toEqual({ kind: "knowledge" });
  });

  it("hiểu tháng gọi bằng số", () => {
    expect(router.route("Lợi nhuận team Tuyen tháng 10", now)).toMatchObject({ startDate: "2026-10-01", endDate: "2026-10-31" });
  });

  it("hiểu tiền hoàn và quý", () => {
    expect(router.route("Seller nào có tiền hoàn cao nhất quý 3 năm 2025?", now)).toMatchObject({
      kind: "data", domain: "support", startDate: "2025-07-01", endDate: "2025-09-30"
    });
  });
});

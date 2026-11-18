import { TiktokQuestionRouterService } from "./tiktok-question-router.service";

describe("TiktokQuestionRouterService - 15 câu hỏi nghiệm thu", () => {
  const router = new TiktokQuestionRouterService();
  const now = new Date("2026-11-14T12:00:00Z");
  const cases: Array<[string, string]> = [
    ["Hôm nay toàn hệ thống có bao nhiêu đơn và bao nhiêu item theo giờ Los Angeles?", "overview"],
    ["Doanh số đơn, doanh thu ước tính và tiền TikTok quyết toán tháng này khác nhau bao nhiêu?", "finance"],
    ["Team nào có contribution profit cao nhất tuần này?", "team"],
    ["Team G9B có những ai?", "team"],
    ["Seller A có bao nhiêu store active, store nào mất auth?", "stores"],
    ["Đơn 5768029137501234567 gồm sản phẩm nào, thuộc store nào và tracking ra sao?", "orders"],
    ["Có bao nhiêu đơn Pending hoặc On Hold quá SLA?", "fulfillment"],
    ["Vendor fulfillment nào có cost/order và refund rate cao nhất?", "fulfillment"],
    ["Có bao nhiêu fulfillment chưa có giá và ảnh hưởng team nào?", "fulfillment"],
    ["SKU nào bán nhiều nhất nhưng refund rate cao trong 30 ngày qua?", "finance"],
    ["Store nào chênh lệch lớn giữa estimated revenue và statement settlement?", "finance"],
    ["Designer nào backlog cao và cycle time bao nhiêu?", "design"],
    ["Design nào thiếu file bắt buộc trước khi gửi xưởng?", "design"],
    ["Refund tuần này phát sinh từ đơn của kỳ nào?", "finance"],
    ["Tại sao lợi nhuận cuối cùng chưa thể kết luận nếu ads và expense chưa đồng bộ?", "finance"],
    ["Số liệu vừa trả lời được cập nhật đến thời điểm nào và có cảnh báo chất lượng gì?", "overview"]
  ];

  test.each(cases)("%s -> %s", (question, domain) => {
    expect(router.route(question, now)).toMatchObject({ kind: "data", domain });
  });

  it("giữ câu hỏi quy trình ở Knowledge Hub", () => {
    expect(router.route("Quy trình duyệt nội dung TikTok như thế nào?", now)).toEqual({ kind: "knowledge" });
  });

  it("hiểu tháng được gọi bằng số", () => {
    expect(router.route("Tiền payout của Trịnh Văn Duy trong tháng 10", now)).toMatchObject({
      kind: "data", domain: "finance", startDate: "2026-10-01", endDate: "2026-10-31"
    });
  });

  it("ưu tiên store khi câu hỏi có cả seller và store", () => {
    expect(router.route("Seller A có bao nhiêu store active, store nào mất auth?", now)).toMatchObject({ kind: "data", domain: "stores" });
  });

  it("hiểu quý và tuần trước", () => {
    expect(router.route("Doanh thu quý 3 năm 2025", now)).toMatchObject({ startDate: "2025-07-01", endDate: "2025-09-30" });
    expect(router.route("Team nào nhiều đơn nhất tuần trước", now)).toMatchObject({ startDate: "2026-11-02", endDate: "2026-11-08" });
  });

  it("ưu tiên danh sách đơn gần nhất dù câu hỏi có nhắc team", () => {
    expect(router.route("Cho tôi 3 đơn hàng gần nhất của team G9B và trạng thái hiện tại", now)).toMatchObject({
      kind: "data", domain: "orders", startDate: "2026-10-16", endDate: "2026-11-14"
    });
  });
});

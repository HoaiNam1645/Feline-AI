import { TiktokQuestionRouterService } from "./tiktok-question-router.service";

describe("TiktokQuestionRouterService - 15 câu hỏi nghiệm thu", () => {
  const router = new TiktokQuestionRouterService();
  const now = new Date("2026-11-14T12:00:00Z");
  const cases: Array<[string, string]> = [
    ["Hôm nay toàn hệ thống có bao nhiêu đơn và bao nhiêu item theo giờ Los Angeles?", "overview"],
    ["Doanh số đơn, doanh thu ước tính và tiền TikTok quyết toán tháng này khác nhau bao nhiêu?", "finance"],
    ["Team nào có contribution profit cao nhất tuần này?", "team"],
    ["Team G9B có những ai?", "team"],
    ["Seller A có bao nhiêu store active, store nào mất auth?", "team"],
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
});

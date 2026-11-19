import { MultiAgentRouterService } from "./multi-agent-router.service";

describe("MultiAgentRouterService", () => {
  const router = new MultiAgentRouterService();

  it("routes strategic order growth tasks to the three operating agents", () => {
    expect(router.route("Lên kế hoạch tăng đơn toàn công ty thêm 20 đơn mỗi ngày")).toEqual([
      "tiktok-ai", "etsy-ai", "lemiex-ai"
    ]);
  });

  it("routes explicit department questions narrowly", () => {
    expect(router.route("Doanh thu Etsy hôm nay thế nào?")).toEqual(["etsy-ai"]);
    expect(router.route("Backlog xưởng Lemiex hiện tại")).toEqual(["lemiex-ai"]);
    expect(router.route("Chính sách nghỉ phép của nhân sự")).toEqual(["ceo-ai"]);
  });

  it("honors valid explicit participants and removes duplicates", () => {
    expect(router.route("Phân tích", ["etsy-ai", "tiktok-ai", "etsy-ai", "unknown"])).toEqual(["etsy-ai", "tiktok-ai"]);
  });
});

export interface AgentCapabilityDefinition {
  id: string;
  name: string;
  description: string;
  status: "available" | "planned";
  riskLevel: "R0" | "R1" | "R2" | "R3";
  allowedTools: string[];
}

export interface AgentDefinition {
  id: string;
  name: string;
  domain: string;
  mission: string;
  riskLevel: "R0" | "R1" | "R2" | "R3";
  boundaries: string[];
  capabilities: AgentCapabilityDefinition[];
}

export const LEMIEX_AGENT_DEFINITION: AgentDefinition = {
  id: "lemiex-ai",
  name: "Lemiex AI",
  domain: "Vận hành xưởng Lemiex",
  mission: "Phân tích dữ liệu vận hành, hỗ trợ điều tra và đề xuất ưu tiên cho xưởng Lemiex.",
  riskLevel: "R0",
  boundaries: [
    "Không truy cập MySQL hoặc tự viết SQL",
    "Chỉ dùng tool và snapshot đã được duyệt",
    "Không sửa trạng thái đơn hoặc điều phối nhân sự",
    "Không kết luận nguyên nhân khi dữ liệu chỉ cho thấy tương quan",
    "Không hoạt động như CEO AI hoặc suy luận ngoài phạm vi xưởng Lemiex"
  ],
  capabilities: [
    {
      id: "lemiex.operations.daily-review",
      name: "Đánh giá vận hành hằng ngày",
      description: "Phân tích snapshot KPI và báo cáo deterministic, sau đó đề xuất điểm cần kiểm tra.",
      status: "available",
      riskLevel: "R0",
      allowedTools: [
        "lemiex.metrics.daily-snapshot",
        "lemiex.reports.daily-artifact"
      ]
    },
    {
      id: "lemiex.operations.backlog-investigation",
      name: "Điều tra backlog",
      description: "Khoanh vùng nhóm backlog theo trạng thái, tuổi đơn và nguyên nhân dữ liệu có thể kiểm chứng.",
      status: "planned",
      riskLevel: "R0",
      allowedTools: ["lemiex.metrics.backlog"]
    },
    {
      id: "lemiex.operations.data-quality-review",
      name: "Kiểm tra chất lượng dữ liệu",
      description: "Theo dõi dữ liệu thiếu, mồ côi, trễ cập nhật và sai lệch workflow.",
      status: "planned",
      riskLevel: "R0",
      allowedTools: ["lemiex.metrics.data-quality"]
    },
    {
      id: "lemiex.operations.ask",
      name: "Hỏi đáp vận hành",
      description: "Trả lời câu hỏi trong phạm vi các metric/query đã được duyệt.",
      status: "available",
      riskLevel: "R0",
      allowedTools: ["lemiex.metrics.live-daily", "lemiex.metrics.live-period", "lemiex.metrics.inventory", "lemiex.metrics.seller-pricing", "lemiex.search.orders"]
    },
    {
      id: "lemiex.operations.production-planning",
      name: "Đề xuất kế hoạch sản xuất",
      description: "Đề xuất ưu tiên xử lý; mọi hành động thực tế phải được con người phê duyệt.",
      status: "planned",
      riskLevel: "R1",
      allowedTools: ["lemiex.metrics.production-load"]
    }
  ]
};

export const CEO_AGENT_DEFINITION: AgentDefinition = {
  id: "ceo-ai",
  name: "CEO AI",
  domain: "Tri thức và điều hành nội bộ",
  mission: "Hỗ trợ nhân sự tra cứu thông tin nội bộ từ tài liệu đã được phê duyệt và đúng phạm vi truy cập.",
  riskLevel: "R0",
  boundaries: [
    "Chỉ trả lời từ tài liệu người dùng được phép đọc",
    "Mọi câu trả lời nghiệp vụ phải có trích dẫn nguồn",
    "Không tìm thấy căn cứ thì ghi nhận câu hỏi chưa trả lời được",
    "Không tự phê duyệt, cam kết hoặc thực hiện hành động thay lãnh đạo",
    "Không dùng lịch sử hoặc vector để suy ra quyền hạn"
  ],
  capabilities: [{
    id: "ceo.hr.ask",
    name: "Hỏi đáp nhân sự",
    description: "Trả lời câu hỏi nhân sự từ Knowledge Hub với trích dẫn tài liệu và phiên bản hiệu lực.",
    status: "available",
    riskLevel: "R0",
    allowedTools: ["ceo.knowledge.search"]
  }]
};

export const TIKTOK_AGENT_DEFINITION: AgentDefinition = {
  id: "tiktok-ai",
  name: "TikTok AI",
  domain: "Phòng Sell TikTok",
  mission: "Hỗ trợ đội ngũ Sell TikTok tra cứu tri thức nghiệp vụ từ tài liệu đã được phê duyệt và đúng phạm vi truy cập.",
  riskLevel: "R0",
  boundaries: [
    "Chỉ trả lời từ tài liệu người dùng được phép đọc",
    "Mọi kết luận nghiệp vụ phải có trích dẫn nguồn",
    "Không tìm thấy căn cứ thì ghi nhận câu hỏi chưa trả lời được",
    "Không tự đăng bài, sửa chiến dịch hoặc thực hiện hành động trên nền tảng TikTok",
    "Không dùng delegation để vượt quyền truy cập của người dùng"
  ],
  capabilities: [
    {
      id: "tiktok.knowledge.ask",
      name: "Hỏi đáp tri thức TikTok",
      description: "Trả lời từ kho tài liệu Sell TikTok với trích dẫn và phân quyền theo phòng ban.",
      status: "available",
      riskLevel: "R0",
      allowedTools: ["tiktok.knowledge.search"]
    },
    {
      id: "tiktok.data.ask",
      name: "Hỏi đáp dữ liệu TikTok",
      description: "Tra cứu dữ liệu đơn hàng, tiền, team, store, fulfillment và design qua các tool chỉ đọc đã được phân quyền.",
      status: "available",
      riskLevel: "R0",
      allowedTools: [
        "tiktok.overview.get",
        "tiktok.orders.search",
        "tiktok.money.summary",
        "tiktok.team.performance",
        "tiktok.stores.health",
        "tiktok.fulfillment.metrics",
        "tiktok.design.metrics"
      ]
    }
  ]
};

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  LEMIEX_AGENT_DEFINITION,
  CEO_AGENT_DEFINITION,
  TIKTOK_AGENT_DEFINITION
];

export function findAgentDefinition(agentId: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((agent) => agent.id === agentId);
}

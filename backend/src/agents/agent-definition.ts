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
  capabilities: [
    {
      id: "ceo.hr.ask",
      name: "Hỏi đáp nhân sự",
      description: "Trả lời câu hỏi nhân sự từ Knowledge Hub với trích dẫn tài liệu và phiên bản hiệu lực.",
      status: "available",
      riskLevel: "R0",
      allowedTools: ["ceo.knowledge.search"]
    },
    {
      id: "ceo.multi-agent.coordinate",
      name: "Điều phối nhiều AI",
      description: "Giao một nhiệm vụ cho nhiều Agent đúng quyền và tổng hợp thành biên bản điều hành.",
      status: "available",
      riskLevel: "R0",
      allowedTools: ["ceo.agent.route", "ceo.meeting.synthesize"]
    }
  ]
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

export const ETSY_AGENT_DEFINITION: AgentDefinition = {
  id: "etsy-ai",
  name: "Etsy AI",
  domain: "Phòng Sell Etsy",
  mission: "Hỗ trợ đội ngũ Sell Etsy tra cứu tri thức nghiệp vụ từ tài liệu đã được phê duyệt và đúng phạm vi truy cập.",
  riskLevel: "R0",
  boundaries: [
    "Chỉ trả lời từ tài liệu người dùng được phép đọc",
    "Mọi kết luận nghiệp vụ phải có trích dẫn nguồn",
    "Không tìm thấy căn cứ thì ghi nhận câu hỏi chưa trả lời được",
    "Không tự đăng sản phẩm, sửa listing, thay đổi quảng cáo hoặc thực hiện hành động trên Etsy",
    "Không dùng lịch sử hội thoại hoặc tri thức vector để vượt quyền truy cập"
  ],
  capabilities: [
    {
      id: "etsy.knowledge.ask",
      name: "Hỏi đáp tri thức Etsy",
      description: "Trả lời từ kho tài liệu Sell Etsy với trích dẫn và phân quyền theo phòng ban.",
      status: "available",
      riskLevel: "R0",
      allowedTools: ["etsy.knowledge.search"]
    },
    {
      id: "etsy.data.ask",
      name: "Tra cứu dữ liệu Etsy",
      description: "Tra cứu dữ liệu đơn hàng, tài chính, team, shop, fulfillment, hỗ trợ và sản phẩm qua các tool chỉ đọc.",
      status: "available",
      riskLevel: "R0",
      allowedTools: [
        "etsy.overview.get", "etsy.orders.search", "etsy.money.summary", "etsy.team.performance",
        "etsy.shops.performance", "etsy.fulfillment.metrics", "etsy.support.metrics", "etsy.products.metrics"
      ]
    }
  ]
};

export const ACCOUNTING_AGENT_DEFINITION: AgentDefinition = {
  id: "accounting-ai",
  name: "Kế toán AI",
  domain: "Phòng Kế toán",
  mission: "Hỗ trợ tra cứu tri thức kế toán và phân tích dữ liệu tài chính nội bộ trong phạm vi được cấp.",
  riskLevel: "R0",
  boundaries: [
    "Chỉ đọc dữ liệu từ các nguồn và công cụ đã được phê duyệt",
    "Không tạo, sửa hoặc xóa giao dịch, số dư và tài khoản thanh toán",
    "Không phê duyệt yêu cầu mua hàng, tạm ứng, hoàn ứng hoặc quy đổi tiền",
    "Không tiết lộ số tài khoản đầy đủ, thông tin đăng nhập hoặc cấu hình kết nối",
    "Tài liệu và lịch sử hội thoại không tạo ra quyền thực thi"
  ],
  capabilities: [
    {
      id: "accounting.knowledge.ask",
      name: "Hỏi đáp tri thức kế toán",
      description: "Trả lời từ tài liệu kế toán nội bộ với trích dẫn và phân quyền theo phòng ban.",
      status: "available",
      riskLevel: "R0",
      allowedTools: ["accounting.knowledge.search"]
    },
    {
      id: "accounting.data.ask",
      name: "Tra cứu dữ liệu kế toán",
      description: "Phân tích thu chi, giao dịch, đề nghị mua hàng, tài khoản, công nợ và quy đổi tiền qua nguồn chỉ đọc.",
      status: "available",
      riskLevel: "R0",
      allowedTools: [
        "accounting.overview.get",
        "accounting.transactions.get",
        "accounting.purchases.get",
        "accounting.accounts.get",
        "accounting.receivables.get",
        "accounting.conversions.get"
      ]
    }
  ]
};

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  LEMIEX_AGENT_DEFINITION,
  CEO_AGENT_DEFINITION,
  TIKTOK_AGENT_DEFINITION,
  ETSY_AGENT_DEFINITION,
  ACCOUNTING_AGENT_DEFINITION
];

export function findAgentDefinition(agentId: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS.find((agent) => agent.id === agentId);
}

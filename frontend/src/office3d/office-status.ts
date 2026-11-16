export type VisualPhase =
  | "IDLE"
  | "OUTBOUND"
  | "ARRIVAL"
  | "PROCESSING"
  | "HANDOFF"
  | "RETURNING"
  | "DELIVERY"
  | "COMPLETE"
  | "ERROR";

export type OfficeAgent = "CEO" | "COURIER" | "LEMIEX";
export type CeoIdleState = "RESTING" | "DESK" | "SMOKING";

export const CEO_IDLE_LABELS: Record<CeoIdleState, string> = {
  RESTING: "Nghỉ ngơi",
  DESK: "Ngồi vào bàn",
  SMOKING: "Hút thuốc"
};

export const PHASE_LABELS: Record<VisualPhase, string> = {
  IDLE: "Sẵn sàng tại Phòng Giám đốc",
  OUTBOUND: "Đang chuyển yêu cầu sang Lemiex",
  ARRIVAL: "Lemiex đang tiếp nhận yêu cầu",
  PROCESSING: "Lemiex AI đang xử lý dữ liệu",
  HANDOFF: "Lemiex đã hoàn tất báo cáo",
  RETURNING: "Đang mang kết quả về Feline",
  DELIVERY: "Đang trình báo cáo cho CEO AI",
  COMPLETE: "CEO AI đã nhận kết quả",
  ERROR: "Yêu cầu chưa hoàn tất"
};

const AGENT_STATUS: Record<OfficeAgent, Record<VisualPhase, string>> = {
  CEO: {
    IDLE: "Đang nghỉ ngắn",
    OUTBOUND: "Đã tiếp nhận việc",
    ARRIVAL: "Theo dõi bàn giao yêu cầu",
    PROCESSING: "Theo dõi Lemiex xử lý",
    HANDOFF: "Chờ nhận báo cáo",
    RETURNING: "Đang chờ kết quả",
    DELIVERY: "Đang nhận báo cáo",
    COMPLETE: "Đã nhận kết quả",
    ERROR: "Cần xử lý lại"
  },
  COURIER: {
    IDLE: "Sẵn sàng",
    OUTBOUND: "Đang sang Lemiex",
    ARRIVAL: "Đang bàn giao yêu cầu",
    PROCESSING: "Đã bàn giao yêu cầu",
    HANDOFF: "Đang nhận báo cáo",
    RETURNING: "Đang mang kết quả về",
    DELIVERY: "Đang trình báo cáo",
    COMPLETE: "Đã bàn giao cho Giám đốc",
    ERROR: "Nhiệm vụ bị gián đoạn"
  },
  LEMIEX: {
    IDLE: "Sẵn sàng tiếp nhận",
    OUTBOUND: "Chờ yêu cầu đến",
    ARRIVAL: "Đang tiếp nhận yêu cầu",
    PROCESSING: "Đã tiếp nhận · đang xử lý",
    HANDOFF: "Đã hoàn tất báo cáo",
    RETURNING: "Đã bàn giao kết quả",
    DELIVERY: "Sẵn sàng",
    COMPLETE: "Sẵn sàng",
    ERROR: "Xử lý thất bại"
  }
};

export function agentStatus(agent: OfficeAgent, phase: VisualPhase) {
  return AGENT_STATUS[agent][phase];
}

export const WORKFLOW_STEPS = [
  "Tiếp nhận việc",
  "Di chuyển",
  "Lemiex xử lý",
  "Nhận báo cáo",
  "Trở về",
  "Hoàn tất"
] as const;

export function workflowStep(phase: VisualPhase) {
  return {
    IDLE: -1,
    OUTBOUND: 1,
    ARRIVAL: 2,
    PROCESSING: 2,
    HANDOFF: 3,
    RETURNING: 4,
    DELIVERY: 5,
    COMPLETE: 5,
    ERROR: -1
  }[phase];
}

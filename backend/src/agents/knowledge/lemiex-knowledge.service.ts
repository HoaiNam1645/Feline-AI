import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { join } from "node:path";

type KnowledgeTopic =
  | "intake"
  | "workflow"
  | "shipout"
  | "backlog"
  | "remake"
  | "tracking"
  | "finance"
  | "inventory"
  | "security"
  | "general";

interface MetricKnowledge {
  id: string;
  topic: string;
  label: string;
  definition: string;
  unit: string;
  availability: string;
}

@Injectable()
export class LemiexKnowledgeService {
  private readonly root = join(process.cwd(), "knowledge", "lemiex");
  private readonly agent = this.read<Record<string, unknown>>("agent.json");
  private readonly glossary = this.read<{ terms: Array<Record<string, unknown>> }>("glossary.json");
  private readonly entities = this.read<{ entities: Array<Record<string, unknown> & { id: string }> }>("entities.json");
  private readonly statuses = this.read<Record<string, unknown>>("statuses.json");
  private readonly metrics = this.read<{ metrics: MetricKnowledge[] }>("metrics.json");
  private readonly policies = this.read<Record<string, unknown>>("policies.json");

  contextFor(question: string): string {
    const topic = this.route(question);
    const selectedMetrics = topic === "general"
      ? this.metrics.metrics.filter((metric) => metric.availability === "available")
      : this.metrics.metrics.filter((metric) => metric.topic === topic);
    const selectedEntities = this.entities.entities.filter((entity) =>
      this.entityIds(topic).includes(entity.id)
    );
    return JSON.stringify({
      catalogVersion: this.agent.version,
      topic,
      identity: {
        name: this.agent.identity,
        domain: this.agent.domain,
        mission: this.agent.mission,
        reportingTimezone: this.agent.reportingTimezone,
        boundaries: this.agent.boundaries
      },
      glossary: this.glossary.terms,
      entities: selectedEntities,
      statuses: this.statusesFor(topic),
      metrics: selectedMetrics,
      policies: this.policies
    });
  }

  private route(question: string): KnowledgeTopic {
    const value = question.toLocaleLowerCase("vi-VN");
    if (/api key|token|mật khẩu|password|connection string|địa chỉ|điện thoại|tracking id/.test(value)) {
      return "security";
    }
    if (/tồn kho|trong kho|stock|sku|biến thể|còn lại bao nhiêu|còn bao nhiêu|danh sách sản phẩm|các sản phẩm nào|những sản phẩm nào/.test(value)) {
      return "inventory";
    }
    if (/doanh thu|lợi nhuận|giá|phí|chi phí|tiền|refund|hoàn tiền|total.?cost|paid.?cost/.test(value)) {
      return "finance";
    }
    if (/carrier|delivered|đã giao|tracking|vận chuyển/.test(value)) return "tracking";
    if (/remake|làm lại|hàng lỗi|lỗi sản phẩm/.test(value)) return "remake";
    if (/backlog|tồn đọng|đơn tồn|kẹt|quá hạn|tuổi đơn/.test(value)) return "backlog";
    if (/shipout|xuất hàng/.test(value)) return "shipout";
    if (/workflow|công đoạn|staff|qc|packing|đóng gói|sản xuất/.test(value)) return "workflow";
    if (/đơn mới|item|quantity|số lượng|tiếp nhận|đầu vào/.test(value)) return "intake";
    return "general";
  }

  private entityIds(topic: KnowledgeTopic): string[] {
    const byTopic: Record<KnowledgeTopic, string[]> = {
      intake: ["orders", "order_items"],
      workflow: ["orders", "order_items", "productions", "order_item_workflows"],
      shipout: ["orders", "order_items", "order_item_workflows"],
      backlog: ["orders", "order_items", "order_item_workflows"],
      remake: ["orders", "order_items", "order_item_remakes"],
      tracking: ["orders", "tracking"],
      finance: ["orders", "transactions"],
      inventory: ["products", "product_variants", "productions"],
      security: ["stores", "orders", "tracking"],
      general: ["orders", "order_items", "order_item_workflows", "order_item_remakes"]
    };
    return byTopic[topic];
  }

  private statusesFor(topic: KnowledgeTopic): Record<string, unknown> {
    if (topic === "tracking") {
      return { trackingStatuses: this.statuses.trackingStatuses };
    }
    if (topic === "workflow" || topic === "shipout") {
      return {
        orderStatuses: this.statuses.orderStatuses,
        workflowStages: this.statuses.workflowStages
      };
    }
    if (topic === "backlog" || topic === "general") {
      return { orderStatuses: this.statuses.orderStatuses };
    }
    return {};
  }

  private read<T>(file: string): T {
    return JSON.parse(readFileSync(join(this.root, file), "utf8")) as T;
  }
}

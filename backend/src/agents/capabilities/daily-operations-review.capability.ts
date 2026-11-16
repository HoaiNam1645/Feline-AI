import { Injectable } from "@nestjs/common";
import { requiredNumber } from "../../config/runtime-config";
import { AnthropicStructuredProvider } from "../../ai/anthropic-structured.provider";
import { reportWindow } from "../../metrics/report-window";
import { AgentToolExecutorService } from "../tools/agent-tool-executor.service";
import {
  DailySnapshotToolOutput
} from "../tools/daily-snapshot.tool";
import { DailyReportToolOutput } from "../tools/daily-report.tool";
import { assertNumericallyGrounded } from "../grounding-validator";
import { AgentCapability, AgentCapabilityResult } from "./agent-capability";

export interface LemiexDailyReview {
  summary: string;
  dataShows: string[];
  needsInvestigation: string[];
  operationalPriorities: Array<{
    priority: "high" | "medium" | "low";
    action: string;
    evidence: string;
  }>;
  limitations: string[];
}

interface DailyReviewInput extends Record<string, unknown> {
  reportDate: string;
}

@Injectable()
export class DailyOperationsReviewCapability implements AgentCapability<DailyReviewInput, LemiexDailyReview> {
  readonly id = "lemiex.operations.daily-review";
  readonly promptVersion = "lemiex-daily-review-v0.1";

  constructor(
    private readonly tools: AgentToolExecutorService,
    private readonly provider: AnthropicStructuredProvider
  ) {}

  validateInput(input: unknown): DailyReviewInput {
    if (!input || typeof input !== "object") {
      throw new Error("Daily review input must be an object");
    }
    const reportDate = (input as Record<string, unknown>).reportDate;
    if (typeof reportDate !== "string" || !reportDate) {
      throw new Error("reportDate is required");
    }
    reportWindow(reportDate);
    return { reportDate };
  }

  async execute(
    agentRunId: string,
    input: DailyReviewInput
  ): Promise<AgentCapabilityResult<LemiexDailyReview>> {
    const snapshot = await this.tools.execute<
      { reportDate: string },
      DailySnapshotToolOutput
    >(agentRunId, "lemiex.metrics.daily-snapshot", input);
    const report = await this.tools.execute<
      { reportDate: string },
      DailyReportToolOutput
    >(agentRunId, "lemiex.reports.daily-artifact", input);
    const context = {
      metrics: snapshot.metrics,
      deterministicReport: report
    };
    const generation = await this.provider.generateObject<LemiexDailyReview>({
      system: this.systemPrompt(),
      user: `Phân tích dữ liệu vận hành Lemiex sau. Chỉ sử dụng dữ liệu trong JSON này:\n${JSON.stringify(context)}`,
      toolName: "submit_lemiex_daily_review",
      toolDescription: "Trả về đánh giá vận hành Lemiex có cấu trúc và được neo vào dữ liệu đầu vào.",
      inputSchema: this.outputSchema(),
      maxOutputTokens: requiredNumber("AI_MAX_OUTPUT_TOKENS", 1200)
    });

    const output = this.normalizeOutput(generation.value);
    this.validateOutput(output);
    assertNumericallyGrounded(output, context);

    return {
      output,
      metricSnapshotId: snapshot.snapshotId,
      generation: {
        model: generation.model,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        estimatedCostUsd: generation.estimatedCostUsd
      }
    };
  }

  private normalizeOutput(output: LemiexDailyReview): LemiexDailyReview {
    return {
      ...output,
      needsInvestigation: Array.isArray(output?.needsInvestigation)
        ? output.needsInvestigation
        : [],
      operationalPriorities: Array.isArray(output?.operationalPriorities)
        ? output.operationalPriorities
        : [],
      limitations: Array.isArray(output?.limitations) ? output.limitations : []
    };
  }

  private systemPrompt(): string {
    return [
      "Bạn là Lemiex AI, domain agent chuyên về vận hành xưởng Lemiex; bạn không phải CEO AI.",
      "Nhiệm vụ của bạn là phân tích dữ liệu đã được Metrics Engine xác minh và hỗ trợ con người quyết định.",
      "Không tạo thêm con số, không tự suy luận dữ liệu khách hàng, không khẳng định nguyên nhân nếu dữ liệu chưa chứng minh.",
      "Phân biệt rõ điều dữ liệu cho thấy với điều cần điều tra.",
      "Đề xuất tối đa ba ưu tiên vận hành; chỉ đề xuất, không ra lệnh và không thực hiện hành động.",
      "Không dùng kiến thức ngoài JSON đầu vào để đưa ra tuyên bố về tình trạng xưởng. Viết tiếng Việt có dấu, ngắn gọn."
    ].join(" ");
  }

  private outputSchema(): Record<string, unknown> {
    return {
      type: "object",
      additionalProperties: false,
      required: [
        "summary",
        "dataShows",
        "needsInvestigation",
        "operationalPriorities",
        "limitations"
      ],
      properties: {
        summary: { type: "string", maxLength: 500 },
        dataShows: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string", maxLength: 300 }
        },
        needsInvestigation: {
          type: "array",
          maxItems: 4,
          items: { type: "string", maxLength: 300 }
        },
        operationalPriorities: {
          type: "array",
          maxItems: 3,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["priority", "action", "evidence"],
            properties: {
              priority: { type: "string", enum: ["high", "medium", "low"] },
              action: { type: "string", maxLength: 300 },
              evidence: { type: "string", maxLength: 300 }
            }
          }
        },
        limitations: {
          type: "array",
          maxItems: 4,
          items: { type: "string", maxLength: 300 }
        }
      }
    };
  }

  private validateOutput(output: LemiexDailyReview): void {
    if (!output || typeof output.summary !== "string" || !output.summary.trim()) {
      throw new Error("Lemiex AI output is missing summary");
    }
    const arrays = [
      output.dataShows,
      output.needsInvestigation,
      output.operationalPriorities,
      output.limitations
    ];
    if (arrays.some((value) => !Array.isArray(value))) {
      const fieldTypes = {
        dataShows: Array.isArray(output.dataShows) ? "array" : typeof output.dataShows,
        needsInvestigation: Array.isArray(output.needsInvestigation)
          ? "array"
          : typeof output.needsInvestigation,
        operationalPriorities: Array.isArray(output.operationalPriorities)
          ? "array"
          : typeof output.operationalPriorities,
        limitations: Array.isArray(output.limitations) ? "array" : typeof output.limitations
      };
      throw new Error(
        `Lemiex AI output has invalid array fields: ${JSON.stringify(fieldTypes)}`
      );
    }
    if (output.dataShows.length < 1 || output.dataShows.length > 4) {
      throw new Error("Lemiex AI dataShows must contain 1-4 items");
    }
    if (output.needsInvestigation.length > 4 || output.limitations.length > 4) {
      throw new Error("Lemiex AI output exceeds investigation or limitation limits");
    }
    if (output.operationalPriorities.length > 3) {
      throw new Error("Lemiex AI output exceeds priority limit");
    }
  }
}

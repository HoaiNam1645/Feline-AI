import { Body, Controller, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { recordRequestError } from "../observability/request-log";
import { OfficeDelegationService } from "./office-delegation.service";

@Controller("office")
export class OfficeController {
  constructor(private readonly office: OfficeDelegationService) {}

  @RequireAgentAccess({
    agentId: "ceo-ai",
    action: "run",
    capabilityId: "ceo.hr.ask",
    dataScopeIds: ["ceo.hr.knowledge"]
  })
  @Post("delegations/stream")
  async delegate(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @Res() response: Response
  ): Promise<void> {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-store, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    const send = (event: string, data: unknown) => {
      if (response.writableEnded || response.destroyed) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (response as Response & { flush?: () => void }).flush?.();
    };
    try {
      response.write(": office-stream-open\n\n");
      const result = await this.office.delegate(
        request.auth!,
        body,
        (stage, message) => send("stage", { stage, message })
      );
      send("result", result);
      send("done", { runId: result.runId });
    } catch (error) {
      recordRequestError(request, error);
      send("error", {
        message: error instanceof Error ? error.message : "Không thể hoàn tất yêu cầu liên công ty"
      });
    } finally {
      response.end();
    }
  }
}

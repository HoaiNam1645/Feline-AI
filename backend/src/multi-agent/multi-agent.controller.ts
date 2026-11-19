import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { MultiAgentOrchestratorService } from "./multi-agent-orchestrator.service";

const VIEW_ACCESS = { agentId: "ceo-ai", action: "view" as const };
const RUN_ACCESS = { agentId: "ceo-ai", action: "run" as const };

@Controller("multi-agent")
export class MultiAgentController {
  constructor(private readonly orchestrator: MultiAgentOrchestratorService) {}

  @RequireAgentAccess(VIEW_ACCESS)
  @Get("conversations")
  list(@Req() request: AuthenticatedRequest) {
    return this.orchestrator.listConversations(request.auth!.user.id);
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Post("conversations")
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.orchestrator.createConversation(request.auth!.user.id, body.title);
  }

  @RequireAgentAccess(VIEW_ACCESS)
  @Get("conversations/:id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.orchestrator.getConversation(request.auth!.user.id, id);
  }

  @RequireAgentAccess(RUN_ACCESS)
  @Post("conversations/:id/messages/stream")
  async stream(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Res() response: Response
  ): Promise<void> {
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    const abortController = new AbortController();
    request.on("close", () => abortController.abort());
    const send = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      response.write(": multi-agent-stream-open\n\n");
      await this.orchestrator.answer(
        {
          id: request.auth!.user.id,
          role: request.auth!.user.role,
          departmentCode: request.auth!.user.departmentCode,
          access: request.auth!.access
        },
        id,
        body,
        abortController.signal,
        (event) => send(event.type, event)
      );
      response.end();
    } catch (error) {
      if (!response.writableEnded) {
        send("error", { message: error instanceof Error ? error.message : "Không thể hoàn tất cuộc họp AI" });
        response.end();
      }
    }
  }
}

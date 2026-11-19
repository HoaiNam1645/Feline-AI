import { Body, Controller, Delete, Get, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Response } from "express";
import { RequireAgentAccess } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { recordRequestError } from "../observability/request-log";
import { AccountingChatService } from "./accounting-chat.service";

const VIEW_ACCESS = { agentId: "accounting-ai", action: "view" as const };
const RUN_ACCESS = { agentId: "accounting-ai", action: "run" as const };

@Controller("chat/accounting")
export class AccountingChatController {
  constructor(private readonly chat: AccountingChatService) {}

  @RequireAgentAccess(VIEW_ACCESS) @Get("conversations")
  list(@Req() request: AuthenticatedRequest) { return this.chat.listConversations(request.auth!.user.id); }

  @RequireAgentAccess(VIEW_ACCESS) @Post("conversations")
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) { return this.chat.createConversation(request.auth!.user.id, body.title); }

  @RequireAgentAccess(VIEW_ACCESS) @Get("conversations/:id")
  get(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.chat.getConversation(request.auth!.user.id, id, request.auth!.user.role === UserRole.ADMIN); }

  @RequireAgentAccess(VIEW_ACCESS) @Patch("conversations/:id")
  rename(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>) { return this.chat.renameConversation(request.auth!.user.id, id, body.title); }

  @RequireAgentAccess(VIEW_ACCESS) @Delete("conversations/:id")
  remove(@Req() request: AuthenticatedRequest, @Param("id") id: string) { return this.chat.deleteConversation(request.auth!.user.id, id); }

  @RequireAgentAccess(RUN_ACCESS) @Post("conversations/:id/messages/stream")
  async stream(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: Record<string, unknown>, @Res() response: Response): Promise<void> {
    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-store, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders();
    const abortController = new AbortController();
    response.on("close", () => abortController.abort());
    const send = (event: string, data: unknown) => {
      if (response.writableEnded || response.destroyed) return;
      response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      (response as Response & { flush?: () => void }).flush?.();
    };
    try {
      let streamedLength = 0;
      response.write(": stream-open\n\n");
      send("status", { message: "Kế toán AI đang đối chiếu dữ liệu và tài liệu phù hợp..." });
      const result = await this.chat.answer(
        { id: request.auth!.user.id, role: request.auth!.user.role, departmentCode: request.auth!.user.departmentCode, access: request.auth!.access },
        id,
        body,
        abortController.signal,
        request.auth!.user.role === UserRole.ADMIN,
        (text) => { streamedLength += text.length; send("delta", { text }); }
      );
      send("meta", { userMessage: result.userMessage, assistantMessageId: result.assistantMessage.id, runId: result.runId, sources: result.output.sources });
      if (streamedLength === 0) send("delta", { text: result.output.markdown });
      send("done", { assistantMessage: result.assistantMessage });
    } catch (error) {
      recordRequestError(request, error);
      if (!abortController.signal.aborted) send("error", { message: error instanceof Error ? error.message : "Không thể hoàn tất câu trả lời" });
    } finally {
      response.end();
    }
  }
}

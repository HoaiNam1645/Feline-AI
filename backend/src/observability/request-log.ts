import { randomUUID } from "node:crypto";
import { Request } from "express";

export interface RequestLogError {
  name: string;
  code: string | null;
  message: string;
  stack: string | null;
}

export interface RequestLogContext {
  requestId: string;
  startedAtMs: number;
  error?: RequestLogError;
}

export type LoggedRequest = Request & { requestLog?: RequestLogContext };

export function initializeRequestLog(request: LoggedRequest): RequestLogContext {
  const context = { requestId: randomUUID(), startedAtMs: Date.now() };
  request.requestLog = context;
  return context;
}

export function recordRequestError(request: LoggedRequest, error: unknown): void {
  const context = request.requestLog || initializeRequestLog(request);
  const candidate = error as { name?: unknown; code?: unknown; message?: unknown; stack?: unknown };
  context.error = {
    name: typeof candidate?.name === "string" ? candidate.name.slice(0, 200) : "UnknownError",
    code: typeof candidate?.code === "string" || typeof candidate?.code === "number"
      ? String(candidate.code).slice(0, 100)
      : null,
    message: error instanceof Error
      ? error.message.slice(0, 2000)
      : String(error ?? "Unknown error").slice(0, 2000),
    stack: typeof candidate?.stack === "string" ? candidate.stack.slice(0, 8000) : null
  };
}

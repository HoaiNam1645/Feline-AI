import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Response } from "express";
import { requestMetadata } from "../auth/auth-http";
import { AuthenticatedRequest } from "../auth/access.guard";
import { PrismaService } from "../database/prisma.service";
import { initializeRequestLog, LoggedRequest } from "./request-log";

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  use(request: LoggedRequest & AuthenticatedRequest, response: Response, next: () => void): void {
    const context = initializeRequestLog(request);
    response.setHeader("X-Request-Id", context.requestId);
    let persisted = false;

    const persist = (aborted: boolean) => {
      if (persisted) return;
      persisted = true;
      const metadata = requestMetadata(request);
      const routePath = request.route?.path;
      const statusCode = aborted && response.statusCode < 400 ? 499 : response.statusCode;

      if (context.error || statusCode >= 500) {
        this.logger.error(JSON.stringify({
          requestId: context.requestId,
          method: request.method,
          path: request.path,
          statusCode,
          durationMs: Math.max(0, Date.now() - context.startedAtMs),
          errorName: context.error?.name || null,
          errorCode: context.error?.code || null,
          errorMessage: context.error?.message || null
        }));
      }

      void this.prisma.httpRequestLog.create({
        data: {
          requestId: context.requestId,
          method: request.method.slice(0, 16),
          path: request.path.slice(0, 1000),
          routePath: typeof routePath === "string" ? routePath.slice(0, 1000) : null,
          statusCode,
          durationMs: Math.max(0, Date.now() - context.startedAtMs),
          userId: request.auth?.user.id || null,
          userRole: request.auth?.user.role || null,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          errorName: context.error?.name || (statusCode >= 400 ? "HttpRequestError" : null),
          errorCode: context.error?.code || (statusCode >= 400 ? String(statusCode) : null),
          errorMessage: context.error?.message || null,
          errorStack: context.error?.stack || null
        }
      }).catch((error: unknown) => {
        this.logger.error(
          `Không thể lưu HTTP request log ${context.requestId}: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    };

    response.once("finish", () => persist(false));
    response.once("close", () => persist(!response.writableEnded));
    next();
  }
}

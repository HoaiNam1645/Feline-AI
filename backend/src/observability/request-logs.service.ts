import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";

@Injectable()
export class RequestLogsService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: Record<string, unknown>) {
    const requestedLimit = Number(query.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(200, Math.max(1, Math.trunc(requestedLimit)))
      : 50;
    const statusCode = Number(query.statusCode);
    const onlyErrors = query.onlyErrors === true || query.onlyErrors === "true";
    const requestId = typeof query.requestId === "string" ? query.requestId.trim() : "";

    return this.prisma.httpRequestLog.findMany({
      where: {
        ...(requestId ? { requestId } : {}),
        ...(Number.isInteger(statusCode) ? { statusCode } : {}),
        ...(onlyErrors ? {
          OR: [
            { statusCode: { gte: 400 } },
            { errorName: { not: null } }
          ]
        } : {})
      },
      orderBy: { createdAt: "desc" },
      take: limit
    });
  }
}

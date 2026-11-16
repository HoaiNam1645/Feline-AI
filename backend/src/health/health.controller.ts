import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { Public } from "../auth/access-control";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health(): Promise<Record<string, unknown>> {
    await this.prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      service: "feline-ai-api",
      timestamp: new Date().toISOString()
    };
  }
}

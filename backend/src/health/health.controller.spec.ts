import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller";
import { PrismaService } from "../database/prisma.service";

describe("HealthController", () => {
  it("returns ok when PostgreSQL is reachable", async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) }
        }
      ]
    }).compile();

    const result = await module.get(HealthController).health();
    expect(result.status).toBe("ok");
  });
});

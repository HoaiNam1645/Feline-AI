import { BadRequestException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { EtsyDashboardService } from "./etsy-dashboard.service";

describe("EtsyDashboardService", () => {
  const source = { dashboard: jest.fn().mockResolvedValue({ report: {} }) };
  const scopes = { fromActor: jest.fn((_actor, requested) => requested) };
  const service = new EtsyDashboardService(source as never, scopes as never);
  const actor = { role: UserRole.ADMIN, access: { platformAdmin: true, grants: [] } };

  beforeEach(() => jest.clearAllMocks());

  it("validates and forwards deterministic filters", async () => {
    const filters = { sellerTeamIds: ["t1"], shopIds: [], sellerIds: [] };
    await service.get(actor, "2026-11-01", "2026-11-17", filters);
    expect(scopes.fromActor).toHaveBeenCalledWith(actor, filters);
    expect(source.dashboard).toHaveBeenCalledWith("2026-11-01", "2026-11-17", filters);
  });

  it("rejects invalid or excessive ranges before calling the source", () => {
    expect(() => service.get(actor, "2026-11-17", "2026-11-01", { sellerTeamIds: [], shopIds: [], sellerIds: [] })).toThrow(BadRequestException);
    expect(() => service.get(actor, "2025-01-01", "2026-11-17", { sellerTeamIds: [], shopIds: [], sellerIds: [] })).toThrow(BadRequestException);
    expect(source.dashboard).not.toHaveBeenCalled();
  });
});

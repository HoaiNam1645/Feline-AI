import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { EtsyScopeService } from "./etsy-scope.service";

describe("EtsyScopeService", () => {
  const service = new EtsyScopeService();
  const requested = { sellerTeamIds: [], shopIds: [], sellerIds: [] };

  it("keeps requested filters unrestricted for admin", () => {
    expect(service.fromActor({ role: UserRole.ADMIN, access: { platformAdmin: true, grants: [] } }, { ...requested, shopIds: ["shop-1"] }))
      .toEqual({ ...requested, shopIds: ["shop-1"] });
  });

  it("forwards only the granted row scopes", () => {
    const result = service.fromActor({
      role: UserRole.MANAGER,
      access: { platformAdmin: false, grants: [{ id: "g1", agentId: "etsy-ai", actions: ["view"], capabilityIds: ["etsy.data.ask"], dataScopeIds: ["etsy.team:t1", "etsy.shop:s1"], expiresAt: null }] }
    }, requested);
    expect(result).toEqual({ sellerTeamIds: ["t1"], shopIds: ["s1"], sellerIds: [] });
  });

  it("does not treat Etsy knowledge access as data access", () => {
    expect(() => service.fromActor({
      role: UserRole.USER,
      access: { platformAdmin: false, grants: [{ id: "g1", agentId: "etsy-ai", actions: ["view"], capabilityIds: ["etsy.knowledge.ask"], dataScopeIds: ["etsy.knowledge"], expiresAt: null }] }
    }, requested)).toThrow(ForbiddenException);
  });
});

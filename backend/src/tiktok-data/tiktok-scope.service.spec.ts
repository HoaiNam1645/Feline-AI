import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { TiktokScopeService } from "./tiktok-scope.service";

describe("TiktokScopeService", () => {
  const service = new TiktokScopeService();

  it("không cho quyền overview mở ngầm dữ liệu finance", () => {
    const scope = service.fromActor({
      role: UserRole.USER,
      access: {
        platformAdmin: false,
        grants: [{
          id: "grant-1", agentId: "tiktok-ai", capabilityIds: ["tiktok.data.ask"],
          dataScopeIds: ["tiktok.data.overview", "tiktok.user:12"], actions: ["view", "run"], expiresAt: null
        }]
      }
    });
    expect(() => service.assertDomain(scope, "overview")).not.toThrow();
    expect(() => service.assertDomain(scope, "finance")).toThrow(ForbiddenException);
  });

  it("tạo predicate giới hạn theo user thay vì mở toàn bộ", () => {
    const predicate = service.orderPredicate({
      unrestricted: false, domains: ["orders"], teamIds: [], storeIds: [], userIds: [12]
    });
    expect(predicate.sql).toContain("o.user_id IN (?)");
    expect(predicate.params).toEqual([12]);
  });
});

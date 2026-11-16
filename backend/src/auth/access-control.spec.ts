import { AccessProfile, hasAgentAccess } from "./access-control";

const scopedProfile: AccessProfile = {
  platformAdmin: false,
  grants: [{
    id: "grant-1",
    agentId: "lemiex-ai",
    capabilityIds: ["lemiex.operations.daily-review"],
    dataScopeIds: ["lemiex.operations.basic"],
    actions: ["view", "run"],
    expiresAt: null
  }]
};

describe("hasAgentAccess", () => {
  it("allows Admin without an explicit grant", () => {
    expect(hasAgentAccess({ platformAdmin: true, grants: [] }, {
      agentId: "lemiex-ai",
      action: "manage_platform"
    })).toBe(true);
  });

  it("requires agent, action, capability and every requested data scope", () => {
    expect(hasAgentAccess(scopedProfile, {
      agentId: "lemiex-ai",
      action: "run",
      dataScopeIds: ["lemiex.operations.basic"]
    }, "lemiex.operations.daily-review")).toBe(true);

    expect(hasAgentAccess(scopedProfile, {
      agentId: "lemiex-ai",
      action: "run",
      dataScopeIds: ["lemiex.operations.costs"]
    }, "lemiex.operations.daily-review")).toBe(false);
  });

  it("denies a capability or action outside the grant", () => {
    expect(hasAgentAccess(scopedProfile, {
      agentId: "lemiex-ai",
      action: "run"
    }, "lemiex.operations.backlog-investigation")).toBe(false);
    expect(hasAgentAccess(scopedProfile, {
      agentId: "lemiex-ai",
      action: "view_audit"
    })).toBe(false);
  });
});

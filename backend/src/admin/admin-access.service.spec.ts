import { AdminAccessService } from "./admin-access.service";

function serviceFor(role: "ADMIN" | "MANAGER" | "USER" = "USER") {
  const prisma = {
    user: {
      findUnique: jest.fn(async () => ({
        id: "user-1",
        role,
        status: "ACTIVE",
        displayName: "Test User"
      }))
    },
    dataScope: {
      findMany: jest.fn(async () => [{ id: "lemiex.operations.basic" }])
    },
    agentAccessGrant: {
      findFirst: jest.fn(async () => null)
    },
    $transaction: jest.fn()
  };
  return { prisma, service: new AdminAccessService(prisma as never) };
}

const metadata = { ipAddress: "127.0.0.1", userAgent: "jest" };

describe("AdminAccessService grant validation", () => {
  it("rejects platform administration actions for Manager", async () => {
    const { service, prisma } = serviceFor("MANAGER");
    await expect(service.createGrant({
      userId: "user-1",
      agentId: "lemiex-ai",
      capabilityIds: [],
      dataScopeIds: ["lemiex.operations.basic"],
      actions: ["manage_platform"]
    }, "admin-1", metadata)).rejects.toThrow("không được cấp");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("requires a capability when run access is selected", async () => {
    const { service } = serviceFor("USER");
    await expect(service.createGrant({
      userId: "user-1",
      agentId: "lemiex-ai",
      capabilityIds: [],
      dataScopeIds: ["lemiex.operations.basic"],
      actions: ["view", "run"]
    }, "admin-1", metadata)).rejects.toThrow("ít nhất một capability");
  });

  it("does not create redundant grants for Admin", async () => {
    const { service } = serviceFor("ADMIN");
    await expect(service.createGrant({
      userId: "user-1",
      agentId: "lemiex-ai",
      capabilityIds: [],
      dataScopeIds: [],
      actions: ["view"]
    }, "admin-1", metadata)).rejects.toThrow("Admin không cần");
  });
});

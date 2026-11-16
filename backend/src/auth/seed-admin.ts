import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { hash } from "bcryptjs";
import { assertValidPassword, normalizeEmail } from "./auth.constants";

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const email = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL);
    const displayName = String(process.env.INITIAL_ADMIN_DISPLAY_NAME || "Feline AI Admin").trim();
    const password = process.env.INITIAL_ADMIN_PASSWORD;
    if (!email || !email.includes("@")) throw new Error("INITIAL_ADMIN_EMAIL không hợp lệ");
    if (!displayName) throw new Error("INITIAL_ADMIN_DISPLAY_NAME không hợp lệ");
    assertValidPassword(password);

    const existingAdmin = await prisma.user.findFirst({ where: { role: UserRole.ADMIN } });
    if (existingAdmin) {
      console.log(`Admin đã tồn tại: ${existingAdmin.email}`);
      return;
    }
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new Error("Email seed đã thuộc một tài khoản không phải Admin");

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE
      }
    });
    await prisma.accessAuditEvent.create({
      data: {
        actorUserId: user.id,
        eventType: "INITIAL_ADMIN_CREATED",
        targetType: "User",
        targetId: user.id,
        detail: { source: "auth:seed-admin" }
      }
    });
    console.log(`Đã tạo Admin đầu tiên: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

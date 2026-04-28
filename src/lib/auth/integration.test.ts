// Integration test — exercises the full auth pipeline against the real DB.
// Skipped if DATABASE_URL is missing or still the placeholder, so CI without
// secrets stays green. Cleans up the test user it inserts.

import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "./password";
import { encryptSession, decryptSession } from "./session";

const url = process.env.DATABASE_URL ?? "";
const dbAvailable =
  url.startsWith("postgresql://") && !url.includes("USER:PASSWORD");

describe.skipIf(!dbAvailable)("auth integration with real DB", () => {
  const testEmail = `m0-test-${Date.now()}@example.invalid`;

  afterAll(async () => {
    await prisma.user
      .deleteMany({ where: { email: testEmail } })
      .catch(() => {});
    await prisma.$disconnect();
  });

  it("full pipeline: hash → create user → query → verify password → JWT roundtrip", async () => {
    const plain = "test_password_with_enough_length_123";
    const hash = await hashPassword(plain);

    const created = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hash,
        name: "M0 Integration Test",
        role: "CUSTOMER",
      },
    });

    expect(created.id).toBeTruthy();
    expect(created.role).toBe("CUSTOMER");
    expect(created.locale).toBe("ko"); // default per schema

    const fetched = await prisma.user.findUnique({
      where: { id: created.id },
    });
    expect(fetched).toBeTruthy();
    expect(fetched!.passwordHash).toBeTruthy();

    expect(await verifyPassword(plain, fetched!.passwordHash!)).toBe(true);
    expect(await verifyPassword("wrong-password", fetched!.passwordHash!)).toBe(
      false,
    );

    const token = await encryptSession({
      userId: created.id,
      role: created.role,
    });
    const decoded = await decryptSession(token);
    expect(decoded?.userId).toBe(created.id);
    expect(decoded?.role).toBe("CUSTOMER");
  });

  it("rejects duplicate email (unique constraint)", async () => {
    const dupEmail = `m0-dup-${Date.now()}@example.invalid`;
    const hash = await hashPassword("pwd_long_enough_1234");

    await prisma.user.create({
      data: { email: dupEmail, passwordHash: hash, name: "First", role: "CUSTOMER" },
    });

    await expect(
      prisma.user.create({
        data: { email: dupEmail, passwordHash: hash, name: "Second", role: "CUSTOMER" },
      }),
    ).rejects.toThrow();

    // cleanup
    await prisma.user.deleteMany({ where: { email: dupEmail } });
  });
});

// Auth integration test — exercises password + session against the real Neon DB
// in the multi-tenant schema (Business + scoped User).

import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "./password";
import { encryptSession, decryptSession } from "./session";

const url = process.env.DATABASE_URL ?? "";
const dbAvailable =
  url.startsWith("postgresql://") && !url.includes("USER:PASSWORD");

const RUN = `m1auth-${Date.now()}`;

describe.skipIf(!dbAvailable)("auth integration in multi-tenant schema", () => {
  let cityId = "";
  let barangayId = "";
  let businessId = "";

  afterAll(async () => {
    if (businessId)
      await prisma.business
        .deleteMany({ where: { id: businessId } })
        .catch(() => {});
    if (barangayId)
      await prisma.barangay
        .deleteMany({ where: { id: barangayId } })
        .catch(() => {});
    if (cityId)
      await prisma.city.deleteMany({ where: { id: cityId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("hash → tenant user create → query → verify password → JWT roundtrip", async () => {
    const city = await prisma.city.create({
      data: { psgcCode: `${RUN}-city`, name: `${RUN}-city` },
    });
    cityId = city.id;
    const barangay = await prisma.barangay.create({
      data: { psgcCode: `${RUN}-brgy`, name: `${RUN}-brgy`, cityId },
    });
    barangayId = barangay.id;

    const business = await prisma.business.create({
      data: { slug: `${RUN}-gym`, name: "Test Gym", cityId, barangayId },
    });
    businessId = business.id;

    const plain = "test_password_long_enough_123";
    const hash = await hashPassword(plain);

    const owner = await prisma.user.create({
      data: {
        gymId: business.id,
        email: `${RUN}@example.invalid`,
        passwordHash: hash,
        name: "Test Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    });

    expect(owner.id).toBeTruthy();
    expect(owner.role).toBe("OWNER");
    expect(owner.gymId).toBe(business.id);

    const fetched = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(fetched).toBeTruthy();
    expect(await verifyPassword(plain, fetched!.passwordHash!)).toBe(true);
    expect(await verifyPassword("wrong-password", fetched!.passwordHash!)).toBe(
      false,
    );

    const token = await encryptSession({ userId: owner.id, role: owner.role });
    const decoded = await decryptSession(token);
    expect(decoded?.userId).toBe(owner.id);
    expect(decoded?.role).toBe("OWNER");
  });
});

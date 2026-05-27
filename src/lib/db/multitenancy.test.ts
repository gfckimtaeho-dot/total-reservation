// Multi-tenancy schema verification — runs against the real Neon dev DB.
// Covers the spec's load-bearing rules after M2 (loginId 통일):
//   1. email is a contact channel, NOT an identifier — duplicate emails are
//      allowed both across gyms and within a single gym.
//   2. (loginId, gymId) composite unique blocks duplicate loginIds within a gym
//      (loginId is the real identifier post-M2).
//   3. Partial unique on email WHERE gymId IS NULL blocks two admins sharing
//      an email (ADMIN account model still treats email as identifier).
//   4. Cross-gym data is invisible to a per-gym scoped query.
//
// Skipped if DATABASE_URL is missing or still the placeholder (CI safety).
// Each test creates its data with a unique slug suffix and tears it down afterwards.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/client";

const url = process.env.DATABASE_URL ?? "";
const dbAvailable =
  url.startsWith("postgresql://") && !url.includes("USER:PASSWORD");

const RUN = `m1iso-${Date.now()}`;

const createdBusinessIds: string[] = [];
const createdAdminEmails: string[] = [];

async function makeCity() {
  return prisma.city.create({
    data: {
      psgcCode: `${RUN}-cityCode`,
      name: `${RUN}-city`,
    },
  });
}

async function makeBarangay(cityId: string) {
  return prisma.barangay.create({
    data: {
      psgcCode: `${RUN}-brgyCode`,
      name: `${RUN}-brgy`,
      cityId,
    },
  });
}

async function makeBusiness(slug: string, cityId: string, barangayId: string) {
  const b = await prisma.business.create({
    data: {
      slug,
      name: `${slug} Gym`,
      cityId,
      barangayId,
    },
  });
  createdBusinessIds.push(b.id);
  return b;
}

describe.skipIf(!dbAvailable)("multi-tenancy isolation", () => {
  let cityId: string;
  let barangayId: string;

  beforeAll(async () => {
    const city = await makeCity();
    cityId = city.id;
    const brgy = await makeBarangay(city.id);
    barangayId = brgy.id;
  });

  afterAll(async () => {
    // Cascade deletes from Business handle most domain rows.
    if (createdBusinessIds.length) {
      await prisma.business
        .deleteMany({ where: { id: { in: createdBusinessIds } } })
        .catch(() => {});
    }
    if (createdAdminEmails.length) {
      await prisma.user
        .deleteMany({ where: { email: { in: createdAdminEmails } } })
        .catch(() => {});
    }
    await prisma.barangay.deleteMany({ where: { id: barangayId } }).catch(() => {});
    await prisma.city.deleteMany({ where: { id: cityId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("allows the same email under two different gyms", async () => {
    const email = `${RUN}-sameemail@example.invalid`;
    const a = await makeBusiness(`${RUN}-a`, cityId, barangayId);
    const b = await makeBusiness(`${RUN}-b`, cityId, barangayId);

    const userA = await prisma.user.create({
      data: { email, name: "Alice@A", gymId: a.id, role: "CUSTOMER", status: "ACTIVE" },
    });
    const userB = await prisma.user.create({
      data: { email, name: "Alice@B", gymId: b.id, role: "CUSTOMER", status: "ACTIVE" },
    });

    expect(userA.id).not.toBe(userB.id);
    expect(userA.gymId).toBe(a.id);
    expect(userB.gymId).toBe(b.id);
  });

  it("allows duplicate email within the same gym (M2: email is a channel, not identifier)", async () => {
    const email = `${RUN}-shared@example.invalid`;
    const a = await makeBusiness(`${RUN}-c`, cityId, barangayId);

    const first = await prisma.user.create({
      data: {
        email,
        name: "First",
        gymId: a.id,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const second = await prisma.user.create({
      data: {
        email,
        name: "Second",
        gymId: a.id,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });

    expect(first.id).not.toBe(second.id);
    expect(first.email).toBe(email);
    expect(second.email).toBe(email);
  });

  it("blocks duplicate (loginId, gymId)", async () => {
    const loginId = `${RUN}-loginid`;
    const a = await makeBusiness(`${RUN}-c2`, cityId, barangayId);

    await prisma.user.create({
      data: {
        loginId,
        name: "First",
        gymId: a.id,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    await expect(
      prisma.user.create({
        data: {
          loginId,
          name: "Second",
          gymId: a.id,
          role: "CUSTOMER",
          status: "ACTIVE",
        },
      }),
    ).rejects.toThrow();
  });

  it("allows the same loginId on two different gyms", async () => {
    const loginId = `${RUN}-cross-loginid`;
    const a = await makeBusiness(`${RUN}-c3`, cityId, barangayId);
    const b = await makeBusiness(`${RUN}-c4`, cityId, barangayId);

    const userA = await prisma.user.create({
      data: {
        loginId,
        name: "User on A",
        gymId: a.id,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });
    const userB = await prisma.user.create({
      data: {
        loginId,
        name: "User on B",
        gymId: b.id,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });

    expect(userA.id).not.toBe(userB.id);
    expect(userA.gymId).toBe(a.id);
    expect(userB.gymId).toBe(b.id);
  });

  it("blocks two admins (gymId NULL) sharing an email — partial unique", async () => {
    const email = `${RUN}-admin@example.invalid`;
    createdAdminEmails.push(email);

    await prisma.user.create({
      data: { email, name: "Admin 1", gymId: null, role: "ADMIN", status: "ACTIVE" },
    });
    await expect(
      prisma.user.create({
        data: { email, name: "Admin 2", gymId: null, role: "ADMIN", status: "ACTIVE" },
      }),
    ).rejects.toThrow();
  });

  it("scoped query hides other gyms' data", async () => {
    const a = await makeBusiness(`${RUN}-d`, cityId, barangayId);
    const b = await makeBusiness(`${RUN}-e`, cityId, barangayId);

    await prisma.service.create({
      data: {
        gymId: a.id,
        name: "PT (gym A)",
        capacity: 1,
        timeUnit: "M60",
        durationMin: 60,
        pricePhp: 1000,
      },
    });
    await prisma.service.create({
      data: {
        gymId: b.id,
        name: "PT (gym B)",
        capacity: 1,
        timeUnit: "M60",
        durationMin: 60,
        pricePhp: 1500,
      },
    });

    const aServices = await prisma.service.findMany({ where: { gymId: a.id } });
    const bServices = await prisma.service.findMany({ where: { gymId: b.id } });

    expect(aServices).toHaveLength(1);
    expect(bServices).toHaveLength(1);
    expect(aServices[0].name).toBe("PT (gym A)");
    expect(bServices[0].name).toBe("PT (gym B)");

    // Symmetric absence — gym A scope must not surface gym B rows.
    expect(aServices.every((s) => s.gymId === a.id)).toBe(true);
    expect(bServices.every((s) => s.gymId === b.id)).toBe(true);
  });
});

import { describe, it, expect, beforeAll } from "vitest";
import { encryptSession, decryptSession } from "./session";

beforeAll(() => {
  process.env.AUTH_SECRET =
    "totally-not-a-real-secret-but-long-enough-for-tests-to-pass-padding";
});

describe("session JWT roundtrip", () => {
  it("encrypts and decrypts a session payload", async () => {
    const payload = { userId: "user_abc123", role: "CUSTOMER" as const };
    const token = await encryptSession(payload);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const decoded = await decryptSession(token);
    expect(decoded).toEqual(payload);
  });

  it("preserves multi-tenant role across encrypt/decrypt", async () => {
    const payload = { userId: "owner_xyz", role: "OWNER" as const };
    const token = await encryptSession(payload);
    const decoded = await decryptSession(token);
    expect(decoded?.role).toBe("OWNER");
  });

  it("preserves admin role (no gymId)", async () => {
    const payload = { userId: "admin_1", role: "ADMIN" as const };
    const token = await encryptSession(payload);
    const decoded = await decryptSession(token);
    expect(decoded?.role).toBe("ADMIN");
  });

  it("returns null for an invalid token", async () => {
    expect(await decryptSession("not.a.valid.token")).toBeNull();
  });

  it("returns null for undefined token (no cookie)", async () => {
    expect(await decryptSession(undefined)).toBeNull();
  });

  it("returns null for a tampered token", async () => {
    const token = await encryptSession({
      userId: "u1",
      role: "CUSTOMER",
    });
    const tampered = token.slice(0, -2) + "xx";
    expect(await decryptSession(tampered)).toBeNull();
  });
});

import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/generated/prisma/enums";

const SESSION_DURATION_DAYS = 7;
const ALGORITHM = "HS256";

export const SESSION_COOKIE_NAME = "session";

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
};

export interface SessionPayload {
  userId: string;
  role: Role;
}

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is not set. Generate with `openssl rand -base64 32` and put it in .env",
    );
  }
  return new TextEncoder().encode(secret);
}

export async function encryptSession(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ userId: payload.userId, role: payload.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret());
}

export async function decryptSession(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: [ALGORITHM],
    });
    return {
      userId: payload.userId as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

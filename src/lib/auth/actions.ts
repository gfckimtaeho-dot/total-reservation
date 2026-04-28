"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "./password";
import {
  encryptSession,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from "./session";
import type { Role } from "@/generated/prisma/enums";

const signupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1, "Name is required"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export type AuthState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
};

async function issueSession(userId: string, role: Role) {
  const token = await encryptSession({ userId, role });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
}

async function signupWithRole(
  formData: FormData,
  role: Role,
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return { message: "Email already in use" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await prisma.user.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
      role,
    },
  });

  await issueSession(user.id, user.role);
  return {};
}

export async function signupCustomer(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = await signupWithRole(formData, "CUSTOMER");
  if (result.errors || result.message) return result;
  redirect("/customer");
}

export async function signupBusinessOwner(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const result = await signupWithRole(formData, "BUSINESS_OWNER");
  if (result.errors || result.message) return result;
  redirect("/business/dashboard");
}

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user || !user.passwordHash) {
    return { message: "Invalid email or password" };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { message: "Invalid email or password" };
  }

  await issueSession(user.id, user.role);

  const isBusiness = user.role === "BUSINESS_OWNER" || user.role === "STAFF";
  redirect(isBusiness ? "/business/dashboard" : "/customer");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}

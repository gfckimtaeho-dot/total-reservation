"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/dal";

const blockSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, "차단 사유를 입력해 주세요").max(500),
});

export type BlockState = {
  errors?: Record<string, string[] | undefined>;
  message?: string;
  ok?: boolean;
};

export async function blockBusiness(
  _prev: BlockState,
  formData: FormData,
): Promise<BlockState> {
  await requireAdmin();
  const parsed = blockSchema.safeParse({
    id: formData.get("id"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >,
    };
  }
  const existing = await prisma.business.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, status: true },
  });
  if (!existing) return { message: "매장을 찾을 수 없습니다." };
  if (existing.status === "BLOCKED") {
    return { message: "이미 차단된 매장입니다." };
  }

  await prisma.business.update({
    where: { id: parsed.data.id },
    data: {
      status: "BLOCKED",
      blockedReason: parsed.data.reason,
    },
  });
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${parsed.data.id}`);
  return { ok: true };
}

export async function unblockBusiness(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const existing = await prisma.business.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return;
  if (existing.status !== "BLOCKED") return;

  // 재활성화는 ACTIVE 로. 구독 만료/유예 자동 분기는 별도 task (#4 구독 관리).
  // 사유 메모는 영구 audit 차원에서 그대로 둔다 (재활성화 후에도 추적 가능).
  await prisma.business.update({
    where: { id },
    data: { status: "ACTIVE" },
  });
  revalidatePath("/admin/businesses");
  revalidatePath(`/admin/businesses/${id}`);
  redirect(`/admin/businesses/${id}`);
}

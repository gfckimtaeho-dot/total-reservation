"use server";

import { prisma } from "@/lib/db/client";
import { requireGymStaff } from "@/lib/auth/dal";

// 완료된 PT 예약의 메모(운동 부위)를 사후에 편집. 캘린더 인라인 입력에서
// skip 했거나, 끝나고 다시 정확히 적고 싶을 때 my-clients 상세에서 사용.
//
// 규칙:
//  - 트레이너는 본인 담당 예약만, OWNER/MANAGER 는 전체.
//  - 완료된 예약만(COMPLETED) — 미완료/취소 예약 메모 수정은 의미 없음.
//  - 빈 문자열 = null 로 저장 (메모 제거).
//  - 80 자 cap (placeholder 가 짧은 라벨 유도하지만 안전망).

type R = { ok: true } | { ok: false; error: string };

export async function updateReservationNote(input: {
  slug: string;
  reservationId: string;
  note: string;
}): Promise<R> {
  const auth = await requireGymStaff(input.slug);
  const gymId = auth.business!.id;

  const res = await prisma.reservation.findFirst({
    where: { id: input.reservationId, gymId },
    select: { id: true, staffId: true, status: true },
  });
  if (!res) return { ok: false, error: "예약을 찾을 수 없습니다" };

  if (auth.role !== "OWNER" && auth.role !== "MANAGER") {
    const staff = await prisma.staff.findFirst({
      where: { userId: auth.id, gymId },
      select: { id: true },
    });
    if (!staff || staff.id !== res.staffId) {
      return { ok: false, error: "본인 예약만 수정할 수 있습니다" };
    }
  }

  if (res.status !== "COMPLETED") {
    return { ok: false, error: "완료된 예약만 메모를 수정할 수 있습니다" };
  }

  const note = input.note.trim();
  const cappedNote = note.length > 80 ? note.slice(0, 80) : note;

  await prisma.reservation.update({
    where: { id: input.reservationId },
    data: { completionNote: cappedNote || null },
  });

  return { ok: true };
}

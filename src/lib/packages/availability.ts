import { prisma } from "@/lib/db/client";

// 권(Package) 초과 예약 방지 헬퍼.
//
// 배경: Package.remainingCount 는 "수업 완료" 시점에만 차감된다. 예약을 거는
// 순간에는 줄지 않으므로, remainingCount 만 보면 보유 횟수보다 많은 예약을
// 잡을 수 있다(5회권으로 10건 예약 등). 아직 완료 전인 PENDING/CONFIRMED
// 예약들이 장차 소진할 몫(예약 수 x 회당 차감)을 미리 빼야 막을 수 있다.
//
//   가용 = remainingCount - (미완료 예약 수 x deductCount)
//
// 새 예약 1건은 deductCount 만큼 소비하므로 가용 >= deductCount 여야 허용.

// 완료 전이라 장차 잔여를 깎을(소진 예정) 예약 상태.
const OPEN_STATUSES = ["PENDING_PAYMENT", "CONFIRMED"] as const;

// 권 1장의 현재 가용 횟수 — 미완료 예약의 소진 예정분을 차감한 값.
export async function packageAvailableCount(
  packageId: string,
  remainingCount: number,
  deductCount: number,
): Promise<number> {
  const open = await prisma.reservation.count({
    where: { packageId, status: { in: [...OPEN_STATUSES] } },
  });
  return remainingCount - open * deductCount;
}

// 사용자가 그 서비스로 보유한 권 중 "지금 1건 더 예약할 여유가 있는"
// 가장 오래된 권(FIFO)을 고른다. 잔여는 있으나 미완료 예약으로 모두
// 선점된 권은 건너뛴다. 여유 있는 권이 하나도 없으면 null.
export async function pickBookablePackage(
  gymId: string,
  userId: string,
  serviceId: string,
  deductCount: number,
): Promise<{ id: string } | null> {
  const pkgs = await prisma.package.findMany({
    where: { gymId, userId, serviceId, remainingCount: { gt: 0 } },
    orderBy: { createdAt: "asc" },
    select: { id: true, remainingCount: true },
  });
  if (pkgs.length === 0) return null;

  // 후보 권들의 미완료 예약 수를 한 번에 집계(권당 N+1 쿼리 회피).
  const grouped = await prisma.reservation.groupBy({
    by: ["packageId"],
    where: {
      packageId: { in: pkgs.map((p) => p.id) },
      status: { in: [...OPEN_STATUSES] },
    },
    _count: { _all: true },
  });
  const openByPkg = new Map(
    grouped.map((g) => [g.packageId, g._count._all]),
  );

  for (const p of pkgs) {
    const committed = (openByPkg.get(p.id) ?? 0) * deductCount;
    if (p.remainingCount - committed >= deductCount) {
      return { id: p.id };
    }
  }
  return null;
}

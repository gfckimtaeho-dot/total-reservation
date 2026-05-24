import { MeLoadingShell } from "../../../_loading/MeLoadingShell";

// /me/reservations/[id]/move — 예약 이동 흐름. 카드 2개 골격.
export default function MoveLoading() {
  return <MeLoadingShell rows={2} />;
}

import { MeLoadingShell } from "../../_loading/MeLoadingShell";

// /me/reservations/new — 권 정보 카드 + 슬롯 picker. 카드 2개 골격.
export default function NewReservationLoading() {
  return <MeLoadingShell rows={2} />;
}

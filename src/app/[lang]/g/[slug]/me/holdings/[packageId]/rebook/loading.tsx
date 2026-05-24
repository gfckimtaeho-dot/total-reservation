import { MeLoadingShell } from "../../../_loading/MeLoadingShell";

// /me/holdings/[packageId]/rebook — 충돌 건 재예약. 카드 3개 골격.
export default function RebookLoading() {
  return <MeLoadingShell rows={3} />;
}

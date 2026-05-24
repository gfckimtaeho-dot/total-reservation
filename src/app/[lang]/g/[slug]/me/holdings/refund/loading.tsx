import { MeLoadingShell } from "../../_loading/MeLoadingShell";

// /me/holdings/refund — 환불 신청 컨펌 화면. 카드 2개 골격.
export default function RefundLoading() {
  return <MeLoadingShell rows={2} />;
}

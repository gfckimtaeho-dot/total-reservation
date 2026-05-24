import { MeLoadingShell } from "../../../_loading/MeLoadingShell";

// /me/holdings/[packageId]/trainer — 트레이너 선택 목록. 카드 3개 골격.
export default function TrainerLoading() {
  return <MeLoadingShell rows={3} />;
}

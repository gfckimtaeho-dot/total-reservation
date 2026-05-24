import { MeLoadingShell } from "./_loading/MeLoadingShell";

// /me 메인 — QR 큰 카드 + 오늘 일정 + CTA. 카드 3개 정도 골격.
export default function MeLoading() {
  return <MeLoadingShell rows={3} />;
}

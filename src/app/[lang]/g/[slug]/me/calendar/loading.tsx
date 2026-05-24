import { MeLoadingShell } from "../_loading/MeLoadingShell";

// /me/calendar — 14일 가로 캘린더 + 옵션 목록. 카드 4개 골격.
export default function CalendarLoading() {
  return <MeLoadingShell rows={4} />;
}

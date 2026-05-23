// Preview routes — design variant playground. No auth, no DB. Mock data only.
// Delete after a variant is chosen and promoted to production dashboard.

import type { Viewport } from "next";

// 부모 [lang]/layout.tsx 의 themeColor #000 을 화이트 시안 미리보기 동안만
// 흰색으로 override. 모바일/PWA 에서 상태바·safe-area 가 검정으로 비쳐
// "페이지가 검정으로 보인다" 는 피드백 차단.
export const viewport: Viewport = {
  themeColor: "#ffffff",
  // iOS 의 자동 줌·확대를 막아 아이폰/갤럭시 사이 시각 크기 차이 최소화.
  // 시안 평가 동안만 적용. 본 코드 적용 시 접근성(핀치줌) 트레이드오프 재검토.
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-white">{children}</div>;
}

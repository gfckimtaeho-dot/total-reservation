// 임시 검증용 — 캐시 없는 새 URL 로 "고객 QR 카드 새 크기"를 확인하기 위한
// 로그인 불필요 미리보기. 실제 /me QrDialog 와 동일한 카드 마크업 + 동일 옵션의
// 샘플 QR. 한 번도 캐시된 적 없는 경로라 고객 폰에서 열면 무조건 최신 렌더가 뜸.
// 확인 끝나면 삭제 예정.
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export default async function QrPreviewPage() {
  const qr = await QRCode.toDataURL("QR-PREVIEW-SAMPLE-0123456789ABCDEF", {
    width: 512,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-100 p-2">
      <div className="relative w-full max-w-md rounded-3xl border border-orange-200/80 bg-white p-3 shadow-[0_30px_80px_-20px_rgba(249,115,22,0.45)]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-600">
          QR 미리보기 (새 크기 · 캐시 없는 URL)
        </div>
        <div className="mt-2 flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qr}
            alt="Access QR preview"
            className="block w-full rounded-xl"
          />
          <div className="mt-2 text-center">
            <div className="font-heading text-lg font-bold tracking-tight text-zinc-900">
              샘플 회원
            </div>
            <div className="mt-0.5 text-[11px] text-zinc-500">
              이게 적용된 새 QR 크기입니다
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

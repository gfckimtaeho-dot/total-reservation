// Vercel Blob — 매장 자원(트레이너 사진 등) 저장소.
//
// Env: BLOB_READ_WRITE_TOKEN (Vercel 대시보드 → Storage → Blob → "Create Store"
// 시 자동 발급, Production+Preview에 등록).
//
// 패턴: 클라이언트가 File을 server action에 보냄 → put()으로 Blob에 저장 →
// 반환된 url을 DB에 저장. 삭제 시 del(url).

import { put, del } from "@vercel/blob";

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: "no-token" | "upload-failed"; message: string };

function hasBlobToken(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function uploadStaffImage(
  staffId: string,
  position: number,
  file: File,
): Promise<UploadResult> {
  if (!hasBlobToken()) {
    return {
      ok: false,
      reason: "no-token",
      message:
        "BLOB_READ_WRITE_TOKEN 미설정 — Vercel Storage → Blob에서 생성 후 env 등록 필요",
    };
  }
  try {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `staff/${staffId}/${position}-${Date.now()}.${ext}`;
    const blob = await put(key, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return { ok: true, url: blob.url };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "upload-failed", message };
  }
}

export async function deleteStaffImageUrl(url: string): Promise<void> {
  if (!hasBlobToken()) return;
  try {
    await del(url);
  } catch {
    // 정리 실패는 silent — DB row 삭제는 별도로 수행됨
  }
}

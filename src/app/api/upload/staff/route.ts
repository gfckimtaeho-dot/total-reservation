// Vercel Blob client-upload — 트레이너 사진 직접 업로드 endpoint.
//
// Why client-upload:
//   - server action 본문 한계(기본 1MB) + Vercel function 본문 한계(4.5MB)
//     모두 우회. 폰 JPG(3~10MB) 정상 처리.
//   - 클라이언트가 짧은 서명된 토큰을 받아 브라우저→Blob 직접 PUT.
//
// Auth: pathname에서 slug 추출 → isGymStaff() 검증.
// Path 형식: staff/<slug>/<position>.<ext>

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isGymStaff } from "@/lib/auth/dal";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const match = pathname.match(/^staff\/([^/]+)\//);
        if (!match) {
          throw new Error("Invalid path — expected staff/<slug>/...");
        }
        const slug = match[1];

        const ok = await isGymStaff(slug);
        if (!ok) {
          throw new Error("Unauthorized — must be gym staff for this slug");
        }

        return {
          allowedContentTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
          ],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // no-op — DB row는 별도 createTrainer 액션에서 imageUrls로 처리
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

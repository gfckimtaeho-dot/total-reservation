// 본인 시점 전체 unread + thread 별 breakdown. 폴링 5초(visible)/30초(hidden) 클라이언트가 호출.

import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/dal";
import { unreadForViewer, type ChatViewer } from "@/lib/chat/queries";

export async function GET() {
  const user = await verifySession();
  if (!user || !user.gymId) {
    return NextResponse.json({ total: 0, breakdown: [] }, { status: 401 });
  }
  const viewer: ChatViewer = { id: user.id, gymId: user.gymId, role: user.role };
  const data = await unreadForViewer(viewer);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

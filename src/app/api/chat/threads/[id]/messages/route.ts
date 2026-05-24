// 단일 thread 의 메시지 incremental fetch. afterId 이후만 가져옴 (오름차순).
// 폴링 또는 thread 진입 시 초기 로드. 권한 게이팅은 getThreadForViewer 가 함.

import { NextResponse, type NextRequest } from "next/server";
import { verifySession } from "@/lib/auth/dal";
import { getThreadForViewer, type ChatViewer } from "@/lib/chat/queries";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await verifySession();
  if (!user || !user.gymId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const afterId = url.searchParams.get("afterId");
  const take = Math.min(Number(url.searchParams.get("take") ?? 100), 200);

  const viewer: ChatViewer = { id: user.id, gymId: user.gymId, role: user.role };
  const data = await getThreadForViewer(viewer, id, { afterId, take });
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      threadId: data.thread.id,
      kind: data.thread.kind,
      closedAt: data.thread.closedAt,
      customer: data.thread.customer,
      staffUser: data.thread.staffUser,
      canSend: data.canSend,
      myLastReadMessageId: data.myLastReadMessageId,
      messages: data.messages,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

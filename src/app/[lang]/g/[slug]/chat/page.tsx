import { requireGymStaff } from "@/lib/auth/dal";
import type { ChatViewer } from "@/lib/chat/queries";
import { TrainerChatList } from "./TrainerChatList";
import { StaffChatList } from "./StaffChatList";

// /chat 라우트는 운영자(OWNER/MANAGER/TRAINER) 공통이지만 톤은 갈라진다.
// - TRAINER: V8 Sunset Gradient 풀스크린 다크 (DashboardTrainer 일관성).
// - OWNER/MANAGER: 3-theme sidebar + STORE thread (audit 진입 우상단).
export default async function ChatListPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const auth = await requireGymStaff(slug);
  const business = auth.business!;
  const viewer: ChatViewer = {
    id: auth.id,
    gymId: business.id,
    role: auth.role,
  };

  if (auth.role === "TRAINER") {
    return (
      <TrainerChatList
        lang={lang}
        slug={slug}
        businessName={business.name}
        trainerName={auth.name}
        viewer={viewer}
      />
    );
  }

  return (
    <StaffChatList
      lang={lang}
      slug={slug}
      businessName={business.name}
      viewer={viewer}
    />
  );
}

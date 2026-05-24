# 채팅 (Chat)

매장 내부에 기록 남는 1:1 텍스트 채팅. 외부 채팅(SMS·카톡)으로의 우회를 막고 분쟁/환불 시 인용 가능한 단일 소스.

## 채널 종류 (확정 2026-05-27)

두 가지 채널만. 단체 수업 채팅은 도입하지 않음.

### TRAINER 채널
- 고객 ↔ 1:1 PT 담당 트레이너.
- 담당 매핑은 `Package.assignedStaffId` (서비스 단위 담당, `docs/trainers.md` 참고).
- 담당 트레이너 없는 고객(noTrainer)은 STORE 채널만 사용.
- 트레이너 양도 시 thread 그대로 `staffUserId`만 갱신 + 시스템 메시지 1줄 자동 삽입 ("○○ 트레이너로 담당이 변경되었습니다").

### STORE 채널
- 고객 ↔ 매장 (OWNER + MANAGER 풀 응대).
- 매장당 고객 1명 = 스레드 1개.
- OWNER/MANAGER 누구든 답장 가능. sender 본인의 userId가 그대로 기록.
- TRAINER 채널과 무관하게 항상 사용 가능 (회원권 환불·문의·전반).

## 비도입 (확정)

- 단체 수업 강사 채팅 — 트래픽 폭증 + 노이즈. 단체 변경/취소는 매장(STORE) 채널로 흘림.
- 사진/파일 첨부 — 텍스트 only. 부상 사진 등은 향후 재검토 시 도입.
- PWA 푸시 — Phase 2. iOS 16.4+ 강제 PWA 설치 요건, LAN HTTP 환경 제약, 매장 공용 태블릿 잠금화면 프라이버시 이슈, 권한 재요청 불가 등 비용 대비 도달률 낮음. 인앱 뱃지로 시작.

## 가시성 / 권한

### 고객
- 본인의 TRAINER thread + 본인의 STORE thread만 보임.
- 발신 가능.

### 트레이너 (TRAINER role)
- 본인이 staffUserId인 TRAINER thread만 보임 / 발신.
- 다른 트레이너 thread는 안 보임.
- STORE thread는 안 보임.

### OWNER / MANAGER
- 본인 매장의 모든 STORE thread 직접 참여 (발신).
- 본인 매장의 모든 TRAINER thread **read-only 열람** (발신 X — 트레이너 신뢰 보호). 분쟁/환불/양도 추적용.
- 별도 라우트 `/g/{slug}/chat/audit` (TRAINER thread 전체 리스트, 메시지 추출).

## 인앱 뱃지

- 트레이너 dashboard sidebar 메뉴 "채팅 N" (TRAINER thread 미읽음 합산).
- 고객 `/me` 헤더에 "채팅 N" 진입 카드 (TRAINER + STORE 합산).
- OWNER/MANAGER sidebar "채팅 N" (STORE thread 미읽음 합산. TRAINER 감사 화면은 뱃지 비포함 — 노이즈 방지).
- 폴링 주기 5초. 페이지 visibilityState !== 'visible'이면 30초로 늘림 (탭 백그라운드 시 부하 감소).

## 폴링 방식

- 가벼운 fetch endpoint `/api/chat/unread` — 본인 account 기준 unread count + 채널별 분해.
- 스레드 안에 있을 때: `/api/chat/threads/[id]/messages?afterId=…` — 새 메시지만 incremental.
- WebSocket/SSE 도입은 매장 5개+ 또는 동시 활성 채팅 50건+ 시 재평가.

## DB 스키마

```prisma
enum ChatThreadKind {
  TRAINER
  STORE
}

model ChatThread {
  id            String         @id @default(cuid())
  gymId         String
  business      Business       @relation(fields: [gymId], references: [id], onDelete: Cascade)
  kind          ChatThreadKind
  customerId    String
  customer      User           @relation("ChatThreadCustomer", fields: [customerId], references: [id], onDelete: Cascade)
  staffUserId   String?        // TRAINER kind일 때만. 양도 시 갱신.
  staffUser     User?          @relation("ChatThreadStaff", fields: [staffUserId], references: [id], onDelete: SetNull)
  lastMessageAt DateTime?      @db.Timestamptz(3)
  closedAt      DateTime?      @db.Timestamptz(3) // 환불/탈퇴 등으로 soft close. 메시지 보존.
  messages      ChatMessage[]
  reads         ChatRead[]
  createdAt     DateTime       @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime       @updatedAt @db.Timestamptz(3)
  createdById   String?
  updatedById   String?

  @@unique([gymId, kind, customerId, staffUserId]) // TRAINER: customer+staff unique / STORE: staffUserId NULL → customer당 1개
  @@index([gymId, lastMessageAt])
  @@index([staffUserId, lastMessageAt])
  @@index([customerId, lastMessageAt])
}

model ChatMessage {
  id          String      @id @default(cuid())
  threadId    String
  thread      ChatThread  @relation(fields: [threadId], references: [id], onDelete: Cascade)
  senderId    String      // User.id. STORE kind에선 OWNER/MANAGER 누구든.
  sender      User        @relation("ChatMessageSender", fields: [senderId], references: [id], onDelete: Cascade)
  body        String      @db.VarChar(1000)
  system      Boolean     @default(false) // 트레이너 양도 등 자동 삽입 메시지
  deletedAt   DateTime?   @db.Timestamptz(3)
  sentAt      DateTime    @default(now()) @db.Timestamptz(3)
  createdAt   DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime    @updatedAt @db.Timestamptz(3)
  createdById String?
  updatedById String?

  @@index([threadId, sentAt])
  @@index([threadId, id])
}

model ChatRead {
  id                String      @id @default(cuid())
  threadId          String
  thread            ChatThread  @relation(fields: [threadId], references: [id], onDelete: Cascade)
  accountId         String      // User.id — 계정 단위 (디바이스 미러링). OWNER/MANAGER 풀에선 각자 별도 row.
  account           User        @relation("ChatReadAccount", fields: [accountId], references: [id], onDelete: Cascade)
  lastReadMessageId String?
  lastReadAt        DateTime    @default(now()) @db.Timestamptz(3)
  createdAt         DateTime    @default(now()) @db.Timestamptz(3)
  updatedAt         DateTime    @updatedAt @db.Timestamptz(3)
  createdById       String?
  updatedById       String?

  @@unique([threadId, accountId])
  @@index([accountId])
}
```

### unique 제약 의도

- TRAINER kind: `(gymId, kind, customerId, staffUserId)` — 같은 (고객, 트레이너) 쌍은 한 스레드만.
- STORE kind: 모든 row가 `staffUserId = NULL` → Postgres unique는 NULL을 distinct로 취급하므로 그대로는 customer 1명당 여러 STORE thread 가능해짐. 따라서 **별도 partial unique index를 raw migration으로 추가**:
  ```sql
  CREATE UNIQUE INDEX chat_thread_store_unique
    ON "ChatThread" ("gymId", "customerId")
    WHERE kind = 'STORE';
  ```

## 라우트

### 트레이너 (TRAINER role)
- `/g/{slug}/chat` — 본인 thread 목록 (최근 메시지순, unread bold).
- `/g/{slug}/chat/[threadId]` — 대화 화면.
- 진입: dashboard sidebar / 핸드폰 dashboard 메뉴.

### OWNER / MANAGER
- `/g/{slug}/chat` — STORE thread 목록 (전체 매장의 고객 ↔ 매장 채널). 발신.
- `/g/{slug}/chat/[threadId]` — 대화 화면.
- `/g/{slug}/chat/audit` — TRAINER thread 전체 read-only 리스트 (트레이너·고객 필터). 분쟁 추적용.
- `/g/{slug}/chat/audit/[threadId]` — read-only 대화 뷰.

### 고객
- `/g/{slug}/me/chat` — TRAINER 채널(있으면) + STORE 채널 카드 2개 (or 1개).
- `/g/{slug}/me/chat/[threadId]` — 대화 화면.

## 시스템 메시지 트리거

- 트레이너 양도 (`Package.assignedStaffId` 변경 → thread.staffUserId 변경): "○○ 트레이너로 담당이 변경되었습니다."
- 트레이너 비활성/이직 (staff 삭제 또는 active=false): "담당 트레이너가 변경 예정입니다. 매장에 문의해주세요." + STORE thread로 유도 링크.
- 환불 완료: "본 PT 권은 환불 완료되었습니다." + thread closedAt 셋 (메시지 보존, 발신 잠금).

## Thread lifecycle

- 생성: 첫 메시지 시 lazy-create (트레이너든 고객이든 누가 보내든). 사전 발급은 안 함 — 빈 스레드 양산 방지.
- 닫힘 (closedAt): 환불 완료 / 고객 탈퇴(soft) / 트레이너 비활성. 발신 잠금 + UI는 회색 read-only 표시.
- 삭제: 하드 삭제 없음. 메시지는 `deletedAt`으로 soft (단, 분쟁 시 OWNER read-only로 보임).

## 메시지 정책

- 본문 길이: 1000자 server enforce (DB `VarChar(1000)` + server action validation).
- 빈 메시지 / 공백만 / 1000자 초과는 발신 거부.
- 본인 메시지 5분 내 삭제(soft) 허용. 그 후는 잠금. 삭제된 메시지는 "삭제된 메시지" placeholder.
- 시간 표시: 매장 타임존(`docs/business.md` gymTime.ts).

## i18n

- 새 라우트는 ko/en 동시 추가 (`feedback_i18n_default`).
- 시스템 메시지 본문은 user-facing locale로 렌더 (메시지 row는 키 보관 → 렌더 시 번역).

## 검증 흐름 (구현 후)

1. 고객 c1@test.local 로그인 → `/me/chat` → 매장 채널 카드 + (있으면) 담당 트레이너 카드.
2. 매장 채널 메시지 발신 → OWNER/MANAGER `/chat`에 thread 등장 + 미읽음 1.
3. MANAGER 답장 → 고객 `/me/chat` 뱃지 1.
4. 1:1 PT 권 있는 고객 → 트레이너 채널 발신 → 트레이너 sidebar 뱃지 1.
5. OWNER가 `/chat/audit`에서 트레이너 thread 열람 (메시지 보이되 입력창 비활성).
6. 트레이너 양도 (2번 기능 구현 후) → 시스템 메시지 자동 삽입, 새 트레이너에게 스레드 노출.

## 미구현 / 다음 (Phase 2)

- PWA Web Push (도달률 검증 후).
- 사진 첨부 (부상 사진 케이스 검토 후).
- 매장 공지 broadcast (별도 알림 시스템에 위임, 채팅 외).
- 검색 (thread 전체 본문 검색) — OWNER audit 화면에서만.

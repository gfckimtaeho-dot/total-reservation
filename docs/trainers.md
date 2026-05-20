# Trainers (M4)

매장 직원(트레이너·매니저) 등록·조회·발송·삭제 + 출근 모델 + 사진 5장 갤러리.

## 도메인 결정

### 직책 (Role)
- **TRAINER**: PT·요가·필라테스·단체수업을 직접 진행하는 인력. 회원이 PT 신청 시 비교 대상.
- **MANAGER**: 사장 대리 운영(스케줄·매출). 트레이너 관리 화면에서 함께 다룸 (직책 컬럼 + 필터로 구분).
- TRAINER + MANAGER가 단일 화면에 공존. 매니저 전용 운영 화면(매출 보기 등)은 후속 마일스톤.

### 사진 5장
- 대표 1장 (큰 슬롯, position=0) + 추가 4장 (작은 슬롯, position=1~4).
- 회원이 PT 예약 시 비교 화면에서 봄 → 회사 직원 사진 성격 (public).
- 저장: Vercel Blob, store `yeyakgazua-blob` (Singapore region). client-upload 패턴 — 브라우저가 서명 토큰을 받아 직접 PUT (서버 함수 본문 한계 우회). 허용 content-type: jpg/png/webp/heic, 최대 10MB.

### 전문분야 (specialties)
- enum: `HEALTH`, `YOGA`, `PILATES`, `DANCE` — 다중 선택.
- + `customSpecialty` 자유 입력 ("기타" 토글 시 활성). 예: 태권도, 줌바.
- 표시: `["HEALTH","YOGA","태권도"].join(" / ")` → "헬스 / 요가 / 태권도".
- PT vs 단체수업 분리 X — Service의 capacity로 판단되므로 트레이너 단위 분리 불필요.

### 출근 모델
**두 차원의 결합**:

1. **요일 패턴** (`Staff.weeklyOffDays Weekday[]`): 정기 휴무 요일. 예: `[TUE, THU]` = 화·목 정기 휴무.
2. **일시 휴가 기간** (`StaffLeave` 테이블): 여름 휴가, 부상 등. start/end date + reason.

오늘 상태 계산 (그리드의 "오늘" 컬럼):
- 오늘 요일이 weeklyOffDays에 있으면 → `REGULAR_OFF` (정기 휴)
- 오늘 날짜가 진행중인 leave 기간 안 → `PERSONAL_OFF` (개인 휴, 메모에 사유)
- 둘 다 아니면 → `WORKING` (출근)

요일 표시 색: 출근=초록(theme별 emerald/lime/sky), 휴=로즈. 폼과 그리드 동일 색.

### 추가 정보
- bio (자기소개) — 회원 PT 선택의 결정 요인.
- career (경력/자격증) — NSCA-CPT 같은. 신뢰 근거.
- note (메모, 사장만 봄) — "이번 주 휴가", "교통사고 재활" 같은 내부 메모.

### 활성화 흐름
- 트레이너 등록 시 status=PENDING. 사장이 "메일 발송" 또는 "URL 복사" 버튼으로 매직링크 전달.
- 트레이너가 매직링크 클릭 → `/g/{slug}/activate` → 비밀번호 설정 → 자동 로그인 → `/me`.
- MagicLinkToken purpose: `STAFF_INVITE` (회원은 `SIGNUP_ACTIVATION`).

### 식별자 unique 제약
- `(phone, gymId)` partial unique (phone IS NOT NULL일 때만): 같은 매장 내 같은 핸드폰 중복 불가.
- `(email, gymId)` unique: 같은 매장에 한 이메일은 한 user에만. 즉 같은 사람이 같은 매장의 회원 + 트레이너 동시 역할 불가.
- 충돌 시 사장에게 컨텍스트 표시: "이 이메일은 이미 회원(클락크)이 사용 중입니다".

## DB 스키마 (m4_trainer_fields migration)

```prisma
enum Specialty { HEALTH YOGA PILATES DANCE }

model Staff {
  // ... 기존 +
  specialties     Specialty[] @default([])
  customSpecialty String?
  weeklyOffDays   Weekday[]   @default([])
  images          StaffImage[]
  leaves          StaffLeave[]
}

model StaffImage {
  id        String   @id
  staffId   String
  staff     Staff    @relation(...)
  url       String
  position  Int      @default(0)
  createdAt DateTime
}

model StaffLeave {
  id        String   @id
  staffId   String
  gymId     String
  startDate DateTime @db.Date
  endDate   DateTime @db.Date
  reason    String?
  createdAt DateTime
}
```

## 라우트

- `/g/{slug}/trainers` — 목록 (3-theme: paper/black/white). 검색(이름·직책·전문분야 다중·현재휴가).
- `/g/{slug}/trainers/new` — 별도 등록 페이지 (가로 max-w-5xl). 6 섹션: 사진/기본/직책·전문/자기소개·경력/출근요일/메모.
- `/g/{slug}/trainers/[id]` — 상세 페이지 (row 클릭으로 진입). 사진 갤러리 + 모든 필드 + **출입 QR 섹션** + 휴가 이력.
- `/g/{slug}/trainers/[id]/edit` — 편집 페이지 (2026-05-07 구현 완료).

## 편집 (2026-05-07)

- TrainerForm을 `mode: "create" | "edit"` 양 모드 지원으로 일반화. `initialValues` + `staffId` props.
- DobPicker는 `initialDate` prop으로 기존 생년월일 prefill.
- gender는 `defaultChecked` → controlled radio (React 19 form auto-reset 회피, edit 시 초기값 반영).
- `updateTrainer` server action — User+Staff+StaffImage 트랜잭션 갱신 + unique 충돌 시 자기 자신 제외 (`NOT: { id: existing.user.id }`).
- 제거된 사진은 best-effort로 Vercel Blob에서 정리 (`deleteStaffImageUrl`).
- ⚠️ 함께 fix된 기존 버그: TrainerForm에 imageUrls hidden input 누락이라 등록 시에도 사진 URL이 actions로 안 넘어가던 상태였음 (이제 정상).

## 출입 QR (트레이너 detail 상단)

- `User.accessToken String? @unique` 32자 base64url. 등록 시 자동 발급 (`generateAccessToken`), 기존 트레이너는 detail 첫 진입 시 lazy-create (`ensureAccessToken`).
- 사장 시점: QR 이미지 + 토큰 텍스트 + "재발급" 버튼 (confirm dialog → `regenerateTrainerAccessToken`).
- 트레이너 시점: 핸드폰 dashboard에 표시 (테블릿/PC `md:hidden`).
- 자세한 정책은 `docs/access.md` 참고.

## 트레이너 dashboard (TRAINER role 진입 시 — 2026-05-07)

`/g/{slug}/dashboard` 가 user.role 보고 분기:
- TRAINER → `DashboardTrainer` (단일 다크 = Black + Amber)
- OWNER/MANAGER → 기존 3-theme

특징:
- 헤더 → (핸드폰만) QR → 일정 → 캘린더 → 푸터. 사이드바 없음 (모바일 우선).
- 일정·캘린더는 `TrainerCalendarSchedule` 클라이언트 컴포넌트 — useState로 selectedDay 관리. URL은 `history.replaceState`로 동기화 (서버 왕복 없이 즉시 반응).
- 캘린더: 셀 고정 높이 `h-16`, 일자 좌상단, 단체수업 1줄 truncate. 오늘 = amber tint + amber ring + amber 글자 (휴무여도 강조).
- 비-오늘 mock 합성 (`MOCK_GROUP_CLASSES_BY_DAY`) — M6 reservation 모델 wiring 시 교체.
- "+ 예약 추가" 버튼 stub (alert "M6 마일스톤").

## 휴무 모델 (트레이너 dashboard)

캘린더 셀에서 "휴" 표시되는 조건:
- 매장 휴관일 (`MOCK_CLOSED_DAYS` — 추후 BusinessHours 연동)
- 트레이너 정기 휴무 (`Staff.weeklyOffDays`에 그 요일이 있을 때)
- (예정) 트레이너 개인 휴무 (`StaffLeave` 기간) — 사장이 등록할 화면 추후 추가

## 트레이너 dashboard 디자인 (2026-05-20 확정)

- V8 Sunset Gradient 컨셉 — purple→sunset orange/coral 그라데. preview 시안 10개(`/preview/trainer/v1~v10`) 비교 후 V8 채택. 다른 시안은 reference 보존.
- 라디얼 backdrop 3개: purple 상단, orange 우중단, fuchsia 좌하단
- 헤더 매장명 = orange→pink bg-clip-text 그라데
- 액션 4개 차등: 내 프로필(orange/pink 옅음) / 발급(orange→pink 솔리드 + shadow) / 실적(pink/purple 옅음) / 로그아웃(zinc)
- QR 카드: sunset 그라데 ring 카드(p-[1.5px] 외곽 + 안쪽 zinc-950)
- 슬롯 그리드: amber 토큰 전체 orange로 시프트. booked 셀은 orange→pink→purple 그라데 fill + pink-400/40 ring. 완료는 emerald 유지(완료 의미).

## /intake 발급 화면 (트레이너 풀스크린 전용)

사장/매니저는 /intake로 직접 접근 시 /members로 redirect. 사장 발급은 회원 상세에 임베드한 OwnerIssuePanel 사용(트레이너 IntakeFlow와 분리, 사장 톤 3가지).

### 고객 선택 흐름 (3단계)
1. **내 담당 고객** — 본인 staff.id가 Package.assignedStaffId인 user distinct, 최근순 10명/페이지. `listMyAssignedCustomers` 액션.
2. **전체 고객 조회** — 검색 input + 빈 q이면 최근 등록 순 자동 list + "더 보기 (10명씩)" 페이징. `listRecentCustomers` 액션.
3. **서비스 발급** — 선택된 고객(picked banner) → 카탈로그 3탭(회원권/횟수권/콤보) + 장바구니 + 발급 버튼

### 고객 row 디자인
- 이름 + 연락처 (위)
- 보유 서비스 chip (아래): 잔여 횟수 합산 표시. 1:1=amber, 단체=purple. 예 "PT 3회" / "단체 요가 2회".

### Package.assignedStaffId
- 발급 시 자동 지정: 발급자가 트레이너면 그 Staff.id, 사장 단독 발급은 null(고객 측 예약 잡기에서 "프런트 문의" 폴백)
- SetNull onDelete (트레이너 비활성 시 자동 null)
- 백필 완료 (scripts/backfill-package-assigned-staff.ts) — 이후 발급분부터 자동 채워짐

## 미구현 (다음 작업 후보)

- 휴가 등록 모달 (server action은 actions.ts에 있음, UI만 추가)
- 트레이너 개인 휴무 등록 (사장이 등록) — schema는 StaffLeave 있음
- 트레이너별 service 단가 차등 (현재 service.pricePhp 단일)
- 트레이너 평점·후기 시스템

## 검증 흐름

1. 사이드바 → 트레이너 관리 → "+ 트레이너 추가"
2. 사진 5장 업로드 → 정보 입력 → "트레이너 등록"
3. 목록 1번째 행에 등장 (status: PENDING)
4. "메일 발송" → 매직링크 도착 → 트레이너가 비밀번호 설정 → status=ACTIVE
5. row 클릭 → 상세 페이지 (사진 갤러리·전문분야·출근요일·자기소개)
6. 3-theme 토글 시 색 따라감.

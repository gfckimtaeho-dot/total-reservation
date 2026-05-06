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
- `/g/{slug}/trainers/[id]` — 상세 페이지 (row 클릭으로 진입). 사진 갤러리 + 모든 필드 + 휴가 이력.
- `/g/{slug}/trainers/[id]/edit` — 편집 페이지 (stub, M5에서 구현).

## 미구현 (다음 작업 후보)

- 트레이너 편집 페이지
- 휴가 등록 모달 (server action은 actions.ts에 있음)
- 트레이너별 service 단가 차등 (현재 service.pricePhp 단일)
- 트레이너 평점·후기 시스템

## 검증 흐름

1. 사이드바 → 트레이너 관리 → "+ 트레이너 추가"
2. 사진 5장 업로드 → 정보 입력 → "트레이너 등록"
3. 목록 1번째 행에 등장 (status: PENDING)
4. "메일 발송" → 매직링크 도착 → 트레이너가 비밀번호 설정 → status=ACTIVE
5. row 클릭 → 상세 페이지 (사진 갤러리·전문분야·출근요일·자기소개)
6. 3-theme 토글 시 색 따라감.

# DB 스키마 (Database)

> **상태**: M1 진입 시 작성 예정 (2026-05-02 시작 예정, 코딩은 다음주).
>
> 이 문서는 Prisma 스키마 작성 시 반영해야 할 핵심 결정 체크리스트.
> 2026-05-02 가맹점형 SaaS 피벗 반영.

## 멀티테넌시 핵심 원칙

- **모든 도메인 row에 `gym_id` FK 강제** (User·Reservation·Membership·Package·Service·Staff·Hours·Image·NotificationSetting·NotificationLog·AccessLog·QrToken·TrustScore·TrustEvent·UserDeletion 등 전부)
- 관리자만 `gym_id` NULL 허용 (User 테이블 한정)
- Server Action·API route 진입점에서 URL slug → `gym_id` 도출 → 모든 쿼리에 `where: { gym_id }` 강제 주입
- Prisma helper 또는 row-level scoping 함수 1개로 통일

## 작성 시 반영해야 할 핵심 결정

### Business (가맹점)
- `id` (cuid 또는 uuid) — 모든 도메인 FK가 참조
- `slug` (unique, 영문/숫자/하이픈, 예약어 금지)
- 매장명·전화·대표 이메일·예약금 여부·GCash QR URL
- `city_id` + `barangay_id` (PSGC FK)
- `status`: `trial` / `active` / `grace` / `expired` / `blocked`
- 등록 시 필수 필드는 [business.md](./business.md) 참조

### 인증 (User · Account · Session)
- `User`:
  - `id`, `email`, `password_hash`, `name`, `phone`, `role` (`admin` / `owner` / `manager` / `trainer` / `customer`), `status` (`pending` / `active` / `withdrawn` / `anonymized`)
  - `gym_id` FK (admin만 NULL)
  - **unique constraint: `(email, gym_id)`** — 같은 이메일이 다른 가맹점에 존재 가능
  - admin은 `gym_id` NULL이라 partial unique index `WHERE gym_id IS NULL` 별도 필요
- `Account` (Better Auth): provider 정보 (이메일·구글). 구글 OAuth는 V1.5
- `Session`: 30일 / 90일 (로그인 유지)

### 토큰 (MagicLinkToken · InviteToken)
- **`OtpToken` 폐기** (OTP 메커니즘 자체 제거)
- `MagicLinkToken`:
  - `token` (base64url 32 byte 랜덤, unique)
  - `target_user_id` FK
  - `purpose`: `signup_activation` / `password_reset` / `staff_invite`
  - `expires_at` (24시간), `used_at` nullable
  - 발급 시 같은 user·purpose의 기존 토큰 무효화
- `InviteToken` (관리자 → 사장):
  - `token` unique
  - `expected_business_name` (관리자 메모)
  - `expected_owner_email` / `expected_owner_phone` (관리자 메모)
  - `expires_at` (7일), `used_at` nullable, `revoked_at` nullable
  - 사용 완료 시 생성된 `business_id` FK 기록 (감사용)

### Staff (가맹점 ↔ User 트레이너 권한)
- `Staff`: `gym_id` + `user_id` + 권한 (`owner` / `manager` / `trainer`) + 사진·소개·경력
- 트레이너 다중 매장 = Staff row N개 (각 매장 다른 User row, 같은 이메일 가능)

### Service · BusinessHours · BusinessImage
- `Service`: `gym_id` + 이름 + 정원 + 시간단위(30/60) + 시술시간(분) + 가격
- `BusinessHours`: `gym_id` + 요일 + 영업·휴게 시간
- `BusinessImage`: `gym_id` + Cloudinary URL + 순서 (최대 10)

### 멤버십·패키지
- `Membership`: `gym_id` + `user_id` (회원) + 시작일 + 만료일 + 금액 (헬스장 출입권)
- `Package`: `gym_id` + `user_id` + `service_id` + 총 횟수 + 잔여 횟수 + 금액 (PT 10회권 등)
- 결제는 매장 직접, 시스템은 기록만

### 예약 (Reservation · ReservationLog)
- `Reservation`: `gym_id` + `service_id` + `staff_id` + `customer_user_id` + 시작·종료 시각 (UTC) + 상태 + 예약금 입금 여부
  - 상태: `pending_payment` / `confirmed` / `completed` / `no_show` / `cancelled` / `rejected`
- 자유 운동은 Reservation row 없음 (AccessLog만)
- 단체 수업: 같은 시간에 N개 row (참석자별)
- `ReservationLog`: 액션 로그
  - `created` / `confirmed` / `changed_by_customer` / `changed_by_staff` / `cancelled_by_customer` / `cancelled_by_staff` / `rejected` / `completed` / `no_show`
  - 패널티 분기에 사용 (`changed_by_staff`는 신뢰도 무영향)

### 출입 (AccessLog · QrToken)
- `QrToken`: `gym_id` + `user_id` + 5분 유효, 일회용. Redis 또는 DB cache (TTL 활용)
  - 페이로드: gym_id + user_id + issued_at + nonce + 서명
- `AccessLog`: `gym_id` + `user_id` + 시각 + QR token + 결과 (`allowed` / `denied` / `expired`)
- 자유 운동 통계는 AccessLog 기반

### 신뢰도 (TrustScore · TrustEvent)
- `TrustScore`: `gym_id` + `user_id` + 현재 점수 + 등급 (계산값 캐싱)
- `TrustEvent`: `gym_id` + `user_id` + 이벤트 타입 (`signup` / `visit_completed` / `no_show`) + 점수 변동 + 시각
  - 신규 가입 +100, 정상 +5, 노쇼 -30
  - 재가입 시 새 TrustScore row (이전 row와 분리, 100점 시작)
- 가맹점 스코프 — 가맹점 A 신뢰도와 가맹점 B 신뢰도는 완전 별개

### 위치 (City · Barangay)
- `City`: 코드 + 이름 (PSGC psgc_code) — 글로벌
- `Barangay`: 코드 + 이름 + city FK — 글로벌
- 시드: NCR 17개 시 + 모든 Barangay (PSGC 데이터)
- `Business`: city_id + barangay_id FK

### 알림 (NotificationSetting · NotificationLog · PushSubscription)
- `BusinessNotificationSetting`: `gym_id` + 채널 (`push` / `email` / `both`)
- `UserNotificationSetting`: `user_id` + push_enabled + email_enabled
- `PushSubscription`: `user_id` + endpoint + p256dh key + auth key (Web Push)
- `NotificationLog`: `gym_id` + 수신자 + 종류 + 채널 + 결과 + 시각 + 폴백 여부

### 구독 (Subscription · Payment)
- `Subscription`: `gym_id` + 시작일 + 만료일 + 플랜 (`trial` / `monthly` / `quarterly` / `semiannual` / `annual`)
- `Payment`: `gym_id` + 금액 + 결제일 + 관리자 확인 일시 + 입금 메모 (현금 수동)

### 회원 탈퇴 (UserDeletion)
- `UserDeletion`: `user_id` + `gym_id` + 신청일 + 익명화 예정일 (1달 후) + 상태 (`pending` / `cancelled` / `anonymized`)
- 1달 cron job으로 익명화 처리 (이름="탈퇴회원", email·phone NULL)

## 명시적으로 제거된 것 (피벗 후)

- `category` enum (`gym` / `massage`) — 단일 vertical
- Staff role의 `massagist`
- `OtpToken` 모델 (magic link로 대체)
- `tsvector` full-text search 인덱스 (검색 모듈 폐기)
- `position` / 정렬 우선순위 컬럼 (검색 노출 X)

## 시간대 처리

- 모든 `DateTime` 컬럼 **UTC 저장**
- 표시·입력은 PHT 변환 (Next.js 서버·클라이언트 양쪽)
- 시간 비교 (예약 충돌·QR 만료·구독 만료)는 **항상 UTC 끼리**

## 인덱스 전략 (초안)

- 빈 시간 슬롯 계산: `(gym_id, staff_id, start_at)` 복합
- 위치 필터: `(city_id, barangay_id)` (admin 통계용)
- 예약 상태별 조회: `(gym_id, status, start_at)`
- 출입 로그: `(gym_id, occurred_at)`
- User 조회: `(email, gym_id)` unique + admin partial unique `WHERE gym_id IS NULL`
- Business 슬러그 조회: `slug` unique
- 토큰 조회: `MagicLinkToken.token` unique, `InviteToken.token` unique

## Prisma 7 주의 사항

- Prisma 7부터 ESM 기본
- `prisma generate` 후 타입 import 위치 확인
- migration: `prisma migrate dev` (개발) / `prisma migrate deploy` (운영)
- driver adapter (Neon serverless) 이미 M0에서 적용됨

## 작업 순서 (M1 시작 시)

1. 도메인별 Prisma 모델 작성 (Business 먼저 → User·Token → Staff·Service → Membership·Package → Reservation·QR·Notification·Trust·Subscription)
2. PSGC 시드 스크립트 작성 (NCR 17개 시 + Barangay)
3. admin user seed 스크립트 (`ADMIN_EMAIL` 기반)
4. `prisma migrate dev --name m1_multitenancy_business`
5. 통합 테스트 (Vitest + 실제 Neon DB) — 가맹점 격리 테스트 (다른 gym_id 데이터 노출 0건)
6. 매장 등록 흐름 UI 진입 (invite → /register → 폼 → /g/{slug}/dashboard)

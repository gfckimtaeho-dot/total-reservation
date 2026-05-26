# 인증 (Auth)

## 인프라

- Better Auth (세션 기반)
- 이메일 발송: Resend (magic link · 환영 메일 · 트레이너 초대 동일 서비스)
- **ID = `loginId`** (매장별 unique). 회원/트레이너/매니저는 활성화 페이지에서 본인이 직접 선택, 사장은 매장 등록 form 에서 본인이 직접 선택. 영문 소문자/숫자/언더스코어/하이픈 3-30자.
- **이메일 = 옵셔널 채널 도구**. magic link 자동 발송용. 식별자 X — 같은 이메일을 한 매장에서 여러 회원(가족 등) 이 공유 가능, 중복 검증 없음. 이메일 없는 회원은 사장이 발급 화면에서 "활성화 URL 복사" 버튼으로 URL 받아 본인 폰으로 회원에게 카톡/문자 직접 전달.
- 비밀번호: 6자리 이상
- 세션: 기본 30일 / "로그인 유지" 시 90일 → 만료 시 비번 재입력
- **OTP 6자리 코드 메커니즘 사용 안 함**. 활성화·비번 재설정은 모두 magic link(일회용 URL 클릭).
- **SMS·문자 채널 미사용** (비용 정책). 이메일 없는 회원의 URL 전달은 사장/트레이너의 개인 폰에서 카톡 등 수동 전달.

## 가맹점 멀티테넌시 — 계정 범위

- **고객/트레이너/매니저/사장 계정**: 가맹점별 분리. `(loginId, gymId)` 매장별 unique. 같은 loginId 라도 매장별 별도 User row.
- **이메일**: 매장별 중복 검증 없음. 단순 채널 도구.
- **관리자 계정**: 가맹점 무관 (`gym_id` = NULL), `email` globally unique. `ADMIN_EMAIL` 환경변수와 일치하는 이메일. (관리자는 이메일 식별 그대로 유지)
- DB 제약: `(loginId, gym_id)` unique + 관리자 email partial unique.

## URL 구조 (인증 관련)

| URL | 용도 |
|---|---|
| `/admin/login` | 관리자 로그인 |
| `/register?token={invite}` | 사장 매장 등록 (invite 검증) |
| `/g/{slug}/login` | 가맹점 통합 로그인 (사장·트레이너·고객) |
| `/g/{slug}/forgot` | 가맹점 비번 재설정 (magic link 발송) |
| `/g/{slug}/activate?token={magic}` | 신규 사용자 활성화 (비번 설정) |
| `/g/{slug}/me` | 고객 마이페이지 |
| `/g/{slug}/dashboard` | 사장·트레이너 운영 화면 |

## Magic link 정책

- 일회용 URL (token = base64url 32 byte 랜덤)
- **만료: 24시간** (가입 활성화·비번 재설정·트레이너 초대 모두 동일)
- 사용 후 즉시 무효화
- 발송 채널: 이메일만 (Resend)
- 재발송 시 이전 토큰 무효화 후 새 토큰 발급
- 용도 구분: `signup_activation` / `password_reset` / `staff_invite`

## Invite link 정책 (관리자 → 사장)

- **신규 가맹점 가입은 invite link로만 가능**. 공개 가입 페이지 없음.
- 관리자가 admin 패널에서 1클릭 발급 → URL 복사 → 사장에게 메일·메신저 등으로 전달
- 토큰 만료: **7일** (사장 응답 여유)
- 1회용 (사장이 매장 등록 완료 시 무효화)
- 미사용 invite는 admin 패널에서 회수 가능
- invite 발급 시 메모 필드: 예상 매장명·사장 연락처 (관리자 본인용 메모)

## 가입·로그인 흐름

### 관리자
- seed 스크립트가 `ADMIN_EMAIL` 이메일을 admin role로 등록 + 초기 비번 설정 (`ADMIN_INITIAL_PASSWORD` 환경변수)
- 첫 로그인 후 비번 변경 권장
- 추가 관리자 V2 (V1은 1인 운영)

### 사장 (매장 등록)
1. 관리자가 admin 패널에서 invite link 발급
2. 사장이 invite URL(`/register?token={invite}`) 진입 → 토큰 검증 (만료·사용 여부)
3. 매장 등록 폼:
   - 매장명
   - 슬러그 (영문/숫자/하이픈, 실시간 중복·예약어 체크)
   - 시 + 동 (PSGC)
   - 사장 이름
   - **사장 아이디 (loginId)** — 영문 소문자/숫자/_/- 3-30자, 매장 내 unique
   - 사장 이메일 (선택)
   - 사장 비밀번호 (6자리 이상, 확인 입력)
   - 사장 전화번호
4. 제출 → `Business`(매장) + `User`(사장 계정, role=owner, loginId 박힘) 동시 생성. 사장은 `active` 상태.
5. invite token 무효화
6. **환영 메일 자동 발송** (사장 이메일이 있을 때만) — 매장 공개 URL · 로그인 URL · 대시보드 URL · PWA 설치 안내.
7. 자동 로그인 → `/g/{slug}/dashboard`로 리다이렉트 (대시보드 첫 화면에 같은 URL 카드 노출 + PWA 설치 카드)
- **이메일은 옵셔널** — 사장이 이메일 없이도 등록 가능. 단 비번 재설정/환영 메일 못 받음.
- **이메일 검증 별도 안 함**: 관리자가 invite 발급 시 사장 신원 확인 책임.

### 트레이너 (사장이 초대)
1. 사장이 직원 추가 화면에서 트레이너 정보 입력:
   - 이름·이메일(옵셔널)·전화·사진·권한(`trainer` 또는 `manager`)
2. 시스템이 `User` row 생성 (`pending` 상태, loginId NULL, passwordHash NULL) + magic link 발급
3. 이메일 있으면 자동 메일 발송, 없으면 사장이 "활성화 URL 복사" 버튼 → 본인 폰으로 트레이너에게 카톡 등 직접 전달
4. 트레이너가 URL 클릭 → `/g/{slug}/activate?token=...` 진입
5. **아이디(loginId) + 비번 입력** form. 아이디는 실시간 매장 내 중복 검증. 제출 → `User` 상태 `active` + loginId/passwordHash 박힘 + 토큰 무효화
6. 자동 로그인 → `/g/{slug}/dashboard`
- 토큰 만료(24h) 시 사장이 직원 편집에서 URL 재발급

### 고객 (사장/트레이너가 카운터에서 등록)
1. 신규 손님 매장 방문 → 사장/트레이너가 "신규 회원 등록" 진입
2. 폼 입력:
   - 이름·전화번호 (필수)
   - 이메일 (옵셔널)
3. 발급 완료 → `User` row 생성(`pending`, loginId NULL).
4. 활성화 URL 발급:
   - 이메일 있음 → magic link 자동 발송
   - 이메일 없음 → 사장/트레이너가 "활성화 URL 복사" 버튼 → 본인 폰으로 회원에게 카톡 등 직접 전달 (SMS 인프라 X)
5. 회원이 URL 클릭 → `/g/{slug}/activate?token=...` 진입
6. **아이디(loginId) + 비번 입력** form. 아이디는 회원이 직접 선택 (실시간 매장 내 중복 검증). 제출 → `User` 상태 `active` + loginId/passwordHash 박힘 + 토큰 무효화
7. 자동 로그인 → `/g/{slug}/me` (PWA 설치 안내 표시)
- 매장에서 메일 안 옴 / 링크 만료 시 사장이 회원 편집에서 "재발송" 또는 URL 재복사

### 사장·트레이너·고객 일반 로그인
- `/g/{slug}/login` 진입
- **아이디(loginId) + 비번** 입력
- `(loginId, gym_id)`로 사용자 조회 → 비번 검증 → 세션 생성
- role에 따라 자동 라우팅:
  - 사장·매니저·트레이너 → `/g/{slug}/dashboard`
  - 고객 → `/g/{slug}/me`
- 같은 사람이 가맹점 A·B 모두 회원이면 각각의 슬러그 URL로 로그인. loginId 는 매장별 독립이라 매장마다 다른 ID 사용 가능. 통합 로그인 화면 없음(V1).

### 구글 OAuth (V1.5)
- M1·M2에서는 이메일·비번만 우선 구현
- 구글 OAuth는 안정화 후 추가 (Better Auth account linking 표준 사용)

## 비밀번호 재설정

1. **이메일 있는 회원**: `/g/{slug}/forgot` 흐름(미구현, 별도 마일스톤). 발송 시 magic link (용도: `PASSWORD_RESET`, 24h).
2. **이메일 없는 회원**: 사장이 admin/회원 편집 화면에서 `copyPasswordResetUrl` 액션 → URL 복사 → 본인 폰으로 회원에게 카톡 직접 전달. 회원이 URL 클릭 → `/g/{slug}/activate?token=...` → 새 비번 입력 → 토큰 무효화.
3. activate 페이지는 `SIGNUP_ACTIVATION` / `STAFF_INVITE` / `PASSWORD_RESET` 세 purpose 모두 수용. PASSWORD_RESET 케이스는 회원이 본인 ID 잊었으면 사장이 URL 전달 시 ID 도 같이 알려줌.

## 사용자 상태 (User.status)

- `pending` — magic link 미클릭. 로그인 불가.
- `active` — 정상.
- `withdrawn` — 탈퇴 신청 (1달 유예 중)
- `anonymized` — 1달 경과 후 익명화 완료. 이름="탈퇴회원", 이메일·전화 NULL.

## 전화번호 활용

- 트레이너 긴급 변경 시 고객 연락
- 사장 ↔ 고객 직접 연락
- 고객이 매장 문의

## 전화번호 노출 권한

| 보는 사람 | 볼 수 있는 번호 |
|---|---|
| 사장·매니저 | 자기 매장 모든 예약 고객 |
| 트레이너 | 본인 예약 고객만 |
| 고객 | 매장 대표 번호 |

## 회원 탈퇴

- 탈퇴 신청 → 1달 유예 ("탈퇴 취소"만 가능, **유예 중 재가입 불가**)
- 1달 후 익명화: 이름="탈퇴회원", 이메일·전화 NULL
- 예약 기록은 유지 (매출 통계용, "탈퇴회원"으로 표시)
- 1달 경과 후 같은 가맹점에 같은 이메일로 재가입 가능 (신뢰도 100점부터 새로 시작)
- 다른 가맹점에는 항상 별도 계정 (탈퇴 영향 없음)

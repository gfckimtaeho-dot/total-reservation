# 출입 시스템 (Access)

## 적용 범위

- 모든 가맹점 직원(트레이너·매니저)·회원에게 영구 QR 발급
- 자유 운동·PT·단체 수업 모두 동일 QR로 입장
- 사장은 사이트에서 직접 운영하므로 QR 발급 X (필요해지면 추가)

## QR 코드 사양 (2026-05-07 변경)

**영구 QR + 사장 재발급 모델**로 결정.

- `User.accessToken String? @unique` — 32자 base64url (192bit 엔트로피)
- 트레이너·회원 등록 시 자동 발급. 분실·유출 의심 시 사장이 수동 재발급으로 즉시 무효화.
- QR이 인코딩하는 값은 accessToken 그대로. userId 등 식별자 노출 X.
- 새로고침마다 QR 새로 만드는 비용 0 — 같은 token, 같은 이미지.

### 왜 영구인가
- UX 우선: 트레이너·회원은 게이트에서 1탭으로 QR 보여주고 통과. 매번 회전 시 카운트다운·재발급 클릭이 마찰.
- 보안 trade-off: 스크린샷·캡처 위험은 있지만 사장의 1클릭 재발급으로 즉시 무효 가능. 헬스장 출입 정도의 risk 모델에선 적절.
- 향후 옵션: 회원 본인이 "QR 자동 갱신" 토글 켤 수 있게 추가 가능 (디폴트 OFF).

### 폐기된 설계 (2026-05-07 이전)
- ~~5분 유효, 일회용 회전 QR~~
- ~~JWT/HMAC 서명 페이로드~~
- ~~카운트다운 타이머 화면~~

## QR 화면 표시 정보 (트레이너·회원)

- QR 이미지 (영구)
- 회원 이름 (헤더에 자연스럽게)
- 안내 문구: "출입 시 매장 단말에 QR을 스캔해 주세요. ⚠️ 다른 사람에게 QR을 양도·공유한 사실이 적발되면 벌금 100만원이 부과됩니다."
- (회원만, 추후) 멤버십 만료일

**핸드폰만 표시** (`md:hidden`) — 테블릿/PC는 게이트에 들고가지 않으므로 섹션 자체를 안 보임.

## 사장 시점 (트레이너 detail 페이지)

- QR 이미지 (관리·공유용으로 데스크톱에서도 보임)
- 토큰 텍스트 (모노스페이스로 노출)
- "재발급" 버튼: confirm dialog → `regenerateTrainerAccessToken` action → `accessToken` 새 값으로 update → 옛 QR 즉시 무효
- (회원도 동일 패턴 추후 추가 예정)

## 출입 검증 흐름 (회원/트레이너 — 구현 완료 2026-06-01)

1. 트레이너·회원이 핸드폰에서 dashboard 진입 → QR 자동 표시 (영구)
2. 매장 단말이 QR 스캔 → token 추출
3. `POST /api/access/verify { slug, token }` → `verifyAccess` 디스패처가 종류 판별:
   - 먼저 로컬 `User.accessToken` 매칭 시도 → 매칭되면 회원/직원 경로(`verifyMemberAccess`)
   - 매칭 안 되면 호텔 게스트 경로(`verifyGuestAccess`, cross-DB Stay)
   - 토큰 형식 휴리스틱 대신 로컬 조회 우선 (둘 다 고엔트로피 unique)
4. 회원/직원 판정(`decideMemberAccess` 순수 코어):
   - `active=false` 또는 `status!=ACTIVE` → DENIED INACTIVE
   - 토큰은 유효하나 `gymId` 불일치 → DENIED WRONG_GYM
   - 직원(TRAINER/MANAGER) → 회원권 불필요, 바로 ALLOWED
   - 회원(CUSTOMER) → 환불 동결(refundedAt) 제외 회원권 날짜창 검사.
     `startDate <= 오늘 <= endDate`(endDate **inclusive**, 게스트 checkOutDate 도 inclusive)면 ALLOWED.
     만료된 회원권만 있으면 EXPIRED MEMBERSHIP_EXPIRED, 없으면 DENIED NO_MEMBERSHIP
5. `AccessLog` 작성 (성공/거절 모두 — `AccessResult` enum). 영구 accessToken 은 QrToken row 가 아니라 `qrTokenId=null`
6. 단말에 OK/거절 응답 (스캐너 화면이 reason 머신코드를 `access.reason.*` 로 번역)
7. 도어락 열림 (V2 자동화, V1은 수동 안내)

## 자유 운동 통계 (구현 완료 2026-06-05)

- 자유 운동은 예약 row 없음
- AccessLog가 유일한 방문 기록
- 사장 방문 통계 화면(`/g/{slug}/visits`)에서 PT·단체·자유 운동 구분 표시
- 일별·월별·연별 방문자 수 집계 (revenue 화면과 동일 기간 토글)

구현 상세:
- "방문(visit-day)" 단위 = `result=ALLOWED` 이고 회원(role=CUSTOMER)인 AccessLog 의
  (userId, 매장 달력일) distinct. 같은 회원이 하루 여러 번 스캔해도 1 방문.
- AccessLog 에는 방문 종류 정보가 없으므로 **같은 날 그 회원의 Reservation 유무로
  역추론**: 그날 PT(scheduledClassId=null) 예약 있으면 PT, 단체(scheduledClassId 있음)만
  있으면 CLASS, 예약 없으면 FREE(자유운동). 같은 날 PT+단체면 PT 우선.
  취소/거절(CANCELLED/REJECTED) 예약은 제외.
- 화면: KPI 3장(오늘/이번달/올해 자유운동 방문 수 + PT/단체 보조라인, 자유운동 기준
  전기간 대비 %) + 누적 막대 차트(자유운동/PT/단체 3세그먼트, day/month/year 토글).
- 한계(MVP): visit-day 가 분류 단위라 PT 받은 날 추가로 한 자유운동은 PT 로 흡수됨
  (같은 날 = 1 방문). 호텔 게스트(GuestAccessLog)는 이 집계에 미포함 — 아래 "다음 단계".

## 게스트 매출 (구현 완료 2026-06-01)

호텔 게스트는 일반 회원권으로 받지 않고 별도 1일 단가로 과금. 매출현황에서 분리 표시.

- 설정: `Business.hotelGuestDailyPricePhp Int?` (₱, nullable=미설정). `/g/{slug}/settings` 의 "호텔 게스트 1일 가격" 카드에서 OWNER/MANAGER 가 설정. 변경 시 `PriceChangeLog`(entityType=`HOTEL_GUEST_DAILY_PRICE`, entityId=businessId) 기록 — [[feedback_money_audit_log]].
- 매출: `/g/{slug}/revenue` 의 "호텔 게스트 매출" 별도 섹션. **Sale row 아님** — 집계 시에만 산출하고 상단 KPI/차트(Sale 기반)엔 미합산.
- 산식: 게스트 1명(=stayId 단위) 매출 = **실제 방문일수 x 1일 단가**. 방문일수 = 선택 기간 내 `result=ALLOWED` GuestAccessLog 의 매장 달력일 distinct (하루 여러 스캔은 1일). 손님명은 로그 스냅샷(가장 최근 non-null).
- 가격 미설정 시 매출 0 + 설정 링크 안내. 기간은 매출현황 차트의 선택 기간(view/anchor)을 따름.

## 멤버십 만료 처리 (회원 한정)

- 만료일 다음날부터 출입 거절 (verify endpoint에서 차단)
- 만료된 회원이 스캔 시 단말에서 "만료" 표시
- 만료 7일 전 알림 (옵션, 사장이 매장별로 설정)

## 매장 측 장비 (V1)

- 태블릿 + QR 스캐너 앱 (저렴한 옵션)
- 매장 스캐너는 항상 온라인 가정
- **PWA 오프라인 시 출입 검증 안 함, 그냥 입장 허용** (V1 단순화 — 사장 신뢰 모델)

## 무인 출입 스캐너 (영구 키 링크 — 구현 완료 2026-06-15)

손님 셀프 출입(지하철 개찰구식) 단말을 직원 로그인/세션 없이 영구 운영하기 위한 구조. 직원 세션 스캐너(`/g/{slug}/scan`, requireGymStaff)는 그대로 두고, 무인 단말용 **세션 없는 키 링크**를 추가한다.

- 인증 = 링크 안의 키. `Business.scannerKey`(nullable, unique, 32B base64url). 사장이 설정에서 발급/재발급. 링크 자체가 영구 인증 수단이라 로그인/세션 만료(JWT 30/90일) 문제를 회피.
- 라우트 = `/{lang}/g/{slug}/scan/{key}` (`scan/[key]/page.tsx`). 세션 게이트 없음. key 가 매장 scannerKey 와 일치 + 매장 status 가 BLOCKED/EXPIRED 아닐 때만 화면 노출, 아니면 404(재발급된 옛 링크 차단).
- 검증 endpoint = `POST /api/access/verify` 가 body.key 를 받아 매장 scannerKey 와 대조. 불일치 시 403(임의 호출/회수된 단말 차단). 직원 세션 스캐너는 key 없이 기존 동작.
- 사장 발급 UI = `/g/{slug}/settings` 의 "무인 출입 스캐너 링크" 카드(OWNER/MANAGER). 링크 표시/복사 + 이메일 발송(`sendScannerLinkEmail`) + 재발급(옛 링크 즉시 무효 = 분실 단말 회수). 발급/재발급은 `regenerateScannerKey`, 발송은 `sendScannerLink` 서버 액션.
- 연속 자동 스캔 = 카메라 모드에서 한 명 인식해도 카메라를 끄지 않고 계속 대기(`AccessScanner.tsx`). QR 인식 -> 결과 4초 -> 자동 재대기. 같은 폰 연타 방지: 직전 QR 이 프레임에서 빠진(빈 프레임) 뒤에만 다음 스캔 허용 + 검증/결과 중 잠금. HID 하드웨어 스캐너(다이소식) 경로는 그대로 — 영구 링크 위에 2D 스캐너만 꽂으면 동작.
- 화면 꺼짐 방지 = Screen Wake Lock API(secure context 전용, 미지원 무시) + 단말 측 키오스크/충전중 화면유지 설정.
- 트레이드오프: 링크에 비밀키가 들어가므로 링크 소지 = 스캔 가능. 단 스캔으로 노출되는 건 제시된 QR 1건의 허용/거절뿐(회원정보 X)이고 재발급으로 즉시 회수 가능 — 무인 단말에 적정.

## 모바일 앱 전략 (2026-05-07 결정)

- **PWA (Progressive Web App)** 채택. native iOS/Android 앱 X.
- manifest.json + service worker + 아이콘 (192/512) → "홈 화면에 추가"로 설치
- iOS Safari·Android Chrome 모두 카메라·QR·세션 기본 지원
- React Native는 추후 (백그라운드 위치·Bluetooth 등 OS 기능 필요할 때)
- **셋업 자체는 미구현** — 다음 작업

## 호텔 게스트 출입 (백엔드 구현 완료 - 2026-05-30)

제휴 호텔의 투숙객에게 체크인 시 헬스장 QR을 메일로 발송, 체크인~체크아웃 기간 동안 헬스장 출입을 허용하는 기능.

구현 상태 (2026-05-30):
- 헬스장 측 schema: `GymHotelAffiliation`(N:N 제휴 매핑) + `GuestAccessLog`(게스트 출입 로그) 추가. db push 완료.
- verify 로직: `src/lib/access/guestVerify.ts` (`decideGuestAccess` 순수 코어 + `verifyGuestAccess` cross-DB IO 쉘).
- endpoint: `POST /api/access/verify` body `{ slug, token }`.
- 호텔 측: 이미 `Stay.gymOptIn`(이용 의사) + `Stay.gymQrSentAt`(QR 발송 시각) + `Stay.status`(ACTIVE/CHECKED_OUT) 보유. QR = `Stay.id` 인코딩 + 체크인 화면 표시 + 메일 발송까지 호텔 측에서 구현됨.
- admin 제휴 관리 UI: 구현됨. 가맹점 상세(GYM) 의 "제휴 호텔" 섹션 (`businesses/[id]/AffiliationManager.tsx` + `affiliationActions.ts`). 호텔 드롭다운 추가 + 행별 활성/비활성 토글.
- 스캐너 태블릿 UI: 구현됨(2026-05-31). `/[lang]/g/[slug]/scan` (`AccessScanner.tsx`). requireGymStaff 게이트. 입력 이중화 = HID 스캐너/수동입력 자동포커스 input(Enter 제출) + 카메라(`BarcodeDetector`, secure context 전용, 미지원 시 안내 fallback). 결과 전체화면 색상(허용=emerald/거절=rose/만료=amber), reason i18n(access.reason.*), 자동 idle 복귀(연속 스캔). 사이드바 "출입 스캔" 진입점.
- 회원/트레이너 공용 verify: 구현됨(2026-06-01). `verifyAccess` 디스패처 + `verifyMemberAccess`/`decideMemberAccess`. 위 "출입 검증 흐름" 절 참조.
- 호텔 게스트 매출: 구현됨(2026-06-01). 아래 "게스트 매출" 절 참조.
- 회원 자유 운동 방문 통계: 구현됨(2026-06-05). 위 "자유 운동 통계" 절 참조.
- 미구현(다음): 게스트 방문 통계(GuestAccessLog union).

### 호텔 측 확정 답변 (2026-05-30)

- QR = bare `Stay.id` (cuid) 문자열. URL/JSON 래핑 없음. 메일 본문에도 같은 토큰 텍스트로 병기.
- `gymOptIn=true` 보장 (체크인 시 "헬스장 이용" 선택 + QR 발송 성공 시 재셋). QR 받은 게스트는 전부 true.
- QR 은 체크인(Stay 생성) 이후에만 발송. 예약 시점엔 Stay 없음.
- 체크아웃/조기퇴실 시 `status=CHECKED_OUT`(+checkedOutAt) 즉시 전이. 투숙 중엔 ACTIVE.
- 호텔 BLOCKED 라도 투숙 중 게스트는 출입 허용 (헬스장은 호텔 status 안 봄. BLOCKED 호텔은 신규 체크인 자체가 안 됨). 헬스장 로직 그대로.
- StayStatus 는 ACTIVE/CHECKED_OUT 둘뿐 (CANCELLED 없음). 잘못된 체크인은 체크아웃으로 무름. -> verify 는 `status==='ACTIVE'` whitelist 권고. 향후 status 추가돼도 안전.
- 레이트 체크아웃/연장: 호텔이 `Stay.checkOutDate` 갱신 -> 헬스장 live read 로 자동 반영(재발급/동기화 불필요).
- 게스트 QR 메일 발송 = 100% 호텔 (호텔 코드 + 호텔 SMTP). 헬스장은 READ/검증만. (호텔이 헬스장과 같은 Gmail 발신 계정을 공유할 뿐 코드 경로 독립.)
- 테스트 데이터 (Grand Hotel, ACTIVE): `Stay.id = cmpr49kd9i3nnig13bcp2dv`, gymOptIn=true, status=ACTIVE, 2026-05-29 ~ 2026-06-03 (checkOutDate inclusive -> 06-03 까지 통과, 06-04 부터 거절).

### 채택 아키텍처 = 모델 B (헬스장이 호텔 Stay 를 live read)

스캔 시점에 헬스장 verify endpoint 가 cross-DB 로 호텔 `Stay` 를 직접 읽어 검증. 호텔이 헬스장 DB 에 게스트/숙박기간을 복제(insert)하지 않음.

폐기 = 모델 A (호텔이 체크인 때 헬스장 DB 에 게스트 출입권 row 복제). 폐기 이유: 연장/조기퇴실/취소를 전부 호텔이 헬스장 DB 로 sync 해야 하고, 그 write 코드가 호텔 repo 에 들어가야 해서 호텔 repo no-touch 룰과 충돌 + 이중 소스 불일치 위험.

모델 B 채택 근거: 헬스장 repo 가 이미 호텔 cross-DB 클라이언트 보유(`src/lib/hotel-db.ts`, `prisma-hotel`) + 호텔 DB 가 호텔 도메인 master + 스캐너 online 가정.

### QR 토큰 = Stay.id

QR 이 인코딩하는 값은 호텔 `Stay.id` (cuid). `reservationNumber` 는 금지 - 사람이 주고받는 번호라 추측 가능하고 호텔별 unique 라 전역 유일하지 않음. 예약번호는 게스트 표기용(메일 본문)으로만.

### 검증 흐름 (`decideGuestAccess` 우선순위 순)

1. 매장 단말이 QR 스캔, `Stay.id` 추출 -> `POST /api/access/verify { slug, token }`
2. slug 로 헬스장 조회 (없으면 GYM_NOT_FOUND)
3. cross-DB 로 호텔 `Stay` 조회 (없으면 STAY_NOT_FOUND, 로그 안 남김). 게스트명은 `Stay -> reservation -> customer.name` 경로.
4. 제휴 확인: `GymHotelAffiliation(gymId, Stay.hotelId, active)` 없거나 비활성이면 NOT_AFFILIATED
5. `Stay.gymOptIn` 확인: false 면 NOT_OPTED_IN (게스트가 헬스장 이용 의사 표시 안 함)
6. `Stay.status` whitelist: `ACTIVE` 만 통과. CHECKED_OUT(조기퇴실 포함) 및 향후 추가될 어떤 status 든 EXPIRED 거절 (호텔 측 권고 - blacklist 아닌 whitelist). 호텔이 status 를 live 갱신 = 동기화 0.
7. 날짜창: `checkInDate <= 오늘 <= checkOutDate` (checkOutDate inclusive 라 체크아웃 당일 오전 운동까지 커버). 체크인 전 NOT_YET, 체크아웃일 다음 날부터 CHECKED_OUT
8. `GuestAccessLog` 기록 (제휴 컨텍스트가 잡힌 4번 이후의 모든 결과). OK/거절 응답

### 연장(late checkout) 처리

호텔은 자기 DB 의 `Stay.checkOutDate` 만 갱신(호텔 자체 연장 흐름에서 이미 하는 일). 헬스장은 스캔 시점에 최신 `checkOutDate` 를 live read 하므로 헬스장 DB sync 코드가 0. 조기퇴실/취소도 동일하게 호텔이 자기 Stay 갱신하면 헬스장이 자동 반영.

### 결정 완료 (2026-05-30)

- 게스트 출입 로그: 별도 `GuestAccessLog` 모델 (회원 `AccessLog` 와 분리). stayId/hotelId/guestName 스냅샷 보존.
- 호텔-헬스장 매핑: N:N `GymHotelAffiliation` 테이블 (1호텔-1헬스장도 포함). `hotelId`/`stayId` 는 호텔 DB 값이라 cross-DB FK 불가 - 값만 저장하고 verify 가 live read 로 무결성 보장.
- 토큰 = `Stay.id` (cuid). 체크아웃 시 status/날짜창으로 자동 만료. 회수/회전 전용 컬럼은 V2.

### 다음 단계

- admin 제휴 관리 화면: `GymHotelAffiliation` row 생성/활성토글 UI 없음 - 이게 없으면 제휴를 못 맺어 실사용 불가. 다음 우선.
- ~~스캐너 태블릿 UI (`/g/[slug]/scan`)~~ 완료 (2026-05-31, 위 "호텔 게스트 출입" 절 참조).
- ~~회원/트레이너 공용 verify: `User.accessToken`(32자 base64url) 분기 추가~~ 완료(2026-06-01).
- 게스트 방문 통계: 자유 운동 집계에 `GuestAccessLog` union.

## V2 로드맵

- PWA 셋업 (manifest + 홈화면 추가 안내)
- 매장 단말 verify endpoint + AccessLog 쓰기
- 자동 도어락 연동 (Bluetooth 또는 ESP32 등)
- 안면인식 옵션 (QR 보완)
- 매장 스캐너 오프라인 캐시 (네트워크 끊겨도 검증 가능)
- 회원 본인 "QR 주기적 자동 갱신" 토글 (디폴트 OFF)

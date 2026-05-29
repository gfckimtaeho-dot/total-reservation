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

## 출입 검증 흐름 (TODO — endpoint 미구현)

1. 트레이너·회원이 핸드폰에서 dashboard 진입 → QR 자동 표시 (영구)
2. 매장 단말이 QR 스캔 → token 추출
3. 서버 verify endpoint 호출:
   - User 조회 (`accessToken` 매칭)
   - status=ACTIVE 확인, gymId 확인
   - (회원만) 멤버십 만료일 검사
4. AccessLog 작성 (성공/거절 모두 기록 — schema에 `AccessResult` enum)
5. 단말에 OK/거절 응답
6. 도어락 열림 (V2 자동화, V1은 수동 안내)

## 자유 운동 통계

- 자유 운동은 예약 row 없음
- AccessLog가 유일한 방문 기록
- 사장 매출·방문 통계 화면에서 PT·단체·자유 운동 구분 표시
- 일별·주별·월별 자유 운동 방문자 수 집계

## 멤버십 만료 처리 (회원 한정)

- 만료일 다음날부터 출입 거절 (verify endpoint에서 차단)
- 만료된 회원이 스캔 시 단말에서 "만료" 표시
- 만료 7일 전 알림 (옵션, 사장이 매장별로 설정)

## 매장 측 장비 (V1)

- 태블릿 + QR 스캐너 앱 (저렴한 옵션)
- 매장 스캐너는 항상 온라인 가정
- **PWA 오프라인 시 출입 검증 안 함, 그냥 입장 허용** (V1 단순화 — 사장 신뢰 모델)

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
- 미구현(다음): 스캐너 태블릿 UI, 게스트 방문 통계, 회원/트레이너 공용 verify 분기.

### 호텔 측 확정 답변 (2026-05-30)

- QR = bare `Stay.id` (cuid) 문자열. URL/JSON 래핑 없음. 메일 본문에도 같은 토큰 텍스트로 병기.
- `gymOptIn=true` 보장 (체크인 시 "헬스장 이용" 선택 + QR 발송 성공 시 재셋). QR 받은 게스트는 전부 true.
- QR 은 체크인(Stay 생성) 이후에만 발송. 예약 시점엔 Stay 없음.
- 체크아웃/조기퇴실 시 `status=CHECKED_OUT`(+checkedOutAt) 즉시 전이. 투숙 중엔 ACTIVE.
- 호텔 BLOCKED 라도 투숙 중 게스트는 출입 허용 (헬스장은 호텔 status 안 봄. BLOCKED 호텔은 신규 체크인 자체가 안 됨). 헬스장 로직 그대로.
- StayStatus 는 ACTIVE/CHECKED_OUT 둘뿐 (CANCELLED 없음). 잘못된 체크인은 체크아웃으로 무름. -> verify 는 `status==='ACTIVE'` whitelist 권고. 향후 status 추가돼도 안전.
- 레이트 체크아웃/연장: 호텔이 `Stay.checkOutDate` 갱신 -> 헬스장 live read 로 자동 반영(재발급/동기화 불필요).
- 게스트 QR 메일 발송 = 100% 호텔 (호텔 코드 + 호텔 SMTP). 헬스장은 READ/검증만. (호텔이 헬스장과 같은 Gmail 발신 계정을 공유할 뿐 코드 경로 독립.)
- 테스트 데이터 (Grand Hotel, ACTIVE): `Stay.id = cmpr49kd9i3nnig13bcp2dv`, gymOptIn=true, status=ACTIVE, 2026-05-29 ~ 2026-06-03 (checkOutDate exclusive -> 06-02 까지 통과, 06-03 부터 거절).

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
7. 날짜창: `checkInDate <= 오늘 < checkOutDate` (checkOutDate exclusive 라 마지막 밤까지 커버). 체크인 전 NOT_YET, 체크아웃일 이후 CHECKED_OUT
8. `GuestAccessLog` 기록 (제휴 컨텍스트가 잡힌 4번 이후의 모든 결과). OK/거절 응답

### 연장(late checkout) 처리

호텔은 자기 DB 의 `Stay.checkOutDate` 만 갱신(호텔 자체 연장 흐름에서 이미 하는 일). 헬스장은 스캔 시점에 최신 `checkOutDate` 를 live read 하므로 헬스장 DB sync 코드가 0. 조기퇴실/취소도 동일하게 호텔이 자기 Stay 갱신하면 헬스장이 자동 반영.

### 결정 완료 (2026-05-30)

- 게스트 출입 로그: 별도 `GuestAccessLog` 모델 (회원 `AccessLog` 와 분리). stayId/hotelId/guestName 스냅샷 보존.
- 호텔-헬스장 매핑: N:N `GymHotelAffiliation` 테이블 (1호텔-1헬스장도 포함). `hotelId`/`stayId` 는 호텔 DB 값이라 cross-DB FK 불가 - 값만 저장하고 verify 가 live read 로 무결성 보장.
- 토큰 = `Stay.id` (cuid). 체크아웃 시 status/날짜창으로 자동 만료. 회수/회전 전용 컬럼은 V2.

### 다음 단계

- admin 제휴 관리 화면: `GymHotelAffiliation` row 생성/활성토글 UI 없음 - 이게 없으면 제휴를 못 맺어 실사용 불가. 다음 우선.
- 스캐너 태블릿 UI (`/g/[slug]/scan` 등): QR 카메라 스캔 -> endpoint 호출 -> OK/거절 표시.
- 회원/트레이너 공용 verify: `User.accessToken`(32자 base64url) 분기 추가. 현재 endpoint 는 token 을 무조건 Stay.id 로 간주.
- 게스트 방문 통계: 자유 운동 집계에 `GuestAccessLog` union.

## V2 로드맵

- PWA 셋업 (manifest + 홈화면 추가 안내)
- 매장 단말 verify endpoint + AccessLog 쓰기
- 자동 도어락 연동 (Bluetooth 또는 ESP32 등)
- 안면인식 옵션 (QR 보완)
- 매장 스캐너 오프라인 캐시 (네트워크 끊겨도 검증 가능)
- 회원 본인 "QR 주기적 자동 갱신" 토글 (디폴트 OFF)

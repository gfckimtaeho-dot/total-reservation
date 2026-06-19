# 디자인 시스템 — 사장 운영 영역 (hybrid-c "Cool Indigo")

> 2026-06-19 채택. 사장(OWNER/MANAGER) 운영 영역의 디자인 표준.
> 고객 영역(`/me`)은 별도(V18 Sunset Peach), 트레이너 영역은 다크 테마로 분리.

## 컨셉

흰 배경 + 또렷한 테두리 + 의미 있는 상태에만 채도색 + sans 헤드라인.
파스텔(violet/lime/amber bg)·serif 헤드라인은 폐기.

design/references/design.md(Bold Outline/뉴 브루탈리즘)는 영감 reference 였고,
**그대로 채택하지 않음**. 그 장점(또렷한 대비, 한눈에 읽히는 상태색)만 차용.

## 토큰

- 배경: `bg-white`. 페이지·카드 모두 흰색.
- 테두리: `border border-zinc-200` (얇은 ring 대신 또렷한 border). 모서리 `rounded-2xl`(카드)/`rounded-lg`(작은 요소).
- 글자: 본문 `text-zinc-900`/`text-zinc-500`(보조). serif(`font-heading`) 미사용, `font-semibold`까지만.
- 포인트 컬러 = indigo. 활성 메뉴 = `bg-indigo-600` 알약(`rounded-full`), 주요 동작 버튼 = `bg-indigo-600`.
- 시맨틱 상태색: emerald(긍정/완료) · amber(주의/진행중) · rose(부정/단체·환불) · sky(정보/정기).
- 회색(zinc fill/opacity)은 "disable" 느낌 → 상태 표현에 쓰지 않음. 0건 카드도 회색 처리 금지(컬러 유지).

## 레이아웃

- 좌측 사이드바 폐지 → **상단 가로 메뉴**(`SidebarNav orientation="top"`). 공용 셸 `OwnerShell`이 상단 바(매장명 + 보조텍스트 + 액션 + 로그아웃) + nav + 콘텐츠 래퍼를 제공. 모든 운영 페이지가 이 셸을 쓴다.
- 카드 = 칩 라벨(시맨틱 bg-100/text-700) + 큰 숫자(`text-4xl font-bold`) + sub 라인. 숫자는 가운데 정렬.

## 오늘의 일정 색 규칙 (시안 2 채택)

한 항목에 두 정보를 동시에 표현:
- **카드 배경 = 상태**: 예정 = 흰색(`border-zinc-200`), 진행중 = `bg-amber-50 border-amber-200`, 완료 = `bg-emerald-50 border-emerald-200`.
- **굵은 좌측 바(`w-1.5` absolute) = 유형**: 개인(PT) = `bg-indigo-500`, 단체(GROUP) = `bg-rose-500`.
- 우측 배지: 진행중(amber) · 완료(emerald) · 단체 "그룹 N/M"(rose).
- 강사 표기: 단체는 "담당강사: {이름}".

상태(진행중/완료/예정)는 **현재 매장 시각** 기준으로 계산(`kpi-data.ts` `deriveTimelineStatus`): `[시작, 시작+소요)` 안이면 진행중, 지났으면 완료, 아직이면 예정. 수동 완료(stored COMPLETED)는 그대로 완료. 소요시간 미상 시 60분 가정. 시각은 매장 타임존(`Business.timeZone`, 예: greenclub=Asia/Manila) 기준.

## 달력(가운데, 단체 수업)

- 흰 셀 + `border-zinc-200`, 오늘 칸 `border-indigo-500 ring-2 ring-indigo-500`.
- 수업 pill: 정기 = `bg-sky-100 text-sky-800`, 단발 = `bg-amber-100 text-amber-800`.

## 롤아웃 상태

- 완료: 대시보드(사장 홈), 회원관리(리스트 + 회원 상세 + OwnerIssuePanel/MemberRow/MembersSearch/MemberAddDialog), 트레이너 관리(리스트 + 트레이너 상세 + 신규/수정 + TrainerRow/TrainersSearch/AttendanceMatrix/TrainerForm/PhotoUploader/LeaveManager/RegenerateQrButton), 영업일(HoursForm/ClosureManager), 상품(products 5탭 + 모든 폼/Edit·Delete 버튼), DobPicker.
- 공유 컴포넌트 indigo 톤 추가됨(ServiceForm/EditServiceButton/DeleteServiceButton/ScheduleManager) — /services 페이지 셸 자체는 아직 미전환(legacy, white 톤 유지).
- 상품 탭별 멀티 파스텔(sky/amber/violet/lime) 폐기 → 흰 카드 + zinc 테두리로 평탄화, 탭 활성 = indigo.
- 공용: `OwnerShell`, `SidebarNav`(top 모드 indigo), `RefreshButton`(indigo), 로딩 셸(top-nav 스켈레톤).
- 완료: 매출현황(revenue page + RevenueChart). KPI 카드 흰색+zinc, 차트 탭 활성 indigo, 순수익=emerald/트레이너 지급=sky 막대 유지, 기본급=amber/세션=indigo 누적바.
- 완료: 방문 통계(visits page + VisitsChart). 자유운동=indigo/PT=sky/단체=amber 누적 막대, 탭 활성 indigo.
- 완료: 환불 요청(refunds page + RefundsTable). 흰 카드+zinc, 탭/검색 활성 indigo, 환불완료 버튼=emerald, 매장귀책 사유 칩=amber 유지.
- 제외: 출입 스캔(`/scan`, AccessScanner). 의도적 풀스크린 다크 키오스크(카메라 단말)이고 무인 공개 키오스크(`/scan/[key]`)와 공유 — violet 레거시 아님, 이미 의미색(허용=emerald/만료=amber/거절=rose). OwnerShell 안 씌움, hybrid-c 전환 대상 아님(2026-06-19 사용자 "그대로 둠" 결정).
- 남음(다음): 채팅 → 설정 + 각 상세 페이지. 같은 `OwnerShell` + 토큰 패턴으로 화면 단위 진행.

### 화면 전환 규칙
- 리스트만 바꾸지 말 것 — 그 화면에서 진입하는 연관 페이지(상세 `[id]`, 신규 `new`, 수정 `[id]/edit`)도 같은 라운드에 전환.
- 공유 컴포넌트가 `tone` 시스템(normal/black/white)을 쓰면, 기존 톤을 건드리지 말고 새 `indigo` 톤을 추가해 적용 — 아직 안 바뀐 다른 화면(다크 트레이너 영역 등)에 색이 번지지 않게.

## 작업 주의 (Windows)

bracket 경로(`[lang]/[slug]`)에서 Turbopack HMR이 불안정 → 수정이 화면에 반영 안 될 수 있음. 수정 후 **`.next` 삭제 + dev 재기동**으로 확실히 반영 확인. (캐시로 오판 금지)

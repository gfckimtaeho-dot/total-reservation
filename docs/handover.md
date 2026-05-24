# 1:1 PT 권 트레이너 양도

트레이너 이직·휴직·사고 등으로 같은 매장 내 다른 트레이너에게 PT(또는 capacity=1 service) 담당을 이관하는 흐름.

## 핵심 결정 (2026-05-25 사장 컨펌)

### 범위

- **대상 서비스**: capacity=1 인 1:1 서비스만 (PT / 1:1 요가 / 1:1 필라테스 등). 단체수업(capacity>1)은 양도 X — `decision_class_deletion_refund_flow` 룰과 일관.
- **단위**: 고객 × 서비스 단위 일괄. 한 고객이 동일 service 권을 여러 개(10회권 + 20회권) 가져도 한 번에 모두 새 트레이너로. 서비스가 다르면 (예: PT + 1:1 요가) 각각 따로 양도.
- **받는 트레이너**: 본인 매장 active TRAINER 전체 (본인 제외). 자격 매핑 phase 2 보류 → 양도하는 트레이너가 직접 선택 (이름 모를 수 없음).

### 양해/동의 흐름

- **사전 채팅 양해는 인간 책임**. 시스템은 동의 버튼 같은 강제 단계 X.
- 양도 실행 시점에 양측 채팅 thread 에 **시스템 메시지 자동 삽입**:
  ```
  {서비스명} 담당 트레이너가 {새 트레이너 이름}으로 변경되었습니다.
  ```
  예: "PT 담당 트레이너가 나리로 변경되었습니다."
- 사유 입력 없음. 양해는 채팅 양해로 충분.
- OWNER/MANAGER 가 일방 양도 가능 (트레이너 잠적/사고 응급 케이스). 시스템 메시지 sender = OWNER userId.

### 미래 예약 처리

- Package 양도와 동시에 **미래 예약 staffId 도 일괄 갱신**.
- 새 트레이너 가용성 충돌 (정기 휴무·근무시간·휴게·기존 예약) 검사 — **충돌 건만 자동 취소**.
- **환불 없음, 권 차감 복귀** (잔여 회수 +1 되돌림). 고객과 PT 수업 중 채팅으로 자연스럽게 새 시간 협의.

### Undo / 재양도

- 양도 후 즉시 다른 트레이너로 재양도 가능 (양도 흐름 재실행).
- Undo 별도 UI 없음. Phase 1.

## 진입점

### 트레이너 본인
- `/g/{slug}/my-clients/[customerId]` — 1:1 권 카드 옆에 "양도" 액션. service 별로 따로 표시.
- 본인이 담당인 권만 양도 가능 (다른 트레이너 담당은 보이지 않음).

### OWNER / MANAGER
- `/g/{slug}/members/[id]` — 회원 상세에 "트레이너 양도" 섹션. service 별 현재 담당 + 변경 액션.
- 모든 service 양도 가능 (응급 케이스 포함).

## 양도 실행 트랜잭션

`handoverServiceAssignment({ slug, customerId, serviceId, toStaffUserId, reason? })`:

1. **권한 가드**
   - 트레이너: 본인이 해당 (customer, service) Package 의 `assignedStaffId` 인 경우만.
   - OWNER/MANAGER: 항상 가능.
   - `toStaffUserId` 가 본인 매장 active TRAINER 인지 확인 (본인 제외).

2. **Package 업데이트**
   - WHERE: gymId + customerId + serviceId + remainingCount > 0
   - SET: assignedStaffId = toStaff.id (Staff.id, User.id 아님 — Package.assignedStaffId 가 Staff FK)

3. **미래 Reservation 처리**
   - WHERE: gymId + customerUserId + serviceId + status IN (CONFIRMED, PENDING_PAYMENT) + startAt >= now
   - 각 예약에 대해 `checkStaffAvailability` + 기존 예약 충돌 검사
   - 충돌 없는 건: `staffId = toStaff.id` 갱신
   - 충돌 건: `status = CANCELLED` + Package.remainingCount +1 복귀 + ReservationLog row 생성 (action = HANDOVER_CONFLICT_CANCEL)

4. **ChatThread 처리**
   - **새 트레이너 ↔ 고객 thread**: find or create. 시스템 메시지 1줄 삽입:
     `{serviceName} 담당 트레이너가 {toStaffName}으로 변경되었습니다.`
   - **옛 담당 트레이너 (양도 직전 `Package.assignedStaff`) ↔ 고객 thread**:
     thread close **하지 않음**. 시스템 메시지 1줄만 삽입:
     `{serviceName} 담당이 {toStaffName}으로 변경되었습니다.`
   - **그 외 트레이너 thread (이번 양도와 무관) 는 건드리지 않음.**
   - close 하지 않는 이유: 채팅 thread 는 (customer, trainer) 페어 단위 1개인데
     양도는 service 단위. 옛 담당 트레이너가 다른 service(예: 단체 댄스 강사)로
     여전히 같은 고객과 연결돼 있을 수 있음 — 일괄 close 하면 그 채널까지 끊김.
     또 양도 후 옛 트레이너가 사후 인사 / 인계 안내를 채팅으로 할 자유도 보존.
   - unique 충돌 회피: `findFirst` → 없으면 `create` 패턴으로 새 트레이너 thread
     를 항상 안전하게 확보. (gym, kind, customer, staffUser) unique 위반 없음.

5. **revalidatePath**: `/my-clients`, `/my-clients/[customerId]`, `/members/[id]`, `/chat` 등

## UI 디테일

### 양도 다이얼로그/페이지
- 진입: 권 카드 옆 "양도" 버튼 클릭 → 모달 또는 별도 라우트(`/handover`).
- 화면 구성:
  - 헤더: "{고객명} · {서비스명} 담당 양도"
  - 현재 담당: {현재 트레이너 이름}
  - 받을 트레이너: 본인 매장 active TRAINER 라디오 (본인 제외, OWNER 시점이면 현재 담당도 제외)
  - 영향 요약: "활성 권 N개 · 미래 예약 M건 → 충돌 시 자동 취소"
  - "양도 실행" 확정 버튼 (warning 톤)

### 결과 화면 / 토스트
- 성공: "{toStaff}로 담당이 변경되었습니다. (미래 예약 M건 중 K건 충돌로 취소)"
- 실패: 사유 표시.

### 디자인 톤
- 트레이너 측 (`/my-clients`): V8 Sunset Gradient (emerald/orange 액센트 — my-clients 라우트 톤 그대로)
- OWNER 측 (`/members/[id]`): 3-theme normal/black/white (sidebar 톤)

## 가드

- capacity > 1 service 는 양도 액션 자체 노출 안 함.
- STORE 채팅 thread 는 영향 X (매장 채널은 트레이너 매핑 무관).
- 트레이너가 본인의 active=false 상태일 때 양도 받는 대상에서 제외.

## 미구현 (다음)

- 자격 매핑 (phase 2): service.requiredSpecialty + Staff.specialties 매칭으로 받는 트레이너 후보 필터.
- OWNER 일괄 양도 (트레이너 1명의 모든 고객 → 다른 트레이너 한 명) — `/trainers/[id]` 에서 "이 트레이너의 모든 고객 일괄 양도" 액션. Phase 1.5 후보.
- PackageHandoverLog audit row — 현재는 audit 컬럼(updatedById) + 시스템 메시지 + ReservationLog 로 추적 가능. Phase 2 도입 검토.

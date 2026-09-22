# 0014 — 카메라/사진 권한 거부 안내

> **관련 태스크**: #51 · **상태**: in-progress
> **depends**: 촬영·Draft [0001](0001-image-capture-and-draft.md) · 아키텍처 [frontend-architecture.md](../../context/frontend-architecture.md)
> **why now**: e2e 시나리오(S17)를 쓰려다 드러난 UX 공백 — 실제 동작을 먼저 구현하고 그 위에 시나리오를 얹는다.

## PRD (왜/무엇)

### 1. 문제
`useImagePicker.pick`가 카메라/사진 권한 거부 시 `return null`로 **아무 안내 없이 조용히 무동작**한다(`// TODO: 설정 이동 안내`). 사용자는 왜 촬영/선택이 안 되는지 알 수 없다. iOS는 권한을 최초 1회만 물으므로, 이후엔 **설정 앱에서만** 허용할 수 있다.

### 2. 목표
- G1. 권한이 거부되면 **안내 다이얼로그** 노출.
- G2. **설정 앱으로 이동**(`Linking.openSettings`) 경로 제공.
- G3. 카메라/사진(라이브러리)에 맞는 문구.

### 3. 비목표
- 권한 온보딩/사전 설명 화면(pre-permission priming) — 후속.
- 취소 후 재요청 로직 — iOS는 설정 이동이 유일 경로라 불필요.

### 4. 제약 (Guardrails)
- 디바이스 API 격리 유지 — UI(EmptyState 등)는 여전히 `expo-image-picker`를 모른다. 안내도 훅/lib 경계 안에서.
- 이미지·경로를 로그로 남기지 않음(기존 guardrail).

### Acceptance
- [x] 카메라 권한 거부 → "카메라 권한이 필요해요" + "설정 열기"/"취소"
- [x] 사진 권한 거부 → "사진 권한이 필요해요" + "설정 열기"/"취소"
- [x] "설정 열기" → `Linking.openSettings` 호출
- [x] 권한 거부 시 addPage 미호출(빈 상태 유지)
- [x] 단위 테스트(안내 로직) + e2e(S17) 작성·실행 · `checks.sh` PASS

## SDD (어떻게)

### ① 읽은 문서/코드
- `useImagePicker.ts`(`requestCameraPermissionsAsync`/`requestMediaLibraryPermissionsAsync` → `!granted`면 `return null`), `EmptyState.tsx`·`PageList.tsx`(captureToDraft 호출부).
- iOS 권한 모델: 최초 1회 프롬프트, 거부 후 재요청은 프롬프트 없이 저장값 반환(`canAskAgain=false`) → 설정 이동이 유일 경로.

### ② 접근
`lib/permission.ts`에 `notifyPermissionDenied(source: PickSource)` 추가 — `react-native`의 `Alert` + `Linking.openSettings`로 안내. `useImagePicker.pick`는 `!granted`일 때 `notifyPermissionDenied(source)` 호출 후 기존대로 `return null`. UI 변경 없음(훅 경계 안).

### ③ 고려한 대안·트레이드오프
- **A. UI(EmptyState)에서 분기·Alert** — 디바이스 관심사가 UI로 샘. 격리 원칙 위반. ✗
- **B(채택). 훅/lib에서 안내** — `useImagePicker`가 이미 권한·피커를 캡슐화 → 거부 안내도 같은 경계. UI 무변경, 테스트는 `Alert`/`Linking` 스파이로. ✓
- **C. 권한 상태를 반환해 호출부가 처리** — 유연하나 모든 호출부(EmptyState·PageList·PageItem)가 중복 처리 → 지금은 과함. 훅 일원화가 단순.
- `canAskAgain` 분기: iOS는 거부 후 사실상 항상 false → 단순화해 **거부면 일관되게 안내**(문구가 항상 설정 이동으로 유효).

### ④ 파일·순서 계획
1. `apps/mobile/src/features/capture/lib/permission.ts` (신규)
2. `apps/mobile/src/features/capture/lib/permission.test.ts` (신규: 카메라/사진 문구 + 설정 열기 콜백)
3. `useImagePicker.ts` 수정 — `notifyPermissionDenied` 호출
4. `.maestro/SCENARIOS.md` S17 + `.maestro/permission-denied.yaml` (반자동: OS 권한 다이얼로그 거부)
5. `checks.sh` 게이트

### ⑤ 위험
- OS 권한 다이얼로그·설정 앱은 Maestro/시뮬레이터에서 자동화가 브리틀(iOS 버전·로케일 의존) → e2e는 **반자동**으로 명시, 안내 로직 자체는 단위로 확정.

### ⑥ 검증 계획
- 단위: `notifyPermissionDenied("camera")` → Alert 제목 "카메라 권한이 필요해요"; `"library"` → "사진 권한이 필요해요"; "설정 열기" onPress → `Linking.openSettings` 호출.
- e2e: 촬영하기 탭 → OS 권한 거부 → 앱 안내 다이얼로그 노출(반자동).
- 게이트: `checks.sh` PASS.

### 검증 결과 (VERIFY 후 채움)
- **단위**: `lib/permission.test.ts` 3케이스 PASS — 카메라→"카메라 권한이 필요해요", 사진→"사진 권한이 필요해요", "설정 열기" onPress→`Linking.openSettings` 호출. `Alert`/`Linking` 스파이.
- **게이트**: `checks.sh` ✅ ALL PASS (mobile 단위 5스위트/25테스트, api 4/19).
- **e2e(S17)**: `permission-denied.yaml` 작성. **반자동** — OS 권한 다이얼로그 "허용 안 함"은 수동(시뮬레이터 브리틀). 안내 로직은 단위가 확정.
- **정직 표기**: OS 권한 다이얼로그·설정 앱 전환은 자동화 브리틀 → CI 완전 자동 아님.

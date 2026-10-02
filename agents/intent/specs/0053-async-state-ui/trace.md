# 0053 — 과정 기록 (trace)

## 판단
- **4곳을 먼저 정독하고 조각을 1:1 대조했다.** 로딩은 다섯 군데(FreeQuotaRow·Chip·RecentEntryButton·RecentListScreen 중앙·푸터) 모두 `<ActivityIndicator accessibilityLabel=…>`(Chip만 size="small", 나머지 기본 small) → 동일 패턴. 에러는 네 군데가 전부 `<Pressable accessibilityRole="button" onPress={refresh}>`지만 **자식이 셋으로 갈림**: danger 텍스트(Row·RecentEntryButton), danger **Badge**(Chip), filled white 텍스트 + 별도 메시지 Text(RecentListScreen). → 억지 통일 대신 `RetryInline`의 `children`·`textClassName`·`className`으로 세 변형을 그대로 재현.
- **단일 `AsyncState(status)`를 버리고 2컴포넌트로 분리.** 소비처가 ready/idle까지 자체 분기하므로 status 하나로 받으면 반대 가지에서 빈 라벨(dead prop)을 강요한다. 로딩/에러 책임을 `LoadingIndicator`·`RetryInline`로 쪼개니 각 호출부가 자기 분기 슬롯에 필요한 것만 꽂아 깔끔.
- **`LoadingIndicator`는 얇지만 값이 있다.** ActivityIndicator 1:1 래퍼지만 `label` required로 **"스피너 a11y 라벨 필수"** 규칙을 타입으로 강제 → 라벨 누락 drift 차단, 로딩을 단위 테스트 대상으로 승격.
- **undefined prop = 원본 "prop 없음" 동치 확인.** FreeQuotaRow 에러는 className·hitSlop·accessibilityLabel 모두 미지정인데, `RetryInline`이 그 자리에 undefined를 넘기므로 원본 `<Pressable>`(해당 prop 없음)과 렌더 동일. 접근명은 자식 danger 텍스트가 제공.
- **표현만 공통화, 판정은 호출부 유지.** status 판정·`refresh()` 바인딩·바깥 컨테이너(카드·정렬·filled 배경·메시지 Text)는 전부 호출부에 남겼다. ui는 스토어를 모른다(결합 0). RecentListScreen 에러의 메시지 Text는 호출부에 두고 버튼만 승격.

## 막힘 / 되돌림
- 공통 컴포넌트 테스트의 `children 렌더` 케이스에서 `r.findAll(testID==="badge-slot")`가 길이 2 반환(host + composite 두 노드) → `toHaveLength(1)` 실패. `.length > 0` 단언으로 교정(노드 중복은 react-test-renderer 특성).
- 소비처 테스트(RecentEntryButton·FreeQuotaChip)를 jest 단독 실행 시 `@clause-lens/contracts` 모듈 미해결로 실패했으나, 이는 **contracts dist 미빌드** 탓(게이트가 선빌드). `checks.sh` 전체 실행에선 정상 통과. 코드 변경과 무관.

## 검증 결과
- `bash agents/harness/evals/checks.sh` **ALL PASS**(contracts/db/infra 빌드 → ui·mobile·api·worker typecheck → 전 유닛 → expo-doctor → 기록 검사).
- ui 유닛: `async-state.test.tsx` 신규(6케이스 — 로딩 ActivityIndicator+라벨·size / 에러-재시도 onPress→onRetry·danger 텍스트 / a11y role=button+label / textClassName·children 오버라이드). ui 스위트 8→9, 테스트 35 PASS.
- mobile 유닛 238 PASS — 기존 `FreeQuotaChip`·`RecentEntryButton` 테스트 **무수정 통과**(스피너 1개·button role·"다시 시도" 텍스트 그대로) = 동작 불변 증거.
- 수치: 소비처 LOC 240→235. 손그림 스피너 5곳·재시도 Pressable 4곳 → 공통 컴포넌트 2개(`LoadingIndicator`·`RetryInline`, 57 LOC) 소비. 변경 파일 7(소비처 4 + index + 신규 컴포넌트·테스트 2), 신규 spec 3.

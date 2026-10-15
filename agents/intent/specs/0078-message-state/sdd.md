# SDD — 메시지·에러 상태 공용 컴포넌트화 + 재구성

- **관련 PRD**: 0078-message-state/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
1. **`packages/ui/src/message-state.tsx`** 신설. props: `icon?`·`title?`·`description?`·`tone?("default"|"danger")`·`actions?`. 루트 `w-full items-center px-6`(배치는 호출측). danger면 description을 `text-danger`로, icon 주면 `IconBadge`(tone 전달). EmptyState와 달리 icon·title 모두 선택적(아이콘 없는 에러 fallback 대응). index.ts export.
2. **5곳 교체**: `apps/mobile/app/result.tsx`(불러오기 실패·gone·error 3분기)·`features/result/ui/ResultScreen.tsx`(`!current`)·`features/documents/ui/RecentListScreen.tsx`(에러). 각 호출측은 중앙 정렬 래퍼(Screen className 또는 flex-1 center View) 유지하고 안에 MessageState.
3. **RecentListScreen 에러**: `RetryInline`(restyle) → `<Button label="다시 시도" variant="primary" onPress={refresh} />`를 MessageState actions로.
4. **RecentEntryButton 'N건'**: raw Pressable → `<ListRow variant="card" title leading(FileClock) trailing(ChevronRight) onPress accessibilityLabel />`. 로딩·에러 상태는 유지.
5. **README**: 핵심 설계 §4 공용 UI 목록에 Screen·MessageState 반영.
6. **테스트**: `message-state.test.tsx`(title/description/tone/actions/icon 조합). 기존 RecentEntryButton·RecentListScreen 테스트는 그대로 통과(ListRow가 role=button·onPress·title 유지, RecentList 테스트는 ready 상태).

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| 신규 MessageState(icon 선택적) | 아이콘 없는 fallback 대응·의미 명확 | 컴포넌트 1개 추가 | ✅ |
| EmptyState 확장(icon 필수 완화) | 재사용 | "빈 상태" 의미와 에러 혼재·icon 필수 설계 깨짐 | ❌ |

## 3. 영향받는 코드 (Touched Surface)
- `packages/ui`: message-state.tsx(신규)·index.ts·message-state.test.tsx(신규)
- `apps/mobile`: app/result.tsx · features/result/ui/ResultScreen.tsx · features/documents/ui/RecentListScreen.tsx · features/documents/ui/RecentEntryButton.tsx
- `README.md`: 공용 UI 목록
- RetryInline은 RecentEntryButton에서 계속 사용 → 제거하지 않음.

## 4. 데이터 / 계약 (Contracts)
변경 없음(표현 재구성).

## 5. 위험과 완화 (Risks)
- R1. 기존 테스트 깨짐 → 완화: RecentEntryButton은 'N건' 행만 ListRow로(에러 "다시 시도"·로딩 유지), ListRow가 role=button·onPress·제목 텍스트 유지. RecentList 테스트는 ready 상태라 에러 분기 무관.
- R2. 간격 정규화로 외형 변동 → 완화: 사용자 명시 허용. 중앙 정렬·버튼 variant는 보존.

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 PR(#198→develop). 컴포넌트/사이트별 독립 revert 가능.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` ALL PASS(mobile·ui 타입체크, ui/mobile 단위).
- 기존 RecentEntryButton·RecentListScreen 테스트 녹색 유지 + MessageState 신규 테스트 통과.

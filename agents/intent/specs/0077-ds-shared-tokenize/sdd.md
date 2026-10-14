# SDD — 디자인 시스템 최적화: 공용 승격 + 토큰화

- **관련 PRD**: 0077-ds-shared-tokenize/prd.md
- **상태**: draft

## 1. 접근 방식 (Approach)
1. **IconBadge 일반화** (`packages/ui/src/icon-badge.tsx`): `box?: "sm"|"md"|"lg"`(기본 md=`h-20 w-20`)·`shape?: "circle"|"rounded"`(기본 circle=`rounded-full`) 프롭 추가. 정적 클래스 맵으로 매핑(NativeWind 컴파일러 호환). 기본값은 현행 클래스와 동일.
2. **승격**: ProcessingScreen 위험(`tone=danger`)·완료(`tone=success`) 배지는 정확 일치로 교체. QuotaExceeded(`tone=warning shape=rounded`)·Hero(`box=lg shape=rounded color=text size=40`)도 교체.
3. **Screen 래퍼** (`packages/ui/src/screen.tsx`): `SafeAreaView edges + className="flex-1 bg-background"`. `edges`·`className` 프롭. 라우트 셸(index·login·recent·result·profile·PagePreviewModal 등) 대체. `react-native-safe-area-context`를 peer+dev 의존에 추가.
4. **토큰화**: ① RecentListScreen `text-white`→`text-primary-foreground` ② IndeterminateBar 애니 스타일 `borderRadius:999`→`radius.full`(토큰 import) ③ tokens에 `overlay.scrim` 추가 후 PageCard rgba 2곳 대체.

## 2. 고려한 대안 (Alternatives)
| 대안 | 장점 | 단점 | 채택? |
| --- | --- | --- | --- |
| IconBadge에 preset 프롭(box/shape) | 정적 클래스 유지·기본 불변 | 프리셋 수 제한 | ✅ |
| className으로 크기 덮어쓰기(현행) | 코드 無 | h-/rounded- 충돌·불안정 | ❌ |
| 폰트 스케일 스냅까지 이번에 | 완전 토큰화 | 외형 변경(시각 결정) → 자율 머지 부적합 | ❌(후속) |

## 3. 영향받는 코드 (Touched Surface)
- `packages/ui`: icon-badge.tsx(프롭), screen.tsx(신규), index.ts(export), package.json(safe-area-context 의존)
- `packages/tokens`: overlay.js(신규)·index.js·index.d.ts
- `apps/mobile`: ProcessingScreen·QuotaExceededScreen·Hero·IndeterminateBar·PageCard·RecentListScreen + 라우트 셸(index·login·recent·result·profile·capture/PagePreviewModal)
- pnpm-lock.yaml(safe-area-context를 ui에 연결)

## 4. 데이터 / 계약 (Contracts)
API/런타임 계약 변경 없음. 공용 컴포넌트 프롭만 추가(하위호환: 기본값=현행).

## 5. 위험과 완화 (Risks)
- R1. 기본 프롭이 현행과 어긋나 기존 IconBadge(ProfileScreen) 외형 변경 → 완화: 기본 box=md·shape=circle을 `h-20 w-20 rounded-full`로 고정(바이트 동일).
- R2. Screen의 SafeAreaView className/edges 불일치로 inset 손실 → 완화: 각 셸의 edges 그대로 이관, bg-background 유지, 타입체크 게이트.
- R3. safe-area-context 의존 추가로 설치/버전 정책 충돌 → 완화: 앱에 이미 설치된 버전 참조. 게이트의 네이티브 단일버전·expo-doctor로 검증. 문제 시 Screen 분리(후속).

## 6. 롤아웃 / 되돌리기 (Rollout & Rollback)
단일 PR(#196→develop). 각 파트가 독립 revert 가능. Screen이 게이트 실패를 유발하면 해당 커밋만 제외.

## 7. 검증 (Verification)
- `bash agents/harness/evals/checks.sh` ALL PASS(특히 Typecheck mobile·ui, Unit tests ui·mobile, Expo Doctor, Native single version).
- IconBadge 기본 사용처(ProfileScreen) 클래스 불변 확인.

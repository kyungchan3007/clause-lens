# 0045 — 분석 결과 화면 리디자인 (SDD)

- **관련 PRD**: 0045-result-redesign/prd.md
- **이슈:** #167
- **상태**: draft — Codex 설계 토론(2026-10-03) 반영 확정

## 0. 읽은 문서
- 확정 시안(디자인 캔버스 Result/Result-Empty), spec 0022(4b, 좌표·상태·degrade 불변), `agents/context/frontend-architecture.md`(shared-first §75)·`highlight-rendering.md`·`clause-result.md`, `packages/tokens`·`packages/ui`, maestro `result.yaml`(S20).

## 1. 접근 (Approach)
- `features/result`의 **표현만** 교체. 불변 경계는 "파일 불변"이 아니라 **동작 불변**(좌표 계산·박스 필터·선택 ID·스냅샷 매칭·상태 분기). HighlightOverlay의 색·투명도·선 두께·모서리 같은 **시각 속성 변경은 허용**.
- shared-first: 범용 조각(`Pager`)은 `packages/ui`로 승격. 결과 전용 조합(`ResultHeader`)은 feature에 둔다(FSD — home의 BrandHeader 재사용 금지).

## 2. 고려한 대안 (Alternatives / Trade-offs)
| 결정 | 대안 | 채택 | 이유 |
| --- | --- | --- | --- |
| 페이지 네비 | 결과 전용 유지 | ❌ | frontend-architecture §75: 제네릭 UI는 재사용 횟수 무관 승격 |
| | **공용 `Pager`(controlled, 상태 비소유)** | ✅ | 라우팅·결과데이터 미포함, 1-based `current` |
| 헤더 | BrandHeader 재사용 | ❌ | home feature 소속 → FSD 경계 위반, API 상이 |
| | **결과 전용 ResultHeader**(IconButton+Pager 조합) | ✅ | 범용 헤더 슬롯까지 만들 필요 없음 |
| 섹션 힌트 | `SectionHeader.action`에 빈 onPress | ❌ | **가짜 버튼**(Pressable+ChevronRight) |
| | `SectionHeader`에 비상호작용 `hint?` + 강조 count 확장 | ✅ | action 의미 보존, N은 중첩 `<Text>` |
| 낮음 위험톤 | 전역 `success`를 slate로 변경 | ❌ | **0건 초록 체크까지 깨짐**(success=안심 전용) |
| | 결과 전용 어댑터만 | 🟡 | 가능하나 분기 증가 |
| | **전역 `riskTone(low): success→neutral`** | ✅ | 저위험 조항=회색(플래그됨), 초록=안심/0건 의미 분리. 시안 일치 |
| 낮음 색 | 기존 neutral(surfaceAlt=slate50·textMuted=slate500) | ❌ | 시안은 slate100/slate600 — 불일치 |
| | **토큰 역할 추가 `neutralBg=neutral100·neutralText=neutral600`**(component tier) | ✅ | 전역 surfaceAlt/textMuted 변경 없이 Badge/Pager만 참조 |
| 0건 | 알약 `1/1` 고정 | ❌ | **0건은 페이지별**(3p 중 2p 0건이면 2/3) |
| | 페이지별 상태 + success EmptyState | ✅ | done+빈배열에만, failed/incomplete 제외 |
| 오버레이 viewport | 바깥 카드 크기 재사용 | ❌ | border·padding만큼 좌표 어긋남 |
| | **Image·SVG가 같은 내부 viewport 공유 + 그 영역 onLayout 측정** | ✅ | 좌표 정합 유지 |

## 3. 영향받는 코드 / 순서 (Touched Surface & Plan)
1. **토큰**: `packages/tokens/semantic.js`에 `neutralBg`(neutral100)·`neutralText`(neutral600) 역할 추가 → `tailwind-preset`·`color.js` 노출. (전역 surfaceAlt/textMuted 불변)
2. **도메인**: `apps/mobile/src/entities/clause` `riskTone(low): "success" → "neutral"`. 영향 범위(DocumentRow 위험 집계 등) 확인.
3. **공용 UI**:
   - `packages/ui/src/pager.tsx`(신규) + index + 단위. controlled `{current(1-based), total, onPrev, onNext}`; `total===1` 정적, `total===0` null; 양끝 실제 disabled + a11y("전체 N페이지 중 M페이지").
   - `packages/ui/src/section-header.tsx`: `hint?: string`(비상호작용) + 제목 강조 count 지원. 기존 `action` 유지.
   - `packages/ui/src/empty-state.tsx`: `tone?`(success→초록 72dp 원형) 최소 확장.
4. **결과 화면**:
   - `features/result/ui/ResultHeader.tsx`(신규): 닫기 IconButton(a11y "분석 결과 닫기")+타이틀(17px/800 근사)+Pager.
   - `ResultScreen.tsx`: 헤더 교체, 이미지 **카드(radius·border)** 로 감싸되 **내부 viewport 측정**, SectionHeader("확인이 필요한 조항 N" + hint, hint는 overlay 가능할 때만), 0건=success EmptyState(페이지별·done+빈배열), 푸터 고지 공통.
   - `ClauseCard.tsx`: 배지 **점(dot)**. 낮음은 neutral tone.
   - `HighlightOverlay.tsx`: fillOpacity .14 / 선택 .28 유지, stroke opacity .6(시각 속성만).
   - 낮음 **근거 원문 생략**은 0022의 표시 요구 변경 → 근거를 trace/sdd에 명시.
5. **테스트**: Pager 단위(단일/첫/중간/마지막·disabled 콜백 차단·a11y), SectionHeader hint 비버튼, 낮음 매핑, 0건/incomplete/failed 분리, overlay 불가 시 hint 숨김. 기존 coordinateTransform·선택·스냅샷 단위 유지. maestro S20에 페이지 전환·조항 선택·닫기·이미지없는 목록 접근 추가(분석 내용 하드 assert 금지).

## 4. 위험과 완화 (Risks)
- R1 오버레이 좌표 어긋남(카드 border/padding) → Image·SVG 공유 내부 viewport를 onLayout로 측정(계산식 불변).
- R2 낮음 톤 전역 변경 blast radius → riskTone 소비처 전수 확인, success는 0건/안심 전용 보존.
- R3 대비: red700/red50≈5.9, amber700/amber50≈4.8(여유 적음→배지 추가 opacity 금지), slate600/slate100≈6.9 — 모두 4.5:1 충족. 사진 위 반투명 박스는 가변 배경이라 보장 불가 → 선택 선두께 차이+목록 라벨/선택 유지, 밝·어두운 실문서 육안.
- R4 `color()` light 고정 → 다크모드 "토큰 썼으니 됨" 금지(이번 범위 아님, 명시).
- R5 17px/800·radius14 토큰 부재 → 근사 허용(문서화), 색 hex 복제는 금지(토큰/역할만).

## 5. 검증 (Verification)
- **단위**: `packages/ui/src/pager.test.tsx` 신규(단일/첫/중간/마지막·disabled·a11y·콜백 6건). `tone.test.ts`(neutral→neutralBg/neutralText 대비 ≥4.5:1)·`risk.test.ts`(low→neutral)·`section-header.test.tsx`(count/hint 후 호환) 갱신·통과. 기존 coordinateTransform·useResultData 단위 불변.
- **게이트**: `bash agents/harness/evals/checks.sh` **ALL PASS**(contracts·db·infra 빌드, mobile/api/worker/ui typecheck, prisma validate, 단위 contracts23·infra11·api84·worker43·mobile272·ui, harness81).
- **maestro S20**: 결과 진입 후 섹션 헤더("확인이 필요한 조항")·참고 고지 푸터 assert 추가(분석 내용·건수 하드 assert 금지).
- **남음(다음 단계)**: 시뮬레이터 육안(300dp·배지 점·페이지 알약·0건 안심·다중박스·선택·좌표불일치·긴제목). 다크모드는 범위 밖(color() light 고정).

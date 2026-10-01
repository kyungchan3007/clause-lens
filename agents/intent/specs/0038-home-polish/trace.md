# 0038 — 과정 기록 (trace)

## 판단
- 순서1(홈) 시안 보정. **설계는 사용자 Q&A로 확정**(Codex 대신 사용자와 직접 수렴):
  - 최근 분석: 인라인 미리보기 → **진입 버튼 → /recent 전체화면**("원할 때 인터랙션으로").
  - 날짜: 오늘/어제(상대일, 시간 미표시).
  - DocumentRow 좌측: 문서 아이콘 → 라인 플레이스홀더.
  - 온보딩 Hero 아이콘: 사용자가 보낸 Main 시안 = ShieldCheck(네이비) → ScanLine에서 교체.
- 갤러리 버튼·하단 중복 "모두 보기"는 유지/자연 해소(최근 인라인 제거로 중복 사라짐).

## 막힘 / 되돌림
- Hero 색: `color("foreground")` 역할 없음 → `color("text")`(네이비 전경)로. ShieldCheck는 레지스트리 기존.
- DocumentRow leading: FileText 아이콘 → 라인 플레이스홀더(60×48 박스 3줄 bg-border). Icon은 trailing chevron에 계속 사용.
- RecentAnalysisSection 제거(홈 인라인 미리보기) → RecentEntryButton 신설(loading/error/0=null/N건). /recent는 RecentListScreen 유지.
- completedAtLabel today → "오늘"(시간·pad 제거). retentionBadge.test "오늘 HH:MM"→"오늘"(now 동일 순간, tz 무관)로 갱신.
- 테스트 함정: RecentEntryButton→documentsStore→auth(@react-native-kakao/user ESM) → `jest.mock("@react-native-kakao/user")`로 체인 차단(FreeQuotaChip와 동일).
- 설계는 사용자 Q&A 확정(Codex 생략): 진입 버튼→/recent·상대일·라인 플레이스홀더·Hero ShieldCheck.
- **추가 지적(사용자)**: 최근있음 홈이 "푸터만" 보이고 **중앙 Hero가 없음**(Hero가 온보딩에서만 렌더됐음). → Hero를 **최근있음에도 표시**하고 **홈 중앙 배치**(ScrollView flexGrow:1 + Hero flex-1 justify-center, 푸터 하단). 시안(센터 Hero+하단 푸터) 구조 일치. 시뮬레이터 실측 확인.

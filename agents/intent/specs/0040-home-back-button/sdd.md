# 0040 — 홈으로 돌아가기 버튼 — SDD

> **관련 PRD**: prd.md · **이슈:** #116 · **갱신**: 2026-10-01

## 1. 접근
- **BrandHeader**: 옵셔널 `onHome?: () => void`. 있으면 좌측 로고칩 대신 **IconButton(ChevronLeft, accessibilityLabel "홈으로")** + "ClauseLens". 없으면 로고칩(기존 시안). 프로필 우측 불변.
- **app/index**: `<BrandHeader onProfile={…} onHome={hasPages ? onReset : undefined} />`. hasPages(담은 페이지·진행·터미널·무료소진)면 홈 버튼 노출, 빈 홈이면 undefined. onReset=기존(cancelAnalysis+resetUpload+ref 해제+clearDraft)→빈 홈.

## 2. 대안
| 대안 | 장점 | 단점 | 채택 |
| --- | --- | --- | --- |
| 로고 탭=홈 | 변경 최소 | 발견성 낮음(버튼 아님) | ❌ |
| 좌측 ChevronLeft(onHome 시) | 명확·일관(recent/result back과 유사) | 로고 자리 교체 | ✅ |
| 홈 버튼 항상 표시 | 단순 | 빈 홈에서 무의미 | ❌ |
| 확인 다이얼로그 | 오터치 방지 | "일단" 빠른 요구와 배치 | ❌(후속) |

## 3. 검증
- 단위: BrandHeader onHome 있으면 "홈으로" 버튼 렌더·onHome 호출 / 없으면 미렌더. 기존 홈 테스트(브랜드명·프로필) 유지.
- 게이트 PASS. 시뮬레이터: 담은 페이지에서 홈으로 → 빈 홈.

# TRACE — 디자인 시스템 최적화: 공용 승격 + 토큰화 (#196)

- 2026-10-15 착수. 사용자(취침 전) 지시: 디자인 시스템 최적화 + shared 승격 + 토큰화, 자율 작업 후 머지·보고.
- 전수 스캔(Explore 서브에이전트)로 근거 확보: IconBadge rigid로 5곳 손그림 · SafeAreaView 셸 8× 중복 · 토큰 우회(색/반경/scrim) · 폰트 스케일 밖 다수.
- 범위 판단: 자율 머지라 **시각 불변** 변경만 채택. 폰트 스케일 스냅·메시지/에러 상태 컴포넌트화는 외형이 바뀌어 사용자 결정이 필요 → 후속 이슈로 분리.
- IconBadge 일반화는 className 덮어쓰기(충돌 위험) 대신 정적 프리셋 프롭(box/shape)으로. 기본값=현행 클래스 고정해 기존 사용처 불변.

- 구현 완료: IconBadge box/shape 프리셋(기본 md·circle=현행) + ProcessingScreen(정확 일치)·QuotaExceeded·Hero 승격. 공용 Screen 신설(safe-area-context peer+dev 추가) + 라우트 6파일 셸 대체(index·login·recent·profile·result×6·PagePreviewModal). 토큰화 3건(primary-foreground·radius.full·overlay.scrim). tokens files 배열 보정.
- 테스트: icon-badge.test.tsx 신규(기본 불변·box/shape 매핑·tone 배경·className 병합·조합 스모크). Screen은 thin wrapper라 safe-area 테스트 환경 불안정 회피 — 타입체크 + 라우트 렌더로 커버.
- 게이트: checks.sh ALL PASS(mobile·ui 타입체크, ui/mobile 단위, expo-doctor, 네이티브 단일버전).

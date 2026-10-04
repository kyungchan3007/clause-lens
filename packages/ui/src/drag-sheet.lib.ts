// DragSheet 순수 로직 — 스냅 결정/인덱스 유틸(렌더·제스처와 분리해 단위 검증).
// 좌표계: translateY(px). 작을수록 더 열림(위), 클수록 접힘(아래). positions는 index-정렬.

export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(index)));
}

// 핸들 탭 = 양 끝 토글(열림 끝 ↔ 접힘 끝). 2스냅이면 0↔1.
export function toggleIndex(current: number, count: number): number {
  if (count <= 1) return 0;
  const last = count - 1;
  return current >= last ? 0 : last;
}

// 드래그 놓을 때 목표 스냅: 현재 위치 + 속도 투영(관성) 후 최근접 스냅.
// velocity px/s(+ 아래쪽=접힘). projectMs는 투영 시간(기본 150ms).
export function resolveSnapIndex(params: {
  positions: number[]; // 각 index의 translateY(px)
  current: number; // 현재 translateY(px)
  velocity: number; // px/s
  projectMs?: number;
}): number {
  const { positions, current, velocity, projectMs = 150 } = params;
  if (positions.length === 0) return 0;
  const projected = current + velocity * (projectMs / 1000);
  let best = 0;
  let bestDist = Infinity;
  positions.forEach((p, i) => {
    const d = Math.abs(p - projected);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  });
  return best;
}

// occupy 비율(0..1, 1=컨테이너 꽉 참=완전 열림) → translateY(px). 컨테이너 높이 기준.
export function occupyToTranslateY(occupy: number, containerHeight: number): number {
  const clamped = Math.max(0, Math.min(1, occupy));
  return Math.round(containerHeight * (1 - clamped));
}

// 펼침(최상단 스냅) 여부 — a11y accessibilityState.expanded.
export function isExpanded(index: number, count: number): boolean {
  return count > 0 && index >= count - 1;
}

// 원본(EXIF 정규화 upright) 픽셀 좌표 → 화면 표시 좌표 변환. (spec 0022 §④)
// 순수 함수 모음. 서버 imageWidth/imageHeight 공간을 기준으로 이미지를 뷰 안에
// contain(비율 유지·전체 표시)으로 배치하고, 위험조항 박스를 그 위 화면 좌표로 옮긴다.

export interface Size {
  width: number;
  height: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Rect = Box;

// 이미지를 뷰 안에 contain 배치했을 때의 배율과 레터박스 오프셋.
export interface ContainFit {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}

function isPositiveSize(size: Size): boolean {
  return (
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

// image를 view 안에 중앙 contain 배치. 뷰/이미지 크기가 유효하지 않으면 null(그리지 않음).
export function computeContainFit(image: Size, view: Size): ContainFit | null {
  if (!isPositiveSize(image) || !isPositiveSize(view)) return null;
  const scale = Math.min(view.width / image.width, view.height / image.height);
  const displayWidth = image.width * scale;
  const displayHeight = image.height * scale;
  return {
    scale,
    offsetX: (view.width - displayWidth) / 2,
    offsetY: (view.height - displayHeight) / 2,
    displayWidth,
    displayHeight,
  };
}

// 원본 박스를 이미지 경계와의 교집합으로 클램프. 폭·높이를 따로 자르지 않고
// 교집합 사각형으로 계산하며, 면적이 0이면 null(버림).
export function clampBoxToImage(box: Box, image: Size): Box | null {
  if (!isPositiveSize(image)) return null;
  const left = Math.max(0, box.x);
  const top = Math.max(0, box.y);
  const right = Math.min(image.width, box.x + box.width);
  const bottom = Math.min(image.height, box.y + box.height);
  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return null;
  return { x: left, y: top, width, height };
}

// 원본 박스 → 화면 사각형. image(서버 크기) 공간 기준으로 view 안 contain 배치.
// 범위 밖은 이미지 경계로 클램프하고, 교집합 면적이 0이면 null. 서버→레이아웃 변환은 한 번만 적용.
export function boxToScreenRect(box: Box, image: Size, view: Size): Rect | null {
  const fit = computeContainFit(image, view);
  if (!fit) return null;
  const clamped = clampBoxToImage(box, image);
  if (!clamped) return null;
  return {
    x: clamped.x * fit.scale + fit.offsetX,
    y: clamped.y * fit.scale + fit.offsetY,
    width: clamped.width * fit.scale,
    height: clamped.height * fit.scale,
  };
}

// 로컬 이미지 크기가 서버 크기와 일치하는지(대응 검증용). 불일치면 호출측이 오버레이를 중단한다.
// 허용 오차(기본 1px)는 인코딩·반올림 차이는 흡수하되 방향 전환·다른 이미지는 걸러낸다.
export function isSizeConsistent(
  server: Size,
  local: Size,
  tolerancePx = 1,
): boolean {
  if (!isPositiveSize(server) || !isPositiveSize(local)) return false;
  return (
    Math.abs(server.width - local.width) <= tolerancePx &&
    Math.abs(server.height - local.height) <= tolerancePx
  );
}

// 오버레이(스크림) — 이미지/썸네일 위에 어둡게 깔아 전경 대비 확보. neutral[900] @ 0.7.
// 테마 불변(항상 어두운 막)이라 전경은 흰색 고정(semantic textInverse로 치환하면 다크에서 뒤집혀 깨짐).
const scrim = "rgba(15,23,42,0.7)";

module.exports = { scrim };

// 그림자 디자인 값(의미). 플랫폼별 RN 변환은 ui 어댑터가 담당(0035).
// card = 리스트 카드의 옅은 입체. iOS=shadow props / Android=elevation.
const card = {
  ios: {
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  android: { elevation: 2 },
};

module.exports = { card };

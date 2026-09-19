// 테스트용 공개 env 기본값(빌드 시 인라인되는 EXPO_PUBLIC_* 대체).
process.env.EXPO_PUBLIC_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

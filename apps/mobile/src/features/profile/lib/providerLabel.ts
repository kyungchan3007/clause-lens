// provider 코드 → 사용자에게 보일 라벨. 미등록 코드는 원문 그대로, 없으면 빈 문자열.
const PROVIDER_LABEL: Record<string, string> = { KAKAO: "카카오" };

export function providerLabelOf(provider: string | undefined): string {
  return PROVIDER_LABEL[provider ?? ""] ?? provider ?? "";
}

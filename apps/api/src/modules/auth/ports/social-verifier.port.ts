// 외부 소셜 provider 검증의 경계(포트). Apple 추가 시 같은 인터페이스로 어댑터만 추가.
export interface SocialProfile {
  provider: "KAKAO";
  providerUserId: string;
  email?: string;
  displayName?: string;
}

export interface SocialVerifier {
  verify(accessToken: string): Promise<SocialProfile>;
}

import { Injectable, UnauthorizedException } from "@nestjs/common";

import type { SocialProfile, SocialVerifier } from "../ports/social-verifier.port";

interface KakaoMeResponse {
  id?: number;
  kakao_account?: {
    email?: string;
    profile?: { nickname?: string };
  };
}

// 앱이 카카오 SDK로 받은 access token을 서버가 카카오 API로 재검증한다(앱 값 불신).
@Injectable()
export class KakaoVerifier implements SocialVerifier {
  async verify(accessToken: string): Promise<SocialProfile> {
    const res = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      // 토큰·응답 원문은 로그에 남기지 않는다(민감정보 로그 금지).
      throw new UnauthorizedException("카카오 토큰 검증에 실패했습니다.");
    }

    const data = (await res.json()) as KakaoMeResponse;
    if (!data.id) {
      throw new UnauthorizedException("카카오 사용자 정보를 확인할 수 없습니다.");
    }

    return {
      provider: "KAKAO",
      providerUserId: String(data.id),
      email: data.kakao_account?.email,
      displayName: data.kakao_account?.profile?.nickname,
    };
  }
}

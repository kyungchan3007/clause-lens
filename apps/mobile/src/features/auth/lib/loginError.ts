// 로그인 실패 원인 → 사용자 친화 문구 매핑(순수 함수).
// 원문 메시지·토큰·프로필은 노출/로깅하지 않는다(guardrail). 여기서 로깅 금지.

const MESSAGE = {
  network: "네트워크 연결을 확인해주세요",
  generic: "로그인에 실패했어요. 잠시 후 다시 시도해주세요",
} as const;

// 카카오 SDK/OS가 사용자 취소에 쓰는 코드들(버전차 대비 다중).
const CANCEL_CODES = ["E_CANCELLED_OPERATION", "CANCELLED", "USER_CANCELLED"];

function codeOf(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    return String((e as { code: unknown }).code ?? "");
  }
  return "";
}

function messageOf(e: unknown): string {
  if (e instanceof Error) return e.message;
  // 일부 SDK/환경은 Error가 아닌 plain object({ message })·DOMException으로 던진다.
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    return typeof m === "string" ? m : "";
  }
  return "";
}

/**
 * 실패 원인을 사용자 문구로 변환한다.
 * @returns 취소면 null(문구 미표시), 그 외엔 친화 문구.
 */
export function mapLoginError(e: unknown): string | null {
  const code = codeOf(e).toUpperCase();
  const msg = messageOf(e);
  const lower = msg.toLowerCase();

  // 1) 사용자 취소 — 실패가 아니므로 문구 미표시. code 우선, message 보조.
  if (CANCEL_CODES.includes(code) || lower.includes("cancel") || msg.includes("취소")) {
    return null;
  }

  // 2) 네트워크 오류 — fetch 실패는 TypeError("Network request failed").
  if (e instanceof TypeError || lower.includes("network")) {
    return MESSAGE.network;
  }

  // 3) 서버 5xx·env 누락·알 수 없음 — 원문 대신 일반 문구.
  return MESSAGE.generic;
}

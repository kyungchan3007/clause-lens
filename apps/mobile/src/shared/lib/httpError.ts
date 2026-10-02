// HTTP status → 의미 분류 공통화. 여러 feature가 복붙하던 `e instanceof HttpError && e.status === N`
// 분기를 단일 함수로. 사용자 문구(한국어)는 각 feature에 유지 — 여기선 "분류"만 한다.
// "서버가 진실의 기준" — 분류는 표현 분기용이며 판단은 서버가 한다.
import { HttpError } from "../http";

// 각 feature가 실제로 분기하던 status 의미:
// 403=무료 소진(quota) · 410=보관 경과(gone) · 401=인증 필요(auth) · 409=충돌/중복(conflict).
// 그 외 status·HttpError 아님(네트워크·스키마 등) = unknown(제네릭 처리).
export type HttpErrorKind = "quota" | "gone" | "auth" | "conflict" | "unknown";

// HttpError(shared/http)를 1차로 식별하되, 번들 경계로 생성자가 달라져 instanceof가
// 실패할 수 있으므로 `status: number`를 가진 객체는 구조적으로도 받아들인다(크로스모듈 폴백).
// status가 없는 에러(네트워크·스키마 등)는 undefined → unknown(제네릭).
function statusOf(e: unknown): number | undefined {
  if (e instanceof HttpError) return e.status;
  if (e && typeof e === "object" && typeof (e as { status?: unknown }).status === "number") {
    return (e as { status: number }).status;
  }
  return undefined;
}

export function classifyHttpError(e: unknown): HttpErrorKind {
  switch (statusOf(e)) {
    case 403:
      return "quota";
    case 410:
      return "gone";
    case 401:
      return "auth";
    case 409:
      return "conflict";
    default:
      return "unknown";
  }
}

import {
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { concatMap, from, interval, map, merge, of, type Observable } from "rxjs";

import { AnalysisNotificationPort } from "../../ports/analysis-notification.port";
import { CurrentUser, type AuthUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AnalysisService } from "./analysis.service";

// SSE 이벤트(Nest는 data만 있으면 됨). lib.dom MessageEvent와 이름 충돌 피함.
interface SseMessage {
  data: string | Record<string, unknown>;
  type?: string;
}

const HEARTBEAT_MS = 25_000;

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class AnalysisController {
  constructor(
    private readonly analysis: AnalysisService,
    private readonly notifications: AnalysisNotificationPort,
  ) {}

  // 분석 요청(멱등) → jobId 즉시 반환(OCR 완료 대기 안 함)
  @Post(":documentId/analyze")
  @HttpCode(200)
  analyze(
    @CurrentUser() user: AuthUser,
    @Param("documentId") documentId: string,
  ) {
    return this.analysis.analyze(user.userId, documentId);
  }

  // 상태 조회(진실의 기준) — 재진입·재연결 fallback
  @Get(":documentId/analysis")
  getStatus(
    @CurrentUser() user: AuthUser,
    @Param("documentId") documentId: string,
  ) {
    return this.analysis.getStatus(user.userId, documentId);
  }

  // SSE 스트림 — 초기 스냅샷 + 변경 알림마다 DB 재조회(동일 shape + stateVersion).
  // 소유권은 초기 조회로 강제(실패 시 스트림 에러로 종료). heartbeat는 초기 성공 후에만.
  @Sse(":documentId/analysis/stream")
  stream(
    @CurrentUser() user: AuthUser,
    @Param("documentId") documentId: string,
  ): Observable<SseMessage> {
    const fetch$ = () => from(this.analysis.getStatus(user.userId, documentId));
    return fetch$().pipe(
      concatMap((first) => {
        const status$ = merge(
          of(first),
          this.notifications.watch(documentId).pipe(concatMap(fetch$)),
        ).pipe(map((data): SseMessage => ({ data })));
        const heartbeat$ = interval(HEARTBEAT_MS).pipe(
          map((): SseMessage => ({ type: "ping", data: "" })),
        );
        return merge(status$, heartbeat$);
      }),
    );
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from "@nestjs/common";

import { RevenueCatWebhookGuard } from "./revenuecat-webhook.guard";
import {
  SubscriptionSyncService,
  type IncomingSubscriptionEvent,
} from "./subscription-sync.service";

// RC 이벤트가 담기는 projectId(DI). 수신함 멱등 키의 일부.
export const REVENUECAT_PROJECT_ID = "REVENUECAT_PROJECT_ID";

// RevenueCat 웹훅 payload(필요 부분만).
interface RevenueCatWebhookBody {
  event?: {
    id?: string;
    type?: string;
    app_user_id?: string;
    environment?: string;
    event_timestamp_ms?: number;
  };
}

// 운영 웹훅 라우트(#165 Slice 2). 공개(JwtAuthGuard 없음) — 인증은 RevenueCatWebhookGuard가 담당.
@Controller("billing/revenuecat")
export class SubscriptionsController {
  constructor(
    private readonly sync: SubscriptionSyncService,
    @Inject(REVENUECAT_PROJECT_ID) private readonly projectId: string,
  ) {}

  @Post("webhook")
  @UseGuards(RevenueCatWebhookGuard)
  @HttpCode(200)
  async webhook(@Body() body: RevenueCatWebhookBody): Promise<{ outcome: string }> {
    // 인증 통과 후에도 입력 검증(필수 필드 없으면 400).
    const event = body.event;
    if (
      !event?.id ||
      !event.app_user_id ||
      !event.environment ||
      typeof event.event_timestamp_ms !== "number"
    ) {
      throw new BadRequestException("invalid_event");
    }

    const environment = event.environment.toLowerCase() === "sandbox" ? "sandbox" : "production";
    const incoming: IncomingSubscriptionEvent = {
      provider: "REVENUECAT",
      projectId: this.projectId,
      eventId: event.id,
      type: event.type ?? "UNKNOWN",
      environment,
      occurredAt: new Date(event.event_timestamp_ms),
      customerId: event.app_user_id,
      payload: body,
    };

    const result = await this.sync.processEvent(incoming, new Date());
    // provider_error(재조회 실패)는 5xx → RC 재시도 유도. 재진입 안전(processed만 중복)으로
    // 재전송이 올바르게 재처리된다. 그 외(applied/noop/duplicate/unmapped/skipped)는 200.
    if (result.outcome === "provider_error") {
      throw new ServiceUnavailableException("provider_requery_failed");
    }
    return { outcome: result.outcome };
  }
}

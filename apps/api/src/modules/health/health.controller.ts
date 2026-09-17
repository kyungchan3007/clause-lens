import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  // Liveness — 서버가 떠서 응답하는지. DB 연결은 확인하지 않는다(readiness는 후속).
  @Get()
  check(): { status: string; timestamp: string } {
    return { status: "ok", timestamp: new Date().toISOString() };
  }
}

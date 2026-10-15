#!/usr/bin/env bash
# 구독 동기화 통합 e2e(#165) — 임시 Postgres(격리 포트 5433) 기동 → 마이그레이션 → e2e → 정리.
# 로컬 5432는 다른 프로젝트가 점유할 수 있어 전용 컨테이너/포트를 쓴다(기존 dev DB 무해).
# 요건: Docker 실행 중. 게이트(checks.sh)와 별개의 on-demand e2e(백엔드판 maestro).
# 사용:  bash scripts/db-e2e.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NAME=clauselens-e2e-pg
PORT=5433
URL="postgresql://clauselens:e2e@localhost:${PORT}/clauselens_e2e"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "▶ 임시 Postgres 기동 (:${PORT})"
docker run -d --name "$NAME" \
  -e POSTGRES_USER=clauselens -e POSTGRES_PASSWORD=e2e -e POSTGRES_DB=clauselens_e2e \
  -p "${PORT}:5432" postgres:17-alpine >/dev/null

echo "▶ 준비 대기 (pg_isready)"
for _ in $(seq 1 60); do
  docker exec "$NAME" pg_isready -U clauselens -d clauselens_e2e >/dev/null 2>&1 && break
done

echo "▶ 마이그레이션 적용 (수기 SQL 포함 전체)"
DATABASE_URL="$URL" pnpm --filter @clause-lens/db exec prisma migrate deploy

echo "▶ e2e 실행 (Nest 모듈 부팅 + 실 Prisma)"
DATABASE_URL="$URL" pnpm --filter @clause-lens/api test:e2e

echo "✅ 구독 동기화 e2e 통과"

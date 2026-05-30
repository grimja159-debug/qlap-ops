/**
 * 시스템 상태 타입.
 *
 * 엔드포인트:
 *   GET /api/health → { ok, service, version, status, environment }  (인증 불필요)
 *
 * 어드민 콘솔은 자신이 의존하는 QLapServices API 하나만 헬스 체크한다
 * (다른 서비스는 nginx에서 노출되지 않아 콘솔에서 직접 확인 불가).
 * 유지보수 모드/멀티서비스 상태판 같은 기능은 백엔드 API가 없어 제공하지 않는다.
 */

export type ServiceStatus = 'online' | 'degraded' | 'offline';

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  status: string;
  environment: string;
}

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  version: string | null;
  environment: string | null;
  checkedAt: string;
  detail?: string;
}

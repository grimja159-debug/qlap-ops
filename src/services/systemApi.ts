/**
 * 시스템 상태 API.
 *
 * 엔드포인트: GET /api/health (인증 불필요)
 *   → { ok, service, version, status, environment }
 *
 * 어드민 콘솔은 자신이 의존하는 QLapServices API 한 곳만 헬스 체크한다.
 * 왕복 지연(latency)은 호출 전후 시각 차이로 직접 측정한다.
 * 실패하면 offline 로 표시(가짜 상태를 만들어내지 않는다).
 */
import { api, ApiError } from './api';
import type { HealthResponse, ServiceHealth } from '../types/system';

export const systemApi = {
  checkHealth: async (): Promise<ServiceHealth> => {
    const startedAt = performance.now();
    const checkedAt = new Date().toISOString();
    try {
      const res = await api.get<HealthResponse>('/api/health');
      const latencyMs = Math.round(performance.now() - startedAt);
      return {
        name: 'QLapServices API',
        status: res.status === 'ok' ? 'online' : 'degraded',
        latencyMs,
        version: res.version ?? null,
        environment: res.environment ?? null,
        checkedAt,
      };
    } catch (error) {
      return {
        name: 'QLapServices API',
        status: 'offline',
        latencyMs: null,
        version: null,
        environment: null,
        checkedAt,
        detail: error instanceof ApiError ? `${error.errorCode}: ${error.message}` : '연결 실패',
      };
    }
  },
};

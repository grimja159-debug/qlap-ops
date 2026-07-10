/**
 * 시스템 상태 API.
 *
 * 엔드포인트: GET /api/health (인증 불필요)
 *   → { ok, service, version, status, environment }
 *
 * 어드민 콘솔은 QLapServices API를 통해 유지보수/PM2 상태를 읽고,
 * 게이트웨이에 노출된 주요 API health도 함께 확인한다.
 * 왕복 지연(latency)은 호출 전후 시각 차이로 직접 측정한다.
 * 실패하면 offline 로 표시(가짜 상태를 만들어내지 않는다).
 */
import { api, ApiError, getApiBaseUrl } from './api';
import type {
  GuildOperationSettings,
  GuildOperationSettingsPatch,
  HealthResponse,
  Pm2LogTail,
  Pm2StatusPayload,
  ServiceHealth,
  SystemState,
} from '../types/system';

export const systemApi = {
  /** 유지보수 모드 등 운영 시스템 상태 조회(super_admin 전용). */
  getState: () =>
    api.get<{ state: SystemState }>('/api/admin/system/state').then((r) => r.state),

  /** 유지보수 모드 토글(super_admin 전용). */
  setMaintenance: (maintenance: boolean, message?: string | null) =>
    api
      .post<{ state: SystemState }>('/api/admin/system/maintenance', {
        maintenance,
        message: message ?? null,
      })
      .then((r) => r.state),

  getPm2Status: () =>
    api.get<{ pm2: Pm2StatusPayload }>('/api/admin/system/pm2').then((r) => r.pm2),

  getPm2LogTail: (input: { name: string; stream?: 'out' | 'err'; lines?: number }) =>
    api
      .get<{ log: Pm2LogTail }>(
        `/api/admin/system/pm2/logs?name=${encodeURIComponent(input.name)}&stream=${encodeURIComponent(input.stream ?? 'out')}&lines=${encodeURIComponent(String(input.lines ?? 80))}`,
      )
      .then((r) => r.log),

  getGuildSettings: () =>
    api.get<{ settings: GuildOperationSettings }>('/api/admin/guild/settings').then((r) => r.settings),

  updateGuildSettings: (input: GuildOperationSettingsPatch) =>
    api
      .patch<{ settings: GuildOperationSettings }>('/api/admin/guild/settings', input)
      .then((r) => r.settings),

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

  checkServiceHealths: async (): Promise<ServiceHealth[]> => {
    const servicesBase = getApiBaseUrl().replace(/\/+$/, '');
    const gatewayBase = servicesBase.replace(/\/services$/, '');
    const targets = [
      { key: 'services', name: 'QLapServices API', url: `${servicesBase}/api/health` },
      { key: 'rofl', name: 'QLapROFL API', url: `${gatewayBase}/rofl/api/health` },
      { key: 'guild', name: 'QLapGuild API', url: `${gatewayBase}/guild/api/health` },
      { key: 'tournament', name: 'QLapTournament API', url: `${gatewayBase}/tournament/api/health` },
      {
        key: 'billing',
        name: 'QLapBilling API',
        url: `${gatewayBase}/api/billing/health`,
        fallbackUrls: [`${gatewayBase}/health`, `${gatewayBase}/billing/api/health`, `${gatewayBase}/billing/health`],
      },
      { key: 'gss', name: 'GSS API', url: `${gatewayBase}/gss/api/health` },
    ];

    return Promise.all(
      targets.map(async (target): Promise<ServiceHealth> => {
        const checkedAt = new Date().toISOString();
        const startedAt = performance.now();
        const fallbackUrls = 'fallbackUrls' in target && Array.isArray(target.fallbackUrls) ? target.fallbackUrls : [];
        const urls = [target.url, ...fallbackUrls];
        let lastDetail = '';
        try {
          for (const url of urls) {
            const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json' } });
            const text = await res.text();
            lastDetail = `HTTP ${res.status}${text ? ` · ${text.slice(0, 160)}` : ''}`;
            if (!res.ok && res.status === 404 && url !== urls[urls.length - 1]) continue;
            const latencyMs = Math.round(performance.now() - startedAt);
          let body: Record<string, unknown> = {};
          if (text) {
            try {
              body = JSON.parse(text) as Record<string, unknown>;
            } catch {
              body = {};
            }
          }
          const rawStatus = typeof body.status === 'string' ? body.status : res.ok ? 'ok' : 'error';
          const online = res.ok && (body.ok !== false) && rawStatus !== 'error';
          return {
            key: target.key,
            name: target.name,
            status: online ? 'online' : res.status >= 500 ? 'offline' : 'degraded',
            latencyMs,
            version: typeof body.version === 'string' ? body.version : null,
            environment: typeof body.environment === 'string' ? body.environment : null,
            checkedAt,
              url,
              detail: online ? undefined : lastDetail,
          };
          }
          throw new Error(lastDetail || '연결 실패');
        } catch (error) {
          return {
            key: target.key,
            name: target.name,
            status: 'offline',
            latencyMs: null,
            version: null,
            environment: null,
            checkedAt,
            url: target.url,
            detail: error instanceof Error ? error.message : '연결 실패',
          };
        }
      }),
    );
  },
};

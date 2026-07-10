/**
 * 시스템 상태 타입.
 *
 * 엔드포인트:
 *   GET /api/health → { ok, service, version, status, environment }  (인증 불필요)
 *
 * 어드민 콘솔은 QLapServices API를 기준으로 유지보수/PM2 상태를 읽고,
 * 공개 게이트웨이를 통해 주요 API health를 함께 확인한다.
 */
import type { PlanId, UserRole } from '../lib/constants';

export type ServiceStatus = 'online' | 'degraded' | 'offline';

export interface HealthResponse {
  ok: boolean;
  service: string;
  version: string;
  status: string;
  environment: string;
}

export interface ServiceHealth {
  key?: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  version: string | null;
  environment: string | null;
  checkedAt: string;
  url?: string;
  detail?: string;
}

export interface Pm2AppStatus {
  name: string;
  status: string;
  pid: number | null;
  restarts: number;
  uptimeMs: number | null;
  memoryBytes: number | null;
  cpu: number | null;
  script: string | null;
  execMode: string | null;
  namespace: string | null;
  unstableRestarts: number | null;
}

export interface Pm2StatusPayload {
  available: boolean;
  checkedAt: string;
  source: 'pm2_jlist';
  apps: Pm2AppStatus[];
  gateway?: {
    checkedAt: string;
    pm2GatewayApps: Array<{ name: string; status: string; pid: number | null }>;
    cloudflaredService: {
      available: boolean;
      status: string | null;
      rawStatus: string | null;
      error: string | null;
    };
  };
  operations?: {
    checkedAt: string;
    runtime: {
      nodeEnv: string | null;
      qlapDataRoot: string | null;
      qstargramDbPath: string | null;
      schemaMode: string | null;
    };
    redis: {
      configured: boolean;
      url: string | null;
      status: string;
      lastError: string | null;
      ping: string | null;
      runtimeCheckedAt: string;
      runtimeCheckError: string | null;
      dir: string | null;
      maxmemory: number | null;
      maxmemoryHuman: string | null;
      maxmemoryPolicy: string | null;
      appendonly: string | null;
      usedMemory: number | null;
      usedMemoryHuman: string | null;
      processId: number | null;
      connectedClients: number | null;
      uptimeSeconds: number | null;
    };
    pathChecks: Array<{
      key: string;
      label: string;
      path: string | null;
      exists: boolean | null;
      required: boolean;
    }>;
    writeWorkers: Array<{
      name: string;
      status: string;
      pid: number | null;
      expectedStopped: boolean;
      gates: Array<{ key: string; value: string | null; safe: boolean }>;
    }>;
    warnings: string[];
  };
  error: string | null;
}

export interface Pm2LogTail {
  appName: string;
  stream: 'out' | 'err';
  lines: number;
  checkedAt: string;
  available: boolean;
  entries: string[];
  error: string | null;
}

/**
 * 운영 시스템 상태(유지보수 모드). 단일 문서 system_state/global.
 * 엔드포인트(super_admin 전용):
 *   GET  /api/admin/system/state          → { ok, state }
 *   POST /api/admin/system/maintenance     → { ok, state }  본문 { maintenance, message? }
 */
export interface SystemState {
  id?: string;
  maintenance: boolean;
  message: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

/**
 * 길드 생성/가입 전역 조건.
 * QLapServices Admin API는 Server DB admin_settings를 우선 사용하고,
 * legacy Firestore 설정은 백엔드 정책에 따라 fallback/import 대상으로만 다룬다.
 */
export interface GuildOperationSettings {
  id?: string;
  joinMode: 'approval' | 'open';
  createAllowedPlans: PlanId[];
  joinAllowedPlans: PlanId[];
  createAllowedRoles: UserRole[];
  joinAllowedRoles: UserRole[];
  maxMembers: number;
  createCostGmTicket: number;
  joinCostGmTicket: number;
  createCostQlCoin: number;
  joinCostQlCoin: number;
  requireKakaoForCreate: boolean;
  requireKakaoForJoin: boolean;
  requireRiotForCreate: boolean;
  requireRiotForJoin: boolean;
  requireDiscordForCreate: boolean;
  requireDiscordForJoin: boolean;
  expandCostGmTicket: number;
  requireEntryTicketForCreate: boolean;
  createEntryTicketItemId: string | null;
  requireEntryTicketForJoin: boolean;
  joinEntryTicketItemId: string | null;
  operationStartHour: number;
  operationEndHour: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export type GuildOperationSettingsPatch = Partial<
  Omit<GuildOperationSettings, 'id' | 'createdAt' | 'updatedAt' | 'updatedBy'>
>;

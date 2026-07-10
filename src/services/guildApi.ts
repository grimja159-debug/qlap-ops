/**
 * 길드 관리 API (조회 + 운영자 변경).
 *
 * 엔드포인트 (QLapServices Admin API):
 *   GET    /api/admin/guilds?seasonId=&status=&q=&limit=   목록            → { guilds }
 *   GET    /api/admin/guilds/:id                            상세            → { guild }
 *   GET    /api/admin/guilds/:id/members                    길드원          → { members }
 *   GET    /api/admin/guilds/:id/logs                       로그            → { logs }
 *   POST   /api/admin/guilds                                길드 생성       → { guild }   (super_admin)
 *   PATCH  /api/admin/guilds/:id                            상태/기본정보   → { guild }   (super_admin)
 *   DELETE /api/admin/guilds/:id                            완전 삭제       → { result }  (super_admin, confirmation)
 *   PATCH  /api/admin/guilds/:id/owner                      길드장 변경     → { guild }   (super_admin)
 *   POST   /api/admin/guilds/:id/members                    길드원 직접추가 → { guild }   (super_admin)
 *   DELETE /api/admin/guilds/:id/members/:uid               길드원 강퇴     → { guild }   (super_admin)
 *
 * 변경 계열은 2026-06-03 QLapServices guildRoutes 에 추가되었다(super_admin 전용).
 */
import { ApiError, api, buildQuery, getAuthToken } from './api';
import { normalizeGatewayApiBase } from './apiBase';
import type { GuildStatus, GuildMemberRole } from '../lib/constants';
import type { Guild, GuildMember, GuildLogs } from '../types/guild';

const GUILD_CORE_BASE_URL = normalizeGatewayApiBase(
  import.meta.env.VITE_QLAP_GUILD_API_BASE_URL,
  'http://localhost:8080/guild',
  'guild',
  ['4200'],
);

async function guildCoreJson<T>(path: string, options: { method: string; body?: object }): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${GUILD_CORE_BASE_URL}${path}`, {
      method: options.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (networkError) {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      networkError instanceof Error ? `Guild API connection failed: ${networkError.message}` : 'Guild API connection failed.',
    );
  }

  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new ApiError(res.status, 'INVALID_JSON_RESPONSE', 'Guild API returned invalid JSON.');
    }
  }
  if (!res.ok || data.ok === false) {
    throw new ApiError(
      res.status,
      typeof data.errorCode === 'string' ? data.errorCode : `HTTP_${res.status}`,
      typeof data.message === 'string' ? data.message : res.statusText,
    );
  }
  return data as T;
}

async function guildCoreRequest<T>(path: string, body: object): Promise<T> {
  return guildCoreJson<T>(path, { method: 'POST', body });
}

export interface GuildListFilter {
  seasonId?: string;
  status?: string;
  q?: string;
  limit?: number;
}

export interface GuildCreateInput {
  seasonId?: string;
  name: string;
  slug?: string;
  ownerUid: string;
  maxMembers?: number;
  description?: string;
  recruitmentMessage?: string;
}

export interface GuildUpdateInput {
  status?: GuildStatus;
  name?: string;
  description?: string;
  maxMembers?: number;
}

export interface GuildDeleteResult {
  deleted: boolean;
  guildId: string;
  removedMembers: number;
}

export interface GuildAddMemberInput {
  uid: string;
  /** owner 는 길드장 변경으로만 부여. 직접 추가는 member(기본)/manager 만. */
  role?: Extract<GuildMemberRole, 'member' | 'manager'>;
}

export interface GuildAddPointsInput {
  amount: number;
  reason: string;
}

export interface GuildAddPointsResult {
  guild: Guild;
  pointLogId: string;
  seasonPointLogId: string | null;
  amount: number;
  reason: string;
  beforeTotal: number;
  afterTotal: number;
}

export interface GuildEmblemResult {
  guild: Guild;
  emblemUrl: string | null;
  previousEmblemUrl: string | null;
}

export interface GuildTransferMemberUidInput {
  fromUid: string;
  toUid: string;
  reason: string;
}

export interface GuildTransferMemberUidResult {
  guild: Guild;
  fromUid: string;
  toUid: string;
}

export interface GuildServerDbDiagnostics {
  checkedAt: string;
  dbPath: string;
  health: 'OK' | 'WARN' | string;
  documents: {
    guilds: number;
    guildMembers: number;
    userGuilds: number;
    userGuildMemberships: number;
  };
  indexes: {
    guildRows: number;
    guildMemberRows: number;
    userGuildMembershipRows: number;
  };
  drift: {
    missingGuildRows: number;
    orphanGuildRows: number;
    missingMemberRows: number;
    orphanMemberRows: number;
    missingUserMembershipRows: number;
  };
  indexedAt: {
    guildRows: string | null;
    guildMemberRows: string | null;
    userGuildMembershipRows: string | null;
  };
}

export interface GuildServerDbReindexResult {
  target: 'all' | 'guilds' | 'members' | 'userGuilds';
  write: boolean;
  rows: Record<string, number>;
  diagnostics: GuildServerDbDiagnostics;
}

export interface GuildSeasonRankingDiagnostic {
  checkedAt: string;
  dbPath: string;
  requestedSeasonId: string | null;
  selectedSeasonId: string;
  health: 'OK' | 'WARN' | string;
  seasonDocuments: {
    total: number;
    byStatus: Array<{ status: string; count: number }>;
    currentCandidates: Array<{
      seasonId: string;
      title: string | null;
      status: string | null;
      updatedAt: string | null;
    }>;
  };
  rankingSource: {
    effectiveSource: 'snapshot' | 'fallback_compute' | string;
    snapshot: {
      exists: boolean;
      rowCount: number;
      generatedAt: string | null;
      source: string | null;
      topN: number | null;
      version: number | null;
      updatedAt: string | null;
    };
    redisCache: {
      key: string;
      hit: boolean;
      ttlMinutesConfigured: number;
      cachedGuildCount: number | null;
      cachedSource: string | null;
    };
    fallbackInputs: {
      seasonEntryRows: number;
      activeSeasonEntryRows: number;
      activeGuildRows: number;
      guildPointLedgerRows: number;
    };
    topGuildRows: Array<{
      guildId: string | null;
      name: string | null;
      totalGuildPoint: number;
      memberCount: number;
      indexedAt: string | null;
    }>;
  };
  guidance: {
    oneGuildVisibleLikelyCauses: string[];
    safeActions: string[];
  };
}

export interface GuildMemberScoreDiagnosticSource {
  exists: boolean;
  source?: 'personal_scores' | 'server_user_profiles' | 'guild_member_rows' | string;
  finalScore?: number | null;
  autoScore?: number | null;
  manualAdjust?: number | null;
  overrideScore?: number | null;
  verifyFlag?: string | null;
  tier?: string | null;
  division?: string | null;
  lp?: number | null;
  queue?: string | null;
  role?: string | null;
  status?: string | null;
  updatedAt?: string | null;
  displayNamePresent?: boolean;
  riotIdPresent?: boolean;
  puuidPresent?: boolean;
}

export interface GuildMemberScoreDiagnostic {
  guildId: string;
  memberPublicId: string;
  found: boolean;
  maskedUid?: string;
  seasonId?: string | null;
  selectedSource?: string;
  sourcePriority?: string[];
  sources?: {
    personalScores: GuildMemberScoreDiagnosticSource;
    serverUserProfiles: GuildMemberScoreDiagnosticSource;
    guildMemberRows: GuildMemberScoreDiagnosticSource;
  };
  uidExposed?: boolean;
  checkedMembers?: number;
  checkedAt?: string;
  message?: string;
}

export const guildApi = {
  list: (filter: GuildListFilter = {}) =>
    api
      .get<{ guilds: Guild[] }>(`/api/admin/guilds${buildQuery({ ...filter })}`)
      .then((r) => r.guilds),

  get: (id: string) =>
    api.get<{ guild: Guild }>(`/api/admin/guilds/${encodeURIComponent(id)}`).then((r) => r.guild),

  members: (id: string) =>
    api
      .get<{ members: GuildMember[] }>(`/api/admin/guilds/${encodeURIComponent(id)}/members`)
      .then((r) => r.members),

  logs: (id: string) =>
    api.get<{ logs: GuildLogs }>(`/api/admin/guilds/${encodeURIComponent(id)}/logs`).then((r) => r.logs),

  /** 운영자 길드 생성(기간/티켓 제약 없이). ownerUid 를 주면 그 유저를 owner 멤버로 등록한다. */
  create: (input: GuildCreateInput) =>
    api.post<{ guild: Guild }>('/api/admin/guilds', input).then((r) => r.guild),

  /** 상태(해체/정지/잠금/활성)·이름·소개·정원 부분 수정. */
  update: (id: string, input: GuildUpdateInput) =>
    api.patch<{ guild: Guild }>(`/api/admin/guilds/${encodeURIComponent(id)}`, input).then((r) => r.guild),

  /** 완전 삭제(문서/멤버/슬러그 제거). confirmation === 'DELETE GUILD' 필요. */
  remove: (id: string, confirmation: string) =>
    api
      .delete<{ result: GuildDeleteResult }>(`/api/admin/guilds/${encodeURIComponent(id)}`, { confirmation })
      .then((r) => r.result),

  /** 길드장 변경. */
  changeOwner: (id: string, newOwnerUid: string) =>
    api
      .patch<{ guild: Guild }>(`/api/admin/guilds/${encodeURIComponent(id)}/owner`, { newOwnerUid })
      .then((r) => r.guild),

  /** 원하는 유저를 곧바로 active 멤버로 추가(기간/티켓/본인인증/승인 제약 없음). */
  addMember: (id: string, input: GuildAddMemberInput) =>
    api
      .post<{ guild: Guild }>(`/api/admin/guilds/${encodeURIComponent(id)}/members`, input)
      .then((r) => r.guild),

  /** 관리자 길드 포인트 추가. reason 은 guildPointLogs/admin_audit_logs 에 함께 기록된다. */
  addPoints: (id: string, input: GuildAddPointsInput) =>
    api
      .post<{ result: GuildAddPointsResult }>(`/api/admin/guilds/${encodeURIComponent(id)}/points`, input)
      .then((r) => r.result),

  updateEmblemUrl: (id: string, emblemUrl: string | null) =>
    api
      .patch<{ result: GuildEmblemResult }>(`/api/admin/guilds/${encodeURIComponent(id)}/emblem`, { emblemUrl })
      .then((r) => r.result),

  uploadEmblem: (id: string, file: File) => {
    const body = new FormData();
    body.set('file', file);
    return api
      .postForm<{ result: GuildEmblemResult }>(`/api/admin/guilds/${encodeURIComponent(id)}/emblem`, body)
      .then((r) => r.result);
  },

  removeEmblem: (id: string) =>
    api
      .delete<{ result: GuildEmblemResult }>(`/api/admin/guilds/${encodeURIComponent(id)}/emblem`)
      .then((r) => r.result),

  /** 길드원 강제 탈퇴(status=kicked). owner 는 강퇴 불가(소유자 변경 먼저). */
  kickMember: (id: string, uid: string) =>
    api
      .delete<{ guild: Guild }>(
        `/api/admin/guilds/${encodeURIComponent(id)}/members/${encodeURIComponent(uid)}`,
      )
      .then((r) => r.guild),

  transferMemberUid: (id: string, input: GuildTransferMemberUidInput) =>
    guildCoreRequest<GuildTransferMemberUidResult>(
      `/api/admin/guilds/${encodeURIComponent(id)}/members/transfer-uid`,
      input,
    ),

  serverDbDiagnostics: () =>
    guildCoreJson<{ diagnostics: GuildServerDbDiagnostics }>('/api/admin/guild/server-db/diagnostics', {
      method: 'GET',
    }).then((r) => r.diagnostics),

  seasonRankingDiagnostics: (seasonId?: string) =>
    guildCoreJson<{ diagnostic: GuildSeasonRankingDiagnostic }>(
      `/api/admin/guild/season-ranking-diagnostics${buildQuery({ seasonId })}`,
      { method: 'GET' },
    ).then((r) => r.diagnostic),

  memberScoreDiagnostic: (guildId: string, memberPublicId: string) =>
    guildCoreJson<{ diagnostic: GuildMemberScoreDiagnostic }>(
      `/api/admin/guild/member-score-diagnostic${buildQuery({ guildId, memberPublicId })}`,
      { method: 'GET' },
    ).then((r) => r.diagnostic),

  reindexServerDb: (input: { target?: 'all' | 'guilds' | 'members' | 'userGuilds'; write?: boolean } = {}) =>
    guildCoreJson<{ result: GuildServerDbReindexResult }>('/api/admin/guild/server-db/reindex', {
      method: 'POST',
      body: input,
    }).then((r) => r.result),
};

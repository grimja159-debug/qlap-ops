import { auth } from '../lib/firebase';
import { ApiError, buildQuery } from './api';
import { normalizeGatewayApiBase } from './apiBase';
import type {
  AdminLiveCwAdminActionResult,
  AdminLiveCwArchiveSummary,
  AdminLiveCwDetail,
  AdminLiveCwFilters,
  AdminLiveCwPatch,
  AdminLiveCwPenaltyMonitor,
  AdminLiveCwPenaltyMonitorFilters,
  AdminLiveCwPolicy,
  AdminLiveCwDiscordServerMonitor,
  AdminLiveCwRewardMonitor,
  AdminLiveCwRewardMonitorFilters,
  AdminLiveCwRoom,
  AdminLiveCwServerDbMonitor,
  AdminFirestoreDependencyMonitor,
} from '../types/liveCw';

const BASE_URL = normalizeGatewayApiBase(
  import.meta.env.VITE_ROFL_API_BASE_URL,
  'http://localhost:8080/rofl',
  'rofl',
  ['4500'],
);

type Envelope<T> = T & { ok?: boolean; errorCode?: string; message?: string };

async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new ApiError(401, 'LOGIN_REQUIRED', 'Login is required.');
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    throw new ApiError(401, 'LOGIN_REQUIRED', 'Could not read Firebase ID token.');
  }
}

async function liveCwAdminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const send = async (token: string) =>
    fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string> | undefined),
      },
    });

  let res: Response;
  try {
    res = await send(await getIdToken(false));
    if (res.status === 401) res = await send(await getIdToken(true));
  } catch (networkError) {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      networkError instanceof Error ? `Live CW admin API connection failed: ${networkError.message}` : 'Live CW admin API connection failed.',
    );
  }

  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      body = null;
    }
  }

  if (!res.ok || body?.ok === false) {
    throw new ApiError(
      res.status,
      (body?.errorCode as string | undefined) ?? `HTTP_${res.status}`,
      (body?.message as string | undefined) ?? res.statusText ?? 'Live CW admin API request failed.',
    );
  }

  return (body ?? {}) as T;
}

export const liveCwAdminApi = {
  getPolicy: () =>
    liveCwAdminRequest<Envelope<{ policy: AdminLiveCwPolicy }>>('/api/admin/live-cw/policy').then((res) => res.policy),

  getRewardMonitor: (input: AdminLiveCwRewardMonitorFilters = {}) =>
    liveCwAdminRequest<Envelope<AdminLiveCwRewardMonitor>>(
      `/api/admin/live-cw/rewards/monitor${buildQuery({
        rewardLimit: input.rewardLimit ?? 50,
        coinLogLimit: input.coinLogLimit ?? 100,
        workerLimit: input.workerLimit ?? 30,
        period: input.period ?? '7d',
        status: input.status || undefined,
        roomId: input.roomId?.trim() || undefined,
        rewardTxId: input.rewardTxId?.trim() || undefined,
      })}`,
    ),

  getPenaltyMonitor: (input: AdminLiveCwPenaltyMonitorFilters = {}) =>
    liveCwAdminRequest<Envelope<AdminLiveCwPenaltyMonitor>>(
      `/api/admin/live-cw/penalties/users${buildQuery({
        limit: input.limit ?? 50,
        logLimit: input.logLimit ?? 100,
        uid: input.uid?.trim() || undefined,
        action: input.action || undefined,
        activeOnly: input.activeOnly === true ? true : undefined,
      })}`,
    ),

  getDiscordServers: () =>
    liveCwAdminRequest<Envelope<AdminLiveCwDiscordServerMonitor>>('/api/admin/live-cw/discord/servers'),

  getFirestoreDependencies: (input: { limit?: number } = {}) =>
    liveCwAdminRequest<Envelope<AdminFirestoreDependencyMonitor>>(
      `/api/admin/live-cw/firestore-dependencies${buildQuery({ limit: input.limit ?? 50 })}`,
    ),

  getServerDbMonitor: (input: { limit?: number } = {}) =>
    liveCwAdminRequest<Envelope<AdminLiveCwServerDbMonitor>>(
      `/api/admin/live-cw/server-db-monitor${buildQuery({ limit: input.limit ?? 20 })}`,
    ),

  updatePolicy: (patch: Partial<AdminLiveCwPolicy>) =>
    liveCwAdminRequest<Envelope<{ policy: AdminLiveCwPolicy }>>('/api/admin/live-cw/policy', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((res) => res.policy),

  listRooms: (filters: AdminLiveCwFilters = {}) =>
    liveCwAdminRequest<Envelope<{ rooms?: AdminLiveCwRoom[] }>>(
      `/api/admin/live-cw/rooms${buildQuery({
        limit: filters.limit ?? 100,
        status: filters.status,
        phase: filters.status ? undefined : filters.phase,
        createdVia: filters.createdVia || undefined,
        includeDeleted: filters.includeDeleted,
      })}`,
    ).then((res) => res.rooms ?? []),

  getRoom: (roomId: string) =>
    liveCwAdminRequest<Envelope<AdminLiveCwDetail>>(`/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}`),

  updateRoom: (roomId: string, patch: AdminLiveCwPatch) =>
    liveCwAdminRequest<Envelope<AdminLiveCwDetail>>(`/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),

  endRoom: (roomId: string) =>
    liveCwAdminRequest<Envelope<AdminLiveCwDetail>>(`/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/end`, {
      method: 'POST',
      body: '{}',
    }),

  cancelRoom: (roomId: string) =>
    liveCwAdminRequest<Envelope<AdminLiveCwDetail>>(`/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/cancel`, {
      method: 'POST',
      body: '{}',
    }),

  rejudgeRoom: (roomId: string, input: { reason?: string; write?: boolean } = {}) =>
    liveCwAdminRequest<Envelope<AdminLiveCwAdminActionResult>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/rejudge`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: input.reason, write: input.write === true, confirm: input.write === true }),
      },
    ),

  overrideFinalResult: (
    roomId: string,
    input: { winnerTeam?: 'BLUE' | 'RED' | ''; reason?: string; write?: boolean } = {},
  ) =>
    liveCwAdminRequest<Envelope<AdminLiveCwAdminActionResult>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/override-final-result`,
      {
        method: 'POST',
        body: JSON.stringify({
          winnerTeam: input.winnerTeam || undefined,
          reason: input.reason,
          write: input.write === true,
          confirm: input.write === true,
        }),
      },
    ),

  reverseReissueReward: (roomId: string, input: { winnerTeam: 'BLUE' | 'RED' }) =>
    liveCwAdminRequest<Envelope<Record<string, unknown>>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/reverse-reissue-reward`,
      {
        method: 'POST',
        body: JSON.stringify({ winnerTeam: input.winnerTeam, confirm: true }),
      },
    ),

  getArchive: (roomId: string) =>
    liveCwAdminRequest<Envelope<{ roomId: string; archiveMeta?: Record<string, unknown> | null }>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/archive`,
    ),

  archiveRoom: (roomId: string, input: { reason?: string; write?: boolean; force?: boolean } = {}) =>
    liveCwAdminRequest<Envelope<{ roomId: string; dryRun: boolean; force: boolean; result: Record<string, unknown>; archiveMeta?: Record<string, unknown> | null }>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/archive`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: input.reason,
          write: input.write === true,
          confirm: input.write === true,
          force: input.force === true,
        }),
      },
    ),

  retryArchive: (roomId: string, input: { reason?: string; write?: boolean; force?: boolean } = {}) =>
    liveCwAdminRequest<Envelope<{ roomId: string; dryRun: boolean; force: boolean; result: Record<string, unknown>; archiveMeta?: Record<string, unknown> | null }>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/archive/retry`,
      {
        method: 'POST',
        body: JSON.stringify({
          reason: input.reason,
          write: input.write === true,
          confirm: input.write === true,
          force: input.force === true,
        }),
      },
    ),

  getArchiveSignedUrl: (roomId: string, kind: 'room' | 'audit' | 'result') =>
    liveCwAdminRequest<Envelope<{ roomId: string; kind: 'room' | 'audit' | 'result'; bucket: string; objectKey: string; url: string; expiresInSeconds: number }>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/archive/signed-url${buildQuery({ kind })}`,
    ),

  getArchiveSummary: (roomId: string, kind: 'room' | 'audit' | 'result') =>
    liveCwAdminRequest<Envelope<AdminLiveCwArchiveSummary>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}/archive/summary${buildQuery({ kind })}`,
    ),

  deleteRoom: (roomId: string) =>
    liveCwAdminRequest<Envelope<{ roomId: string; deleted: boolean; softDeleted: boolean }>>(
      `/api/admin/live-cw/rooms/${encodeURIComponent(roomId)}`,
      {
        method: 'DELETE',
      },
    ),
};

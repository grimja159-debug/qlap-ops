import { auth } from '../lib/firebase';
import { ApiError, buildQuery } from './api';
import { gatewayLocalFallback, getDevOnlyEnvValue, normalizeGatewayApiBase } from './apiBase';
import type {
  BracketType,
  EntryRequirement,
  EntryRequirementMode,
  Prize,
  PrizeType,
  SeedDefaultTournamentTemplatesResult,
  Tournament,
  TournamentInput,
  TournamentStatus,
  TournamentTemplate,
  TournamentTemplateInput,
} from '../types/tournament';

const BASE_URL = normalizeGatewayApiBase(
  getDevOnlyEnvValue(['VITE', 'TOURNAMENT', 'API', 'BASE', 'URL']),
  gatewayLocalFallback('tournament'),
  'tournament',
  ['4300'],
);

export function getTournamentApiBaseUrl() {
  return BASE_URL;
}

type Envelope<T> = T & { ok?: boolean; errorCode?: string; message?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeStatus(value: unknown): TournamentStatus {
  if (value === 'draft' || value === 'open' || value === 'in_progress' || value === 'finished' || value === 'cancelled') {
    return value;
  }
  return 'draft';
}

function normalizeBracketType(value: unknown): BracketType {
  return value === 'double_elimination' ? 'double_elimination' : 'single_elimination';
}

function normalizeEntryRequirement(value: unknown, fallbackFee = 0): EntryRequirement {
  const raw = isRecord(value) ? value : {};
  const mode = readString(raw.mode);
  const validMode: EntryRequirementMode =
    mode === 'FREE' || mode === 'TICKET' || mode === 'QLAP_COIN' || mode === 'PRO_ONLY' || mode === 'CUSTOM'
      ? mode
      : fallbackFee > 0
        ? 'QLAP_COIN'
        : 'FREE';

  return {
    mode: validMode,
    amount: readNumber(raw.amount) ?? (validMode === 'QLAP_COIN' ? fallbackFee : 0),
    label: readString(raw.label) ?? (validMode === 'FREE' ? '무료 참가' : undefined),
    description: readString(raw.description),
  };
}

function normalizePrizes(value: unknown): Prize[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    const rank = readNumber(item.rank);
    const label = readString(item.label);
    const rawType = readString(item.type);
    if (!rank || !label) return [];
    const type: PrizeType =
      rawType === 'GUILD_POINT' ||
      rawType === 'QLAP_COIN' ||
      rawType === 'TICKET' ||
      rawType === 'ITEM' ||
      rawType === 'CASH_LIKE' ||
      rawType === 'CUSTOM'
        ? rawType
        : 'CUSTOM';
    return [{ rank, type, label, amount: readNumber(item.amount), extraText: readString(item.extraText) }];
  });
}

function rewardPrizes(raw: Record<string, unknown>): Prize[] {
  const rewardConfig = isRecord(raw.rewardConfig) ? raw.rewardConfig : {};
  const direct = normalizePrizes(raw.prizes);
  return direct.length > 0 ? direct : normalizePrizes(rewardConfig.prizes);
}

function toTemplate(raw: unknown): TournamentTemplate {
  const row = isRecord(raw) ? raw : {};
  const id = readString(row.id) ?? readString(row.templateId) ?? '';
  return {
    id,
    templateId: readString(row.templateId) ?? id,
    name: readString(row.name) ?? '이름 없는 템플릿',
    description: readString(row.description),
    guildScoreLimit: readNumber(row.guildScoreLimit) ?? 0,
    defaultEntryRequirement: normalizeEntryRequirement(row.defaultEntryRequirement),
    defaultPrizes: normalizePrizes(row.defaultPrizes),
    bracketType: normalizeBracketType(row.bracketType),
    teamSize: readNumber(row.teamSize) ?? 5,
    minGuilds: readNumber(row.minGuilds) ?? 2,
    maxGuilds: readNumber(row.maxGuilds) ?? 16,
    isActive: readBoolean(row.isActive) ?? true,
    createdAt: readString(row.createdAt),
    updatedAt: readString(row.updatedAt),
  };
}

function toTournament(raw: unknown): Tournament {
  const row = isRecord(raw) ? raw : {};
  const groupConfig = isRecord(row.groupConfig) ? row.groupConfig : {};
  const id = readString(row.id) ?? readString(row.tournamentId) ?? '';
  const entryFeeQcoin = readNumber(row.entryFeeQcoin) ?? 0;
  const status = normalizeStatus(row.status);
  const title = readString(row.title) ?? readString(row.name) ?? '이름 없는 멸망전';
  const maxGuilds = readNumber(row.maxGuilds) ?? readNumber(row.participantLimit) ?? readNumber(groupConfig.maxGuilds) ?? 0;

  return {
    id,
    tournamentId: readString(row.tournamentId) ?? id,
    templateId: readString(row.templateId),
    title,
    name: readString(row.name) ?? title,
    description: readString(row.description),
    status,
    guildScoreLimit: readNumber(row.guildScoreLimit) ?? readNumber(row.teamPointCap) ?? 0,
    entryRequirement: normalizeEntryRequirement(row.entryRequirement, entryFeeQcoin),
    prizes: rewardPrizes(row),
    bracketType: normalizeBracketType(row.bracketType ?? groupConfig.bracketType),
    teamSize: readNumber(row.teamSize) ?? readNumber(groupConfig.teamSize) ?? 5,
    minGuilds: readNumber(row.minGuilds) ?? readNumber(groupConfig.minGuilds) ?? 2,
    maxGuilds,
    registrationStartAt: readString(row.registrationStartAt) ?? readString(row.applyOpenAt),
    registrationEndAt: readString(row.registrationEndAt) ?? readString(row.applyCloseAt),
    tournamentStartAt: readString(row.tournamentStartAt) ?? readString(row.startsAt),
    tournamentEndAt: readString(row.tournamentEndAt),
    registeredGuildCount: readNumber(row.registeredGuildCount) ?? 0,
    createdBy: readString(row.createdBy) ?? readString(row.createdByUid),
    createdAt: readString(row.createdAt),
    updatedAt: readString(row.updatedAt),
    userPageVisible: status !== 'draft',
  };
}

async function getTournamentIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError(401, 'LOGIN_REQUIRED', '로그인이 필요합니다. 다시 로그인해 주세요.');
  }
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    throw new ApiError(401, 'LOGIN_REQUIRED', '인증 토큰을 가져오지 못했습니다. 다시 로그인해 주세요.');
  }
}

async function tournamentRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;

  const buildHeaders = (token: string): Record<string, string> => {
    const headers: Record<string, string> = isFormData ? {} : { 'Content-Type': 'application/json' };
    headers.Authorization = `Bearer ${token}`;
    return { ...headers, ...(options?.headers as Record<string, string> | undefined) };
  };

  const send = async (token: string): Promise<Response> => {
    try {
      return await fetch(url, { ...options, headers: buildHeaders(token) });
    } catch (networkError) {
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        networkError instanceof Error
          ? `멸망전 서버에 연결할 수 없습니다: ${networkError.message}`
          : '멸망전 서버에 연결할 수 없습니다.',
      );
    }
  };

  let res = await send(await getTournamentIdToken(false));
  if (res.status === 401) {
    res = await send(await getTournamentIdToken(true));
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

  if (!res.ok || (body != null && body.ok === false)) {
    const fallbackCode = res.status === 401 ? 'LOGIN_REQUIRED' : res.status === 403 ? 'ADMIN_REQUIRED' : `HTTP_${res.status}`;
    const fallbackMessage =
      res.status === 401
        ? '로그인이 필요합니다. 세션이 만료되었을 수 있습니다.'
        : res.status === 403
          ? '관리자 권한이 필요합니다.'
          : res.statusText || '멸망전 요청 처리에 실패했습니다.';
    throw new ApiError(res.status, (body?.errorCode as string) ?? fallbackCode, (body?.message as string) ?? fallbackMessage);
  }

  return (body ?? {}) as T;
}

function cleanObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '' && !Number.isNaN(item))) as T;
}

function tournamentPayload(input: TournamentInput): Record<string, unknown> {
  return cleanObject({
    templateId: input.templateId,
    title: input.title,
    name: input.title,
    description: input.description,
    status: input.status,
    guildScoreLimit: input.guildScoreLimit,
    teamPointCap: input.guildScoreLimit,
    entryRequirement: input.entryRequirement,
    entryFeeQcoin: input.entryRequirement.mode === 'QLAP_COIN' ? input.entryRequirement.amount ?? 0 : 0,
    prizes: input.prizes,
    bracketType: input.bracketType,
    teamSize: input.teamSize,
    minGuilds: input.minGuilds,
    maxGuilds: input.maxGuilds,
    participantLimit: input.maxGuilds,
    registrationStartAt: input.registrationStartAt,
    registrationEndAt: input.registrationEndAt,
    tournamentStartAt: input.tournamentStartAt,
    tournamentEndAt: input.tournamentEndAt,
    groupConfig: {
      bracketType: input.bracketType,
      teamSize: input.teamSize,
      minGuilds: input.minGuilds,
      maxGuilds: input.maxGuilds,
    },
    rewardConfig: {
      prizes: input.prizes,
    },
  });
}

export interface TournamentDbCollectionSummary {
  collection: string;
  label: string;
  count: number;
  latestCreatedAt: string | null;
  latestUpdatedAt: string | null;
}

export interface TournamentDbInspectorRow {
  collection: string;
  id: string;
  tournamentId: string | null;
  applicationId: string | null;
  teamId: string | null;
  guildId: string | null;
  uid: string | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  payload: Record<string, unknown>;
}

export interface TournamentDbInspector {
  service: 'QLapTournament';
  storage: 'server-db';
  dbPath: string;
  generatedAt: string;
  selectedCollection: string | null;
  selectedId: string | null;
  limit: number;
  totalRows: number;
  collections: TournamentDbCollectionSummary[];
  rows: TournamentDbInspectorRow[];
  xml: string;
  guide: Array<{ title: string; description: string }>;
}

export const tournamentAdminApi = {
  listTemplates: () =>
    tournamentRequest<Envelope<{ templates?: unknown[]; items?: unknown[] }>>('/api/admin/tournament-templates').then((response) =>
      (Array.isArray(response.templates) ? response.templates : response.items ?? []).map(toTemplate),
    ),

  createTemplate: (input: TournamentTemplateInput) =>
    tournamentRequest<Envelope<{ template: unknown }>>('/api/admin/tournament-templates', {
      method: 'POST',
      body: JSON.stringify(input),
    }).then((response) => toTemplate(response.template)),

  updateTemplate: (templateId: string, input: TournamentTemplateInput) =>
    tournamentRequest<Envelope<{ template: unknown }>>(`/api/admin/tournament-templates/${encodeURIComponent(templateId)}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }).then((response) => toTemplate(response.template)),

  seedDefaultTemplates: () =>
    tournamentRequest<Envelope<{ templates: unknown[]; created?: number; updated?: number }>>(
      '/api/admin/tournament-templates/seed-defaults',
      { method: 'POST', body: JSON.stringify({}) },
    ).then(
      (response): SeedDefaultTournamentTemplatesResult => ({
        templates: (response.templates ?? []).map(toTemplate),
        created: readNumber(response.created) ?? 0,
        updated: readNumber(response.updated) ?? 0,
      }),
    ),

  listTournaments: (params: { limit?: number; status?: TournamentStatus | '' } = {}) =>
    tournamentRequest<Envelope<{ tournaments?: unknown[]; items?: unknown[] }>>(
      `/api/admin/tournaments${buildQuery({ limit: params.limit ?? 100, status: params.status || undefined })}`,
    ).then((response) => (Array.isArray(response.tournaments) ? response.tournaments : response.items ?? []).map(toTournament)),

  createTournament: (input: TournamentInput) =>
    tournamentRequest<Envelope<{ tournament: unknown }>>('/api/admin/tournaments', {
      method: 'POST',
      body: JSON.stringify(tournamentPayload(input)),
    }).then((response) => toTournament(response.tournament)),

  updateTournament: (tournamentId: string, input: TournamentInput) =>
    tournamentRequest<Envelope<{ tournament: unknown }>>(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}`, {
      method: 'PUT',
      body: JSON.stringify(tournamentPayload(input)),
    }).then((response) => toTournament(response.tournament)),

  cancelTournament: (tournamentId: string) =>
    tournamentRequest<Envelope<{ tournament: unknown }>>(`/api/admin/tournaments/${encodeURIComponent(tournamentId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({}),
    }).then((response) => toTournament(response.tournament)),

  openFromTemplate: (input: TournamentInput & { templateId: string }) =>
    tournamentRequest<Envelope<{ tournament: unknown }>>('/api/admin/tournaments/open-from-template', {
      method: 'POST',
      body: JSON.stringify(tournamentPayload(input)),
    }).then((response) => toTournament(response.tournament)),

  verifyPublicList: () =>
    tournamentRequest<Envelope<{ tournaments?: unknown[]; items?: unknown[] }>>('/api/tournaments?limit=100').then((response) =>
      (Array.isArray(response.tournaments) ? response.tournaments : response.items ?? []).map(toTournament),
    ),

  getDbInspector: (params: { collection?: string | null; id?: string | null; limit?: number } = {}) =>
    tournamentRequest<Envelope<{ inspector: TournamentDbInspector }>>(
      `/api/admin/db-inspector/tournament${buildQuery({
        collection: params.collection || undefined,
        id: params.id || undefined,
        limit: params.limit ?? 50,
      })}`,
    ).then((response) => response.inspector),
};

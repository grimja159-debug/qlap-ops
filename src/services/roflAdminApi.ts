import { auth } from '../lib/firebase';
import { ApiError, buildQuery } from './api';
import { normalizeGatewayApiBase } from './apiBase';
import type {
  AdminRoflArtifactKind,
  AdminRoflJob,
  AdminRoflJobAction,
  AdminRoflJobFilters,
  AdminRoflLocalArtifactBucket,
  AdminRoflLocalArtifactMonitor,
  AdminRoflLocalArtifactSample,
  AdminR2ArtifactList,
} from '../types/rofl';

const BASE_URL = normalizeGatewayApiBase(
  import.meta.env.VITE_ROFL_API_BASE_URL,
  'http://localhost:8080/rofl',
  'rofl',
  ['4500'],
);

type Envelope<T> = T & { ok?: boolean; errorCode?: string; message?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

const ROFL_ARTIFACT_KINDS = new Set(['manifest', 'summary', 'players', 'teams', 'rawBasic']);

function toR2JsonArtifacts(raw: unknown): AdminRoflJob['r2JsonArtifacts'] {
  const row = isRecord(raw) ? raw : {};
  const artifacts = Array.isArray(row.artifacts)
    ? row.artifacts
        .filter(isRecord)
        .map((artifact) => {
          const kind = readString(artifact.artifact);
          if (!kind || !ROFL_ARTIFACT_KINDS.has(kind)) return null;
          return {
            artifact: kind as AdminRoflArtifactKind,
            fileName: readString(artifact.fileName) ?? '-',
            objectKey: readString(artifact.objectKey),
            signedUrlRequired: artifact.signedUrlRequired !== false,
          };
        })
        .filter((artifact): artifact is NonNullable<typeof artifact> => artifact !== null)
    : [];
  return {
    storageMode: readString(row.storageMode) ?? 'private',
    publicUrl: readString(row.publicUrl),
    jsonOutputPrefix: readString(row.jsonOutputPrefix),
    available: readBoolean(row.available),
    artifacts,
  };
}

function toRawFileCleanup(raw: unknown): AdminRoflJob['rawFileCleanup'] {
  const row = isRecord(raw) ? raw : {};
  const status = readString(row.status);
  if (!status) return undefined;
  return {
    status,
    rawFileDeleted: readBoolean(row.rawFileDeleted),
    deletedAt: readString(row.deletedAt),
    deleteError: readString(row.deleteError),
    bytes: readNumber(row.bytes),
    storageMode: readString(row.storageMode),
    localPathHidden: row.localPathHidden !== false,
  };
}

function toRoflJob(raw: unknown): AdminRoflJob {
  const row = isRecord(raw) ? raw : {};
  const verification = isRecord(row.matchVerification) ? row.matchVerification : null;
  return {
    jobId: readString(row.jobId) ?? '',
    status: readString(row.status) ?? 'unknown',
    sourceType: readString(row.sourceType),
    matchRecordId: readString(row.matchRecordId),
    roomId: readString(row.roomId),
    tournamentId: readString(row.tournamentId),
    tournamentMatchId: readString(row.tournamentMatchId),
    guildId: readString(row.guildId),
    uploaderUid: readString(row.uploaderUid) ?? '',
    region: readString(row.region) ?? '-',
    originalFileName: readString(row.originalFileName) ?? '-',
    fileSize: readNumber(row.fileSize),
    r2Bucket: readString(row.r2Bucket),
    r2ObjectKey: readString(row.r2ObjectKey),
    storageMode: readString(row.storageMode),
    localInputDeletedAt: readString(row.localInputDeletedAt),
    localInputDeleteError: readString(row.localInputDeleteError),
    rawFileCleanup: toRawFileCleanup(row.rawFileCleanup),
    jsonOutputPrefix: readString(row.jsonOutputPrefix),
    attempts: readNumber(row.attempts),
    errorCode: readString(row.errorCode),
    errorMessage: readString(row.errorMessage),
    createdAt: readString(row.createdAt),
    updatedAt: readString(row.updatedAt),
    processingStartedAt: readString(row.processingStartedAt),
    finishedAt: readString(row.finishedAt),
    adminActionHistory: Array.isArray(row.adminActionHistory) ? row.adminActionHistory : undefined,
    r2JsonArtifacts: toR2JsonArtifacts(row.r2JsonArtifacts),
    matchVerification: verification
      ? {
          matchStatus: readString(verification.matchStatus),
          reportedWinnerTeam: readString(verification.reportedWinnerTeam),
          roflWinnerTeam: readString(verification.roflWinnerTeam),
          participantVerificationStatus: readString(verification.participantVerificationStatus),
          matchedCount: readNumber(verification.matchedCount),
          expectedCount: readNumber(verification.expectedCount),
          roflCount: readNumber(verification.roflCount),
          teamMatchedCount: readNumber(verification.teamMatchedCount),
          finalResultExists: readBoolean(verification.finalResultExists),
          disputeReason: readString(verification.disputeReason),
        }
      : null,
  };
}

function toLocalArtifactSample(raw: unknown): AdminRoflLocalArtifactSample {
  const row = isRecord(raw) ? raw : {};
  const bucket = readString(row.bucket);
  return {
    bucket: bucket === 'jobs' || bucket === 'input' || bucket === 'output' ? bucket : 'output',
    path: readString(row.path) ?? '-',
    bytes: readNumber(row.bytes) ?? 0,
    ageHours: readNumber(row.ageHours) ?? 0,
    modifiedAt: readString(row.modifiedAt) ?? '',
  };
}

function toLocalArtifactBucket(raw: unknown): AdminRoflLocalArtifactBucket {
  const row = isRecord(raw) ? raw : {};
  const bucket = readString(row.bucket);
  return {
    bucket: bucket === 'jobs' || bucket === 'input' || bucket === 'output' ? bucket : 'output',
    root: readString(row.root) ?? '-',
    exists: readBoolean(row.exists),
    underDataRoot: readBoolean(row.underDataRoot),
    extensions: Array.isArray(row.extensions) ? row.extensions.map((item) => String(item)) : [],
    scannedFiles: readNumber(row.scannedFiles) ?? 0,
    totalFiles: readNumber(row.totalFiles) ?? 0,
    staleFiles: readNumber(row.staleFiles) ?? 0,
    totalBytes: readNumber(row.totalBytes) ?? 0,
    staleBytes: readNumber(row.staleBytes) ?? 0,
    sampleStaleFiles: Array.isArray(row.sampleStaleFiles) ? row.sampleStaleFiles.map(toLocalArtifactSample) : [],
    truncated: readBoolean(row.truncated),
  };
}

function toLocalArtifactMonitor(raw: unknown): AdminRoflLocalArtifactMonitor {
  const row = isRecord(raw) ? raw : {};
  const totals = isRecord(row.totals) ? row.totals : {};
  const cleanupCommandPreview = isRecord(row.cleanupCommandPreview) ? row.cleanupCommandPreview : {};
  return {
    generatedAt: readString(row.generatedAt) ?? '',
    write: false,
    cutoffHours: readNumber(row.cutoffHours) ?? 24,
    maxFiles: readNumber(row.maxFiles) ?? 5000,
    ok: readBoolean(row.ok),
    totals: {
      scannedFiles: readNumber(totals.scannedFiles) ?? 0,
      totalFiles: readNumber(totals.totalFiles) ?? 0,
      staleFiles: readNumber(totals.staleFiles) ?? 0,
      totalBytes: readNumber(totals.totalBytes) ?? 0,
      staleBytes: readNumber(totals.staleBytes) ?? 0,
    },
    buckets: Array.isArray(row.buckets) ? row.buckets.map(toLocalArtifactBucket) : [],
    cleanupCommandPreview: {
      dryRun: readString(cleanupCommandPreview.dryRun) ?? 'npm.cmd run rofl:local-cleanup',
      writeRequiresManualApproval:
        readString(cleanupCommandPreview.writeRequiresManualApproval) ?? 'npm.cmd run rofl:local-cleanup -- --write',
    },
  };
}

function toR2ArtifactList(raw: unknown, note?: string | null): AdminR2ArtifactList {
  const row = isRecord(raw) ? raw : {};
  return {
    bucket: readString(row.bucket) ?? '-',
    prefix: readString(row.prefix) ?? '',
    limit: readNumber(row.limit) ?? 100,
    count: readNumber(row.count) ?? 0,
    hasMore: readBoolean(row.hasMore),
    nextContinuationToken: readString(row.nextContinuationToken),
    storageMode: 'private',
    publicUrl: null,
    note: note ?? null,
    objects: Array.isArray(row.objects)
      ? row.objects.filter(isRecord).map((object) => ({
          objectKey: readString(object.objectKey) ?? '-',
          sizeBytes: readNumber(object.sizeBytes),
          lastModified: readString(object.lastModified),
          storageClass: readString(object.storageClass),
          type: readString(object.type) ?? 'OBJECT',
        }))
      : [],
  };
}

async function getIdToken(forceRefresh = false): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new ApiError(401, 'LOGIN_REQUIRED', 'Login is required.');
  }
  try {
    return await user.getIdToken(forceRefresh);
  } catch {
    throw new ApiError(401, 'LOGIN_REQUIRED', 'Could not read Firebase ID token.');
  }
}

async function roflAdminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const send = async (token: string) =>
    fetch(url, {
      ...options,
      method: options.method ?? 'GET',
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
      networkError instanceof Error ? `ROFL API connection failed: ${networkError.message}` : 'ROFL API connection failed.',
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
      (body?.message as string | undefined) ?? res.statusText ?? 'ROFL API request failed.',
    );
  }

  return (body ?? {}) as T;
}

export const roflAdminApi = {
  listR2Artifacts: (options: { prefix?: string; limit?: number; continuationToken?: string | null } = {}) =>
    roflAdminRequest<Envelope<{ artifacts: unknown; note?: string }>>(
      `/api/admin/r2/artifacts${buildQuery({
        prefix: options.prefix ?? 'outrofl/',
        limit: options.limit ?? 100,
        continuationToken: options.continuationToken ?? undefined,
      })}`,
    ).then((res) => toR2ArtifactList(res.artifacts, readString(res.note))),

  getLocalArtifacts: (options: { hours?: number; maxFiles?: number } = {}) =>
    roflAdminRequest<Envelope<{ monitor: unknown }>>(
      `/api/admin/rofl/local-artifacts${buildQuery({
        hours: options.hours ?? 24,
        maxFiles: options.maxFiles ?? 5000,
      })}`,
    ).then((res) => toLocalArtifactMonitor(res.monitor)),

  listJobs: (filters: AdminRoflJobFilters = {}) =>
    roflAdminRequest<Envelope<{ jobs?: unknown[] }>>(
      `/api/admin/rofl/jobs${buildQuery({
        limit: filters.limit ?? 100,
        status: filters.status,
        sourceType: filters.sourceType,
        matchRecordId: filters.matchRecordId,
        roomId: filters.roomId,
        uploaderUid: filters.uploaderUid,
      })}`,
    ).then((res) => (Array.isArray(res.jobs) ? res.jobs : []).map(toRoflJob)),

  getJob: (jobId: string) =>
    roflAdminRequest<Envelope<{ job: unknown }>>(`/api/admin/rofl/jobs/${encodeURIComponent(jobId)}`).then((res) =>
      toRoflJob(res.job),
    ),

  runJobAction: (jobId: string, action: AdminRoflJobAction, reason: string) =>
    roflAdminRequest<Envelope<{ job: unknown; action: string }>>(
      `/api/admin/rofl/jobs/${encodeURIComponent(jobId)}/${action}`,
      {
        method: 'POST',
        body: JSON.stringify({ reason, confirm: true }),
      },
    ).then((res) => toRoflJob(res.job)),

  getArtifactSignedUrl: (jobId: string, artifact: AdminRoflArtifactKind) =>
    roflAdminRequest<
      Envelope<{
        jobId: string;
        artifact: AdminRoflArtifactKind;
        storageMode: 'private';
        publicUrl: null;
        bucket: string;
        objectKey: string;
        url: string;
        expiresInSeconds: number;
      }>
    >(
      `/api/admin/rofl/jobs/${encodeURIComponent(jobId)}/artifacts/signed-url${buildQuery({
        artifact,
        expiresInSeconds: 300,
      })}`,
    ),
};

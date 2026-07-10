import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { TextField, SelectField, NumberField } from '../components/Field';
import { formatDateTime, formatNumber } from '../lib/format';
import type { Tone } from '../lib/statusTone';
import { roflAdminApi } from '../services/roflAdminApi';
import type {
  AdminRoflArtifactKind,
  AdminRoflJob,
  AdminRoflJobAction,
  AdminRoflJobFilters,
  AdminRoflLocalArtifactBucket,
  AdminRoflLocalArtifactSample,
} from '../types/rofl';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'queued', label: 'queued' },
  { value: 'processing', label: 'processing' },
  { value: 'done', label: 'done' },
  { value: 'failed', label: 'failed' },
  { value: 'canceled', label: 'canceled' },
];

const SOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All source types' },
  { value: 'CUSTOM_LIVE_CW', label: 'CUSTOM_LIVE_CW' },
  { value: 'TOURNAMENT', label: 'TOURNAMENT' },
  { value: 'DESTRUCTION_MATCH', label: 'DESTRUCTION_MATCH' },
  { value: 'GUILD_TOURNAMENT', label: 'GUILD_TOURNAMENT' },
  { value: 'GUILD_WAR', label: 'GUILD_WAR' },
];

function statusTone(status: string): Tone {
  if (status === 'queued') return 'warning';
  if (status === 'processing') return 'info';
  if (status === 'done') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'canceled') return 'neutral';
  return 'neutral';
}

function matchTone(status: string | null | undefined): Tone {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'DISPUTED') return 'danger';
  if (status === 'ROFL_PROCESSED') return 'info';
  if (status === 'ROFL_UPLOADED' || status === 'RESULT_REPORTED') return 'warning';
  return 'neutral';
}

function dash(value: string | null | undefined): string {
  return value && value.trim() ? value : '-';
}

function short(value: string | null | undefined): string {
  if (!value) return '-';
  return value.length > 24 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value;
}

function artifactLabel(artifact: AdminRoflArtifactKind): string {
  if (artifact === 'rawBasic') return 'raw';
  return artifact;
}

function inputCleanupTone(job: AdminRoflJob): Tone {
  if (job.rawFileCleanup?.status === 'DELETE_FAILED') return 'danger';
  if (job.rawFileCleanup?.status === 'DELETED') return 'success';
  if (job.rawFileCleanup?.status === 'CLEANUP_PENDING') return 'warning';
  if (job.rawFileCleanup?.status === 'PENDING_WORKER') return 'neutral';
  if (job.localInputDeleteError) return 'danger';
  if (job.localInputDeletedAt) return 'success';
  if (job.storageMode === 'local') return job.status === 'done' || job.status === 'failed' ? 'warning' : 'neutral';
  return 'neutral';
}

function inputCleanupLabel(job: AdminRoflJob): string {
  if (job.rawFileCleanup?.status === 'DELETE_FAILED') return 'raw delete failed';
  if (job.rawFileCleanup?.status === 'DELETED') return 'raw deleted';
  if (job.rawFileCleanup?.status === 'CLEANUP_PENDING') return 'cleanup pending';
  if (job.rawFileCleanup?.status === 'PENDING_WORKER') return 'waiting worker';
  if (job.rawFileCleanup?.status === 'NOT_LOCAL') return 'not local';
  if (job.localInputDeleteError) return 'delete failed';
  if (job.localInputDeletedAt) return 'input deleted';
  if (job.storageMode === 'local') return 'local input pending';
  return 'not local';
}

function inputCleanupDetail(job: AdminRoflJob): string {
  const cleanup = job.rawFileCleanup;
  const dateOrError = cleanup?.deletedAt
    ? formatDateTime(cleanup.deletedAt)
    : cleanup?.deleteError
      ? short(cleanup.deleteError)
      : job.localInputDeletedAt
        ? formatDateTime(job.localInputDeletedAt)
        : job.localInputDeleteError
          ? short(job.localInputDeleteError)
          : cleanup?.storageMode ?? job.storageMode ?? '-';
  const bytes = cleanup?.bytes ?? job.fileSize;
  return `${dateOrError} · ${formatBytes(bytes)} · path hidden`;
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '–';
  if (value < 1024) return `${value.toLocaleString('ko-KR')} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

const localArtifactBucketColumns: Column<AdminRoflLocalArtifactBucket>[] = [
  { key: 'bucket', header: 'bucket', render: (bucket) => <span className="font-mono text-xs">{bucket.bucket}</span> },
  {
    key: 'status',
    header: 'status',
    render: (bucket) => (
      <div className="flex flex-wrap gap-1">
        <StatusBadge label={bucket.exists ? 'exists' : 'missing'} tone={bucket.exists ? 'success' : 'danger'} />
        <StatusBadge label={bucket.underDataRoot ? 'data-root' : 'outside'} tone={bucket.underDataRoot ? 'success' : 'warning'} />
        {bucket.truncated && <StatusBadge label="truncated" tone="warning" />}
      </div>
    ),
  },
  { key: 'root', header: 'root', render: (bucket) => <span className="font-mono text-xs text-zinc-400">{bucket.root}</span> },
  { key: 'files', header: 'files', render: (bucket) => `${formatNumber(bucket.totalFiles)} / scanned ${formatNumber(bucket.scannedFiles)}` },
  { key: 'stale', header: 'stale', render: (bucket) => <span className={bucket.staleFiles > 0 ? 'text-amber-300' : 'text-zinc-300'}>{formatNumber(bucket.staleFiles)}</span> },
  { key: 'bytes', header: 'bytes', render: (bucket) => formatBytes(bucket.totalBytes) },
  { key: 'staleBytes', header: 'stale bytes', render: (bucket) => formatBytes(bucket.staleBytes) },
];

const localArtifactSampleColumns: Column<AdminRoflLocalArtifactSample>[] = [
  { key: 'bucket', header: 'bucket', render: (sample) => <span className="font-mono text-xs">{sample.bucket}</span> },
  { key: 'path', header: 'masked path', render: (sample) => <span className="font-mono text-xs text-zinc-400">{sample.path}</span> },
  { key: 'ageHours', header: 'age', render: (sample) => `${formatNumber(sample.ageHours)}h` },
  { key: 'bytes', header: 'bytes', render: (sample) => formatBytes(sample.bytes) },
  { key: 'modifiedAt', header: 'modified', render: (sample) => formatDateTime(sample.modifiedAt) },
];

const baseColumns: Column<AdminRoflJob>[] = [
  {
    key: 'jobId',
    header: 'jobId',
    render: (job) => <span className="font-mono text-xs text-zinc-200">{short(job.jobId)}</span>,
  },
  {
    key: 'status',
    header: 'status',
    render: (job) => <StatusBadge label={job.status} tone={statusTone(job.status)} />,
  },
  { key: 'sourceType', header: 'sourceType', render: (job) => <span className="font-mono text-xs">{dash(job.sourceType)}</span> },
  { key: 'matchRecordId', header: 'matchRecordId', render: (job) => <span className="font-mono text-xs">{short(job.matchRecordId)}</span> },
  {
    key: 'matchStatus',
    header: 'match',
    render: (job) =>
      job.matchVerification?.matchStatus ? (
        <StatusBadge label={job.matchVerification.matchStatus} tone={matchTone(job.matchVerification.matchStatus)} />
      ) : (
        '-'
      ),
  },
  {
    key: 'winners',
    header: 'reported/rofl',
    render: (job) => (
      <span className="font-mono text-xs">
        {dash(job.matchVerification?.reportedWinnerTeam)} / {dash(job.matchVerification?.roflWinnerTeam)}
      </span>
    ),
  },
  {
    key: 'participants',
    header: 'participants',
    render: (job) => (
      <span className="text-xs">
        {dash(job.matchVerification?.participantVerificationStatus)} · {formatNumber(job.matchVerification?.matchedCount)}/
        {formatNumber(job.matchVerification?.expectedCount ?? job.matchVerification?.roflCount)}
      </span>
    ),
  },
  {
    key: 'final',
    header: 'final/dispute',
    render: (job) => (
      <span className="text-xs">
        {job.matchVerification?.finalResultExists ? 'final' : '-'}
        {job.matchVerification?.disputeReason ? ` · ${job.matchVerification.disputeReason}` : ''}
      </span>
    ),
  },
  { key: 'roomId', header: 'roomId', render: (job) => <span className="font-mono text-xs">{short(job.roomId)}</span> },
  { key: 'tournamentId', header: 'tournamentId', render: (job) => <span className="font-mono text-xs">{short(job.tournamentId)}</span> },
  { key: 'tournamentMatchId', header: 'tournamentMatchId', render: (job) => <span className="font-mono text-xs">{short(job.tournamentMatchId)}</span> },
  { key: 'guildId', header: 'guildId', render: (job) => <span className="font-mono text-xs">{short(job.guildId)}</span> },
  { key: 'uploaderUid', header: 'uploaderUid', render: (job) => <span className="font-mono text-xs">{short(job.uploaderUid)}</span> },
  { key: 'region', header: 'region', render: (job) => job.region },
  { key: 'attempts', header: 'attempts', render: (job) => formatNumber(job.attempts) },
  {
    key: 'inputCleanup',
    header: 'raw cleanup',
    render: (job) => (
      <div className="flex max-w-[12rem] flex-col gap-1">
        <StatusBadge label={inputCleanupLabel(job)} tone={inputCleanupTone(job)} />
        <span className="text-[11px] text-zinc-500">{inputCleanupDetail(job)}</span>
      </div>
    ),
  },
  { key: 'createdAt', header: 'createdAt', render: (job) => formatDateTime(job.createdAt) },
  { key: 'updatedAt', header: 'updatedAt', render: (job) => formatDateTime(job.updatedAt) },
  {
    key: 'r2JsonArtifacts',
    header: 'private JSON evidence',
    render: (job) =>
      job.r2JsonArtifacts?.available ? (
        <div className="flex max-w-[16rem] flex-wrap gap-1">
          <StatusBadge label="private" tone="success" />
          <StatusBadge label="signed URL only" tone="info" />
          <span className="font-mono text-[11px] text-zinc-500" title={job.r2JsonArtifacts.jsonOutputPrefix ?? undefined}>
            {short(job.r2JsonArtifacts.jsonOutputPrefix)}
          </span>
        </div>
      ) : (
        <StatusBadge label="no json" tone="neutral" />
      ),
  },
  {
    key: 'error',
    header: 'error',
    render: (job) => (
      <span className="max-w-[18rem] truncate text-xs text-red-300" title={job.errorMessage ?? job.errorCode ?? undefined}>
        {job.errorCode || job.errorMessage ? `${dash(job.errorCode)} ${dash(job.errorMessage)}` : '-'}
      </span>
    ),
  },
];

export function AdminRoflJobsPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<AdminRoflJobFilters>({ limit: 100 });
  const [filters, setFilters] = useState<AdminRoflJobFilters>({ limit: 100 });
  const [lastActionJob, setLastActionJob] = useState<AdminRoflJob | null>(null);
  const [lastArtifactRequest, setLastArtifactRequest] = useState<Record<string, unknown> | null>(null);

  const jobsQuery = useQuery({
    queryKey: ['admin-rofl-jobs', filters],
    queryFn: () => roflAdminApi.listJobs(filters),
  });

  const localArtifactsQuery = useQuery({
    queryKey: ['admin-rofl-local-artifacts', 24, 5000],
    queryFn: () => roflAdminApi.getLocalArtifacts({ hours: 24, maxFiles: 5000 }),
    refetchInterval: 60_000,
  });

  const jobs = useMemo(() => jobsQuery.data ?? [], [jobsQuery.data]);
  const actionMutation = useMutation({
    mutationFn: ({ jobId, action, reason }: { jobId: string; action: AdminRoflJobAction; reason: string }) =>
      roflAdminApi.runJobAction(jobId, action, reason),
    onSuccess: (job) => {
      setLastActionJob(job);
      void qc.invalidateQueries({ queryKey: ['admin-rofl-jobs'] });
    },
  });
  const runJobAction = useCallback((job: AdminRoflJob, action: AdminRoflJobAction) => {
    const reason = window.prompt(`${action.toUpperCase()} reason`, `ADMIN_${action.toUpperCase()}`);
    if (!reason) return;
    if (!window.confirm(`${action.toUpperCase()} ROFL job ${job.jobId}?`)) return;
    actionMutation.mutate({ jobId: job.jobId, action, reason });
  }, [actionMutation]);

  const artifactSignedUrlMutation = useMutation({
    mutationFn: ({ jobId, artifact }: { jobId: string; artifact: AdminRoflArtifactKind }) =>
      roflAdminApi.getArtifactSignedUrl(jobId, artifact),
    onSuccess: (result) => {
      setLastArtifactRequest({
        jobId: result.jobId,
        artifact: result.artifact,
        storageMode: result.storageMode,
        publicUrl: result.publicUrl,
        bucket: result.bucket,
        objectKey: result.objectKey,
        expiresInSeconds: result.expiresInSeconds,
        url: '[opened in new tab]',
      });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    },
  });

  const openArtifact = useCallback((job: AdminRoflJob, artifact: AdminRoflArtifactKind) => {
    if (!job.r2JsonArtifacts?.available) return;
    artifactSignedUrlMutation.mutate({ jobId: job.jobId, artifact });
  }, [artifactSignedUrlMutation]);

  const columns = useMemo<Column<AdminRoflJob>[]>(
    () => [
      ...baseColumns,
      {
        key: 'artifacts',
        header: 'artifacts',
        render: (job) => (
          <div className="flex max-w-[17rem] flex-wrap gap-1">
            {(job.r2JsonArtifacts?.artifacts ?? []).map((artifact) => (
              <button
                key={`${job.jobId}-${artifact.artifact}`}
                type="button"
                disabled={artifactSignedUrlMutation.isPending || !job.r2JsonArtifacts?.available || !artifact.objectKey}
                onClick={() => openArtifact(job, artifact.artifact)}
                title={artifact.objectKey ?? undefined}
                className="rounded border border-cyan-700/60 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-950/30 disabled:opacity-40"
              >
                {artifactLabel(artifact.artifact)}
              </button>
            ))}
            {!job.r2JsonArtifacts?.available && <span className="text-[11px] text-zinc-500">worker output 없음</span>}
          </div>
        ),
      },
      {
        key: 'actions',
        header: 'actions',
        render: (job) => (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              disabled={actionMutation.isPending || !['failed', 'canceled'].includes(job.status)}
              onClick={() => runJobAction(job, 'retry')}
              className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
            >
              retry
            </button>
            <button
              type="button"
              disabled={actionMutation.isPending || !['done', 'failed', 'canceled'].includes(job.status)}
              onClick={() => runJobAction(job, 'reprocess')}
              className="rounded border border-amber-700/60 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-950/30 disabled:opacity-40"
            >
              reprocess
            </button>
            <button
              type="button"
              disabled={actionMutation.isPending || job.status !== 'queued'}
              onClick={() => runJobAction(job, 'cancel')}
              className="rounded border border-red-700/60 px-2 py-1 text-[11px] text-red-200 hover:bg-red-950/30 disabled:opacity-40"
            >
              cancel
            </button>
          </div>
        ),
      },
    ],
    [actionMutation.isPending, artifactSignedUrlMutation.isPending, openArtifact, runJobAction],
  );
  const summary = useMemo(
    () => ({
      total: jobs.length,
      queued: jobs.filter((job) => job.status === 'queued').length,
      processing: jobs.filter((job) => job.status === 'processing').length,
      failed: jobs.filter((job) => job.status === 'failed').length,
      canceled: jobs.filter((job) => job.status === 'canceled').length,
    }),
    [jobs],
  );
  const storageSummary = useMemo(
    () => ({
      privateInput: jobs.filter((job) => job.storageMode === 'private').length,
      localInput: jobs.filter((job) => job.storageMode === 'local').length,
      rawDeleted: jobs.filter((job) => job.rawFileCleanup?.status === 'DELETED' || Boolean(job.localInputDeletedAt)).length,
      cleanupPending: jobs.filter((job) => job.rawFileCleanup?.status === 'CLEANUP_PENDING').length,
      cleanupFailed: jobs.filter((job) => job.rawFileCleanup?.status === 'DELETE_FAILED' || Boolean(job.localInputDeleteError)).length,
      jsonReady: jobs.filter((job) => job.r2JsonArtifacts?.available === true).length,
      jsonMissingDone: jobs.filter((job) => job.status === 'done' && job.r2JsonArtifacts?.available !== true).length,
      liveCwJobs: jobs.filter((job) => job.sourceType === 'CUSTOM_LIVE_CW').length,
    }),
    [jobs],
  );
  const localArtifactSamples = useMemo(
    () => (localArtifactsQuery.data?.buckets ?? []).flatMap((bucket) => bucket.sampleStaleFiles),
    [localArtifactsQuery.data],
  );

  return (
    <div className="flex max-w-[96rem] flex-col gap-5">
      <PageSection
        title="ROFL Local Artifact Monitor"
        description="jobs/input/output 로컬 폴더에 남은 ROFL 원본과 JSON 산출물을 읽기 전용으로 점검합니다. 이 화면에서는 파일을 삭제하지 않습니다."
        right={
          <button
            onClick={() => void localArtifactsQuery.refetch()}
            disabled={localArtifactsQuery.isFetching}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {localArtifactsQuery.isFetching ? 'Checking...' : 'Check now'}
          </button>
        }
      >
        <QueryState isLoading={localArtifactsQuery.isLoading} error={localArtifactsQuery.error}>
          {localArtifactsQuery.data && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 md:grid-cols-5">
                <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">상태</p>
                  <div className="mt-2">
                    <StatusBadge label={localArtifactsQuery.data.ok ? 'OK' : 'CHECK'} tone={localArtifactsQuery.data.ok ? 'success' : 'warning'} />
                  </div>
                </div>
                <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">전체 파일</p>
                  <p className="text-xl font-semibold text-zinc-100">{formatNumber(localArtifactsQuery.data.totals.totalFiles)}</p>
                </div>
                <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">오래된 파일</p>
                  <p className="text-xl font-semibold text-amber-300">{formatNumber(localArtifactsQuery.data.totals.staleFiles)}</p>
                </div>
                <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">총 용량</p>
                  <p className="text-xl font-semibold text-zinc-100">{formatBytes(localArtifactsQuery.data.totals.totalBytes)}</p>
                </div>
                <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
                  <p className="text-xs text-zinc-500">오래된 용량</p>
                  <p className="text-xl font-semibold text-amber-300">{formatBytes(localArtifactsQuery.data.totals.staleBytes)}</p>
                </div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
                <p>cutoff: {formatNumber(localArtifactsQuery.data.cutoffHours)}시간 · maxFiles: {formatNumber(localArtifactsQuery.data.maxFiles)} · generated: {formatDateTime(localArtifactsQuery.data.generatedAt)}</p>
                <p className="mt-1 font-mono">dry-run: {localArtifactsQuery.data.cleanupCommandPreview.dryRun}</p>
                <p className="mt-1 font-mono text-amber-300">manual write only: {localArtifactsQuery.data.cleanupCommandPreview.writeRequiresManualApproval}</p>
              </div>
              <DataTable
                columns={localArtifactBucketColumns}
                data={localArtifactsQuery.data.buckets}
                rowKey={(bucket) => bucket.bucket}
                emptyMessage="No ROFL local artifact buckets found."
              />
              {localArtifactSamples.length > 0 && (
                <DataTable
                  columns={localArtifactSampleColumns}
                  data={localArtifactSamples}
                  rowKey={(sample) => `${sample.bucket}-${sample.path}`}
                  emptyMessage="No stale ROFL artifacts found."
                />
              )}
            </div>
          )}
        </QueryState>
      </PageSection>

      <PageSection
        title="ROFL Jobs"
        description="ROFL 원본 처리, 로컬 입력 삭제 audit, private R2 JSON evidence, guarded retry/reprocess/cancel 상태를 확인합니다."
        right={
          <button
            onClick={() => void jobsQuery.refetch()}
            disabled={jobsQuery.isFetching}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {jobsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
          </button>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="text-xl font-semibold text-zinc-100">{formatNumber(summary.total)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">Queued</p>
            <p className="text-xl font-semibold text-amber-300">{formatNumber(summary.queued)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">Processing</p>
            <p className="text-xl font-semibold text-blue-300">{formatNumber(summary.processing)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">Failed</p>
            <p className="text-xl font-semibold text-red-300">{formatNumber(summary.failed)}</p>
          </div>
        </div>
      </PageSection>

      <PageSection title="ROFL Storage Status" description="현재 필터 결과 기준으로 원본 저장, 로컬 원본 삭제, private JSON evidence 준비 여부를 한눈에 확인합니다.">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">private input</p>
            <p className="text-xl font-semibold text-emerald-300">{formatNumber(storageSummary.privateInput)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">local input</p>
            <p className="text-xl font-semibold text-zinc-100">{formatNumber(storageSummary.localInput)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">raw deleted</p>
            <p className="text-xl font-semibold text-emerald-300">{formatNumber(storageSummary.rawDeleted)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">cleanup pending</p>
            <p className="text-xl font-semibold text-amber-300">{formatNumber(storageSummary.cleanupPending)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">cleanup failed</p>
            <p className="text-xl font-semibold text-red-300">{formatNumber(storageSummary.cleanupFailed)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">JSON ready</p>
            <p className="text-xl font-semibold text-cyan-300">{formatNumber(storageSummary.jsonReady)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">done/no JSON</p>
            <p className="text-xl font-semibold text-amber-300">{formatNumber(storageSummary.jsonMissingDone)}</p>
          </div>
          <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">Live CW</p>
            <p className="text-xl font-semibold text-violet-300">{formatNumber(storageSummary.liveCwJobs)}</p>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-400">
          <p>JSON ready는 private R2 JSON evidence prefix가 준비된 job입니다. 원본 공개 URL은 표시하지 않고, JSON 열람은 artifact 버튼의 짧은 signed URL만 사용합니다.</p>
          {storageSummary.cleanupFailed > 0 && <p className="mt-1 text-red-300">cleanup failed가 있으면 원본 로컬 파일 삭제 실패 로그를 먼저 확인하세요.</p>}
          {storageSummary.jsonMissingDone > 0 && <p className="mt-1 text-amber-300">done/no JSON이 있으면 worker가 완료됐지만 JSON evidence prefix가 비어 있는 케이스입니다.</p>}
        </div>
      </PageSection>

      <PageSection title="Filters" description="Filters only change the list. Use the actions column to retry failed/canceled jobs, reprocess done/failed/canceled jobs, or cancel queued jobs.">
        <div className="grid gap-3 lg:grid-cols-6">
          <SelectField
            label="status"
            value={draft.status ?? ''}
            onChange={(status) => setDraft((prev) => ({ ...prev, status: status || undefined }))}
            options={STATUS_OPTIONS}
          />
          <SelectField
            label="sourceType"
            value={draft.sourceType ?? ''}
            onChange={(sourceType) => setDraft((prev) => ({ ...prev, sourceType: sourceType || undefined }))}
            options={SOURCE_TYPE_OPTIONS}
          />
          <TextField
            label="matchRecordId"
            value={draft.matchRecordId ?? ''}
            onChange={(matchRecordId) => setDraft((prev) => ({ ...prev, matchRecordId: matchRecordId || undefined }))}
          />
          <TextField
            label="roomId"
            value={draft.roomId ?? ''}
            onChange={(roomId) => setDraft((prev) => ({ ...prev, roomId: roomId || undefined }))}
          />
          <TextField
            label="uploaderUid"
            value={draft.uploaderUid ?? ''}
            onChange={(uploaderUid) => setDraft((prev) => ({ ...prev, uploaderUid: uploaderUid || undefined }))}
          />
          <NumberField
            label="limit"
            value={draft.limit ?? 100}
            onChange={(limit) => setDraft((prev) => ({ ...prev, limit }))}
            min={1}
            max={200}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setFilters({ ...draft, limit: draft.limit ?? 100 })}
            className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
          >
            Apply filters
          </button>
          <button
            onClick={() => {
              setDraft({ limit: 100 });
              setFilters({ limit: 100 });
            }}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Reset
          </button>
        </div>
      </PageSection>

      {lastActionJob && (
        <PageSection title="Last job action" description="Latest ROFL job admin action result.">
          <pre className="max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
            {JSON.stringify(lastActionJob, null, 2)}
          </pre>
        </PageSection>
      )}

      {lastArtifactRequest && (
        <PageSection title="Last R2 JSON artifact request" description="Admin-only signed URL was opened in a new tab. The signed URL itself is not printed or stored in this screen, and public URL is not exposed.">
          <pre className="max-h-80 overflow-auto rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
            {JSON.stringify(lastArtifactRequest, null, 2)}
          </pre>
        </PageSection>
      )}

      {actionMutation.isError && (
        <PageSection title="Job action error">
          <p className="text-sm text-red-300">{actionMutation.error instanceof Error ? actionMutation.error.message : 'ROFL job action failed.'}</p>
        </PageSection>
      )}

      {artifactSignedUrlMutation.isError && (
        <PageSection title="R2 artifact error">
          <p className="text-sm text-red-300">{artifactSignedUrlMutation.error instanceof Error ? artifactSignedUrlMutation.error.message : 'R2 artifact request failed.'}</p>
        </PageSection>
      )}

      <PageSection title="Job list" description="원본 local path는 표시하지 않습니다. 삭제 결과와 private JSON object key만 확인하고, JSON 열람은 짧은 signed URL로만 진행합니다.">
        <QueryState isLoading={jobsQuery.isLoading} error={jobsQuery.error}>
          <DataTable
            columns={columns}
            data={jobs}
            rowKey={(job) => job.jobId}
            emptyMessage="No ROFL jobs found."
          />
        </QueryState>
      </PageSection>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { NumberField, SelectField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { redisCacheAdminApi } from '../services/redisCacheAdminApi';
import { errorToMessage } from '../lib/apiError';
import type {
  LiveCwCachePolicy,
  LiveCwCachePolicyPatch,
  ManagedCacheEntry,
  RedisKeyMetadata,
  RedisKeySummary,
  RedisLiveCwDrilldown,
  RedisNamespacePurgeResult,
  RedisStatus,
} from '../types/redisCache';

const FIELD_LABELS: Record<keyof LiveCwCachePolicyPatch, { label: string; hint: string }> = {
  liveListTtlSeconds: {
    label: '실시간 방 목록 Redis TTL',
    hint: 'livecw:list:recruiting:v1 / livecw:list:active:v1 보관 시간입니다.',
  },
  liveRoomTtlSeconds: {
    label: '실시간 방 상세 Redis TTL',
    hint: 'livecw:room:{roomId} 보관 시간입니다.',
  },
  endedListTtlSeconds: {
    label: '종료방 목록 Redis TTL',
    hint: 'livecw:ended:list:v2 보관 시간입니다.',
  },
  endedRoomTtlSeconds: {
    label: '종료방 상세 Redis TTL',
    hint: 'livecw:ended:room:{roomId} 보관 시간입니다.',
  },
  participantRecordTtlSeconds: {
    label: '참가자 전적 요약 Redis TTL',
    hint: 'livecw:participant-record:{uid}:v1 보관 시간입니다.',
  },
  liveRoomClientPollSeconds: {
    label: '유저 진행방 화면 갱신 간격',
    hint: '프론트가 진행중 방 상태를 다시 확인할 권장 간격입니다.',
  },
  endedRoomClientPollSeconds: {
    label: '유저 종료방 화면 갱신 간격',
    hint: '종료방은 잘 바뀌지 않으므로 길게 잡는 것을 권장합니다.',
  },
  adminLiveCwPollSeconds: {
    label: '관리자 Live CW 화면 갱신 간격',
    hint: '관리자 페이지에서 방 상태를 다시 확인할 권장 간격입니다.',
  },
};

const EDITABLE_FIELDS = Object.keys(FIELD_LABELS) as Array<keyof LiveCwCachePolicyPatch>;

function formatDuration(seconds: number | string): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return String(seconds);
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes * 10) / 10}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10}d`;
}

function formatTtlRange(min: number | null, max: number | null): string {
  if (min === null || max === null) return '-';
  if (min === max) return formatDuration(min);
  return `${formatDuration(min)} ~ ${formatDuration(max)}`;
}

function redisTone(status: string) {
  if (status === 'ready') return 'success' as const;
  if (status === 'disabled') return 'neutral' as const;
  return 'warning' as const;
}

function buildPatch(current: LiveCwCachePolicy, draft: LiveCwCachePolicyPatch): LiveCwCachePolicyPatch {
  const patch: LiveCwCachePolicyPatch = {};
  for (const field of EDITABLE_FIELDS) {
    const value = draft[field];
    if (typeof value === 'number' && Number.isFinite(value) && value !== current[field]) {
      patch[field] = Math.trunc(value);
    }
  }
  return patch;
}

function RedisRuntimeGrid({ redis }: { redis: RedisStatus }) {
  const rows = [
    { label: 'PING', value: redis.ping ?? '-' },
    { label: '저장 경로', value: redis.dir ?? '-', mono: true },
    { label: '메모리 제한', value: redis.maxmemoryHuman ?? '-' },
    { label: '사용 메모리', value: redis.usedMemoryHuman ?? '-' },
    { label: '메모리 정책', value: redis.maxmemoryPolicy ?? '-' },
    { label: 'AOF', value: redis.appendonly ?? '-' },
    { label: '연결 클라이언트', value: redis.connectedClients ?? '-' },
    { label: '프로세스 ID', value: redis.processId ?? '-' },
    { label: '업타임', value: typeof redis.uptimeSeconds === 'number' ? formatDuration(redis.uptimeSeconds) : '-' },
    { label: '상태 확인 시각', value: redis.runtimeCheckedAt ?? '-' },
  ];

  return (
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {rows.map((row) => (
        <div key={row.label} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs text-zinc-500">{row.label}</p>
          <p className={row.mono ? 'mt-2 break-all font-mono text-xs text-zinc-300' : 'mt-2 text-sm font-semibold text-zinc-200'}>
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function RedisKeySummaryGrid({ summary }: { summary?: RedisKeySummary }) {
  if (!summary) return null;
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs text-zinc-500">조회된 key</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{summary.totalKeys}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs text-zinc-500">예상 메모리</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{summary.totalMemoryUsageHuman ?? '-'}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs text-zinc-500">마스킹 key</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{summary.maskedKeys}</p>
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs text-zinc-500">분류</p>
          <p className="mt-2 text-lg font-semibold text-zinc-100">{summary.groups.length}</p>
        </div>
      </div>
      {summary.groups.length > 0 ? (
        <div className="overflow-x-auto rounded-md border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">group</th>
                <th className="px-3 py-2 text-left">keys</th>
                <th className="px-3 py-2 text-left">TTL range</th>
                <th className="px-3 py-2 text-left">TTL buckets</th>
                <th className="px-3 py-2 text-left">memory</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {summary.groups.map((group) => (
                <tr key={group.group} className="bg-zinc-900/35">
                  <td className="px-3 py-2 text-zinc-200">{group.group}</td>
                  <td className="px-3 py-2 text-zinc-300">
                    {group.count}
                    {group.noExpire > 0 ? <span className="ml-2 text-amber-300">no-expire {group.noExpire}</span> : null}
                    {group.missing > 0 ? <span className="ml-2 text-rose-300">missing {group.missing}</span> : null}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{formatTtlRange(group.minTtlSeconds, group.maxTtlSeconds)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                    {Object.entries(group.ttlBuckets ?? {}).map(([bucket, count]) => `${bucket}:${count}`).join(' · ') || '-'}
                  </td>
                  <td className="px-3 py-2 text-zinc-300">{group.memoryUsageHuman ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ManagedCacheTable({ rows }: { rows: ManagedCacheEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">key</th>
            <th className="px-3 py-2 text-left">data</th>
            <th className="px-3 py-2 text-left">TTL</th>
            <th className="px-3 py-2 text-left">Firestore refresh</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.map((row) => (
            <tr key={row.keyPattern} className="bg-zinc-900/35">
              <td className="px-3 py-2 font-mono text-xs text-zinc-300">{row.keyPattern}</td>
              <td className="px-3 py-2 text-zinc-300">{row.data}</td>
              <td className="px-3 py-2 text-zinc-300">{formatDuration(row.ttlSeconds)}</td>
              <td className="px-3 py-2 text-xs text-zinc-500">{row.firestoreRefresh}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LiveCwRedisDrilldownPanel({ drilldown }: { drilldown?: RedisLiveCwDrilldown }) {
  if (!drilldown) return <InlineMessage kind="info">Live CW Redis 드릴다운 데이터가 아직 없습니다.</InlineMessage>;
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <StatusBadge label={drilldown.source} tone="info" />
        <StatusBadge label={drilldown.fallbackUsed ? 'fallback used' : 'fallback=false'} tone={drilldown.fallbackUsed ? 'warning' : 'success'} />
        <StatusBadge label={drilldown.valueExposed ? 'value exposed' : 'value hidden'} tone={drilldown.valueExposed ? 'danger' : 'success'} />
        <span className="text-zinc-500">확인 시각 {drilldown.checkedAt}</span>
      </div>
      {drilldown.note ? <InlineMessage kind="info">{drilldown.note}</InlineMessage> : null}
      <div className="grid gap-3 xl:grid-cols-2">
        {drilldown.sections.map((section) => (
          <div key={section.id} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{section.label}</p>
                <p className="mt-1 font-mono text-[11px] text-zinc-500">{section.pattern}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <StatusBadge label={`${section.count} keys`} tone="info" />
                <StatusBadge label={section.scanComplete ? 'complete' : 'limited'} tone={section.scanComplete ? 'success' : 'warning'} />
              </div>
            </div>
            <RedisKeySummaryGrid summary={section.summary} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RedisKeyTable({ rows }: { rows: RedisKeyMetadata[] }) {
  if (rows.length === 0) {
    return <InlineMessage kind="info">선택한 namespace에 표시할 Redis key가 없습니다.</InlineMessage>;
  }
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-800">
      <table className="min-w-full divide-y divide-zinc-800 text-sm">
        <thead className="bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left">key</th>
            <th className="px-3 py-2 text-left">group</th>
            <th className="px-3 py-2 text-left">type</th>
            <th className="px-3 py-2 text-left">TTL</th>
            <th className="px-3 py-2 text-left">memory</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {rows.map((row) => (
            <tr key={row.key} className="bg-zinc-900/35">
              <td className="px-3 py-2 font-mono text-xs text-zinc-300">
                {row.key}
                {row.keyMasked ? <span className="ml-2 rounded border border-amber-500/30 px-1.5 py-0.5 text-[10px] text-amber-200">masked</span> : null}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-400">{row.group ?? '-'}</td>
              <td className="px-3 py-2 text-zinc-300">{row.type}</td>
              <td className="px-3 py-2 text-zinc-300">{row.ttlSeconds >= 0 ? formatDuration(row.ttlSeconds) : row.ttlState}</td>
              <td className="px-3 py-2 text-zinc-300">{row.memoryUsageHuman ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PurgeResultBox({ result }: { result: RedisNamespacePurgeResult | null }) {
  if (!result) return null;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-3 text-xs text-zinc-300">
      <div className="mb-2 flex flex-wrap gap-2">
        <StatusBadge label={result.dryRun ? 'dry-run' : 'deleted'} tone={result.dryRun ? 'warning' : 'danger'} />
        <StatusBadge label={`${result.matched} matched`} tone="neutral" />
        <StatusBadge label={`${result.deleted} deleted`} tone={result.deleted > 0 ? 'danger' : 'neutral'} />
        <StatusBadge label={result.scanComplete ? 'scan complete' : 'scan limited'} tone={result.scanComplete ? 'success' : 'warning'} />
      </div>
      <p className="mb-2 text-zinc-500">{result.note}</p>
      <pre className="max-h-40 overflow-auto rounded bg-black/30 p-2 font-mono text-[11px] text-zinc-400">
        {JSON.stringify(result.keysPreview, null, 2)}
      </pre>
    </div>
  );
}

export function AdminRedisCachePage() {
  const qc = useQueryClient();
  const settingsQuery = useQuery({
    queryKey: ['admin-redis-cache-settings'],
    queryFn: redisCacheAdminApi.getSettings,
  });
  const settings = settingsQuery.data ?? null;
  const [draft, setDraft] = useState<LiveCwCachePolicyPatch>({});
  const [namespace, setNamespace] = useState('livecw');
  const [keyLimit, setKeyLimit] = useState(100);
  const [lastPurgeResult, setLastPurgeResult] = useState<RedisNamespacePurgeResult | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!settings?.policy) return;
    const next: LiveCwCachePolicyPatch = {};
    for (const field of EDITABLE_FIELDS) next[field] = settings.policy[field];
    setDraft(next);
  }, [settings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const pendingPatch = useMemo(
    () => (settings ? buildPatch(settings.policy, draft) : {}),
    [draft, settings],
  );
  const changedCount = Object.keys(pendingPatch).length;

  const mutation = useMutation({
    mutationFn: () => redisCacheAdminApi.updateSettings(pendingPatch),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-redis-cache-settings'] }),
  });
  const keysQuery = useQuery({
    queryKey: ['admin-redis-cache-keys', namespace, keyLimit],
    queryFn: () => redisCacheAdminApi.browseKeys({ namespace, limit: keyLimit }),
    enabled: Boolean(settings),
  });
  const purgeMutation = useMutation({
    mutationFn: ({ confirm }: { confirm: boolean }) => redisCacheAdminApi.purgeNamespace({ namespace, limit: keyLimit, confirm }),
    onSuccess: (result) => {
      setLastPurgeResult(result);
      void qc.invalidateQueries({ queryKey: ['admin-redis-cache-keys'] });
      void qc.invalidateQueries({ queryKey: ['admin-redis-cache-settings'] });
    },
  });

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageSection
        title="Redis 캐시 관리"
        description="Live CW Redis/Memory 캐시 TTL과 화면 갱신 권장 간격을 관리합니다."
        right={
          <button
            type="button"
            onClick={() => void settingsQuery.refetch()}
            disabled={settingsQuery.isFetching}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {settingsQuery.isFetching ? '새로고침 중...' : '새로고침'}
          </button>
        }
      >
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settings && (
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Redis 상태</p>
                <div className="mt-2">
                  <StatusBadge label={settings.redis.status} tone={redisTone(settings.redis.status)} />
                </div>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">Redis URL</p>
                <p className="mt-2 font-mono text-xs text-zinc-300">{settings.redis.url ?? '-'}</p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">정책 버전</p>
                <p className="mt-2 text-lg font-semibold text-zinc-100">v{settings.policy.policyVersion}</p>
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <p className="text-xs text-zinc-500">마지막 변경</p>
                <p className="mt-2 text-xs text-zinc-300">{settings.policy.updatedAt ?? '-'}</p>
              </div>
            </div>
          )}
          {settings?.redis.lastError && (
            <div className="mt-3">
              <InlineMessage kind="error">Redis error: {settings.redis.lastError}</InlineMessage>
            </div>
          )}
          {settings?.redis.runtimeCheckError && (
            <div className="mt-3">
              <InlineMessage kind="error">Redis runtime check error: {settings.redis.runtimeCheckError}</InlineMessage>
            </div>
          )}
          {settings && <RedisRuntimeGrid redis={settings.redis} />}
        </QueryState>
      </PageSection>

      <PageSection title="저장 대상" description="현재 서버가 관리하는 Redis key와 원본 재조회 기준입니다.">
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settings && <ManagedCacheTable rows={settings.managedCaches ?? []} />}
        </QueryState>
      </PageSection>

      <PageSection title="Live CW Redis 드릴다운" description="활성 방 관련 Redis key 수, TTL, 메모리만 확인합니다. 값(value)은 노출하지 않습니다.">
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settings && <LiveCwRedisDrilldownPanel drilldown={settings.liveCwDrilldown} />}
        </QueryState>
      </PageSection>

      <PageSection title="Redis namespace 조회 / 안전 삭제" description="SCAN 기반으로 지정 namespace key metadata만 확인합니다. 값(value)은 노출하지 않습니다.">
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settings && (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto] md:items-end">
                <SelectField
                  label="namespace"
                  value={namespace}
                  onChange={(value) => {
                    setNamespace(value);
                    setLastPurgeResult(null);
                  }}
                  options={(settings.namespaces ?? []).map((item) => ({
                    value: item.id,
                    label: `${item.id} · ${item.pattern}${item.purgeAllowed ? '' : ' · read-only'}`,
                  }))}
                />
                <NumberField label="조회 제한" value={keyLimit} min={1} max={500} onChange={setKeyLimit} />
                <button
                  type="button"
                  onClick={() => void keysQuery.refetch()}
                  disabled={keysQuery.isFetching}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white disabled:opacity-50"
                >
                  {keysQuery.isFetching ? '조회 중...' : 'key 조회'}
                </button>
              </div>
              {keysQuery.data ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <StatusBadge label={`${keysQuery.data.count} keys`} tone="info" />
                  <StatusBadge label={keysQuery.data.scanComplete ? 'scan complete' : 'scan limited'} tone={keysQuery.data.scanComplete ? 'success' : 'warning'} />
                  <StatusBadge label={keysQuery.data.purgeAllowed ? 'purge allowed' : 'read-only'} tone={keysQuery.data.purgeAllowed ? 'warning' : 'neutral'} />
                  <span className="font-mono text-zinc-500">{keysQuery.data.pattern}</span>
                </div>
              ) : null}
              {keysQuery.isError ? <InlineMessage kind="error">{errorToMessage(keysQuery.error)}</InlineMessage> : null}
              {keysQuery.data ? <RedisKeySummaryGrid summary={keysQuery.data.summary} /> : null}
              {keysQuery.data ? <RedisKeyTable rows={keysQuery.data.rows ?? []} /> : null}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => purgeMutation.mutate({ confirm: false })}
                  disabled={purgeMutation.isPending}
                  className="rounded border border-amber-500/40 px-3 py-1.5 text-sm text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  purge dry-run
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`${namespace} namespace Redis key를 삭제할까요? 이 작업은 캐시만 삭제하지만 즉시 원본 재조회가 늘 수 있습니다.`)) {
                      purgeMutation.mutate({ confirm: true });
                    }
                  }}
                  disabled={purgeMutation.isPending || keysQuery.data?.purgeAllowed === false}
                  className="rounded bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
                >
                  purge 실행
                </button>
              </div>
              {purgeMutation.isError ? <InlineMessage kind="error">{errorToMessage(purgeMutation.error)}</InlineMessage> : null}
              <PurgeResultBox result={lastPurgeResult} />
            </div>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="TTL / 갱신 간격 설정" description="값은 초 단위입니다. 너무 짧으면 원본 조회가 늘고, 너무 길면 화면 반영이 늦어집니다.">
        <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
          {settings && (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {EDITABLE_FIELDS.map((field) => {
                  const meta = FIELD_LABELS[field];
                  const value = draft[field] ?? settings.policy[field];
                  return (
                    <div key={field} className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
                      <NumberField
                        label={meta.label}
                        value={Number(value)}
                        min={1}
                        max={60 * 60 * 24 * 30}
                        step={1}
                        onChange={(next) => setDraft((prev) => ({ ...prev, [field]: next }))}
                        hint={`${meta.hint} 현재 ${formatDuration(Number(value))}`}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={changedCount === 0 || mutation.isPending}
                  onClick={() => mutation.mutate()}
                  className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  {mutation.isPending ? '저장 중...' : `변경 저장 (${changedCount})`}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const reset: LiveCwCachePolicyPatch = {};
                    for (const field of EDITABLE_FIELDS) reset[field] = settings.policy[field];
                    setDraft(reset);
                  }}
                  className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
                >
                  되돌리기
                </button>
              </div>

              {changedCount > 0 && (
                <InlineMessage kind="info">
                  저장하면 Server DB admin_settings/service_settings/liveCwCachePolicy가 갱신되고, 서버 정책 캐시는 즉시 비워집니다.
                </InlineMessage>
              )}
              {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
              {mutation.isSuccess && <InlineMessage kind="success">Redis 캐시 정책이 저장되었습니다.</InlineMessage>}
            </div>
          )}
        </QueryState>
      </PageSection>
    </div>
  );
}

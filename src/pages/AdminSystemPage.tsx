import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { PageSection } from '../components/PageSection';
import { StatusBadge } from '../components/StatusBadge';
import { QueryState } from '../components/QueryState';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { NumberField, TextField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { EntryTicketItemSelect } from '../components/EntryTicketItemSelect';
import { ConfirmButton } from '../components/ConfirmButton';
import { systemApi } from '../services/systemApi';
import { itemApi } from '../services/itemApi';
import { PLAN_IDS, PLAN_LABELS, USER_ROLES, USER_ROLE_LABELS, type PlanId, type UserRole } from '../lib/constants';
import { planTone, serviceStatusTone } from '../lib/statusTone';
import { formatDateTime, formatNumber } from '../lib/format';
import { errorToMessage } from '../lib/apiError';
import type { GuildOperationSettings, GuildOperationSettingsPatch, Pm2LogTail, Pm2StatusPayload, SystemState } from '../types/system';

type RequirementKey = 'createQlCoin' | 'joinQlCoin';
type CostKey = 'createCostQlCoin' | 'joinCostQlCoin';

interface RequirementFlags {
  createQlCoin: boolean;
  joinQlCoin: boolean;
}

const PLAN_PRESETS: { label: string; plans: PlanId[] }[] = [
  { label: '전체 허용', plans: [...PLAN_IDS] },
  { label: 'PRO 이상', plans: ['pro', 'pro_max'] },
  { label: 'PRO MAX 이상', plans: ['pro_max'] },
  { label: 'FREE 이상', plans: ['free'] },
];

/**
 * 시스템 페이지(super_admin 전용).
 *  - 서비스 헬스 체크(GET /api/health) - 30초 자동 갱신.
 *  - 유지보수 모드(GET /api/admin/system/state, POST /api/admin/system/maintenance).
 *  - 길드 생성/가입 조건(GET/PATCH /api/admin/guild/settings).
 */
export function AdminSystemPage() {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['system-health'],
    queryFn: systemApi.checkHealth,
    refetchInterval: 30000,
  });

  const stateQuery = useQuery({ queryKey: ['system-state'], queryFn: systemApi.getState });
  const serviceHealthsQuery = useQuery({
    queryKey: ['system-service-healths'],
    queryFn: systemApi.checkServiceHealths,
    refetchInterval: 30000,
  });
  const pm2StatusQuery = useQuery({
    queryKey: ['system-pm2-status'],
    queryFn: systemApi.getPm2Status,
    refetchInterval: 30000,
  });

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageSection
        title="서비스 상태"
        right={
          <button
            onClick={() => void refetch()}
            disabled={isFetching}
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {isFetching ? '확인 중...' : '새로고침'}
          </button>
        }
      >
        {data && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-700/40 bg-zinc-900/60 p-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">{data.name}</p>
              <p className="text-xs text-zinc-600">
                마지막 확인: {formatDateTime(data.checkedAt)}
                {data.version ? ` · v${data.version}` : ''}
                {data.environment ? ` · ${data.environment}` : ''}
              </p>
              {data.detail && <p className="mt-1 text-xs text-red-400">{data.detail}</p>}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs text-zinc-500">지연</p>
                <p className="font-mono text-sm font-semibold text-zinc-300">
                  {data.latencyMs != null ? `${data.latencyMs}ms` : '-'}
                </p>
              </div>
              <StatusBadge
                label={data.status === 'online' ? '정상' : data.status === 'degraded' ? '불안정' : '오프라인'}
                tone={serviceStatusTone(data.status)}
              />
            </div>
          </div>
        )}
      </PageSection>

      <PageSection
        title="PM2 프로세스"
        description="서버 PC에서 PM2가 관리하는 앱 상태를 읽기 전용으로 확인합니다. 환경변수와 토큰은 표시하지 않습니다."
        right={
          <button
            onClick={() => void pm2StatusQuery.refetch()}
            disabled={pm2StatusQuery.isFetching}
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {pm2StatusQuery.isFetching ? '확인 중...' : 'PM2 새로고침'}
          </button>
        }
      >
        <QueryState isLoading={pm2StatusQuery.isLoading} error={pm2StatusQuery.error}>
          {pm2StatusQuery.data && <Pm2StatusPanel pm2={pm2StatusQuery.data} />}
        </QueryState>
      </PageSection>

      <PageSection
        title="멀티 서비스 헬스"
        description="Cloudflare/Nginx 게이트웨이를 통해 각 API가 응답하는지 30초마다 확인합니다. 읽기 전용 점검입니다."
        right={
          <button
            onClick={() => void serviceHealthsQuery.refetch()}
            disabled={serviceHealthsQuery.isFetching}
            className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
          >
            {serviceHealthsQuery.isFetching ? '확인 중...' : '전체 새로고침'}
          </button>
        }
      >
        <QueryState isLoading={serviceHealthsQuery.isLoading} error={serviceHealthsQuery.error}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(serviceHealthsQuery.data ?? []).map((service) => (
              <div key={service.key ?? service.name} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-200">{service.name}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-zinc-600" title={service.url}>
                      {service.url}
                    </p>
                  </div>
                  <StatusBadge
                    label={service.status === 'online' ? '정상' : service.status === 'degraded' ? '확인 필요' : '오프라인'}
                    tone={serviceStatusTone(service.status)}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>지연 {service.latencyMs != null ? `${service.latencyMs}ms` : '-'}</span>
                  <span>{formatDateTime(service.checkedAt)}</span>
                </div>
                {(service.version || service.environment) && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {service.version ? `v${service.version}` : ''}
                    {service.environment ? ` · ${service.environment}` : ''}
                  </p>
                )}
                {service.detail && <p className="mt-2 break-all text-xs text-amber-300">{service.detail}</p>}
              </div>
            ))}
          </div>
        </QueryState>
      </PageSection>

      <PageSection title="유지보수 모드" description="켜면 점검 안내 상태를 system_state 에 기록합니다.">
        <QueryState isLoading={stateQuery.isLoading} error={stateQuery.error}>
          {stateQuery.data && <MaintenancePanel key={String(stateQuery.data.updatedAt ?? '')} state={stateQuery.data} />}
        </QueryState>
      </PageSection>

      <GuildSettingsSection />
    </div>
  );
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  if (value < 1024 * 1024) return `${Math.round(value / 1024).toLocaleString()} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatUptime(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분`;
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  if (value < 60) return `${Math.floor(value)}초`;
  const minutes = Math.floor(value / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}일 ${hours % 24}시간`;
  if (hours > 0) return `${hours}시간 ${minutes % 60}분`;
  return `${minutes}분`;
}

function pm2Tone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'online') return 'success' as const;
  if (normalized === 'stopped' || normalized === 'errored') return 'danger' as const;
  return 'warning' as const;
}

function Pm2StatusPanel({ pm2 }: { pm2: Pm2StatusPayload }) {
  const [lastLog, setLastLog] = useState<Pm2LogTail | null>(null);
  const logMutation = useMutation({
    mutationFn: (input: { name: string; stream: 'out' | 'err' }) => systemApi.getPm2LogTail({ ...input, lines: 80 }),
    onSuccess: setLastLog,
  });

  if (!pm2.available) {
    return (
      <InlineMessage kind="error">
        PM2 상태를 읽지 못했습니다. 서버 PC에서 pm2.cmd jlist가 실행 가능한지 확인하세요. {pm2.error}
      </InlineMessage>
    );
  }

  const onlineCount = pm2.apps.filter((app) => app.status === 'online').length;
  const restartWarnings = pm2.apps.filter((app) => app.restarts >= 5 || (app.unstableRestarts ?? 0) > 0);
  const cloudflaredStatus = pm2.gateway?.cloudflaredService.status ?? (pm2.gateway?.cloudflaredService.available ? 'unknown' : 'unavailable');
  const gatewayApps = pm2.gateway?.pm2GatewayApps ?? [];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={`online ${onlineCount}/${pm2.apps.length}`} tone={onlineCount === pm2.apps.length ? 'success' : 'warning'} />
        <StatusBadge label={`checked ${formatDateTime(pm2.checkedAt)}`} tone="neutral" />
        <StatusBadge label={`cloudflared ${cloudflaredStatus}`} tone={cloudflaredStatus === 'RUNNING' ? 'success' : 'warning'} />
        <StatusBadge label={`gateway apps ${gatewayApps.length}`} tone={gatewayApps.length > 0 ? 'info' : 'neutral'} />
        {restartWarnings.length > 0 && <StatusBadge label={`재시작 확인 ${restartWarnings.length}`} tone="warning" />}
      </div>
      {pm2.gateway?.cloudflaredService.error ? (
        <InlineMessage kind="warning">Cloudflared service check: {pm2.gateway.cloudflaredService.error}</InlineMessage>
      ) : null}
      {gatewayApps.length > 0 ? (
        <div className="flex flex-wrap gap-2 text-xs">
          {gatewayApps.map((app) => (
            <span key={app.name} className="rounded border border-zinc-700 bg-zinc-950/40 px-2 py-1 font-mono text-zinc-300">
              {app.name} · {app.status} · pid {app.pid ?? '-'}
            </span>
          ))}
        </div>
      ) : null}
      <RiotFeaturePosture pm2={pm2} />
      {pm2.operations ? <OperationsSummary operations={pm2.operations} /> : null}
      <div className="overflow-hidden rounded-md border border-zinc-800">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-zinc-900 text-zinc-500">
            <tr>
              <th className="px-3 py-2">앱</th>
              <th className="px-3 py-2">상태</th>
              <th className="px-3 py-2">PID</th>
              <th className="px-3 py-2">재시작</th>
              <th className="px-3 py-2">메모리</th>
              <th className="px-3 py-2">CPU</th>
              <th className="px-3 py-2">가동</th>
              <th className="px-3 py-2">로그</th>
            </tr>
          </thead>
          <tbody>
            {pm2.apps.map((app) => (
              <tr key={app.name} className="border-t border-zinc-800 bg-zinc-950/50">
                <td className="px-3 py-2 font-mono text-zinc-300">{app.name}</td>
                <td className="px-3 py-2"><StatusBadge label={app.status} tone={pm2Tone(app.status)} /></td>
                <td className="px-3 py-2 font-mono text-zinc-500">{app.pid ?? '-'}</td>
                <td className="px-3 py-2 font-mono text-zinc-300">{formatNumber(app.restarts)}</td>
                <td className="px-3 py-2 font-mono text-zinc-300">{formatBytes(app.memoryBytes)}</td>
                <td className="px-3 py-2 font-mono text-zinc-300">{app.cpu == null ? '-' : `${app.cpu}%`}</td>
                <td className="px-3 py-2 text-zinc-500">{formatUptime(app.uptimeMs)}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => logMutation.mutate({ name: app.name, stream: 'out' })}
                      disabled={logMutation.isPending}
                      className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:text-white disabled:opacity-50"
                    >
                      out
                    </button>
                    <button
                      type="button"
                      onClick={() => logMutation.mutate({ name: app.name, stream: 'err' })}
                      disabled={logMutation.isPending}
                      className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:text-white disabled:opacity-50"
                    >
                      err
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logMutation.isError ? <InlineMessage kind="error">{errorToMessage(logMutation.error)}</InlineMessage> : null}
      {lastLog ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge label={`${lastLog.appName} ${lastLog.stream}`} tone={lastLog.available ? 'info' : 'warning'} />
            <StatusBadge label={`${lastLog.entries.length} lines`} tone="neutral" />
            <span className="text-xs text-zinc-500">{formatDateTime(lastLog.checkedAt)}</span>
          </div>
          {lastLog.error ? <InlineMessage kind="warning">{lastLog.error}</InlineMessage> : null}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-300">
            {lastLog.entries.join('\n') || '로그가 비어 있습니다.'}
          </pre>
          <p className="mt-2 text-xs text-zinc-600">로그는 마지막 80줄만 표시하며, token/Bearer/JWT 패턴은 서버에서 마스킹합니다.</p>
        </div>
      ) : null}
    </div>
  );
}

function RiotFeaturePosture({ pm2 }: { pm2: Pm2StatusPayload }) {
  const gss = pm2.apps.find((app) => app.name === 'gss-server');
  const topRating = pm2.apps.find((app) => app.name === 'top-rating-api');
  const duoApps = pm2.apps.filter((app) => /duo[-_ ]?map/i.test(app.name));
  const duoOnline = duoApps.some((app) => app.status === 'online');
  const duoLabel = duoApps.length === 0 ? 'PM2 미등록' : duoApps.map((app) => `${app.name}:${app.status}`).join(', ');

  const rows = [
    {
      title: 'GSS Riot 조회',
      status: gss?.status === 'online' ? '운영 가능' : '확인 필요',
      tone: gss?.status === 'online' ? ('success' as const) : ('warning' as const),
      detail: `gss-server ${gss?.status ?? 'missing'}`,
    },
    {
      title: 'Top Rating',
      status: topRating?.status === 'online' ? '운영 가능' : '확인 필요',
      tone: topRating?.status === 'online' ? ('success' as const) : ('warning' as const),
      detail: `top-rating-api ${topRating?.status ?? 'missing'}`,
    },
    {
      title: 'Duo-map',
      status: duoOnline ? '승인 전 실행됨' : '승인 전 비활성',
      tone: duoOnline ? ('danger' as const) : ('success' as const),
      detail: duoLabel,
    },
  ];

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Riot 기능 운영 경계</p>
          <p className="mt-1 text-[11px] text-zinc-600">Duo-map은 Riot API 승인 전까지 PM2에 등록하거나 실행하지 않습니다.</p>
        </div>
        <StatusBadge label={duoOnline ? 'duo-map 확인 필요' : 'duo-map off'} tone={duoOnline ? 'danger' : 'success'} />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {rows.map((row) => (
          <div key={row.title} className="rounded border border-zinc-800 bg-black/20 p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-zinc-300">{row.title}</span>
              <StatusBadge label={row.status} tone={row.tone} />
            </div>
            <p className="mt-1 truncate font-mono text-[11px] text-zinc-600" title={row.detail}>
              {row.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function OperationsSummary({ operations }: { operations: NonNullable<Pm2StatusPayload['operations']> }) {
  const requiredMissing = operations.pathChecks.filter((item) => item.required && item.exists === false);
  const optionalMissing = operations.pathChecks.filter((item) => !item.required && item.exists === false);
  const unsafeWorkers = operations.writeWorkers.filter(
    (worker) => worker.status !== 'stopped' || worker.gates.some((gate) => !gate.safe),
  );
  const redisOk = operations.redis.ping === 'PONG' && !operations.redis.runtimeCheckError;
  const redisRows = [
    { label: 'PING', value: operations.redis.ping ?? '-' },
    { label: '상태', value: operations.redis.status ?? '-' },
    { label: '저장 경로', value: operations.redis.dir ?? '-', mono: true },
    { label: '메모리 제한', value: operations.redis.maxmemoryHuman ?? '-' },
    { label: '사용 메모리', value: operations.redis.usedMemoryHuman ?? '-' },
    { label: '메모리 정책', value: operations.redis.maxmemoryPolicy ?? '-' },
    { label: 'AOF', value: operations.redis.appendonly ?? '-' },
    { label: '연결 클라이언트', value: operations.redis.connectedClients ?? '-' },
    { label: '업타임', value: formatDurationSeconds(operations.redis.uptimeSeconds) },
    { label: '확인 시각', value: formatDateTime(operations.redis.runtimeCheckedAt) },
  ];

  return (
    <div className="grid gap-3 rounded-md border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={`NODE_ENV ${operations.runtime.nodeEnv ?? '-'}`} tone={operations.runtime.nodeEnv === 'production' ? 'success' : 'warning'} />
        <StatusBadge label={`schema ${operations.runtime.schemaMode ?? '-'}`} tone={operations.runtime.schemaMode === 'verify' ? 'success' : 'warning'} />
        <StatusBadge label={`Redis ${redisOk ? 'PONG' : '확인 필요'}`} tone={redisOk ? 'success' : 'danger'} />
        <StatusBadge label={`DB 경로 ${requiredMissing.length === 0 ? '정상' : '확인 필요'}`} tone={requiredMissing.length === 0 ? 'success' : 'danger'} />
        <StatusBadge label={`write worker ${unsafeWorkers.length === 0 ? 'OFF' : '확인 필요'}`} tone={unsafeWorkers.length === 0 ? 'success' : 'danger'} />
        {optionalMissing.length > 0 && <StatusBadge label={`선택 폴더 없음 ${optionalMissing.length}`} tone="warning" />}
      </div>

      {operations.warnings.length > 0 ? (
        <InlineMessage kind="warning">{operations.warnings.join(' / ')}</InlineMessage>
      ) : operations.redis.runtimeCheckError ? (
        <InlineMessage kind="warning">Redis runtime check: {operations.redis.runtimeCheckError}</InlineMessage>
      ) : (
        <InlineMessage kind="success">운영 기본 안전 상태입니다. Write worker는 꺼져 있고 필수 DB 경로가 확인됩니다.</InlineMessage>
      )}

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded border border-zinc-800 bg-black/20 xl:col-span-2">
          <div className="flex items-center justify-between gap-2 border-b border-zinc-800 px-3 py-2">
            <span className="text-xs font-semibold text-zinc-300">Redis runtime</span>
            <StatusBadge label={redisOk ? 'PONG' : operations.redis.status} tone={redisOk ? 'success' : 'warning'} />
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
            {redisRows.map((row) => (
              <div key={row.label} className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                <p className="text-[11px] text-zinc-500">{row.label}</p>
                <p className={row.mono ? 'mt-1 break-all font-mono text-[11px] text-zinc-300' : 'mt-1 text-xs font-semibold text-zinc-200'}>
                  {row.value}
                </p>
              </div>
            ))}
          </div>
          {operations.redis.lastError ? <p className="px-3 pb-3 text-xs text-amber-300">lastError: {operations.redis.lastError}</p> : null}
        </div>

        <div className="rounded border border-zinc-800 bg-black/20">
          <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300">데이터 경로</div>
          <div className="divide-y divide-zinc-800">
            {operations.pathChecks.map((item) => (
              <div key={item.key} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[8rem_1fr_auto] sm:items-center">
                <span className="text-zinc-500">{item.label}</span>
                <span className="break-all font-mono text-zinc-300">{item.path ?? '-'}</span>
                <StatusBadge
                  label={item.exists == null ? 'unset' : item.exists ? 'exists' : item.required ? 'missing' : 'optional missing'}
                  tone={item.exists ? 'success' : item.required ? 'danger' : 'warning'}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded border border-zinc-800 bg-black/20">
          <div className="border-b border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300">Write worker gate</div>
          <div className="divide-y divide-zinc-800">
            {operations.writeWorkers.map((worker) => (
              <div key={worker.name} className="px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs text-zinc-300">{worker.name}</span>
                  <StatusBadge label={`${worker.status} pid ${worker.pid ?? '-'}`} tone={worker.status === 'stopped' ? 'success' : 'danger'} />
                </div>
                <div className="mt-2 grid gap-1">
                  {worker.gates.map((gate) => (
                    <div key={gate.key} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono text-zinc-500">{gate.key}</span>
                      <StatusBadge label={gate.value ?? 'unset'} tone={gate.safe ? 'success' : 'danger'} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MaintenancePanel({ state }: { state: SystemState }) {
  const qc = useQueryClient();
  const [maintenance, setMaintenance] = useState(state.maintenance);
  const [message, setMessage] = useState(state.message ?? '');

  const mut = useMutation({
    mutationFn: () => systemApi.setMaintenance(maintenance, message.trim() || null),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['system-state'] }),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-md border border-zinc-700/40 bg-zinc-900/60 p-3">
        <div>
          <p className="text-sm text-zinc-300">현재 상태</p>
          {state.updatedAt && <p className="text-xs text-zinc-600">마지막 변경: {formatDateTime(state.updatedAt)}</p>}
        </div>
        <StatusBadge label={state.maintenance ? '점검 중' : '정상 운영'} tone={state.maintenance ? 'danger' : 'success'} />
      </div>

      <ToggleSwitch checked={maintenance} onChange={setMaintenance} label="유지보수 모드 켜기" />
      <TextField
        label="점검 안내 메시지(선택)"
        value={message}
        onChange={setMessage}
        placeholder="예: 서버 점검 중입니다. 잠시 후 다시 시도해주세요."
      />

      <div className="flex items-center gap-3 pt-1">
        <ConfirmButton
          tone={maintenance ? 'danger' : 'primary'}
          confirmLabel="적용 확정"
          disabled={mut.isPending}
          onConfirm={() => mut.mutate()}
        >
          {maintenance ? '점검 모드 적용' : '정상 운영으로 변경'}
        </ConfirmButton>
        {mut.isSuccess && <InlineMessage kind="success">적용되었습니다.</InlineMessage>}
        {mut.isError && <InlineMessage kind="error">{errorToMessage(mut.error)}</InlineMessage>}
      </div>
    </div>
  );
}

function GuildSettingsSection() {
  const settingsQuery = useQuery({ queryKey: ['guild-operation-settings'], queryFn: systemApi.getGuildSettings });

  return (
    <PageSection
      title="길드 생성/가입 조건"
      description="FREE, PRO, PRO MAX별 생성·가입 권한과 QL 코인 조건을 전역으로 관리합니다."
      accent
    >
      <QueryState isLoading={settingsQuery.isLoading} error={settingsQuery.error}>
        {settingsQuery.data && (
          <GuildSettingsPanel key={String(settingsQuery.data.updatedAt ?? '')} settings={settingsQuery.data} />
        )}
      </QueryState>
    </PageSection>
  );
}

function GuildSettingsPanel({ settings }: { settings: GuildOperationSettings }) {
  const qc = useQueryClient();
  const entryTicketItemsQuery = useQuery({
    queryKey: ['items', 'entry-tickets', 'guild-settings'],
    queryFn: itemApi.listAll,
    staleTime: 30000,
  });
  const initialSettings = useMemo(() => normalizeSettings(settings), [settings]);
  const initialRequirements = useMemo(() => buildRequirementFlags(initialSettings), [initialSettings]);
  const [form, setForm] = useState<GuildOperationSettings>(initialSettings);
  const [requirements, setRequirements] = useState<RequirementFlags>(initialRequirements);

  const currentPatch = useMemo(() => toGuildSettingsPatch(form, requirements), [form, requirements]);
  const savedPatch = useMemo(
    () => toGuildSettingsPatch(initialSettings, initialRequirements),
    [initialSettings, initialRequirements],
  );
  const validationErrors = useMemo(() => validateGuildSettings(form, requirements), [form, requirements]);
  const warnings = useMemo(() => planPolicyWarnings(form), [form]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dirty = JSON.stringify(currentPatch) !== JSON.stringify(savedPatch);

  const mut = useMutation({
    mutationFn: () => systemApi.updateGuildSettings(currentPatch),
    onSuccess: (next) => {
      const normalized = normalizeSettings(next);
      setForm(normalized);
      setRequirements(buildRequirementFlags(normalized));
      void qc.invalidateQueries({ queryKey: ['guild-operation-settings'] });
    },
  });

  const set = <K extends keyof GuildOperationSettings>(key: K, value: GuildOperationSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setRequirement = (flagKey: RequirementKey, costKey: CostKey, enabled: boolean) => {
    setRequirements((prev) => ({ ...prev, [flagKey]: enabled }));
    set(costKey, (enabled ? positiveOrDefault(form[costKey], 1) : 0) as GuildOperationSettings[CostKey]);
  };

  const reset = () => {
    setForm(initialSettings);
    setRequirements(initialRequirements);
  };

  return (
    <div className="flex flex-col gap-4">
      <PolicyPreview form={form} requirements={requirements} />

      <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-4">
        <label className="mb-1 block text-xs text-zinc-400">길드 가입 방식</label>
        <select
          value={form.joinMode}
          onChange={(event) => set('joinMode', event.target.value as GuildOperationSettings['joinMode'])}
          className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-violet-500 md:max-w-xs"
        >
          <option value="approval">승인제 - 가입 신청 후 운영진 승인</option>
          <option value="open">즉시가입 - 조건 충족 시 바로 가입</option>
        </select>
        <p className="mt-2 text-xs text-zinc-500">
          승인제는 기존 가입 신청/승인 흐름을 사용하고, 즉시가입은 공개 가입 버튼이 바로 멤버 추가 API를 호출합니다.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ConditionPanel
          title="생성 조건"
          subject="길드 생성"
          plans={form.createAllowedPlans}
          roles={form.createAllowedRoles}
          qlCoin={form.createCostQlCoin}
          qlCoinEnabled={requirements.createQlCoin}
          requireKakao={form.requireKakaoForCreate}
          requireRiot={form.requireRiotForCreate}
          requireDiscord={form.requireDiscordForCreate}
          onPlans={(value) => set('createAllowedPlans', value)}
          onRoles={(value) => set('createAllowedRoles', value)}
          onQlCoin={(value) => set('createCostQlCoin', value)}
          onQlCoinEnabled={(enabled) => setRequirement('createQlCoin', 'createCostQlCoin', enabled)}
          onKakao={(value) => set('requireKakaoForCreate', value)}
          onRiot={(value) => set('requireRiotForCreate', value)}
          onDiscord={(value) => set('requireDiscordForCreate', value)}
        />
        <ConditionPanel
          title="가입 조건"
          subject="길드 가입"
          plans={form.joinAllowedPlans}
          roles={form.joinAllowedRoles}
          qlCoin={form.joinCostQlCoin}
          qlCoinEnabled={requirements.joinQlCoin}
          requireKakao={form.requireKakaoForJoin}
          requireRiot={form.requireRiotForJoin}
          requireDiscord={form.requireDiscordForJoin}
          onPlans={(value) => set('joinAllowedPlans', value)}
          onRoles={(value) => set('joinAllowedRoles', value)}
          onQlCoin={(value) => set('joinCostQlCoin', value)}
          onQlCoinEnabled={(enabled) => setRequirement('joinQlCoin', 'joinCostQlCoin', enabled)}
          onKakao={(value) => set('requireKakaoForJoin', value)}
          onRiot={(value) => set('requireRiotForJoin', value)}
          onDiscord={(value) => set('requireDiscordForJoin', value)}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <NumberField
          label="길드 기본 정원"
          value={form.maxMembers}
          min={1}
          max={1000}
          step={1}
          onChange={(value) => set('maxMembers', value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="운영 시작시"
            value={form.operationStartHour}
            min={0}
            max={23}
            step={1}
            onChange={(value) => set('operationStartHour', value)}
          />
          <NumberField
            label="운영 종료시"
            value={form.operationEndHour}
            min={1}
            max={24}
            step={1}
            onChange={(value) => set('operationEndHour', value)}
          />
        </div>
      </div>

      <div className="grid gap-3 rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-4 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">길드 생성 입장권</p>
              <p className="text-xs text-zinc-500">상점 아이템 중 targetFeature=guild_create 입장권을 사용합니다.</p>
            </div>
            <ToggleTile
              checked={form.requireEntryTicketForCreate}
              onChange={(value) => set('requireEntryTicketForCreate', value)}
              label={form.requireEntryTicketForCreate ? '사용' : '미사용'}
            />
          </div>
          <EntryTicketItemSelect
            label="생성 입장권 선택"
            value={form.createEntryTicketItemId}
            enabled={form.requireEntryTicketForCreate}
            targetFeature="guild_create"
            items={entryTicketItemsQuery.data ?? []}
            loading={entryTicketItemsQuery.isLoading}
            error={entryTicketItemsQuery.error}
            onChange={(value) => set('createEntryTicketItemId', value)}
          />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-100">길드 가입 입장권</p>
              <p className="text-xs text-zinc-500">상점 아이템 중 targetFeature=guild_join 입장권을 사용합니다.</p>
            </div>
            <ToggleTile
              checked={form.requireEntryTicketForJoin}
              onChange={(value) => set('requireEntryTicketForJoin', value)}
              label={form.requireEntryTicketForJoin ? '사용' : '미사용'}
            />
          </div>
          <EntryTicketItemSelect
            label="가입 입장권 선택"
            value={form.joinEntryTicketItemId}
            enabled={form.requireEntryTicketForJoin}
            targetFeature="guild_join"
            items={entryTicketItemsQuery.data ?? []}
            loading={entryTicketItemsQuery.isLoading}
            error={entryTicketItemsQuery.error}
            onChange={(value) => set('joinEntryTicketItemId', value)}
          />
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
          {validationErrors.map((message) => (
            <p key={message} className="text-xs text-red-300">
              {message}
            </p>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-zinc-700/60 bg-zinc-900/80 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-200">{dirty ? '저장 대기 중인 변경사항이 있습니다' : '현재 조건이 최신입니다'}</p>
          {settings.updatedAt && <p className="text-xs text-zinc-600">마지막 변경: {formatDateTime(settings.updatedAt)}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!dirty || mut.isPending}
            onClick={reset}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600 disabled:opacity-40"
          >
            되돌리기
          </button>
          <button
            type="button"
            disabled={!dirty || validationErrors.length > 0 || mut.isPending}
            onClick={() => setConfirmOpen(true)}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            조건 저장
          </button>
          {mut.isSuccess && <InlineMessage kind="success">길드 조건이 저장되었습니다.</InlineMessage>}
          {mut.isError && <InlineMessage kind="error">{errorToMessage(mut.error)}</InlineMessage>}
        </div>
      </div>

      {confirmOpen && (
        <GuildSettingsConfirmModal
          form={form}
          warnings={warnings}
          pending={mut.isPending}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setConfirmOpen(false);
            mut.mutate();
          }}
        />
      )}
    </div>
  );
}

function GuildSettingsConfirmModal({
  form,
  warnings,
  pending,
  onCancel,
  onConfirm,
}: {
  form: GuildOperationSettings;
  warnings: string[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-zinc-100">길드 조건 저장 확인</h3>
        <p className="mt-1 text-xs text-zinc-500">저장하면 전역 길드 생성/가입 정책이 즉시 적용됩니다.</p>

        <div className="mt-3 space-y-2 rounded-md border border-zinc-700/60 bg-zinc-950/50 p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">생성 허용</span>
            <span className="font-medium text-zinc-200">{formatPlanList(form.createAllowedPlans)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-zinc-400">가입 허용</span>
            <span className="font-medium text-zinc-200">{formatPlanList(form.joinAllowedPlans)}</span>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
            {warnings.map((message) => (
              <p key={message} className="text-xs text-amber-300">
                ⚠ {message}
              </p>
            ))}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            취소
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
          >
            {warnings.length > 0 ? '경고 확인 후 저장' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConditionPanel({
  title,
  subject,
  plans,
  roles,
  qlCoin,
  qlCoinEnabled,
  requireKakao,
  requireRiot,
  requireDiscord,
  onPlans,
  onRoles,
  onQlCoin,
  onQlCoinEnabled,
  onKakao,
  onRiot,
  onDiscord,
}: {
  title: string;
  subject: string;
  plans: PlanId[];
  roles: UserRole[];
  qlCoin: number;
  qlCoinEnabled: boolean;
  requireKakao: boolean;
  requireRiot: boolean;
  requireDiscord: boolean;
  onPlans: (value: PlanId[]) => void;
  onRoles: (value: UserRole[]) => void;
  onQlCoin: (value: number) => void;
  onQlCoinEnabled: (value: boolean) => void;
  onKakao: (value: boolean) => void;
  onRiot: (value: boolean) => void;
  onDiscord: (value: boolean) => void;
}) {
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <p className="mt-0.5 text-xs text-zinc-500">{subject}을 허용할 요금제와 필요 재화를 조정합니다.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge label={`${plans.length}개 요금제`} tone={plans.length === PLAN_IDS.length ? 'success' : 'accent'} />
          <StatusBadge label={qlCoinEnabled ? `QL ${formatNumber(qlCoin)}` : 'QL 불필요'} tone={qlCoinEnabled ? 'info' : 'neutral'} />
        </div>
      </div>

      <div className="grid gap-4">
        <PlanAccessControl label={`${subject} 허용 요금제`} values={plans} onChange={onPlans} />

        <div className="grid gap-3 sm:grid-cols-2">
          <RequirementAmount
            label="QL 코인(QLAP)"
            enabled={qlCoinEnabled}
            value={qlCoin}
            max={100000000}
            unit="QL"
            onEnabledChange={onQlCoinEnabled}
            onValueChange={onQlCoin}
          />
        </div>

        <div>
          <p className="mb-2 text-xs text-zinc-400">인증 조건</p>
          <div className="grid gap-2 sm:grid-cols-3">
            <ToggleTile checked={requireKakao} onChange={onKakao} label="카카오 인증" />
            <ToggleTile checked={requireRiot} onChange={onRiot} label="Riot 인증" />
            <ToggleTile checked={requireDiscord} onChange={onDiscord} label="디스코드 인증" />
          </div>
        </div>

        <Checklist
          label="허용 계정 권한"
          values={roles}
          options={USER_ROLES.map((value) => ({ value, label: USER_ROLE_LABELS[value] }))}
          onChange={onRoles}
        />
      </div>
    </div>
  );
}

function PolicyPreview({ form, requirements }: { form: GuildOperationSettings; requirements: RequirementFlags }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <PreviewBlock
        title="생성 적용값"
        plans={form.createAllowedPlans}
        qlCoin={requirements.createQlCoin ? form.createCostQlCoin : 0}
        authItems={[
          ['카카오', form.requireKakaoForCreate],
          ['Riot', form.requireRiotForCreate],
          ['디스코드', form.requireDiscordForCreate],
        ]}
      />
      <PreviewBlock
        title="가입 적용값"
        plans={form.joinAllowedPlans}
        qlCoin={requirements.joinQlCoin ? form.joinCostQlCoin : 0}
        authItems={[
          ['카카오', form.requireKakaoForJoin],
          ['Riot', form.requireRiotForJoin],
          ['디스코드', form.requireDiscordForJoin],
        ]}
      />
    </div>
  );
}

function PreviewBlock({
  title,
  plans,
  qlCoin,
  authItems,
}: {
  title: string;
  plans: PlanId[];
  qlCoin: number;
  authItems: [string, boolean][];
}) {
  return (
    <div className="rounded-md border border-zinc-700/60 bg-zinc-950/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-200">{title}</p>
        <span className="text-xs text-zinc-500">{formatPlanList(plans)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {plans.map((plan) => (
          <StatusBadge key={plan} label={PLAN_LABELS[plan]} tone={planTone(plan)} />
        ))}
        <StatusBadge label={qlCoin > 0 ? `QL ${formatNumber(qlCoin)} 필요` : 'QL 무료'} tone={qlCoin > 0 ? 'info' : 'neutral'} />
        {authItems.map(([label, required]) => (
          <StatusBadge key={label} label={required ? `${label} 필수` : `${label} 선택`} tone={required ? 'success' : 'neutral'} />
        ))}
      </div>
    </div>
  );
}

function PlanAccessControl({
  label,
  values,
  onChange,
}: {
  label: string;
  values: PlanId[];
  onChange: (value: PlanId[]) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">{label}</p>
        <div className="flex flex-wrap gap-1">
          {PLAN_PRESETS.map((preset) => {
            const active = sameSelection(values, preset.plans);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => onChange([...preset.plans])}
                className={clsx(
                  'rounded border px-2 py-0.5 text-xs',
                  active
                    ? 'border-violet-500/60 bg-violet-500/15 text-violet-200'
                    : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-300',
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {PLAN_IDS.map((plan) => {
          const checked = values.includes(plan);
          return (
            <button
              key={plan}
              type="button"
              onClick={() => onChange(toggleRequiredItem(values, plan))}
              className={clsx(
                'flex min-h-16 flex-col justify-between rounded-md border p-3 text-left transition-colors',
                checked ? selectedPlanClasses(plan) : 'border-zinc-700 bg-zinc-950/60 text-zinc-500 hover:text-zinc-300',
              )}
            >
              <span className="text-sm font-semibold">{PLAN_LABELS[plan]}</span>
              <span className="text-xs">{checked ? '허용' : '차단'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RequirementAmount({
  label,
  enabled,
  value,
  max,
  unit,
  onEnabledChange,
  onValueChange,
}: {
  label: string;
  enabled: boolean;
  value: number;
  max: number;
  unit: string;
  onEnabledChange: (value: boolean) => void;
  onValueChange: (value: number) => void;
}) {
  return (
    <div
      className={clsx(
        'rounded-md border p-3',
        enabled ? 'border-blue-500/30 bg-blue-500/10' : 'border-zinc-700/60 bg-zinc-950/50',
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">{label}</p>
          <p className="text-xs text-zinc-500">{enabled ? '필요 조건으로 적용' : '필요 없음'}</p>
        </div>
        <ToggleSwitch checked={enabled} onChange={onEnabledChange} label={enabled ? '필요' : '불필요'} />
      </div>
      <NumberField
        label={`필요 수량(${unit})`}
        value={enabled ? value : 0}
        min={enabled ? 1 : 0}
        max={max}
        step={1}
        disabled={!enabled}
        onChange={onValueChange}
      />
    </div>
  );
}

function ToggleTile({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm',
        checked
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
          : 'border-zinc-700 bg-zinc-950/50 text-zinc-500 hover:text-zinc-300',
      )}
    >
      <span>{label}</span>
      <span className="text-xs">{checked ? '필수' : '선택'}</span>
    </button>
  );
}

function Checklist<T extends string>({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange: (value: T[]) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs text-zinc-400">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(toggleRequiredItem(values, option.value))}
              className={clsx(
                'rounded border px-2.5 py-1 text-xs',
                checked
                  ? 'border-violet-500/60 bg-violet-600/20 text-violet-200'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-500 hover:text-zinc-300',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildRequirementFlags(settings: GuildOperationSettings): RequirementFlags {
  return {
    createQlCoin: settings.createCostQlCoin > 0,
    joinQlCoin: settings.joinCostQlCoin > 0,
  };
}

function toGuildSettingsPatch(settings: GuildOperationSettings, requirements: RequirementFlags): GuildOperationSettingsPatch {
  return {
    joinMode: settings.joinMode,
    createAllowedPlans: settings.createAllowedPlans,
    joinAllowedPlans: settings.joinAllowedPlans,
    createAllowedRoles: settings.createAllowedRoles,
    joinAllowedRoles: settings.joinAllowedRoles,
    maxMembers: settings.maxMembers,
    createCostGmTicket: 0,
    joinCostGmTicket: 0,
    createCostQlCoin: requirements.createQlCoin ? settings.createCostQlCoin : 0,
    joinCostQlCoin: requirements.joinQlCoin ? settings.joinCostQlCoin : 0,
    requireKakaoForCreate: settings.requireKakaoForCreate,
    requireKakaoForJoin: settings.requireKakaoForJoin,
    requireRiotForCreate: settings.requireRiotForCreate,
    requireRiotForJoin: settings.requireRiotForJoin,
    requireDiscordForCreate: settings.requireDiscordForCreate,
    requireDiscordForJoin: settings.requireDiscordForJoin,
    expandCostGmTicket: 0,
    requireEntryTicketForCreate: settings.requireEntryTicketForCreate,
    createEntryTicketItemId: settings.requireEntryTicketForCreate ? settings.createEntryTicketItemId : null,
    requireEntryTicketForJoin: settings.requireEntryTicketForJoin,
    joinEntryTicketItemId: settings.requireEntryTicketForJoin ? settings.joinEntryTicketItemId : null,
    operationStartHour: settings.operationStartHour,
    operationEndHour: settings.operationEndHour,
  };
}

/** Non-blocking cautions surfaced in the save-confirmation modal. */
function planPolicyWarnings(settings: GuildOperationSettings): string[] {
  const warnings: string[] = [];
  if (settings.createAllowedPlans.length === 0 || settings.createAllowedPlans.includes('free')) {
    warnings.push('생성 허용 요금제에 FREE가 포함되어 있습니다 — free 유저도 길드를 생성할 수 있게 됩니다.');
  }
  if (settings.joinAllowedPlans.length === 0 || settings.joinAllowedPlans.includes('free')) {
    warnings.push('가입 허용 요금제에 FREE가 포함되어 있습니다 — free 유저도 길드에 가입할 수 있습니다.');
  }
  return warnings;
}

function validateGuildSettings(settings: GuildOperationSettings, requirements: RequirementFlags): string[] {
  const errors: string[] = [];

  if (settings.joinMode !== 'approval' && settings.joinMode !== 'open') {
    errors.push('길드 가입 방식은 승인제 또는 즉시가입이어야 합니다.');
  }
  if (settings.createAllowedRoles.length === 0) errors.push('생성 허용 계정 권한을 1개 이상 선택하세요.');
  if (settings.joinAllowedRoles.length === 0) errors.push('가입 허용 계정 권한을 1개 이상 선택하세요.');

  requireIntegerInRange(settings.maxMembers, '길드 기본 정원', 1, 1000, errors);
  requireIntegerInRange(settings.operationStartHour, '운영 시작시', 0, 23, errors);
  requireIntegerInRange(settings.operationEndHour, '운영 종료시', 1, 24, errors);
  // Guard: end must be after start. 0–0 (the past outage) and any end<=start blocks guild ops 24/7.
  if (
    Number.isInteger(settings.operationStartHour) &&
    Number.isInteger(settings.operationEndHour) &&
    settings.operationEndHour <= settings.operationStartHour
  ) {
    errors.push('운영 종료시는 시작시보다 커야 합니다. (24시간 상시 운영은 0~24로 설정)');
  }

  if (requirements.createQlCoin) requireIntegerInRange(settings.createCostQlCoin, '생성 QL 코인', 1, 100000000, errors);
  if (requirements.joinQlCoin) requireIntegerInRange(settings.joinCostQlCoin, '가입 QL 코인', 1, 100000000, errors);
  if (settings.requireEntryTicketForCreate && !settings.createEntryTicketItemId) {
    errors.push('길드 생성 입장권을 사용하려면 생성 입장권 itemId를 입력하세요.');
  }
  if (settings.requireEntryTicketForJoin && !settings.joinEntryTicketItemId) {
    errors.push('길드 가입 입장권을 사용하려면 가입 입장권 itemId를 입력하세요.');
  }

  return errors;
}

function requireIntegerInRange(value: number, label: string, min: number, max: number, errors: string[]) {
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`${label}은 ${formatNumber(min)}~${formatNumber(max)} 사이의 정수여야 합니다.`);
  }
}

function normalizeSettings(settings: GuildOperationSettings): GuildOperationSettings {
  return {
    ...settings,
    joinMode: settings.joinMode === 'open' ? 'open' : 'approval',
    createAllowedPlans: keepKnown(settings.createAllowedPlans, PLAN_IDS, ['pro']),
    joinAllowedPlans: keepKnown(settings.joinAllowedPlans, PLAN_IDS, [...PLAN_IDS]),
    createAllowedRoles: keepKnown(settings.createAllowedRoles, USER_ROLES, ['user']),
    joinAllowedRoles: keepKnown(settings.joinAllowedRoles, USER_ROLES, ['user']),
    maxMembers: numberOrFallback(settings.maxMembers, 20),
    createCostGmTicket: 0,
    joinCostGmTicket: 0,
    createCostQlCoin: numberOrFallback(settings.createCostQlCoin, 0),
    joinCostQlCoin: numberOrFallback(settings.joinCostQlCoin, 0),
    requireKakaoForCreate: Boolean(settings.requireKakaoForCreate),
    requireKakaoForJoin: Boolean(settings.requireKakaoForJoin),
    requireRiotForCreate: Boolean(settings.requireRiotForCreate),
    requireRiotForJoin: Boolean(settings.requireRiotForJoin),
    requireDiscordForCreate: Boolean(settings.requireDiscordForCreate),
    requireDiscordForJoin: Boolean(settings.requireDiscordForJoin),
    expandCostGmTicket: 0,
    requireEntryTicketForCreate: Boolean(settings.requireEntryTicketForCreate),
    createEntryTicketItemId: typeof settings.createEntryTicketItemId === 'string' && settings.createEntryTicketItemId.trim() ? settings.createEntryTicketItemId.trim() : null,
    requireEntryTicketForJoin: Boolean(settings.requireEntryTicketForJoin),
    joinEntryTicketItemId: typeof settings.joinEntryTicketItemId === 'string' && settings.joinEntryTicketItemId.trim() ? settings.joinEntryTicketItemId.trim() : null,
    operationStartHour: numberOrFallback(settings.operationStartHour, 0),
    operationEndHour: numberOrFallback(settings.operationEndHour, 24),
  };
}

function keepKnown<T extends string>(values: readonly T[] | undefined, options: readonly T[], fallback: readonly T[]): T[] {
  const optionSet = new Set<string>(options);
  const next = (values ?? []).filter((value) => optionSet.has(value));
  return next.length > 0 ? next : [...fallback];
}

function toggleRequiredItem<T extends string>(values: T[], value: T): T[] {
  if (!values.includes(value)) return [...values, value];
  if (values.length === 1) return values;
  return values.filter((item) => item !== value);
}

function sameSelection<T extends string>(left: T[], right: T[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function positiveOrDefault(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function numberOrFallback(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function formatPlanList(plans: PlanId[]): string {
  return plans.map((plan) => PLAN_LABELS[plan]).join(', ');
}

function selectedPlanClasses(plan: PlanId): string {
  if (plan === 'pro_max') return 'border-violet-500/50 bg-violet-500/15 text-violet-100';
  if (plan === 'pro') return 'border-blue-500/50 bg-blue-500/15 text-blue-100';
  return 'border-zinc-500/70 bg-zinc-800/70 text-zinc-100';
}

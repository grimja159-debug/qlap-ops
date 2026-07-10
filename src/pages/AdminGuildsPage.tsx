import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { GuildDetailModal } from '../components/GuildDetailModal';
import { GuildCreateModal } from '../components/GuildCreateModal';
import { GuildPointGrantModal } from '../components/GuildPointGrantModal';
import { GuildEmblemThumb } from '../components/GuildEmblemTools';
import { guildApi, type GuildListFilter, type GuildSeasonRankingDiagnostic, type GuildServerDbDiagnostics } from '../services/guildApi';
import { GUILD_STATUSES, GUILD_STATUS_LABELS, type GuildStatus } from '../lib/constants';
import { guildStatusTone } from '../lib/statusTone';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { errorToMessage } from '../lib/apiError';
import type { Guild } from '../types/guild';

const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  ...GUILD_STATUSES.map((status) => ({ value: status, label: GUILD_STATUS_LABELS[status] })),
];

const RECRUITING_OPTIONS = [
  { value: '', label: '전체 모집' },
  { value: 'recruiting', label: '모집중' },
  { value: 'closed', label: '모집 닫힘' },
  { value: 'full', label: '정원 가득참' },
  { value: 'needs-owner', label: '길드장 없음' },
];

const LIMIT_OPTIONS = [50, 100, 200] as const;

function driftTotal(diagnostics: GuildServerDbDiagnostics | undefined): number {
  if (!diagnostics) return 0;
  return Object.values(diagnostics.drift).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function GuildServerDbDiagnosticsPanel({
  diagnostics,
  loading,
  error,
  onRefresh,
  onReindex,
  reindexing,
}: {
  diagnostics?: GuildServerDbDiagnostics;
  loading: boolean;
  error: unknown;
  onRefresh: () => void;
  onReindex: () => void;
  reindexing: boolean;
}) {
  const drift = driftTotal(diagnostics);
  return (
    <PageSection
      title="길드 Server DB 인덱스"
      right={
        <div className="flex items-center gap-2">
          {diagnostics && (
            <StatusBadge
              label={drift > 0 ? `WARN drift ${drift}` : 'OK'}
              tone={drift > 0 ? 'warning' : 'success'}
            />
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            새로고침
          </button>
          <ConfirmButton
            tone="primary"
            confirmLabel="Server DB 인덱스 재생성"
            disabled={reindexing}
            className="px-3 py-1.5 text-sm"
            onConfirm={onReindex}
          >
            인덱스 재생성
          </ConfirmButton>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-zinc-500">진단 정보를 불러오는 중입니다.</p>
      ) : error ? (
        <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage>
      ) : diagnostics ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">guild documents / index</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">
                {formatNumber(diagnostics.documents.guilds)} / {formatNumber(diagnostics.indexes.guildRows)}
              </p>
              <p className="text-xs text-zinc-500">indexed {formatDateTime(diagnostics.indexedAt.guildRows)}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">member documents / index</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">
                {formatNumber(diagnostics.documents.guildMembers)} / {formatNumber(diagnostics.indexes.guildMemberRows)}
              </p>
              <p className="text-xs text-zinc-500">indexed {formatDateTime(diagnostics.indexedAt.guildMemberRows)}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">user guild docs / memberships</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">
                {formatNumber(diagnostics.documents.userGuilds)} / {formatNumber(diagnostics.indexes.userGuildMembershipRows)}
              </p>
              <p className="text-xs text-zinc-500">indexed {formatDateTime(diagnostics.indexedAt.userGuildMembershipRows)}</p>
            </div>
          </div>
          <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-5">
            {Object.entries(diagnostics.drift).map(([key, value]) => (
              <div key={key} className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <p className="text-zinc-500">{key}</p>
                <p className={value > 0 ? 'font-mono text-amber-300' : 'font-mono text-emerald-300'}>{formatNumber(value)}</p>
              </div>
            ))}
          </div>
          <p className="break-all text-[11px] text-zinc-600">
            DB {diagnostics.dbPath} · checked {formatDateTime(diagnostics.checkedAt)}
          </p>
        </div>
      ) : null}
    </PageSection>
  );
}

const rankingTopColumns: Column<GuildSeasonRankingDiagnostic['rankingSource']['topGuildRows'][number]>[] = [
  { key: 'guildId', header: 'guildId', render: (row) => <CopyableId value={row.guildId} /> },
  { key: 'name', header: '길드명', render: (row) => <span className="text-sm text-zinc-200">{row.name ?? '-'}</span> },
  { key: 'points', header: '포인트', render: (row) => <span className="font-mono text-xs">{formatNumber(row.totalGuildPoint)}</span> },
  { key: 'members', header: '인원', render: (row) => <span className="font-mono text-xs">{formatNumber(row.memberCount)}</span> },
  { key: 'indexedAt', header: 'indexed', render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.indexedAt)}</span> },
];

function GuildSeasonRankingDiagnosticsPanel({
  diagnostic,
  loading,
  error,
  onRefresh,
}: {
  diagnostic?: GuildSeasonRankingDiagnostic;
  loading: boolean;
  error: unknown;
  onRefresh: () => void;
}) {
  const byStatus = diagnostic?.seasonDocuments.byStatus ?? [];
  const source = diagnostic?.rankingSource;
  return (
    <PageSection
      title="길드 시즌/랭킹 출처"
      description="현재 시즌 선택, 랭킹 스냅샷, Redis 캐시, fallback 계산 입력값을 읽기 전용으로 확인합니다."
      right={
        <div className="flex items-center gap-2">
          {diagnostic && (
            <StatusBadge
              label={diagnostic.health}
              tone={diagnostic.health === 'OK' ? 'success' : 'warning'}
            />
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            새로고침
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="text-sm text-zinc-500">시즌/랭킹 진단 정보를 불러오는 중입니다.</p>
      ) : error ? (
        <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage>
      ) : diagnostic && source ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">선택 시즌</p>
              <p className="mt-1 break-all font-mono text-sm text-zinc-100">{diagnostic.selectedSeasonId}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">랭킹 출처</p>
              <div className="mt-2">
                <StatusBadge
                  label={source.effectiveSource}
                  tone={source.effectiveSource === 'snapshot' ? 'success' : 'warning'}
                />
              </div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">스냅샷 rows</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">{formatNumber(source.snapshot.rowCount)}</p>
              <p className="text-xs text-zinc-500">{source.snapshot.exists ? formatDateTime(source.snapshot.updatedAt) : '없음'}</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">Redis 랭킹 캐시</p>
              <div className="mt-2">
                <StatusBadge label={source.redisCache.hit ? 'hit' : 'miss'} tone={source.redisCache.hit ? 'success' : 'neutral'} />
              </div>
              <p className="mt-1 text-xs text-zinc-500">TTL {formatNumber(source.redisCache.ttlMinutesConfigured)}분</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <p className="text-xs text-zinc-500">active guild rows</p>
              <p className="mt-1 font-mono text-lg text-zinc-100">{formatNumber(source.fallbackInputs.activeGuildRows)}</p>
              <p className="text-xs text-zinc-500">entries {formatNumber(source.fallbackInputs.activeSeasonEntryRows)}</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs font-semibold text-zinc-300">시즌 상태 분포</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {byStatus.length > 0 ? (
                  byStatus.map((row) => (
                    <span key={row.status} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">
                      {row.status}: {formatNumber(row.count)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">시즌 문서 없음</span>
                )}
              </div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
              <p className="text-xs font-semibold text-zinc-300">현재 시즌 후보</p>
              <div className="mt-2 space-y-1 text-xs text-zinc-400">
                {diagnostic.seasonDocuments.currentCandidates.map((row) => (
                  <p key={row.seasonId} className="break-all">
                    <span className="font-mono text-zinc-200">{row.seasonId}</span> · {row.status ?? '-'} · {row.title ?? '-'}
                  </p>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-4">
            {Object.entries(source.fallbackInputs).map(([key, value]) => (
              <div key={key} className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <p className="text-zinc-500">{key}</p>
                <p className="font-mono text-zinc-100">{formatNumber(value)}</p>
              </div>
            ))}
          </div>

          <DataTable
            columns={rankingTopColumns}
            data={source.topGuildRows}
            rowKey={(row) => row.guildId ?? row.name ?? 'unknown'}
            emptyMessage="랭킹 입력 guild_rows가 없습니다."
          />
          <p className="break-all text-[11px] text-zinc-600">
            Redis key {source.redisCache.key} · DB {diagnostic.dbPath} · checked {formatDateTime(diagnostic.checkedAt)}
          </p>
        </div>
      ) : null}
    </PageSection>
  );
}

export function AdminGuildsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState<GuildListFilter>({ q: '', status: '', seasonId: '', limit: 100 });
  const [recruitingFilter, setRecruitingFilter] = useState('');
  const [filter, setFilter] = useState<GuildListFilter>({ limit: 100 });
  const [openGuildId, setOpenGuildId] = useState<string | null>(null);
  const [pointGuild, setPointGuild] = useState<Guild | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: guildRows, isLoading, error } = useQuery({
    queryKey: ['admin-guilds', filter],
    queryFn: () => guildApi.list(filter),
  });

  const diagnosticsQuery = useQuery({
    queryKey: ['admin-guild-server-db-diagnostics'],
    queryFn: () => guildApi.serverDbDiagnostics(),
    refetchInterval: 60_000,
  });

  const rankingDiagnosticsQuery = useQuery({
    queryKey: ['admin-guild-season-ranking-diagnostics', filter.seasonId ?? 'current'],
    queryFn: () => guildApi.seasonRankingDiagnostics(filter.seasonId),
    refetchInterval: 60_000,
  });

  const quickMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Parameters<typeof guildApi.update>[1] }) => guildApi.update(id, input),
    onSuccess: (guild) => {
      setNotice(`${guild.name} 업데이트 완료`);
      void qc.invalidateQueries({ queryKey: ['admin-guilds'] });
      void qc.invalidateQueries({ queryKey: ['guild', guild.guildId] });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: () => guildApi.reindexServerDb({ target: 'all', write: true }),
    onSuccess: (result) => {
      setNotice(
        `길드 Server DB 인덱스 재생성 완료 · guilds ${formatNumber(result.rows.guilds)} / members ${formatNumber(result.rows.members)} / userGuilds ${formatNumber(result.rows.userGuilds)}`,
      );
      void qc.invalidateQueries({ queryKey: ['admin-guild-server-db-diagnostics'] });
      void qc.invalidateQueries({ queryKey: ['admin-guilds'] });
    },
  });

  const applyFilter = () =>
    setFilter({
      q: form.q?.trim() || undefined,
      status: form.status || undefined,
      seasonId: form.seasonId?.trim() || undefined,
      limit: form.limit ?? 100,
    });

  const resetFilter = () => {
    setForm({ q: '', status: '', seasonId: '', limit: 100 });
    setRecruitingFilter('');
    setFilter({ limit: 100 });
  };

  const guilds = useMemo(() => {
    const rows = guildRows ?? [];
    return rows.filter((guild) => {
      if (recruitingFilter === 'recruiting') return guild.isRecruiting === true && guild.memberCount < guild.maxMembers;
      if (recruitingFilter === 'closed') return guild.isRecruiting !== true;
      if (recruitingFilter === 'full') return guild.memberCount >= guild.maxMembers;
      if (recruitingFilter === 'needs-owner') return !guild.ownerUid;
      return true;
    });
  }, [guildRows, recruitingFilter]);

  const summary = useMemo(() => {
    const rows = guildRows ?? [];
    return {
      active: rows.filter((guild) => guild.status === 'active').length,
      recruiting: rows.filter((guild) => guild.isRecruiting === true && guild.memberCount < guild.maxMembers).length,
      full: rows.filter((guild) => guild.memberCount >= guild.maxMembers).length,
      needsOwner: rows.filter((guild) => !guild.ownerUid).length,
      locked: rows.filter((guild) => guild.status === 'locked').length,
      banned: rows.filter((guild) => guild.status === 'banned').length,
    };
  }, [guildRows]);

  const updateStatus = (guild: Guild, status: GuildStatus) =>
    quickMutation.mutate({ id: guild.guildId, input: { status } });

  const columns: Column<Guild>[] = [
    { key: 'emblem', header: '엠블럼', render: (row) => <GuildEmblemThumb guild={row} /> },
    { key: 'name', header: '길드명', render: (row) => <span className="font-medium text-zinc-200">{row.name}</span> },
    { key: 'slug', header: '슬러그', render: (row) => <span className="font-mono text-xs text-zinc-500">{row.slug}</span> },
    { key: 'season', header: '시즌', render: (row) => <span className="text-xs text-zinc-400">{row.seasonId}</span> },
    {
      key: 'status',
      header: '상태',
      render: (row) => <StatusBadge label={GUILD_STATUS_LABELS[row.status]} tone={guildStatusTone(row.status)} />,
    },
    {
      key: 'members',
      header: '인원',
      render: (row) => <span className="font-mono text-xs text-zinc-300">{row.memberCount}/{row.maxMembers}</span>,
    },
    {
      key: 'point',
      header: '총 포인트',
      render: (row) => <span className="font-mono text-xs text-zinc-300">{formatNumber(row.totalGuildPoint)}</span>,
    },
    {
      key: 'rank',
      header: '순위',
      render: (row) => <span className="font-mono text-xs text-zinc-400">{row.currentSeasonRank ?? '-'}</span>,
    },
    { key: 'owner', header: '길드장', render: (row) => <CopyableId value={row.ownerUid} /> },
    {
      key: 'createdAt',
      header: '생성일',
      render: (row) => <span className="font-mono text-xs text-zinc-500">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '관리',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => setOpenGuildId(row.guildId)}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-600"
          >
            상세
          </button>
          <button
            type="button"
            onClick={() => setPointGuild(row)}
            className="rounded bg-emerald-700 px-2 py-1 text-xs text-white hover:bg-emerald-600"
          >
            포인트 +
          </button>
          <ConfirmButton
            tone={row.status === 'locked' ? 'primary' : 'neutral'}
            confirmLabel={row.status === 'locked' ? '활성화 확정' : '잠금 확정'}
            disabled={quickMutation.isPending || row.status === 'disbanded'}
            className="px-2 py-1 text-xs"
            onConfirm={() => updateStatus(row, row.status === 'locked' ? 'active' : 'locked')}
          >
            {row.status === 'locked' ? '활성화' : '잠금'}
          </ConfirmButton>
          <ConfirmButton
            tone="danger"
            confirmLabel="정지 확정"
            disabled={quickMutation.isPending || row.status === 'banned' || row.status === 'disbanded'}
            className="px-2 py-1 text-xs"
            onConfirm={() => updateStatus(row, 'banned')}
          >
            정지
          </ConfirmButton>
          <ConfirmButton
            tone="danger"
            confirmLabel="해체 확정"
            disabled={quickMutation.isPending || row.status === 'disbanded'}
            className="px-2 py-1 text-xs"
            onConfirm={() => updateStatus(row, 'disbanded')}
          >
            해체
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <GuildServerDbDiagnosticsPanel
        diagnostics={diagnosticsQuery.data}
        loading={diagnosticsQuery.isLoading}
        error={diagnosticsQuery.error}
        onRefresh={() => void diagnosticsQuery.refetch()}
        onReindex={() => reindexMutation.mutate()}
        reindexing={reindexMutation.isPending}
      />

      <GuildSeasonRankingDiagnosticsPanel
        diagnostic={rankingDiagnosticsQuery.data}
        loading={rankingDiagnosticsQuery.isLoading}
        error={rankingDiagnosticsQuery.error}
        onRefresh={() => void rankingDiagnosticsQuery.refetch()}
      />
      {reindexMutation.isError && <InlineMessage kind="error">{errorToMessage(reindexMutation.error)}</InlineMessage>}
      <PageSection
        title="길드 검색"
        right={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void qc.invalidateQueries({ queryKey: ['admin-guilds'] })}
              className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
            >
              새로고침
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700"
            >
              + 새 길드 생성
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs text-zinc-400">이름 / 슬러그</label>
            <input
              type="text"
              value={form.q ?? ''}
              onChange={(event) => setForm({ ...form, q: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && applyFilter()}
              placeholder="길드명 또는 슬러그"
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">상태</label>
            <select
              value={form.status ?? ''}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">모집</label>
            <select
              value={recruitingFilter}
              onChange={(event) => setRecruitingFilter(event.target.value)}
              className="cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              {RECRUITING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">시즌 ID</label>
            <input
              type="text"
              value={form.seasonId ?? ''}
              onChange={(event) => setForm({ ...form, seasonId: event.target.value })}
              onKeyDown={(event) => event.key === 'Enter' && applyFilter()}
              placeholder="선택"
              className="w-40 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">로드 수</label>
            <select
              value={form.limit ?? 100}
              onChange={(event) => setForm({ ...form, limit: Number(event.target.value) })}
              className="cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              {LIMIT_OPTIONS.map((limit) => (
                <option key={limit} value={limit}>
                  {limit}개
                </option>
              ))}
            </select>
          </div>
          <button type="button" onClick={applyFilter} className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700">
            검색
          </button>
          <button
            type="button"
            onClick={resetFilter}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            필터 초기화
          </button>
        </div>
      </PageSection>

      <QueryState isLoading={isLoading} error={error}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">
            {guilds.length}개 표시 · 전체 {guildRows?.length ?? 0}개 로드
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={`활성 ${summary.active}`} tone="success" />
            <StatusBadge label={`모집 ${summary.recruiting}`} tone="info" />
            <StatusBadge label={`만석 ${summary.full}`} tone="warning" />
            <StatusBadge label={`길드장 없음 ${summary.needsOwner}`} tone={summary.needsOwner > 0 ? 'danger' : 'neutral'} />
            <StatusBadge label={`잠금 ${summary.locked}`} tone="neutral" />
            <StatusBadge label={`정지 ${summary.banned}`} tone="danger" />
          </div>
        </div>
        {notice && <InlineMessage kind="success">{notice}</InlineMessage>}
        {quickMutation.isError && <InlineMessage kind="error">{errorToMessage(quickMutation.error)}</InlineMessage>}
        <DataTable
          columns={columns}
          data={guilds}
          rowKey={(row) => row.id}
          emptyMessage="해당 조건의 길드가 없습니다"
          onRowClick={(row) => setOpenGuildId(row.guildId)}
        />
      </QueryState>

      {openGuildId && <GuildDetailModal guildId={openGuildId} open={openGuildId !== null} onClose={() => setOpenGuildId(null)} />}

      <GuildPointGrantModal
        guild={pointGuild}
        open={pointGuild !== null}
        onClose={() => setPointGuild(null)}
        onSuccess={(result) => {
          setNotice(`${result.guild.name} 포인트 ${formatNumber(result.amount)}점 추가 완료`);
          void qc.invalidateQueries({ queryKey: ['admin-guilds'] });
          void qc.invalidateQueries({ queryKey: ['guild', result.guild.guildId] });
        }}
      />

      <GuildCreateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

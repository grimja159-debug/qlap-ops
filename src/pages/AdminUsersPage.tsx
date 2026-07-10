import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { UserDetailModal } from '../components/UserDetailModal';
import { UserCreateModal } from '../components/UserCreateModal';
import { userApi } from '../services/userApi';
import { useAuth } from '../contexts/auth';
import type { AdminUser } from '../types/user';
import {
  IDENTITY_PROVIDER_LABELS,
  PLAN_LABELS,
  USER_ROLES,
  USER_ROLE_LABELS,
  USER_STATUSES,
  USER_STATUS_LABELS,
  type UserRole,
  type UserStatus,
} from '../lib/constants';
import { planTone, userStatusTone } from '../lib/statusTone';
import { formatDate, formatNumber } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import { errorToMessage } from '../lib/apiError';
import type { UserCompletenessReport, UserSearchField } from '../types/user';

/**
 * 유저 관리 페이지.
 *
 * [검색] 백엔드 GET /api/admin/users 가 서버사이드 검색을 지원한다.
 *  - q: 닉네임/이메일/RiotID/gameName/UID 부분일치
 *  - role/status: equality 필터
 *  검색을 적용하면 서버에서 다시 받아오므로, 클라이언트 ≤100 한계의 "목록에 없으면 못 찾음" 문제가 줄어든다.
 *  (인증 필터는 백엔드에 없어 받은 결과 안에서 클라이언트가 추가로 거른다.)
 */
const STATUS_FILTER_OPTIONS = [{ value: '', label: '전체 상태' }, ...USER_STATUSES.map((s) => ({ value: s, label: USER_STATUS_LABELS[s] }))];
const ROLE_FILTER_OPTIONS = [{ value: '', label: '전체 권한' }, ...USER_ROLES.map((r) => ({ value: r, label: USER_ROLE_LABELS[r] }))];
const IDENTITY_FILTER_OPTIONS = [
  { value: '', label: '전체 인증' },
  { value: 'verified', label: '인증자' },
  { value: 'kakao', label: '카카오 인증자' },
  { value: 'unverified', label: '미인증' },
];

const SEARCH_TYPE_OPTIONS: Array<{ value: UserSearchField | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'uid', label: 'UID' },
  { value: 'email', label: '이메일' },
  { value: 'displayName', label: '닉네임' },
  { value: 'riotId', label: 'Riot ID' },
];
const LIMIT_OPTIONS = [50, 100, 200];

interface AppliedSearch {
  q?: string;
  type?: UserSearchField | 'all';
  role?: UserRole;
  status?: UserStatus;
}

function identityBadgeLabel(user: AdminUser): string {
  if (!user.identityVerified) return '미인증';
  if (user.identityProvider === 'kakao') return '카카오 인증자';
  const providerLabel = IDENTITY_PROVIDER_LABELS[user.identityProvider] ?? user.identityProvider;
  return `${providerLabel} 인증`;
}

function coverageTone(percent: number) {
  if (percent >= 80) return 'success' as const;
  if (percent >= 40) return 'warning' as const;
  return 'danger' as const;
}

function CompletenessMetric({
  label,
  value,
  total,
  percent,
}: {
  label: string;
  value: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">{label}</p>
        <StatusBadge label={`${percent}%`} tone={coverageTone(percent)} />
      </div>
      <p className="mt-2 text-lg font-semibold text-zinc-100">
        {formatNumber(value)}
        <span className="ml-1 text-xs font-normal text-zinc-500">/ {formatNumber(total)}</span>
      </p>
    </div>
  );
}

function UserCompletenessPanel({ report, refreshing, onRefresh }: { report: UserCompletenessReport; refreshing: boolean; onRefresh: () => void }) {
  const total = report.counts.checked;
  return (
    <PageSection
      title="유저 데이터 완성도"
      description="Server DB 기준으로 Kakao, Discord, Riot, PUUID, 전투력/티어, 프로필 이미지, 지갑 준비 상태를 읽기 전용으로 확인합니다."
      right={
        <button type="button" onClick={onRefresh} disabled={refreshing} className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50">
          {refreshing ? '확인 중...' : '새로고침'}
        </button>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <CompletenessMetric label="Kakao 인증" value={report.counts.kakaoVerified} total={total} percent={report.coverage.kakaoVerifiedPct} />
        <CompletenessMetric label="Discord 연동" value={report.counts.discordLinked} total={total} percent={report.coverage.discordLinkedPct} />
        <CompletenessMetric label="Riot 연동" value={report.counts.riotLinked} total={total} percent={report.coverage.riotLinkedPct} />
        <CompletenessMetric label="PUUID 준비" value={report.counts.puuidReady} total={total} percent={report.coverage.puuidReadyPct} />
        <CompletenessMetric label="전투력/티어" value={report.counts.personalScoreSummaryReady} total={total} percent={report.coverage.personalScoreSummaryReadyPct} />
        <CompletenessMetric label="프로필 이미지" value={report.counts.profileImageReady} total={total} percent={report.coverage.profileImageReadyPct} />
        <CompletenessMetric label="지갑 row" value={report.counts.walletReady} total={total} percent={report.coverage.walletReadyPct} />
        <CompletenessMetric label="접근권한 row" value={report.counts.accessReady} total={total} percent={report.coverage.accessReadyPct} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <StatusBadge label={`Server DB only`} tone="success" />
        <StatusBadge label={`write=false`} tone="neutral" />
        <StatusBadge label={`checked ${formatNumber(report.counts.checked)}`} tone="info" />
        <span className="text-zinc-500">확인 시각 {formatDate(report.checkedAt)}</span>
      </div>
      {report.sampleMissing.length > 0 ? (
        <div className="mt-3 overflow-x-auto rounded-md border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-sm">
            <thead className="bg-zinc-950/70 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-3 py-2 text-left">sample</th>
                <th className="px-3 py-2 text-left">missing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {report.sampleMissing.slice(0, 8).map((sample, index) => (
                <tr key={`${sample.uidMasked}-${index}`} className="bg-zinc-900/35">
                  <td className="px-3 py-2 font-mono text-xs text-zinc-300">{sample.uidMasked}</td>
                  <td className="px-3 py-2 text-xs text-zinc-400">{sample.missing.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {report.note ? <p className="mt-3 text-xs text-zinc-500">{report.note}</p> : null}
    </PageSection>
  );
}

export function AdminUsersPage() {
  const qc = useQueryClient();
  const { me } = useAuth();
  const ownUid = me?.uid ?? null;

  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState<UserSearchField | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [identityFilter, setIdentityFilter] = useState('');
  const [applied, setApplied] = useState<AppliedSearch>({});
  const [limit, setLimit] = useState(50);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [directUid, setDirectUid] = useState('');
  const [openUid, setOpenUid] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentCursor = cursorStack[cursorStack.length - 1] ?? null;
  const page = cursorStack.length + 1;

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['admin-users', applied, limit, currentCursor],
    queryFn: () => {
      const params = {
        q: applied.q,
        type: applied.type ?? 'all',
        role: applied.role,
        status: applied.status,
        limit,
        cursor: currentCursor,
      };
      return applied.q ? userApi.searchPage(params) : userApi.listPage(params);
    },
  });

  const completenessQuery = useQuery({
    queryKey: ['admin-users-completeness'],
    queryFn: () => userApi.completeness(1000),
  });

  const quickMutation = useMutation({
    mutationFn: ({ uid, patch }: { uid: string; patch: Parameters<typeof userApi.updateProfile>[1] }) =>
      userApi.updateProfile(uid, patch),
    onSuccess: (user) => {
      setNotice(`${user.displayName ?? user.email ?? user.uid} 업데이트 완료`);
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['user', user.uid] });
    },
  });

  const resetPagination = () => {
    setCursorStack([]);
  };

  const applySearch = () => {
    resetPagination();
    setApplied({
      q: searchInput.trim() || undefined,
      type: searchType,
      role: (roleFilter || undefined) as UserRole | undefined,
      status: (statusFilter || undefined) as UserStatus | undefined,
    });
  };

  const resetFilters = () => {
    setSearchInput('');
    setSearchType('all');
    setRoleFilter('');
    setStatusFilter('');
    setIdentityFilter('');
    resetPagination();
    setApplied({});
  };

  const changeLimit = (nextLimit: number) => {
    setLimit(nextLimit);
    resetPagination();
  };

  const updateSearchInput = (value: string) => {
    setSearchInput(value);
    resetPagination();
  };

  const updateSearchType = (value: UserSearchField | 'all') => {
    setSearchType(value);
    resetPagination();
  };

  const updateRoleFilter = (value: string) => {
    setRoleFilter(value);
    resetPagination();
  };

  const updateStatusFilter = (value: string) => {
    setStatusFilter(value);
    resetPagination();
  };

  const updateIdentityFilter = (value: string) => {
    setIdentityFilter(value);
    resetPagination();
  };

  const goNext = () => {
    if (!data?.nextCursor) return;
    setCursorStack((prev) => [...prev, data.nextCursor!]);
  };

  const goPrev = () => {
    setCursorStack((prev) => prev.slice(0, -1));
  };

  // 인증 필터는 서버 미지원이라 받은 결과 안에서 추가로 거른다.
  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    return list.filter((u) => {
      if (identityFilter === 'verified' && !u.identityVerified) return false;
      if (identityFilter === 'kakao' && !(u.identityVerified && u.identityProvider === 'kakao')) return false;
      if (identityFilter === 'unverified' && u.identityVerified) return false;
      return true;
    });
  }, [data, identityFilter]);

  const summary = useMemo(() => {
    const list = data?.users ?? [];
    return {
      active: list.filter((u) => u.status === 'active').length,
      banned: list.filter((u) => u.status === 'banned').length,
      verified: list.filter((u) => u.identityVerified).length,
      kakao: list.filter((u) => u.identityVerified && u.identityProvider === 'kakao').length,
      admins: list.filter((u) => u.role !== 'user').length,
    };
  }, [data]);

  const exportCsv = () =>
    downloadCsv<AdminUser>(`users-${new Date().toISOString().slice(0, 10)}.csv`, filtered, [
      { header: 'uid', value: (u) => u.uid },
      { header: 'displayName', value: (u) => u.displayName ?? '' },
      { header: 'email', value: (u) => u.email ?? '' },
      { header: 'riotId', value: (u) => u.riotId ?? '' },
      { header: 'plan', value: (u) => u.plan },
      { header: 'role', value: (u) => u.role },
      { header: 'status', value: (u) => u.status },
      { header: 'qlCoinBalance', value: (u) => u.qlCoinBalance },
      { header: 'identityVerified', value: (u) => u.identityVerified },
      { header: 'createdAt', value: (u) => u.createdAt },
    ]);

  const columns: Column<AdminUser>[] = [
    { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'displayName', header: '닉네임', render: (r) => <span className="font-medium text-zinc-200">{r.displayName ?? '–'}</span> },
    { key: 'email', header: '이메일', render: (r) => <span className="text-zinc-400">{r.email ?? '–'}</span> },
    { key: 'riotId', header: 'Riot ID', render: (r) => <span className="text-zinc-400 text-xs">{r.riotId ?? '-'}</span> },
    {
      key: 'identityVerified',
      header: '본인인증',
      render: (r) => <StatusBadge label={identityBadgeLabel(r)} tone={r.identityVerified ? 'success' : 'neutral'} />,
    },
    { key: 'plan', header: '요금제', render: (r) => <StatusBadge label={PLAN_LABELS[r.plan]} tone={planTone(r.plan)} /> },
    { key: 'role', header: '권한', render: (r) => <span className="text-xs text-zinc-300">{USER_ROLE_LABELS[r.role]}</span> },
    { key: 'status', header: '상태', render: (r) => <StatusBadge label={USER_STATUS_LABELS[r.status]} tone={userStatusTone(r.status)} /> },
    { key: 'coin', header: 'QL 코인', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatNumber(r.qlCoinBalance)}</span> },
    { key: 'createdAt', header: '가입일', render: (r) => <span className="text-xs text-zinc-500 font-mono">{formatDate(r.createdAt)}</span> },
    {
      key: 'actions',
      header: '관리',
      render: (r) => {
        const isSelf = ownUid === r.uid;
        return (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setOpenUid(r.uid)} className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100">
            상세
          </button>
          <ConfirmButton
            tone={r.status === 'banned' ? 'primary' : 'danger'}
            confirmLabel={r.status === 'banned' ? '해제 확정' : '정지 확정'}
            disabled={quickMutation.isPending || r.status === 'deleted' || isSelf}
            className="text-xs px-2 py-1"
            onConfirm={() => quickMutation.mutate({ uid: r.uid, patch: { status: r.status === 'banned' ? 'active' : 'banned' } })}
          >
            {r.status === 'banned' ? '해제' : '정지'}
          </ConfirmButton>
          <ConfirmButton
            tone="neutral"
            confirmLabel="삭제처리 확정"
            disabled={quickMutation.isPending || r.status === 'deleted' || isSelf}
            className="text-xs px-2 py-1"
            onConfirm={() => quickMutation.mutate({ uid: r.uid, patch: { status: 'deleted' } })}
          >
            삭제처리
          </ConfirmButton>
          {isSelf && <span className="text-[11px] text-zinc-500">본인 보호</span>}
        </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <QueryState isLoading={completenessQuery.isLoading} error={completenessQuery.error}>
        {completenessQuery.data ? (
          <UserCompletenessPanel
            report={completenessQuery.data}
            refreshing={completenessQuery.isFetching}
            onRefresh={() => void completenessQuery.refetch()}
          />
        ) : null}
      </QueryState>

      <PageSection
        title="유저 검색 (서버사이드)"
        description="닉네임/이메일/RiotID/UID 로 서버에서 검색합니다. 권한·상태는 서버 필터, 인증은 결과 내 필터입니다."
        right={
          <div className="flex items-center gap-2">
            <button type="button" onClick={exportCsv} disabled={filtered.length === 0} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 text-sm px-3 py-1.5 rounded">
              CSV 내보내기
            </button>
            <button onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
              + 유저 추가
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-zinc-400 mb-1 block">검색어 (통합)</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => updateSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applySearch()}
              placeholder="닉네임 / 이메일 / Riot ID / UID"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">상태</label>
            <select value={statusFilter} onChange={(e) => updateStatusFilter(e.target.value)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer">
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">권한</label>
            <select value={roleFilter} onChange={(e) => updateRoleFilter(e.target.value)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer">
              {ROLE_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">인증</label>
            <select value={identityFilter} onChange={(e) => updateIdentityFilter(e.target.value)} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer">
              {IDENTITY_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">검색 대상</label>
            <select value={searchType} onChange={(e) => updateSearchType(e.target.value as UserSearchField | 'all')} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer">
              {SEARCH_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">페이지 크기</label>
            <select value={limit} onChange={(e) => changeLimit(Number(e.target.value))} className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer">
              {LIMIT_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}명</option>
              ))}
            </select>
          </div>
          <button type="button" onClick={applySearch} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
            검색
          </button>
          <button type="button" onClick={resetFilters} className="bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm px-3 py-1.5 rounded">
            초기화
          </button>
          <div className="flex items-end gap-2">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">UID로 직접 열기</label>
              <input
                type="text"
                value={directUid}
                onChange={(e) => setDirectUid(e.target.value)}
                placeholder="정확한 UID"
                className="w-56 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
              />
            </div>
            <button type="button" disabled={!directUid.trim()} onClick={() => setOpenUid(directUid.trim())} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded">
              열기
            </button>
          </div>
        </div>
      </PageSection>

      <QueryState isLoading={isLoading} error={error}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">
            {filtered.length}명 표시 / 현재 페이지 {data?.users.length ?? 0}명 / {page}페이지 / 최대 {limit}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={`활성 ${summary.active}`} tone="success" />
            <StatusBadge label={`정지 ${summary.banned}`} tone="danger" />
            <StatusBadge label={`인증 ${summary.verified}`} tone="info" />
            <StatusBadge label={`카카오 ${summary.kakao}`} tone="success" />
            <StatusBadge label={`관리자 ${summary.admins}`} tone="accent" />
          </div>
        </div>
        {notice && <InlineMessage kind="success">{notice}</InlineMessage>}
        {quickMutation.isError && <InlineMessage kind="error">{errorToMessage(quickMutation.error)}</InlineMessage>}
        <DataTable columns={columns} data={filtered} rowKey={(r) => r.uid} emptyMessage="해당 조건의 유저가 없습니다" onRowClick={(r) => setOpenUid(r.uid)} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-zinc-500">
            {applied.q ? `검색: ${applied.q}` : '전체 목록'} / {page}페이지
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={goPrev} disabled={isFetching || cursorStack.length === 0} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 text-sm px-3 py-1.5 rounded">
              이전
            </button>
            <button type="button" onClick={goNext} disabled={isFetching || !data?.hasMore || !data?.nextCursor} className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 text-sm px-3 py-1.5 rounded">
              다음
            </button>
          </div>
        </div>
      </QueryState>

      {openUid && <UserDetailModal uid={openUid} open={openUid !== null} onClose={() => setOpenUid(null)} />}
      <UserCreateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}

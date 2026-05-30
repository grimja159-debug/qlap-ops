import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { UserDetailModal } from '../components/UserDetailModal';
import { userApi } from '../services/userApi';
import { USER_SEARCH_FIELD_LABELS, type UserSearchField, type AdminUser } from '../types/user';
import { PLAN_LABELS, USER_ROLE_LABELS, USER_STATUS_LABELS } from '../lib/constants';
import { planTone, userStatusTone } from '../lib/statusTone';
import { formatDate, formatNumber } from '../lib/format';

/**
 * 유저 관리 페이지.
 *
 * [검색 동작 — 운영자가 꼭 알아야 함]
 *  백엔드 GET /api/admin/users 는 검색 파라미터가 없고 최신 일부(limit)만 준다.
 *  그래서 이 화면은 "최대 100명을 불러와 그 안에서" UID/RiotID/닉네임/이메일로 필터링한다.
 *  찾는 사용자가 목록에 없을 수 있으므로, 정확한 UID 를 알면 'UID로 직접 열기'(단건 조회)를 쓴다.
 *  대규모 검색에는 백엔드 검색 API 가 필요하다 → ADMIN_GUIDE.md.
 */
const SEARCH_FIELDS: UserSearchField[] = ['uid', 'riotId', 'displayName', 'email'];

export function AdminUsersPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => userApi.list(100),
  });

  const [field, setField] = useState<UserSearchField>('displayName');
  const [query, setQuery] = useState('');
  const [directUid, setDirectUid] = useState('');
  const [openUid, setOpenUid] = useState<string | null>(null);

  // 불러온 목록 안에서 선택한 필드로 부분일치 필터링.
  const filtered = useMemo(() => {
    const list = data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => {
      const value = u[field];
      return typeof value === 'string' && value.toLowerCase().includes(q);
    });
  }, [data, field, query]);

  const columns: Column<AdminUser>[] = [
    { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
    {
      key: 'displayName',
      header: '닉네임',
      render: (r) => <span className="font-medium text-zinc-200">{r.displayName ?? '–'}</span>,
    },
    { key: 'email', header: '이메일', render: (r) => <span className="text-zinc-400">{r.email ?? '–'}</span> },
    {
      key: 'riotId',
      header: 'Riot ID',
      render: (r) => <span className="text-zinc-400 text-xs">{r.riotId ?? '–'}</span>,
    },
    {
      key: 'plan',
      header: '요금제',
      render: (r) => <StatusBadge label={PLAN_LABELS[r.plan]} tone={planTone(r.plan)} />,
    },
    { key: 'role', header: '권한', render: (r) => <span className="text-xs text-zinc-300">{USER_ROLE_LABELS[r.role]}</span> },
    {
      key: 'status',
      header: '상태',
      render: (r) => <StatusBadge label={USER_STATUS_LABELS[r.status]} tone={userStatusTone(r.status)} />,
    },
    {
      key: 'coin',
      header: 'QL 코인',
      render: (r) => <span className="font-mono text-xs text-zinc-300">{formatNumber(r.qlCoinBalance)}</span>,
    },
    {
      key: 'createdAt',
      header: '가입일',
      render: (r) => <span className="text-xs text-zinc-500 font-mono">{formatDate(r.createdAt)}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="유저 검색"
        description="불러온 목록(최대 100명) 안에서 필터링합니다. 목록에 없으면 UID로 직접 여세요."
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">검색 기준</label>
            <select
              value={field}
              onChange={(e) => setField(e.target.value as UserSearchField)}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {SEARCH_FIELDS.map((f) => (
                <option key={f} value={f}>
                  {USER_SEARCH_FIELD_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-zinc-400 mb-1 block">검색어</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`${USER_SEARCH_FIELD_LABELS[field]} 입력`}
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
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
            <button
              type="button"
              disabled={!directUid.trim()}
              onClick={() => setOpenUid(directUid.trim())}
              className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
            >
              열기
            </button>
          </div>
        </div>
      </PageSection>

      <QueryState isLoading={isLoading} error={error}>
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {filtered.length}명 표시 · 전체 {data?.length ?? 0}명 로드(최대 100)
          </span>
        </div>
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.uid}
          emptyMessage="해당 조건의 유저가 없습니다"
          onRowClick={(r) => setOpenUid(r.uid)}
        />
      </QueryState>

      {openUid && (
        <UserDetailModal uid={openUid} open={openUid !== null} onClose={() => setOpenUid(null)} />
      )}
    </div>
  );
}

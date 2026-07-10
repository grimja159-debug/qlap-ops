import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { InlineMessage } from '../components/InlineMessage';
import { ConfirmButton } from '../components/ConfirmButton';
import { StatusBadge } from '../components/StatusBadge';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime } from '../lib/format';
import { accessApi } from '../services/accessApi';
import { ACCESS_FLAG_KEYS, ACCESS_FLAG_LABELS, type AccessFlagKey, type UserAccess } from '../types/access';

type FlagFilterValue = 'all' | 'true' | 'false';

interface EditingAccess {
  base: UserAccess;
  draft: UserAccess;
}

const LIMIT_OPTIONS = [50, 100];
const FLAG_FILTER_OPTIONS: Array<{ value: FlagFilterValue; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'true', label: 'ON' },
  { value: 'false', label: 'OFF' },
];

function toFilters(filters: Record<AccessFlagKey, FlagFilterValue>): Partial<Record<AccessFlagKey, boolean>> {
  const result: Partial<Record<AccessFlagKey, boolean>> = {};
  for (const key of ACCESS_FLAG_KEYS) {
    if (filters[key] === 'true') result[key] = true;
    if (filters[key] === 'false') result[key] = false;
  }
  return result;
}

function changedFlags(editing: EditingAccess | null): Partial<Record<AccessFlagKey, boolean>> {
  const patch: Partial<Record<AccessFlagKey, boolean>> = {};
  if (!editing) return patch;
  for (const key of ACCESS_FLAG_KEYS) {
    if (editing.base[key] !== editing.draft[key]) patch[key] = editing.draft[key];
  }
  return patch;
}

function countEnabled(row: UserAccess): number {
  return ACCESS_FLAG_KEYS.filter((key) => row[key]).length;
}

function accessSummary(rows: UserAccess[]) {
  return {
    total: rows.length,
    guildCreate: rows.filter((row) => row.guildCreate).length,
    guildManage: rows.filter((row) => row.guildManage).length,
    aiReport: rows.filter((row) => row.aiReport).length,
  };
}

export function AdminAccessPage() {
  const qc = useQueryClient();
  const [searchUid, setSearchUid] = useState('');
  const [lookupUid, setLookupUid] = useState('');
  const [editing, setEditing] = useState<EditingAccess | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [limit, setLimit] = useState(100);
  const [filters, setFilters] = useState<Record<AccessFlagKey, FlagFilterValue>>({
    guildCreate: 'all',
    guildManage: 'all',
    aiReport: 'all',
  });

  const apiFilters = useMemo(() => toFilters(filters), [filters]);
  const {
    data: accessList,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['admin-access', apiFilters, limit],
    queryFn: () => accessApi.list(apiFilters, limit),
  });

  const lookup = useQuery({
    queryKey: ['access-uid', lookupUid],
    queryFn: () => accessApi.getByUid(lookupUid),
    enabled: lookupUid.length > 0,
  });

  const mutation = useMutation({
    mutationFn: ({ uid, patch }: { uid: string; patch: Partial<Record<AccessFlagKey, boolean>> }) =>
      accessApi.update({ uid, ...patch }),
    onSuccess: (access) => {
      setNotice(`${access.uid} 기능 플래그가 저장되었습니다.`);
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['admin-access'] });
      void qc.invalidateQueries({ queryKey: ['access-uid'] });
    },
  });

  const rows = useMemo(() => accessList ?? [], [accessList]);
  const summary = useMemo(() => accessSummary(rows), [rows]);
  const patch = changedFlags(editing);
  const hasChanges = Object.keys(patch).length > 0;

  const updateFilter = (key: AccessFlagKey, value: FlagFilterValue) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({ guildCreate: 'all', guildManage: 'all', aiReport: 'all' });
    setLimit(100);
  };

  const startEdit = (row: UserAccess) => {
    setNotice(null);
    setEditing({ base: { ...row }, draft: { ...row } });
  };

  const setDraftFlag = (key: AccessFlagKey, value: boolean) => {
    setEditing((current) =>
      current ? { ...current, draft: { ...current.draft, [key]: value } } : current,
    );
  };

  const submitChanges = () => {
    if (!editing || !hasChanges) return;
    mutation.mutate({ uid: editing.draft.uid, patch });
  };

  const columns: Column<UserAccess>[] = [
    { key: 'uid', header: 'UID', render: (row) => <CopyableId value={row.uid} /> },
    ...ACCESS_FLAG_KEYS.map<Column<UserAccess>>((key) => ({
      key,
      header: ACCESS_FLAG_LABELS[key],
      render: (row) => <StatusBadge label={row[key] ? 'ON' : 'OFF'} tone={row[key] ? 'success' : 'neutral'} />,
    })),
    {
      key: 'enabledCount',
      header: '활성 플래그',
      render: (row) => <span className="font-mono text-xs text-zinc-300">{countEnabled(row)} / {ACCESS_FLAG_KEYS.length}</span>,
    },
    {
      key: 'updatedAt',
      header: '최근 수정',
      render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.updatedAt)}</span>,
    },
    {
      key: 'actions',
      header: '관리',
      render: (row) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            startEdit(row);
          }}
          className="rounded border border-violet-700/50 px-2 py-0.5 text-xs text-violet-300 hover:bg-violet-500/10"
        >
          편집
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageSection
        title="접근 권한"
        description="user_access 기능 플래그를 관리합니다. 계정 role/status/plan은 유저 관리에서 수정하세요."
      >
        <div className="flex flex-wrap items-end gap-3">
          {ACCESS_FLAG_KEYS.map((key) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-zinc-400">{ACCESS_FLAG_LABELS[key]}</label>
              <select
                value={filters[key]}
                onChange={(event) => updateFilter(key, event.target.value as FlagFilterValue)}
                className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
              >
                {FLAG_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          ))}
          <div>
            <label className="mb-1 block text-xs text-zinc-400">목록 수</label>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}명</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            필터 초기화
          </button>
          {isFetching && <span className="text-xs text-zinc-500">갱신 중...</span>}
        </div>
      </PageSection>

      <PageSection title="UID로 단건 조회">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            placeholder="Firebase UID 입력"
            value={searchUid}
            onChange={(event) => setSearchUid(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && searchUid.trim()) setLookupUid(searchUid.trim());
            }}
            className="w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={!searchUid.trim()}
            onClick={() => setLookupUid(searchUid.trim())}
            className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
          >
            조회
          </button>
        </div>
        {lookupUid && (
          <div className="mt-3">
            <QueryState isLoading={lookup.isLoading} error={lookup.error}>
              {lookup.data && (
                <div className="flex flex-wrap items-center gap-5 rounded border border-zinc-700/60 bg-zinc-900 p-3">
                  <CopyableId value={lookup.data.uid} full />
                  {ACCESS_FLAG_KEYS.map((key) => (
                    <span key={key} className="flex items-center gap-1.5 text-xs text-zinc-400">
                      {ACCESS_FLAG_LABELS[key]}
                      <StatusBadge label={lookup.data![key] ? 'ON' : 'OFF'} tone={lookup.data![key] ? 'success' : 'neutral'} />
                    </span>
                  ))}
                  <span className="text-xs text-zinc-500">최근 수정 {formatDateTime(lookup.data.updatedAt)}</span>
                  <button
                    type="button"
                    onClick={() => startEdit(lookup.data!)}
                    className="ml-auto rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-700"
                  >
                    편집
                  </button>
                </div>
              )}
            </QueryState>
          </div>
        )}
      </PageSection>

      {editing && (
        <PageSection accent title="기능 플래그 편집" description="저장 시 변경된 플래그만 백엔드로 전송되고 감사 로그에 기록됩니다.">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-zinc-500">대상</span>
            <CopyableId value={editing.draft.uid} full />
          </div>
          <div className="mb-4 flex flex-wrap gap-6">
            {ACCESS_FLAG_KEYS.map((key) => (
              <ToggleSwitch
                key={key}
                checked={editing.draft[key]}
                onChange={(value) => setDraftFlag(key, value)}
                label={ACCESS_FLAG_LABELS[key]}
              />
            ))}
          </div>
          <div className="mb-4 rounded border border-zinc-700/60 bg-zinc-900/70 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-500">변경 예정</p>
            {hasChanges ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(patch).map(([key, value]) => (
                  <StatusBadge
                    key={key}
                    label={`${ACCESS_FLAG_LABELS[key as AccessFlagKey]} ${value ? 'ON' : 'OFF'}`}
                    tone={value ? 'success' : 'neutral'}
                  />
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-500">변경된 값이 없습니다.</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <ConfirmButton
              confirmLabel="저장 확정"
              disabled={mutation.isPending || !hasChanges}
              onConfirm={submitChanges}
            >
              변경 저장
            </ConfirmButton>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
            >
              취소
            </button>
            {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
          </div>
        </PageSection>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">전체 권한 목록</h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={`표시 ${summary.total}`} tone="neutral" />
            <StatusBadge label={`길드 생성 ${summary.guildCreate}`} tone="success" />
            <StatusBadge label={`길드 관리 ${summary.guildManage}`} tone="accent" />
            <StatusBadge label={`AI 리포트 ${summary.aiReport}`} tone="info" />
          </div>
        </div>
        {notice && <InlineMessage kind="success">{notice}</InlineMessage>}
        <QueryState isLoading={isLoading} error={error}>
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(row) => row.uid}
            emptyMessage="조건에 맞는 접근 권한 기록이 없습니다"
            onRowClick={startEdit}
          />
        </QueryState>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { InlineMessage } from '../components/InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { accessApi } from '../services/accessApi';
import { ACCESS_FLAG_KEYS, ACCESS_FLAG_LABELS, type UserAccess } from '../types/access';

/**
 * 접근 권한(플래그) 관리 — user_access 의 guildCreate / guildManage / aiReport.
 *
 * 주의: 여기는 "기능 플래그"만 다룬다. 사용자 권한(role)·정지(status)는 유저 관리 페이지에서.
 *  - 전체 목록(GET /api/admin/access) + UID 단건 조회(GET /api/admin/access/:uid)
 *  - 토글 후 저장(POST /api/admin/access/update) — 바뀐 플래그만 전송
 */
export function AdminAccessPage() {
  const qc = useQueryClient();
  const [searchUid, setSearchUid] = useState('');
  const [lookupUid, setLookupUid] = useState('');
  const [editRow, setEditRow] = useState<UserAccess | null>(null);

  const { data: accessList, isLoading, error } = useQuery({
    queryKey: ['admin-access'],
    queryFn: () => accessApi.list(),
  });

  // UID 단건 조회(목록에 없을 수 있는 사용자도 직접 확인/편집).
  const lookup = useQuery({
    queryKey: ['access-uid', lookupUid],
    queryFn: () => accessApi.getByUid(lookupUid),
    enabled: lookupUid.length > 0,
  });

  const mutation = useMutation({
    mutationFn: accessApi.update,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-access'] });
      void qc.invalidateQueries({ queryKey: ['access-uid'] });
      setEditRow(null);
    },
  });

  const columns: Column<UserAccess>[] = [
    { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
    ...ACCESS_FLAG_KEYS.map<Column<UserAccess>>((key) => ({
      key,
      header: ACCESS_FLAG_LABELS[key],
      render: (r) => (
        <span className={r[key] ? 'text-emerald-400' : 'text-zinc-600'}>{r[key] ? 'ON' : 'OFF'}</span>
      ),
    })),
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={() => setEditRow({ ...r })}
          className="text-xs text-violet-400 hover:text-violet-300 px-2 py-0.5 border border-violet-700/50 rounded hover:bg-violet-500/10"
        >
          편집
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageSection title="UID로 권한 조회">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="UID 입력 후 조회"
            value={searchUid}
            onChange={(e) => setSearchUid(e.target.value)}
            className="w-80 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
          />
          <button
            type="button"
            disabled={!searchUid.trim()}
            onClick={() => setLookupUid(searchUid.trim())}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
          >
            조회
          </button>
        </div>
        {lookupUid && (
          <div className="mt-3">
            <QueryState isLoading={lookup.isLoading} error={lookup.error}>
              {lookup.data && (
                <div className="p-3 rounded bg-zinc-900 border border-zinc-700/60 flex flex-wrap gap-6 items-center">
                  <CopyableId value={lookup.data.uid} full />
                  <div className="flex gap-4">
                    {ACCESS_FLAG_KEYS.map((key) => (
                      <span key={key} className="text-xs text-zinc-400">
                        {ACCESS_FLAG_LABELS[key]}:{' '}
                        <span className={lookup.data![key] ? 'text-emerald-400' : 'text-zinc-600'}>
                          {lookup.data![key] ? 'ON' : 'OFF'}
                        </span>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => setEditRow({ ...lookup.data! })}
                    className="ml-auto text-xs bg-violet-600 hover:bg-violet-700 text-white px-3 py-1 rounded"
                  >
                    편집
                  </button>
                </div>
              )}
            </QueryState>
          </div>
        )}
      </PageSection>

      {editRow && (
        <PageSection accent title={`권한 편집 — ${editRow.uid}`}>
          <div className="flex flex-wrap gap-6 mb-4">
            {ACCESS_FLAG_KEYS.map((key) => (
              <ToggleSwitch
                key={key}
                checked={editRow[key]}
                onChange={(v) => setEditRow({ ...editRow, [key]: v })}
                label={ACCESS_FLAG_LABELS[key]}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() =>
                mutation.mutate({
                  uid: editRow.uid,
                  guildCreate: editRow.guildCreate,
                  guildManage: editRow.guildManage,
                  aiReport: editRow.aiReport,
                })
              }
              disabled={mutation.isPending}
              className="text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-4 py-1.5 rounded"
            >
              {mutation.isPending ? '저장 중...' : '변경 저장'}
            </button>
            <button onClick={() => setEditRow(null)} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5">
              취소
            </button>
            {mutation.isSuccess && <InlineMessage kind="success">저장되었습니다.</InlineMessage>}
            {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
          </div>
        </PageSection>
      )}

      <div>
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">전체 권한 목록</h2>
        <QueryState isLoading={isLoading} error={error}>
          <DataTable
            columns={columns}
            data={accessList ?? []}
            rowKey={(r) => r.uid}
            emptyMessage="권한 레코드가 없습니다"
          />
        </QueryState>
      </div>
    </div>
  );
}

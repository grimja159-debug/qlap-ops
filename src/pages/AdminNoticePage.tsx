import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { NoticeFormModal } from '../components/NoticeFormModal';
import { noticeApi } from '../services/noticeApi';
import { NOTICE_TYPE_LABELS, type NoticeType } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import { errorToMessage } from '../lib/apiError';
import type { Notice } from '../types/notice';

/**
 * 공지 관리 페이지(super_admin 전용).
 * GET/POST/PATCH/DELETE /api/admin/notices 로 운영 공지/배너를 관리한다.
 */
const TYPE_TONE: Record<NoticeType, Parameters<typeof StatusBadge>[0]['tone']> = {
  info: 'info',
  warning: 'danger',
  event: 'accent',
  maintenance: 'neutral',
};

export function AdminNoticePage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['notices'], queryFn: () => noticeApi.list({ limit: 100 }) });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);

  const removeMut = useMutation({
    mutationFn: (id: string) => noticeApi.remove(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notices'] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => noticeApi.update(id, { active }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notices'] }),
  });

  const columns: Column<Notice>[] = [
    {
      key: 'type',
      header: '종류',
      render: (r) => <StatusBadge label={NOTICE_TYPE_LABELS[r.type] ?? r.type} tone={TYPE_TONE[r.type] ?? 'neutral'} />,
    },
    {
      key: 'title',
      header: '제목',
      render: (r) => (
        <span className="font-medium text-zinc-200">
          {r.pinned && <span className="text-violet-400 mr-1">📌</span>}
          {r.title}
        </span>
      ),
    },
    {
      key: 'active',
      header: '활성',
      render: (r) => <StatusBadge label={r.active ? '활성' : '비활성'} tone={r.active ? 'success' : 'neutral'} />,
    },
    {
      key: 'period',
      header: '노출 기간',
      render: (r) => (
        <span className="text-xs text-zinc-500">
          {r.startAt || r.endAt ? `${r.startAt ? formatDateTime(r.startAt) : '–'} ~ ${r.endAt ? formatDateTime(r.endAt) : '–'}` : '상시'}
        </span>
      ),
    },
    { key: 'updatedAt', header: '수정', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.updatedAt)}</span> },
    {
      key: 'actions',
      header: '관리',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setEditing(r)}
            className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100"
          >
            수정
          </button>
          <button
            type="button"
            disabled={toggleMut.isPending}
            onClick={() => toggleMut.mutate({ id: r.id, active: !r.active })}
            className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 disabled:opacity-50"
          >
            {r.active ? '비활성화' : '활성화'}
          </button>
          <ConfirmButton tone="danger" confirmLabel="삭제 확정" className="text-xs px-2 py-1" disabled={removeMut.isPending} onConfirm={() => removeMut.mutate(r.id)}>
            삭제
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="공지 목록"
        description="운영 공지/배너를 작성·수정·삭제합니다. 활성/고정/노출 기간으로 제어합니다."
        right={
          <button onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
            + 새 공지
          </button>
        }
      >
        {(removeMut.isError || toggleMut.isError) && (
          <div className="mb-2">
            <InlineMessage kind="error">{errorToMessage(removeMut.error ?? toggleMut.error)}</InlineMessage>
          </div>
        )}
        <QueryState isLoading={isLoading} error={error}>
          <DataTable columns={columns} data={data ?? []} rowKey={(r) => r.id} emptyMessage="등록된 공지가 없습니다" />
        </QueryState>
      </PageSection>

      {showCreate && <NoticeFormModal open={showCreate} onClose={() => setShowCreate(false)} />}
      {editing && <NoticeFormModal open={editing !== null} editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

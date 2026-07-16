import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyableId } from './CopyableId';
import { DataTable, type Column } from './DataTable';
import { InlineMessage } from './InlineMessage';
import { PageSection } from './PageSection';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime } from '../lib/format';
import { dataSourceLabel, dataSourceTitle } from '../lib/statusTone';
import { supportApi } from '../services/supportApi';
import type { SupportAttachment, SupportRequest, SupportStatus, SupportType } from '../types/support';

const STATUS_LABELS: Record<SupportStatus, string> = {
  pending: '접수',
  in_progress: '처리중',
  resolved: '완료',
  rejected: '반려',
};

const STATUS_TONES: Record<SupportStatus, Parameters<typeof StatusBadge>[0]['tone']> = {
  pending: 'warning',
  in_progress: 'info',
  resolved: 'success',
  rejected: 'danger',
};

const STATUS_FILTERS: Array<{ value: SupportStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: '접수' },
  { value: 'in_progress', label: '처리중' },
  { value: 'resolved', label: '완료' },
  { value: 'rejected', label: '반려' },
];

const STATUS_ACTIONS: SupportStatus[] = ['pending', 'in_progress', 'resolved', 'rejected'];

function SupportStorageBadge({ row }: { row: SupportRequest }) {
  const isServerDb = row.storageSource === 'server_db';
  const isFallback = row.storageSource === 'firestore_fallback';
  const label = dataSourceLabel(row.storageSource);
  const detail = [row.serverDbSource, row.serverDbMirrorStatus].filter(Boolean).join(' / ');
  const title = dataSourceTitle({ source: row.storageSource, serverDbSource: row.serverDbSource, serverDbMirrorStatus: row.serverDbMirrorStatus });
  return (
    <div className="flex flex-col items-start gap-1" title={title}>
      <span
        className={
          isServerDb
            ? 'rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-200'
            : isFallback
              ? 'rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200'
              : 'rounded border border-zinc-600 bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-zinc-400'
        }
      >
        {label}
      </span>
      {detail && <span className="max-w-40 truncate text-[10px] text-zinc-600">{detail}</span>}
    </div>
  );
}

interface SupportInboxPageProps {
  type: SupportType;
  title: string;
  description: string;
}

export function SupportInboxPage({ type, title, description }: SupportInboxPageProps) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<SupportStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryKey = ['support-requests', type, statusFilter];

  const requestsQ = useQuery({ queryKey, queryFn: () => supportApi.list(type, statusFilter) });

  const rows = useMemo(() => {
    const data = requestsQ.data ?? [];
    return statusFilter === 'all' ? data : data.filter((row) => row.status === statusFilter);
  }, [requestsQ.data, statusFilter]);

  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) =>
      supportApi.updateStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey }),
  });

  const columns = useMemo<Column<SupportRequest>[]>(
    () => [
      {
        key: 'status',
        header: '상태',
        width: 'w-24',
        render: (row) => (
          <StatusBadge label={STATUS_LABELS[row.status]} tone={STATUS_TONES[row.status]} />
        ),
      },
      {
        key: 'title',
        header: type === 'inquiry' ? '문의 제목' : '신고 제목',
        render: (row) => (
          <div className="min-w-72">
            <p className="font-medium text-zinc-200">{row.title}</p>
            <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{row.content}</p>
          </div>
        ),
      },
      {
        key: 'author',
        header: type === 'inquiry' ? '문의자' : '신고자',
        width: 'w-44',
        render: (row) => (
          <div>
            <p className="text-xs text-zinc-300">
              {row.authorDisplayName ?? row.authorEmail ?? '-'}
            </p>
            <p className="text-xs text-zinc-600">{row.authorEmail ?? ''}</p>
          </div>
        ),
      },
      {
        key: 'uid',
        header: 'UID',
        width: 'w-56',
        render: (row) => <CopyableId value={row.authorUid} full sensitive />,
      },
      {
        key: 'attachments',
        header: '첨부',
        width: 'w-20',
        render: (row) => (
          <span className="text-xs text-zinc-400">{row.attachments?.length ?? 0}개</span>
        ),
      },
      {
        key: 'storage',
        header: 'Storage',
        width: 'w-40',
        render: (row) => <SupportStorageBadge row={row} />,
      },
      {
        key: 'createdAt',
        header: '접수일',
        width: 'w-44',
        render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span>,
      },
    ],
    [type],
  );

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title={title}
        description={description}
        right={<StatusFilter value={statusFilter} onChange={setStatusFilter} />}
      >
        <QueryState isLoading={requestsQ.isLoading} error={requestsQ.error}>
          <DataTable
            columns={columns}
            data={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => setSelectedId(row.id)}
            emptyMessage={type === 'inquiry' ? '접수된 문의가 없습니다' : '접수된 신고가 없습니다'}
          />
        </QueryState>
      </PageSection>

      {selected && (
        <PageSection
          title={type === 'inquiry' ? '문의 내용' : '신고 내용'}
          description="목록을 클릭하면 내용, 첨부파일, 처리 상태를 한 번에 확인할 수 있습니다."
          accent
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100">{selected.title}</h3>
                <p className="mt-3 whitespace-pre-wrap rounded-lg border border-zinc-700/60 bg-zinc-950/40 p-4 text-sm leading-6 text-zinc-300">
                  {selected.content || '내용이 없습니다.'}
                </p>
              </div>

              <AttachmentList type={type} requestId={selected.id} attachments={selected.attachments ?? []} />
            </div>

            <div className="grid content-start gap-4">
              <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/30 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">처리 상태</p>
                  <StatusBadge label={STATUS_LABELS[selected.status]} tone={STATUS_TONES[selected.status]} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_ACTIONS.map((status) => (
                    <button
                      key={status}
                      type="button"
                      disabled={statusMut.isPending || selected.status === status}
                      onClick={() => statusMut.mutate({ id: selected.id, status })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {STATUS_LABELS[status]}
                    </button>
                  ))}
                </div>
                {statusMut.isError && (
                  <InlineMessage kind="error" className="mt-3 block">
                    {errorToMessage(statusMut.error)}
                  </InlineMessage>
                )}
              </div>

              <dl className="grid content-start gap-3 rounded-lg border border-zinc-700/60 bg-zinc-950/30 p-4 text-sm">
                <DetailItem label="문서 ID" value={<CopyableId value={selected.id} full />} />
                <DetailItem label="UID" value={<CopyableId value={selected.authorUid} full sensitive />} />
                <DetailItem label="이름" value={selected.authorDisplayName ?? '-'} />
                <DetailItem label="이메일" value={selected.authorEmail ?? '-'} />
                <DetailItem label="접수일" value={formatDateTime(selected.createdAt)} />
                <DetailItem label="수정일" value={formatDateTime(selected.updatedAt)} />
                <DetailItem label="처리자" value={<CopyableId value={selected.handledBy} full sensitive />} />
                <DetailItem label="Storage" value={<SupportStorageBadge row={selected} />} />
                <DetailItem label="Mirror" value={`${selected.serverDbSource ?? '-'} / ${selected.serverDbMirrorStatus ?? '-'}`} />
              </dl>
            </div>
          </div>
        </PageSection>
      )}
    </div>
  );
}

function StatusFilter({
  value,
  onChange,
}: {
  value: SupportStatus | 'all';
  onChange: (value: SupportStatus | 'all') => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {STATUS_FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          onClick={() => onChange(filter.value)}
          className={
            value === filter.value
              ? 'rounded border border-violet-500/50 bg-violet-600/20 px-3 py-1.5 text-xs text-violet-200'
              : 'rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300'
          }
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function AttachmentList({
  type,
  requestId,
  attachments,
}: {
  type: SupportType;
  requestId: string;
  attachments: SupportAttachment[];
}) {
  const signedUrlMut = useMutation({
    mutationFn: (attachmentId: string) => supportApi.attachmentUrl(type, requestId, attachmentId),
    onSuccess: (result) => {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    },
  });

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-950/30 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">첨부파일</p>
        <span className="text-xs text-zinc-600">{attachments.length}개</span>
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-zinc-500">첨부파일이 없습니다.</p>
      ) : (
        <div className="grid gap-2">
          {attachments.map((attachment) => (
            <button
              key={attachment.id || attachment.r2Key || attachment.url || attachment.filename}
              type="button"
              disabled={!attachment.id || signedUrlMut.isPending}
              onClick={() => {
                if (attachment.id) signedUrlMut.mutate(attachment.id);
              }}
              className="flex items-center justify-between gap-3 rounded border border-zinc-700/60 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-violet-500/50 hover:text-violet-200"
            >
              <span className="min-w-0 truncate">{attachment.filename ?? attachment.id ?? 'attachment'}</span>
              <span className="shrink-0 text-xs text-zinc-500">
                {attachment.r2Key ? 'signed URL' : attachment.url ? 'legacy URL' : 'private R2'}
              </span>
            </button>
          ))}
        </div>
      )}
      {signedUrlMut.isError && (
        <InlineMessage kind="error" className="mt-3 block">
          {errorToMessage(signedUrlMut.error)}
        </InlineMessage>
      )}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{label}</dt>
      <dd className="mt-1 break-all text-zinc-300">{value}</dd>
    </div>
  );
}

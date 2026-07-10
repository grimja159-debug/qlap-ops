import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from './DataTable';
import { InlineMessage } from './InlineMessage';
import { PageSection } from './PageSection';
import { QueryState } from './QueryState';
import { SelectField, TextAreaField, TextField } from './Field';
import { StatusBadge } from './StatusBadge';
import { supportApi } from '../services/supportApi';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime } from '../lib/format';
import type { SupportRequest, SupportStatus, SupportType } from '../types/support';

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const STATUS_LABELS: Record<SupportStatus, string> = {
  pending: '대기',
  in_progress: '처리중',
  resolved: '완료',
  rejected: '반려',
};

const STATUS_OPTIONS = [
  { value: 'pending', label: '대기' },
  { value: 'in_progress', label: '처리중' },
  { value: 'resolved', label: '완료' },
  { value: 'rejected', label: '반려' },
] as const;

function statusTone(status: SupportStatus): Parameters<typeof StatusBadge>[0]['tone'] {
  if (status === 'resolved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'in_progress') return 'info';
  return 'warning';
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.ceil(value / 1024)}KB`;
}

interface SupportRequestPageProps {
  type: SupportType;
  title: string;
  submitLabel: string;
  description: string;
  tone: 'primary' | 'danger';
}

export function SupportRequestPage({ type, title, submitLabel, description, tone }: SupportRequestPageProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', content: '' });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const queryKey = ['support-requests', type];
  const requestsQ = useQuery({ queryKey, queryFn: () => supportApi.list(type) });

  const createMut = useMutation({
    mutationFn: () => supportApi.create(type, { ...form, attachment }),
    onSuccess: () => {
      setForm({ title: '', content: '' });
      setAttachment(null);
      setFileError(null);
      void qc.invalidateQueries({ queryKey });
    },
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SupportStatus }) => supportApi.updateStatus(id, status),
    onSuccess: () => void qc.invalidateQueries({ queryKey }),
  });

  const columns = useMemo<Column<SupportRequest>[]>(
    () => [
      {
        key: 'status',
        header: '상태',
        render: (row) => <StatusBadge label={STATUS_LABELS[row.status]} tone={statusTone(row.status)} />,
      },
      {
        key: 'title',
        header: '제목',
        render: (row) => <span className="font-medium text-zinc-200">{row.title}</span>,
      },
      {
        key: 'author',
        header: '작성자',
        render: (row) => (
          <span className="text-xs text-zinc-400">{row.authorDisplayName ?? row.authorEmail ?? row.authorUid}</span>
        ),
      },
      {
        key: 'attachment',
        header: '첨부',
        render: (row) => {
          const first = row.attachments?.[0];
          if (!first) return <span className="text-xs text-zinc-600">없음</span>;
          if (!first.url) {
            return <span className="text-xs text-zinc-500">{first.r2Key ? 'private R2' : formatBytes(first.size ?? 0)}</span>;
          }
          return (
            <a
              href={first.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-violet-300 hover:text-violet-200"
            >
              {formatBytes(first.size ?? 0)}
            </a>
          );
        },
      },
      {
        key: 'createdAt',
        header: '접수일',
        render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span>,
      },
      {
        key: 'manage',
        header: '처리',
        render: (row) => (
          <div onClick={(event) => event.stopPropagation()}>
            <SelectField
              label=""
              value={row.status}
              options={STATUS_OPTIONS}
              disabled={statusMut.isPending}
              onChange={(status) => statusMut.mutate({ id: row.id, status: status as SupportStatus })}
            />
          </div>
        ),
      },
    ],
    [statusMut],
  );

  const pickFile = (file: File | undefined) => {
    setFileError(null);
    setAttachment(null);
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) {
      setFileError('jpg, png, webp 이미지만 첨부할 수 있습니다.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setFileError('첨부파일은 5MB 이하만 가능합니다.');
      return;
    }
    setAttachment(file);
  };

  const canSubmit = form.title.trim().length > 0 && form.content.trim().length > 0 && !fileError && !createMut.isPending;

  return (
    <div className="flex flex-col gap-4">
      <PageSection title={title} description={description}>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) createMut.mutate();
          }}
        >
          <TextField
            label="제목"
            value={form.title}
            onChange={(next) => setForm((prev) => ({ ...prev, title: next }))}
            maxLength={100}
            placeholder="제목을 입력하세요"
            required
          />
          <TextAreaField
            label="내용"
            value={form.content}
            onChange={(next) => setForm((prev) => ({ ...prev, content: next }))}
            rows={6}
            maxLength={5000}
            placeholder="내용을 입력하세요"
            hint={`${form.content.length}/5000`}
            required
          />
          <div>
            <label className="mb-1 block text-xs text-zinc-400">첨부파일</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => pickFile(event.target.files?.[0])}
              className="block w-full cursor-pointer rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 file:mr-3 file:rounded file:border-0 file:bg-zinc-700 file:px-3 file:py-1 file:text-xs file:text-zinc-100 hover:file:bg-zinc-600"
            />
            <p className="mt-1 text-xs text-zinc-600">jpg, png, webp 이미지 1개만 첨부할 수 있습니다. 최대 5MB.</p>
            {attachment && <p className="mt-1 text-xs text-zinc-400">{attachment.name} · {formatBytes(attachment.size)}</p>}
          </div>

          {fileError && <InlineMessage kind="error">{fileError}</InlineMessage>}
          {createMut.isError && <InlineMessage kind="error">{errorToMessage(createMut.error)}</InlineMessage>}
          {createMut.isSuccess && <InlineMessage kind="success">접수되었습니다.</InlineMessage>}

          <div>
            <button
              type="submit"
              disabled={!canSubmit}
              className={
                tone === 'danger'
                  ? 'rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50'
                  : 'rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50'
              }
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </PageSection>

      <PageSection title="최근 접수 목록">
        {statusMut.isError && <InlineMessage kind="error" className="mb-2">{errorToMessage(statusMut.error)}</InlineMessage>}
        <QueryState isLoading={requestsQ.isLoading} error={requestsQ.error}>
          <DataTable
            columns={columns}
            data={requestsQ.data ?? []}
            rowKey={(row) => row.id}
            emptyMessage="접수된 내역이 없습니다"
          />
        </QueryState>
      </PageSection>
    </div>
  );
}

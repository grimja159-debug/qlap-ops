import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { InlineMessage } from '../components/InlineMessage';
import { Modal } from '../components/Modal';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { auditApi } from '../services/auditApi';
import { qstargramAdminApi } from '../services/qstargramAdminApi';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime, shortId } from '../lib/format';
import type { AdminAuditLog } from '../types/audit';
import type {
  QStargramAdminListParams,
  QStargramAdminPost,
  QStargramPostStatus,
  QStargramReport,
  QStargramReportListParams,
  QStargramReportStatus,
} from '../types/qstargram';

const STATUS_OPTIONS = ['', 'ACTIVE', 'HIDDEN', 'DELETED'] as const;
const REPORT_STATUS_OPTIONS = ['', 'OPEN', 'REVIEWED', 'RESOLVED'] as const;
const CATEGORY_OPTIONS = ['', 'DAILY', 'PHOTO', 'SHOWCASE', 'LIVE_CW_REVIEW', 'TOURNAMENT_REVIEW', 'ETC'] as const;
const VISIBILITY_OPTIONS = ['', 'PUBLIC', 'HOME_ONLY', 'PRIVATE'] as const;
const LIMIT_OPTIONS = [20, 50, 100] as const;

const REPORT_REASON_LABELS: Record<string, string> = {
  SPAM: '스팸',
  ABUSE: '욕설/괴롭힘',
  SEXUAL_EXPLOITATION: '성착취',
  AD: '광고',
  PRIVACY: '개인정보',
  OTHER: '기타',
};

type BadgeTone = NonNullable<Parameters<typeof StatusBadge>[0]['tone']>;

const STATUS_TONE: Record<QStargramPostStatus, BadgeTone> = {
  ACTIVE: 'success',
  HIDDEN: 'warning',
  DELETED: 'danger',
};

const POST_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '노출중',
  HIDDEN: '숨김',
  DELETED: '삭제됨',
};

const REPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: '미처리',
  REVIEWED: '검토중',
  RESOLVED: '처리완료',
};

const REPORT_STATUS_TONE: Record<string, BadgeTone> = {
  OPEN: 'danger',
  REVIEWED: 'info',
  RESOLVED: 'success',
};

const CATEGORY_LABELS: Record<string, string> = {
  DAILY: '일상',
  PHOTO: '사진',
  SHOWCASE: '자랑',
  LIVE_CW_REVIEW: '내전후기',
  TOURNAMENT_REVIEW: '대회후기',
  ETC: '기타',
};

const VISIBILITY_LABELS: Record<string, string> = {
  PUBLIC: '전체공개',
  HOME_ONLY: '홈에만',
  PRIVATE: '비공개',
};

function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '-';
  return map[key] ?? key;
}

function postIdOf(post: QStargramAdminPost): string {
  return post.postId ?? post.id;
}

function maskUid(uid: string | null | undefined): string {
  return shortId(uid);
}

function preview(value: string | null | undefined, max = 90): string {
  const text = (value ?? '').trim();
  if (!text) return '-';
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function statusLabel(status: string): string {
  return POST_STATUS_LABELS[status] ?? status ?? '-';
}

function Thumb({ post }: { post?: { imageThumbUrls?: string[]; imageUrls?: string[] } | null }) {
  const src = post?.imageThumbUrls?.[0] ?? post?.imageUrls?.[0];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="h-12 w-12 shrink-0 rounded-md border border-zinc-700 object-cover"
    />
  );
}

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: BadgeTone }) {
  const toneText: Record<BadgeTone, string> = {
    success: 'text-emerald-400',
    info: 'text-blue-400',
    accent: 'text-violet-300',
    warning: 'text-amber-400',
    danger: 'text-red-400',
    neutral: 'text-zinc-200',
  };
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/50 px-3 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className={`text-xl font-semibold ${toneText[tone]}`}>{value}</div>
    </div>
  );
}

function PostSummary({ posts }: { posts: QStargramAdminPost[] }) {
  const total = posts.length;
  const active = posts.filter((p) => p.status === 'ACTIVE').length;
  const hidden = posts.filter((p) => p.status === 'HIDDEN').length;
  const deleted = posts.filter((p) => p.status === 'DELETED').length;
  const reported = posts.filter((p) => (p.reportCount ?? 0) > 0).length;
  return (
    <div className="mb-3">
      <div className="mb-1.5 text-[11px] text-zinc-500">현재 목록 기준</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <StatCard label="전체" value={total} />
        <StatCard label="노출중" value={active} tone="success" />
        <StatCard label="숨김" value={hidden} tone="warning" />
        <StatCard label="삭제됨" value={deleted} tone="danger" />
        <StatCard label="신고있음" value={reported} tone={reported > 0 ? 'danger' : 'neutral'} />
      </div>
    </div>
  );
}

export function AdminQStargramPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'posts' | 'reports'>('posts');
  const [postFilter, setPostFilter] = useState<QStargramAdminListParams>({ status: '', limit: 50 });
  const [reportFilter, setReportFilter] = useState<QStargramReportListParams>({ status: '', limit: 50 });
  const [detailPost, setDetailPost] = useState<QStargramAdminPost | null>(null);
  const [statusTarget, setStatusTarget] = useState<QStargramAdminPost | null>(null);
  const [reportStatusTarget, setReportStatusTarget] = useState<QStargramReport | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const postsQuery = useQuery({
    queryKey: ['qstargram-admin-posts', postFilter],
    queryFn: () => qstargramAdminApi.listPosts(postFilter),
  });

  const reportsQuery = useQuery({
    queryKey: ['qstargram-admin-reports', reportFilter],
    queryFn: () => qstargramAdminApi.listReports(reportFilter),
  });

  const statusMut = useMutation({
    mutationFn: ({ postId, status, reason }: { postId: string; status: QStargramPostStatus; reason: string }) =>
      qstargramAdminApi.updatePostStatus(postId, { status, reason }),
    onSuccess: (post) => {
      setResultMessage(`게시글 상태 변경 완료: ${shortId(postIdOf(post), 8, 5)} → ${statusLabel(post.status)}`);
      setStatusTarget(null);
      void qc.invalidateQueries({ queryKey: ['qstargram-admin-posts'] });
      void qc.invalidateQueries({ queryKey: ['qstargram-admin-reports'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
  });

  const reportStatusMut = useMutation({
    mutationFn: ({ reportId, status, reason }: { reportId: string; status: QStargramReportStatus; reason: string }) =>
      qstargramAdminApi.updateReportStatus(reportId, { status, reason }),
    onSuccess: (report) => {
      setResultMessage(`신고 처리상태 변경 완료: ${shortId(report.id, 8, 5)} → ${labelOf(REPORT_STATUS_LABELS, report.status)}`);
      setReportStatusTarget(null);
      void qc.invalidateQueries({ queryKey: ['qstargram-admin-reports'] });
      void qc.invalidateQueries({ queryKey: ['qstargram-admin-posts'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit'] });
    },
  });

  const posts = postsQuery.data ?? [];
  const reports = reportsQuery.data ?? [];

  const postColumns: Column<QStargramAdminPost>[] = [
    {
      key: 'body',
      header: '게시글',
      render: (p) => (
        <button type="button" onClick={() => setDetailPost(p)} className="flex items-start gap-3 text-left">
          <Thumb post={p} />
          <div className="max-w-md">
            <div className="font-medium text-zinc-100">{preview(p.title, 50)}</div>
            <div className="mt-0.5 text-xs text-zinc-400">{preview(p.content, 120)}</div>
          </div>
        </button>
      ),
    },
    {
      key: 'author',
      header: '작성자',
      render: (p) => (
        <div className="text-xs">
          <div className="text-zinc-200">{p.authorDisplayName ?? p.authorNickname ?? '-'}</div>
          <div className="font-mono text-zinc-500">{maskUid(p.authorUid)}</div>
        </div>
      ),
    },
    { key: 'category', header: '분류', render: (p) => <span className="text-xs text-zinc-300">{labelOf(CATEGORY_LABELS, p.category)}</span> },
    {
      key: 'visibility',
      header: '공개',
      render: (p) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge label={labelOf(VISIBILITY_LABELS, p.visibility)} tone={p.visibility === 'PUBLIC' ? 'info' : 'neutral'} />
          <span className="text-[11px] text-zinc-500">{p.showOnQStargram ? '피드 노출' : '피드 숨김'}</span>
        </div>
      ),
    },
    {
      key: 'counts',
      header: '반응',
      render: (p) => (
        <div className="flex flex-col items-start gap-1 text-xs">
          <span className="text-zinc-400">좋아요 {p.likeCount ?? 0}</span>
          {(p.reportCount ?? 0) > 0 ? (
            <StatusBadge label={`신고 ${p.reportCount}`} tone="danger" />
          ) : (
            <span className="text-zinc-600">신고 0</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: '상태',
      render: (p) => <StatusBadge label={statusLabel(p.status)} tone={STATUS_TONE[p.status] ?? 'neutral'} />,
    },
    { key: 'createdAt', header: '작성일', render: (p) => <span className="text-xs text-zinc-500">{formatDateTime(p.createdAt)}</span> },
    {
      key: 'actions',
      header: '관리',
      render: (p) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setDetailPost(p)} className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-600">
            상세
          </button>
          <button type="button" onClick={() => setStatusTarget(p)} className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700">
            상태변경
          </button>
        </div>
      ),
    },
  ];

  const reportColumns: Column<QStargramReport>[] = [
    {
      key: 'reason',
      header: '신고 사유',
      render: (r) => (
        <div className="text-xs">
          <StatusBadge label={REPORT_REASON_LABELS[r.reason ?? ''] ?? r.reason ?? '기타'} tone="danger" />
          {r.detail ? <div className="mt-1 text-zinc-400">{preview(r.detail, 30)}</div> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: '처리',
      render: (r) => (
        <StatusBadge label={labelOf(REPORT_STATUS_LABELS, r.status ?? 'OPEN')} tone={REPORT_STATUS_TONE[r.status ?? 'OPEN'] ?? 'neutral'} />
      ),
    },
    {
      key: 'post',
      header: '대상 게시글',
      render: (r) => (
        <div className="flex items-start gap-3">
          <Thumb post={r.post} />
          <div className="max-w-md">
            <div className="text-xs text-zinc-200">{preview(r.post?.title, 50)}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{preview(r.post?.content, 100)}</div>
            {r.post && (
              <StatusBadge label={statusLabel(r.post.status)} tone={STATUS_TONE[r.post.status] ?? 'neutral'} className="mt-1" />
            )}
          </div>
        </div>
      ),
    },
    { key: 'reporter', header: '신고자', render: (r) => <span className="font-mono text-xs text-zinc-500">{maskUid(r.uid)}</span> },
    { key: 'createdAt', header: '신고일', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    {
      key: 'actions',
      header: '관리',
      render: (r) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {r.post && (
            <button type="button" onClick={() => setStatusTarget(r.post ?? null)} className="rounded bg-violet-600 px-2 py-1 text-xs text-white hover:bg-violet-700">
              게시글 상태변경
            </button>
          )}
          <button type="button" onClick={() => setReportStatusTarget(r)} className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-600">
            신고 처리
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="Q스타그램 관리"
        description="게시글을 검토하고 신고를 처리합니다. 상태 변경은 감사 로그에 기록됩니다."
        right={
          <div className="flex rounded-lg border border-zinc-700 bg-zinc-900 p-1 text-xs">
            <button type="button" onClick={() => setTab('posts')} className={tab === 'posts' ? activeTabClass : tabClass}>
              게시글 {posts.length}
            </button>
            <button type="button" onClick={() => setTab('reports')} className={tab === 'reports' ? activeTabClass : tabClass}>
              신고 {reports.length}
            </button>
          </div>
        }
      >
        {resultMessage && <InlineMessage kind="success">{resultMessage}</InlineMessage>}
        {statusMut.isError && (
          <div className="mt-2">
            <InlineMessage kind="error">{errorToMessage(statusMut.error)}</InlineMessage>
          </div>
        )}
        {reportStatusMut.isError && (
          <div className="mt-2">
            <InlineMessage kind="error">{errorToMessage(reportStatusMut.error)}</InlineMessage>
          </div>
        )}
      </PageSection>

      {tab === 'posts' ? (
        <PageSection title="게시글" description="상태 변경은 소프트 처리입니다. 삭제해도 미디어는 즉시 영구 삭제하지 않습니다.">
          <PostFilters value={postFilter} onChange={setPostFilter} onRefresh={() => void postsQuery.refetch()} />
          <QueryState isLoading={postsQuery.isLoading} error={postsQuery.error}>
            <PostSummary posts={posts} />
            <div className="mb-2 text-xs text-zinc-500">{posts.length}건 표시</div>
            <DataTable columns={postColumns} data={posts} rowKey={(p) => postIdOf(p)} emptyMessage="게시글이 없습니다." onRowClick={setDetailPost} />
          </QueryState>
        </PageSection>
      ) : (
        <PageSection title="신고" description="신고 처리상태를 변경하고 필요한 경우 게시글 상태도 함께 변경하세요.">
          <ReportFilters value={reportFilter} onChange={setReportFilter} onRefresh={() => void reportsQuery.refetch()} />
          <QueryState isLoading={reportsQuery.isLoading} error={reportsQuery.error}>
            <div className="mb-2 text-xs text-zinc-500">{reports.length}건 표시</div>
            <DataTable columns={reportColumns} data={reports} rowKey={(r) => r.id} emptyMessage="신고가 없습니다." />
          </QueryState>
        </PageSection>
      )}

      {statusTarget && (
        <StatusChangeModal
          post={statusTarget}
          pending={statusMut.isPending}
          error={statusMut.error}
          onClose={() => setStatusTarget(null)}
          onSubmit={(status, reason) => statusMut.mutate({ postId: postIdOf(statusTarget), status, reason })}
        />
      )}
      {reportStatusTarget && (
        <ReportStatusChangeModal
          report={reportStatusTarget}
          pending={reportStatusMut.isPending}
          error={reportStatusMut.error}
          onClose={() => setReportStatusTarget(null)}
          onSubmit={(status, reason) => reportStatusMut.mutate({ reportId: reportStatusTarget.id, status, reason })}
        />
      )}
      {detailPost && <PostDetailModal post={detailPost} onClose={() => setDetailPost(null)} onStatus={() => setStatusTarget(detailPost)} />}
    </div>
  );
}

const tabClass = 'rounded-md px-3 py-1.5 text-zinc-400 hover:text-zinc-100';
const activeTabClass = 'rounded-md bg-zinc-700 px-3 py-1.5 text-zinc-100';

function PostFilters({
  value,
  onChange,
  onRefresh,
}: {
  value: QStargramAdminListParams;
  onChange: (next: QStargramAdminListParams) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <SelectField label="상태" value={value.status ?? ''} options={STATUS_OPTIONS} labels={POST_STATUS_LABELS} onChange={(status) => onChange({ ...value, status })} />
      <SelectField label="분류" value={value.category ?? ''} options={CATEGORY_OPTIONS} labels={CATEGORY_LABELS} onChange={(category) => onChange({ ...value, category })} />
      <SelectField label="공개" value={value.visibility ?? ''} options={VISIBILITY_OPTIONS} labels={VISIBILITY_LABELS} onChange={(visibility) => onChange({ ...value, visibility })} />
      <TextField label="작성자 UID" value={value.authorUid ?? ''} onChange={(authorUid) => onChange({ ...value, authorUid })} />
      <TextField label="검색" value={value.q ?? ''} onChange={(q) => onChange({ ...value, q })} />
      <label className="flex items-center gap-2 pb-1 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={value.reportedOnly === true}
          onChange={(e) => onChange({ ...value, reportedOnly: e.target.checked })}
        />
        신고 글만
      </label>
      <SelectField label="개수" value={String(value.limit ?? 50)} options={LIMIT_OPTIONS.map(String)} onChange={(limit) => onChange({ ...value, limit: Number(limit) })} />
      <button type="button" onClick={onRefresh} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
        새로고침
      </button>
    </div>
  );
}

function ReportFilters({
  value,
  onChange,
  onRefresh,
}: {
  value: QStargramReportListParams;
  onChange: (next: QStargramReportListParams) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end gap-3">
      <SelectField label="처리상태" value={value.status ?? ''} options={REPORT_STATUS_OPTIONS} labels={REPORT_STATUS_LABELS} onChange={(status) => onChange({ ...value, status })} />
      <TextField label="게시글 ID" value={value.postId ?? ''} onChange={(postId) => onChange({ ...value, postId })} />
      <TextField label="신고자 UID" value={value.reporterUid ?? ''} onChange={(reporterUid) => onChange({ ...value, reporterUid })} />
      <TextField label="검색" value={value.q ?? ''} onChange={(q) => onChange({ ...value, q })} />
      <SelectField label="개수" value={String(value.limit ?? 50)} options={LIMIT_OPTIONS.map(String)} onChange={(limit) => onChange({ ...value, limit: Number(limit) })} />
      <button type="button" onClick={onRefresh} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
        새로고침
      </button>
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  labels,
}: {
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-400">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option || 'ALL'} value={option}>
            {option ? labels?.[option] ?? option : '전체'}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-44 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
    </div>
  );
}

function StatusChangeModal({
  post,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  post: QStargramAdminPost;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (status: QStargramPostStatus, reason: string) => void;
}) {
  const [status, setStatus] = useState<QStargramPostStatus>(post.status === 'DELETED' ? 'HIDDEN' : post.status);
  const [reason, setReason] = useState('');
  const canSubmit = reason.trim().length > 0 && status !== post.status && !pending;

  return (
    <Modal open title={`게시글 상태 변경 · ${shortId(postIdOf(post), 8, 5)}`} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-zinc-500">현재 상태</div>
            <StatusBadge label={statusLabel(post.status)} tone={STATUS_TONE[post.status] ?? 'neutral'} />
          </div>
          <div>
            <div className="text-xs text-zinc-500">변경할 상태</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QStargramPostStatus)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="ACTIVE">노출중</option>
              <option value="HIDDEN">숨김</option>
              <option value="DELETED">삭제됨</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">사유 (필수)</label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="감사 로그에 남길 사유를 입력하세요."
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        {error ? <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(status, reason.trim())}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {pending ? '저장 중...' : '변경하기'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ReportStatusChangeModal({
  report,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  report: QStargramReport;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onSubmit: (status: QStargramReportStatus, reason: string) => void;
}) {
  const [status, setStatus] = useState<QStargramReportStatus>(report.status ?? 'OPEN');
  const [reason, setReason] = useState('');
  const canSubmit = reason.trim().length > 0 && status !== report.status && !pending;

  return (
    <Modal open title={`신고 처리상태 변경 · ${shortId(report.id, 8, 5)}`} onClose={onClose} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-zinc-500">현재 처리상태</div>
            <StatusBadge label={labelOf(REPORT_STATUS_LABELS, report.status ?? 'OPEN')} tone={REPORT_STATUS_TONE[report.status ?? 'OPEN'] ?? 'neutral'} />
          </div>
          <div>
            <div className="text-xs text-zinc-500">변경할 처리상태</div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as QStargramReportStatus)}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              <option value="OPEN">미처리</option>
              <option value="REVIEWED">검토중</option>
              <option value="RESOLVED">처리완료</option>
            </select>
          </div>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-400">
          <div>
            게시글 ID: <span className="font-mono text-zinc-300">{report.postId}</span>
          </div>
          <div className="mt-1">
            신고자: <span className="font-mono text-zinc-300">{maskUid(report.uid)}</span>
          </div>
          <div className="mt-1">신고 사유: {labelOf(REPORT_REASON_LABELS, report.reason ?? '')}</div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">처리 사유 (필수)</label>
          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="감사 로그에 남길 처리 사유를 입력하세요."
            className="w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        {error ? <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage> : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
            취소
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => onSubmit(status, reason.trim())}
            className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {pending ? '저장 중...' : '처리상태 변경'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PostDetailModal({
  post,
  onClose,
  onStatus,
}: {
  post: QStargramAdminPost;
  onClose: () => void;
  onStatus: () => void;
}) {
  const auditsQuery = useQuery({
    queryKey: ['admin-audit', 'qstargram', postIdOf(post)],
    queryFn: () => auditApi.list({ action: 'qstargram.post.status', targetId: postIdOf(post), limit: 20 }),
  });
  const audits = useMemo(() => auditsQuery.data ?? [], [auditsQuery.data]);

  return (
    <Modal open title={`게시글 상세 · ${shortId(postIdOf(post), 8, 5)}`} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={statusLabel(post.status)} tone={STATUS_TONE[post.status] ?? 'neutral'} />
          <StatusBadge label={labelOf(VISIBILITY_LABELS, post.visibility)} tone="info" />
          <StatusBadge label={labelOf(CATEGORY_LABELS, post.category)} tone="neutral" />
          <span className="text-xs text-zinc-500">{post.showOnQStargram ? '피드 노출' : '피드 숨김'}</span>
          {(post.reportCount ?? 0) > 0 && <StatusBadge label={`신고 ${post.reportCount}`} tone="danger" />}
        </div>
        {post.imageUrls && post.imageUrls.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.imageUrls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noreferrer">
                <img
                  src={post.imageThumbUrls?.[i] ?? url}
                  alt=""
                  loading="lazy"
                  className="h-24 w-24 rounded-md border border-zinc-700 object-cover"
                />
              </a>
            ))}
          </div>
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <Info label="게시글 ID" value={postIdOf(post)} mono />
          <Info label="작성자 UID" value={maskUid(post.authorUid)} mono />
          <Info label="작성일" value={formatDateTime(post.createdAt)} />
          <Info label="수정일" value={formatDateTime(post.updatedAt)} />
          <Info label="삭제일" value={formatDateTime(post.deletedAt)} />
          <Info label="반응" value={`좋아요 ${post.likeCount ?? 0} · 신고 ${post.reportCount ?? 0}`} />
        </div>
        <div>
          <div className="text-xs text-zinc-500">제목</div>
          <div className="mt-1 rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-200">{post.title || '-'}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500">내용</div>
          <div className="mt-1 whitespace-pre-wrap rounded border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">{post.content || '-'}</div>
        </div>
        <div className="flex justify-end">
          <button type="button" onClick={onStatus} className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700">
            상태 변경
          </button>
        </div>
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">최근 상태 변경 로그</div>
          <QueryState isLoading={auditsQuery.isLoading} error={auditsQuery.error}>
            <AuditList rows={audits} />
          </QueryState>
        </div>
      </div>
    </Modal>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className={mono ? 'mt-1 break-all font-mono text-xs text-zinc-300' : 'mt-1 text-sm text-zinc-300'}>{value || '-'}</div>
    </div>
  );
}

function AuditList({ rows }: { rows: AdminAuditLog[] }) {
  if (rows.length === 0) return <div className="text-xs text-zinc-500">이 게시글의 상태 변경 로그가 없습니다.</div>;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs">
          <div className="flex flex-wrap justify-between gap-2 text-zinc-500">
            <span>{formatDateTime(row.createdAt)}</span>
            <span className="font-mono">{maskUid(row.actorUid)}</span>
          </div>
          <div className="mt-1 text-zinc-300">{row.reason ?? '-'}</div>
          <div className="mt-1 break-all font-mono text-zinc-500">{row.changes ? JSON.stringify(row.changes) : '-'}</div>
        </div>
      ))}
    </div>
  );
}

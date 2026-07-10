import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { auditApi } from '../services/auditApi';
import { ADMIN_AUDIT_ACTION_LABELS, adminAuditActionLabel } from '../lib/constants';
import { formatDateTime } from '../lib/format';
import { downloadCsv } from '../lib/csv';
import type { AdminAuditFilter, AdminAuditLog } from '../types/audit';

/**
 * 통합 관리자 감사 로그 페이지(super_admin 전용).
 *
 * 재화/아이템 로그만으로는 추적되지 않던 권한/상태/요금제/접근/길드/공지/시스템 변경까지
 * 모든 admin mutation 을 한 곳에서 본다(GET /api/admin/logs/admin-audit).
 * "누가(actorUid) · 언제(createdAt) · 무엇을(action) · 누구/무엇에(target)" 를 기록한다.
 */
const ACTION_OPTIONS = [
  { value: '', label: '전체 액션' },
  ...Object.keys(ADMIN_AUDIT_ACTION_LABELS).map((key) => ({
    value: key,
    label: ADMIN_AUDIT_ACTION_LABELS[key],
  })),
];

function targetText(row: AdminAuditLog): string {
  return row.targetUid ?? row.targetGuildId ?? row.targetId ?? '';
}

export function AdminAuditPage() {
  const [form, setForm] = useState<AdminAuditFilter>({ action: '', actorUid: '', targetUid: '' });
  const [filter, setFilter] = useState<AdminAuditFilter>({ limit: 200 });

  const query = useQuery({
    queryKey: ['admin-audit', filter],
    queryFn: () => auditApi.list(filter),
  });

  const applyFilter = () =>
    setFilter({
      action: form.action?.trim() || undefined,
      actorUid: form.actorUid?.trim() || undefined,
      targetUid: form.targetUid?.trim() || undefined,
      limit: 200,
    });

  const rows = query.data ?? [];

  const columns: Column<AdminAuditLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    {
      key: 'action',
      header: '액션',
      render: (r) => <span className="text-xs text-zinc-200">{adminAuditActionLabel(r.action)}</span>,
    },
    { key: 'actor', header: '처리자', render: (r) => <CopyableId value={r.actorUid} /> },
    {
      key: 'target',
      header: '대상',
      render: (r) => (targetText(r) ? <CopyableId value={targetText(r)} /> : <span className="text-zinc-600">–</span>),
    },
    {
      key: 'summary',
      header: '요약',
      render: (r) => <span className="text-xs text-zinc-400">{r.summary ?? '–'}</span>,
    },
    {
      key: 'changes',
      header: '변경/사유',
      render: (r) => (
        <span className="text-xs text-zinc-500 font-mono break-all">
          {r.reason ? `${r.reason} ` : ''}
          {r.changes ? JSON.stringify(r.changes) : ''}
          {!r.reason && !r.changes ? '–' : ''}
        </span>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv<AdminAuditLog>(`admin-audit-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
      { header: 'createdAt', value: (r) => r.createdAt },
      { header: 'action', value: (r) => r.action },
      { header: 'actionLabel', value: (r) => adminAuditActionLabel(r.action) },
      { header: 'actorUid', value: (r) => r.actorUid },
      { header: 'target', value: (r) => targetText(r) },
      { header: 'summary', value: (r) => r.summary ?? '' },
      { header: 'reason', value: (r) => r.reason ?? '' },
      { header: 'changes', value: (r) => (r.changes ? JSON.stringify(r.changes) : '') },
    ]);

  return (
    <div className="flex flex-col gap-4">
      <PageSection
        title="감사 로그 필터"
        description="모든 관리자 변경 작업이 actor/대상/변경값과 함께 기록됩니다(admin_audit_logs)."
        right={
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={exportCsv}
            className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-100 text-sm px-3 py-1.5 rounded"
          >
            CSV 내보내기
          </button>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">액션</label>
            <select
              value={form.action ?? ''}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <AuditInput label="처리자 UID" value={form.actorUid ?? ''} onChange={(v) => setForm({ ...form, actorUid: v })} onEnter={applyFilter} />
          <AuditInput label="대상 UID" value={form.targetUid ?? ''} onChange={(v) => setForm({ ...form, targetUid: v })} onEnter={applyFilter} />
          <button onClick={applyFilter} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
            적용
          </button>
        </div>
      </PageSection>

      <QueryState isLoading={query.isLoading} error={query.error}>
        <div className="text-xs text-zinc-500">{rows.length}건 표시 (최대 200)</div>
        <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="감사 로그가 없습니다" />
      </QueryState>
    </div>
  );
}

function AuditInput({
  label,
  value,
  onChange,
  onEnter,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onEnter: () => void;
}) {
  return (
    <div>
      <label className="text-xs text-zinc-400 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter()}
        placeholder="(선택)"
        className="w-44 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
      />
    </div>
  );
}

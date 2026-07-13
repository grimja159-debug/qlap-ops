import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { StatCard } from '../components/StatCard';
import { DataTable, type Column } from '../components/DataTable';
import { firestoreHotPathApi } from '../services/firestoreHotPathApi';
import { formatDateTime } from '../lib/format';
import type { FirestoreHotPathCheck, FirestoreHotPathStatus } from '../types/firestoreHotPath';

function statusTone(status: FirestoreHotPathStatus) {
  if (status === 'PASS') return 'success' as const;
  if (status === 'WARN') return 'warning' as const;
  return 'danger' as const;
}

function statusLabel(status: FirestoreHotPathStatus): string {
  if (status === 'PASS') return '안전';
  if (status === 'WARN') return '주의';
  return '위험';
}

function endpointList(endpoints: string[]) {
  return (
    <div className="flex flex-col gap-1">
      {endpoints.map((endpoint) => (
        <span key={endpoint} className="break-all font-mono text-[11px] text-zinc-500">
          {endpoint}
        </span>
      ))}
    </div>
  );
}

function textList(items: string[]) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item} className="text-xs leading-5 text-zinc-400">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function AdminFirestoreHotPathPage() {
  const reportQuery = useQuery({
    queryKey: ['admin-firestore-hot-paths'],
    queryFn: firestoreHotPathApi.getReport,
    refetchInterval: 60000,
  });

  const columns = useMemo<Column<FirestoreHotPathCheck>[]>(
    () => [
      {
        key: 'status',
        header: '상태',
        width: 'w-24',
        render: (row) => <StatusBadge label={statusLabel(row.status)} tone={statusTone(row.status)} />,
      },
      {
        key: 'feature',
        header: '기능',
        width: 'min-w-[220px]',
        render: (row) => (
          <div>
            <p className="font-semibold text-zinc-100">{row.name}</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">{row.source}</p>
          </div>
        ),
      },
      {
        key: 'endpoints',
        header: 'API',
        width: 'min-w-[260px]',
        render: (row) => endpointList(row.endpoints),
      },
      {
        key: 'evidence',
        header: '근거',
        width: 'min-w-[320px]',
        render: (row) => textList(row.evidence),
      },
      {
        key: 'risk',
        header: '위험/다음 조치',
        width: 'min-w-[260px]',
        render: (row) => (
          <div className="space-y-2 text-xs leading-5">
            {row.risk ? <p className="text-amber-300">{row.risk}</p> : <p className="text-emerald-300">운영 hot path Firestore 위험 없음</p>}
            {row.recommendation ? <p className="text-zinc-500">{row.recommendation}</p> : null}
          </div>
        ),
      },
    ],
    [],
  );

  const report = reportQuery.data ?? null;
  const warningRows = report?.hotPaths.filter((row) => row.status !== 'PASS') ?? [];

  return (
    <div className="flex max-w-7xl flex-col gap-5">
      <PageSection
        title="Firestore Hot Path"
        description="Services API가 Firestore 대신 Server DB, Redis, R2를 쓰는지 기능별로 점검합니다. Legacy mirror/outbox 표시는 현재 진단 또는 호환 흔적이며, Firestore 직접 write 의미가 아닙니다."
        right={
          <button
            type="button"
            onClick={() => void reportQuery.refetch()}
            disabled={reportQuery.isFetching}
            className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            {reportQuery.isFetching ? '점검 중...' : '새로고침'}
          </button>
        }
      >
        <QueryState isLoading={reportQuery.isLoading} error={reportQuery.error}>
          {report && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-5">
                <StatCard label="점검 항목" value={report.checked} sub={formatDateTime(report.generatedAt)} accent />
                <StatCard label="PASS" value={report.pass} />
                <StatCard label="WARN" value={report.warn} />
                <StatCard label="FAIL" value={report.fail} />
                <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/50 p-4">
                  <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">전체 상태</span>
                  <div className="mt-3">
                    <StatusBadge label={report.ok ? '운영 가능' : '확인 필요'} tone={report.ok ? 'success' : 'danger'} />
                  </div>
                </div>
              </div>

              {warningRows.length > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                  <p className="text-sm font-semibold text-amber-200">주의 항목 {warningRows.length}개</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {warningRows.map((row) => (
                      <div key={row.name} className="rounded border border-amber-500/20 bg-zinc-950/40 p-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge label={statusLabel(row.status)} tone={statusTone(row.status)} />
                          <span className="text-sm font-semibold text-zinc-100">{row.name}</span>
                        </div>
                        {row.risk && <p className="mt-2 text-xs leading-5 text-amber-300">{row.risk}</p>}
                        {row.recommendation && <p className="mt-1 text-xs leading-5 text-zinc-500">{row.recommendation}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-500/25 bg-emerald-500/5 p-4 text-sm text-emerald-200">
                  현재 집계된 Services hot path 항목은 모두 Server DB/Redis/R2 우선 구조입니다.
                </div>
              )}

              <DataTable
                columns={columns}
                data={report.hotPaths}
                rowKey={(row) => row.name}
                emptyMessage="점검 항목이 없습니다."
              />
            </div>
          )}
        </QueryState>
      </PageSection>
    </div>
  );
}

export default AdminFirestoreHotPathPage;

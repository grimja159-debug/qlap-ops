import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { EconomyChangeForm } from '../components/EconomyChangeForm';
import { logApi } from '../services/logApi';
import { formatDateTime, formatNumber, formatSignedNumber } from '../lib/format';
import type { CurrencyLog } from '../types/log';

type LogTab = 'qlCoin';

const LOG_TAB_LABELS: Record<LogTab, string> = {
  qlCoin: 'QL 코인 로그',
};

const LOG_TYPE_OPTIONS: Record<LogTab, Array<{ value: string; label: string }>> = {
  qlCoin: [
    { value: '', label: '전체' },
    { value: 'ADMIN_GRANT', label: '관리자 지급' },
    { value: 'ADMIN_REVOKE', label: '관리자 차감' },
    { value: 'SHOP_USE', label: '상점 사용' },
    { value: 'REFUND', label: '환불' },
    { value: 'PRO_MONTHLY_GRANT', label: 'PRO 월 지급' },
    { value: 'PRO_MAX_MONTHLY_GRANT', label: 'PRO MAX 월 지급' },
  ],
};

const LIMIT_OPTIONS = [20, 50, 100, 200];

function logSummary(rows: CurrencyLog[]) {
  return {
    count: rows.length,
    grant: rows.filter((row) => row.amount > 0).reduce((sum, row) => sum + row.amount, 0),
    revoke: Math.abs(rows.filter((row) => row.amount < 0).reduce((sum, row) => sum + row.amount, 0)),
    adminRows: rows.filter((row) => row.type === 'ADMIN_GRANT' || row.type === 'ADMIN_REVOKE').length,
  };
}

function logTypeTone(type: string): 'success' | 'danger' | 'info' | 'neutral' {
  if (type === 'ADMIN_GRANT' || type.endsWith('_GRANT')) return 'success';
  if (type === 'ADMIN_REVOKE' || type.endsWith('_USE')) return 'danger';
  if (type === 'REFUND') return 'info';
  return 'neutral';
}

export function AdminEconomyPage() {
  const [tab, setTab] = useState<LogTab>('qlCoin');
  const [uidFilter, setUidFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [limit, setLimit] = useState(50);

  const filters = useMemo(
    () => ({
      uid: uidFilter.trim() || undefined,
      type: typeFilter || undefined,
      limit,
    }),
    [limit, typeFilter, uidFilter],
  );

  const logs = useQuery({
    queryKey: ['logs', tab, filters],
    queryFn: () => logApi.qlCoin(filters),
  });

  const rows = useMemo(() => logs.data ?? [], [logs.data]);
  const summary = useMemo(() => logSummary(rows), [rows]);

  const columns: Column<CurrencyLog>[] = [
    {
      key: 'createdAt',
      header: '시각',
      render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span>,
    },
    { key: 'uid', header: '대상', render: (row) => <CopyableId value={row.uid} /> },
    {
      key: 'type',
      header: '유형',
      render: (row) => <StatusBadge label={row.type} tone={logTypeTone(row.type)} />,
    },
    {
      key: 'amount',
      header: '변동',
      render: (row) => (
        <span className={row.amount >= 0 ? 'font-mono text-xs text-emerald-400' : 'font-mono text-xs text-red-400'}>
          {formatSignedNumber(row.amount)}
        </span>
      ),
    },
    {
      key: 'balance',
      header: '잔액',
      render: (row) => (
        <span className="font-mono text-xs text-zinc-300">
          {formatNumber(row.beforeBalance)} → {formatNumber(row.afterBalance)}
        </span>
      ),
    },
    {
      key: 'reason',
      header: '사유',
      render: (row) => <span className="block max-w-[24rem] break-words text-xs text-zinc-400">{row.reason || '-'}</span>,
    },
    { key: 'by', header: '처리자', render: (row) => <CopyableId value={row.createdBy} /> },
  ];

  const switchTab = (next: LogTab) => {
    setTab(next);
    setTypeFilter('');
  };

  return (
    <div className="flex flex-col gap-5">
      <PageSection
        title="재화 지급 / 차감"
        description="QL 코인을 수동 보정합니다. 모든 변경은 지갑 트랜잭션, 재화 로그, 관리자 감사 로그에 남습니다."
        className="max-w-2xl"
      >
        <EconomyChangeForm />
      </PageSection>

      <PageSection
        title="최근 재화 로그"
        description="실제 지급/차감 내역을 조회합니다. UID와 로그 유형으로 좁혀서 확인할 수 있습니다."
        right={
          <div className="flex gap-1">
            {(['qlCoin'] as LogTab[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => switchTab(key)}
                className={
                  tab === key
                    ? 'rounded border border-violet-500/50 bg-violet-600/20 px-2.5 py-1 text-xs text-violet-300'
                    : 'rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300'
                }
              >
                {LOG_TAB_LABELS[key]}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-zinc-400">대상 UID</label>
            <input
              value={uidFilter}
              onChange={(event) => setUidFilter(event.target.value)}
              placeholder="전체 또는 Firebase UID"
              className="w-72 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">유형</label>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              {LOG_TYPE_OPTIONS[tab].map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">목록 수</label>
            <select
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
            >
              {LIMIT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}건</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => {
              setUidFilter('');
              setTypeFilter('');
              setLimit(50);
            }}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            필터 초기화
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <StatusBadge label={`표시 ${summary.count}`} tone="neutral" />
          <StatusBadge label={`지급 합계 ${formatNumber(summary.grant)}`} tone="success" />
          <StatusBadge label={`차감 합계 ${formatNumber(summary.revoke)}`} tone="danger" />
          <StatusBadge label={`관리자 처리 ${summary.adminRows}`} tone="accent" />
        </div>

        <QueryState isLoading={logs.isLoading} error={logs.error}>
          <DataTable columns={columns} data={rows} rowKey={(row) => row.id} emptyMessage="조건에 맞는 재화 로그가 없습니다" />
        </QueryState>
      </PageSection>
    </div>
  );
}

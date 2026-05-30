import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { DataTable, type Column } from '../components/DataTable';
import { EconomyChangeForm } from '../components/EconomyChangeForm';
import { logApi } from '../services/logApi';
import { LOG_KIND_LABELS } from '../lib/constants';
import { formatDateTime, formatNumber, formatSignedNumber } from '../lib/format';
import type { CurrencyLog } from '../types/log';

/**
 * 재화 관리 페이지.
 *
 * [구성]
 *  - 지급/차감: 공용 EconomyChangeForm (UID 입력). QL 코인/GM 티켓, 지급/차감, 사유.
 *  - 최근 로그: qlCoin / gmTiket 탭. createdBy 로 "누가" 조작했는지 확인 가능.
 *
 * 총 발행량 같은 집계 통계는 백엔드 집계 API 가 없어 표시하지 않는다(가짜 수치 금지).
 * 필요하면 백엔드에 집계 엔드포인트를 추가해야 한다 → ADMIN_GUIDE.md.
 */
type LogTab = 'qlCoin' | 'gmTiket';

export function AdminEconomyPage() {
  const [tab, setTab] = useState<LogTab>('qlCoin');

  const logs = useQuery({
    queryKey: ['logs', tab, 'recent'],
    queryFn: () => (tab === 'qlCoin' ? logApi.qlCoin({ limit: 50 }) : logApi.gmTiket({ limit: 50 })),
  });

  const columns: Column<CurrencyLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'uid', header: '대상', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'type', header: '유형', render: (r) => <span className="text-xs text-zinc-400">{r.type}</span> },
    {
      key: 'amount',
      header: '변동',
      render: (r) => (
        <span className={r.amount >= 0 ? 'text-emerald-400 font-mono text-xs' : 'text-red-400 font-mono text-xs'}>
          {formatSignedNumber(r.amount)}
        </span>
      ),
    },
    { key: 'after', header: '잔액', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatNumber(r.afterBalance)}</span> },
    { key: 'reason', header: '사유', render: (r) => <span className="text-xs text-zinc-400">{r.reason}</span> },
    { key: 'by', header: '처리자', render: (r) => <CopyableId value={r.createdBy} /> },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageSection
        title="재화 지급 / 차감"
        description="QL 코인·GM 티켓을 사용자에게 지급하거나 차감합니다. 모든 처리는 사유와 함께 로그에 남습니다."
        className="max-w-md"
      >
        <EconomyChangeForm />
      </PageSection>

      <PageSection
        title="최근 재화 로그"
        right={
          <div className="flex gap-1">
            {(['qlCoin', 'gmTiket'] as LogTab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={
                  tab === k
                    ? 'text-xs px-2.5 py-1 rounded bg-violet-600/20 border border-violet-500/50 text-violet-300'
                    : 'text-xs px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }
              >
                {LOG_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        }
      >
        <QueryState isLoading={logs.isLoading} error={logs.error}>
          <DataTable columns={columns} data={logs.data ?? []} rowKey={(r) => r.id} emptyMessage="로그가 없습니다" />
        </QueryState>
      </PageSection>
    </div>
  );
}

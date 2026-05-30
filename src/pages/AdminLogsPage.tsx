import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { logApi } from '../services/logApi';
import { LOG_KINDS, LOG_KIND_LABELS, type LogKind } from '../lib/constants';
import { formatDateTime, formatNumber, formatSignedNumber } from '../lib/format';
import type { CurrencyLog, LogFilter } from '../types/log';
import type { GuildActionLog, GuildPointLog } from '../types/guild';

/** 4종 로그 행의 합집합 — useQuery 데이터 타입으로 사용. */
type LogRow = CurrencyLog | GuildActionLog | GuildPointLog;

/**
 * 운영 로그 페이지.
 *
 * 4개 로그 컬렉션을 탭으로 전환하며, uid / guildId / seasonId 로 필터링한다.
 * (백엔드 GET /api/admin/logs/:kind 가 그대로 지원하는 필터다.)
 *
 * [감사 관점] qlCoin/gmTiket 로그는 createdBy(조작 주체)를 포함해 "누가 언제 얼마를"
 * 추적할 수 있다. 단, 권한/상태 변경과 아이템 지급은 별도 감사 로그가 없다(ADMIN_GUIDE 참고).
 */
export function AdminLogsPage() {
  const [kind, setKind] = useState<LogKind>('qlCoin');
  const [form, setForm] = useState<LogFilter>({ uid: '', guildId: '', seasonId: '' });
  const [filter, setFilter] = useState<LogFilter>({ limit: 100 });

  // 로그 종류마다 행 타입이 달라, useQuery 의 데이터 타입을 유니온으로 명시한다.
  // (명시하지 않으면 첫 분기 타입으로 추론돼 다른 분기와 충돌한다.)
  const query = useQuery<LogRow[]>({
    queryKey: ['logs', kind, filter],
    queryFn: () => {
      const f = { ...filter, limit: 100 };
      if (kind === 'qlCoin') return logApi.qlCoin(f);
      if (kind === 'gmTiket') return logApi.gmTiket(f);
      if (kind === 'guildActions') return logApi.guildActions(f);
      return logApi.guildPoints(f);
    },
  });

  const applyFilter = () =>
    setFilter({
      uid: form.uid?.trim() || undefined,
      guildId: form.guildId?.trim() || undefined,
      seasonId: form.seasonId?.trim() || undefined,
      limit: 100,
    });

  return (
    <div className="flex flex-col gap-4">
      <PageSection title="로그 종류 / 필터">
        <div className="flex flex-wrap gap-1 mb-3">
          {LOG_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={
                kind === k
                  ? 'text-xs px-3 py-1.5 rounded bg-violet-600/20 border border-violet-500/50 text-violet-300'
                  : 'text-xs px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
              }
            >
              {LOG_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <FilterInput label="UID" value={form.uid ?? ''} onChange={(v) => setForm({ ...form, uid: v })} onEnter={applyFilter} />
          <FilterInput label="길드 ID" value={form.guildId ?? ''} onChange={(v) => setForm({ ...form, guildId: v })} onEnter={applyFilter} />
          <FilterInput label="시즌 ID" value={form.seasonId ?? ''} onChange={(v) => setForm({ ...form, seasonId: v })} onEnter={applyFilter} />
          <button onClick={applyFilter} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
            적용
          </button>
        </div>
      </PageSection>

      <QueryState isLoading={query.isLoading} error={query.error}>
        {kind === 'qlCoin' || kind === 'gmTiket' ? (
          <CurrencyLogTable rows={(query.data as CurrencyLog[]) ?? []} />
        ) : kind === 'guildActions' ? (
          <ActionLogTable rows={(query.data as GuildActionLog[]) ?? []} />
        ) : (
          <PointLogTable rows={(query.data as GuildPointLog[]) ?? []} />
        )}
      </QueryState>
    </div>
  );
}

function FilterInput({
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

function CurrencyLogTable({ rows }: { rows: CurrencyLog[] }) {
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
  return <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="로그가 없습니다" />;
}

function ActionLogTable({ rows }: { rows: GuildActionLog[] }) {
  const columns: Column<GuildActionLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'action', header: '액션', render: (r) => <span className="text-xs text-zinc-300">{r.action}</span> },
    { key: 'guildId', header: '길드', render: (r) => <CopyableId value={r.guildId} /> },
    { key: 'uid', header: '대상', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'season', header: '시즌', render: (r) => <span className="text-xs text-zinc-400">{r.seasonId ?? '–'}</span> },
  ];
  return <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="로그가 없습니다" />;
}

function PointLogTable({ rows }: { rows: GuildPointLog[] }) {
  const columns: Column<GuildPointLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'guildId', header: '길드', render: (r) => <CopyableId value={r.guildId} /> },
    { key: 'source', header: '출처', render: (r) => <span className="text-xs text-zinc-400">{r.source ?? '–'}</span> },
    { key: 'point', header: '점수', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatSignedNumber(r.point ?? 0)}</span> },
    { key: 'uid', header: '대상', render: (r) => <CopyableId value={r.uid ?? null} /> },
  ];
  return <DataTable columns={columns} data={rows} rowKey={(r) => r.id} emptyMessage="로그가 없습니다" />;
}

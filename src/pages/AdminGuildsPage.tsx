import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { GuildDetailModal } from '../components/GuildDetailModal';
import { guildApi, type GuildListFilter } from '../services/guildApi';
import { GUILD_STATUSES, GUILD_STATUS_LABELS } from '../lib/constants';
import { guildStatusTone } from '../lib/statusTone';
import { formatDate, formatNumber } from '../lib/format';
import type { Guild } from '../types/guild';

/**
 * 길드 관리 페이지.
 *  - 검색/필터: q(이름·슬러그), 상태, 시즌ID — 모두 백엔드 GET /api/admin/guilds 가 지원.
 *  - 행 클릭 → 상세 모달(정보/길드원/로그). 변경 기능은 상세의 '관리' 탭에서 필요 API 안내.
 */
const STATUS_OPTIONS = [{ value: '', label: '전체 상태' }, ...GUILD_STATUSES.map((s) => ({ value: s, label: GUILD_STATUS_LABELS[s] }))];

export function AdminGuildsPage() {
  // 입력 중인 폼 값과 실제 적용된 필터를 분리(검색 버튼/엔터로 적용).
  const [form, setForm] = useState<GuildListFilter>({ q: '', status: '', seasonId: '' });
  const [filter, setFilter] = useState<GuildListFilter>({ limit: 100 });
  const [openGuildId, setOpenGuildId] = useState<string | null>(null);

  const { data: guilds, isLoading, error } = useQuery({
    queryKey: ['admin-guilds', filter],
    queryFn: () => guildApi.list(filter),
  });

  const applyFilter = () =>
    setFilter({
      q: form.q?.trim() || undefined,
      status: form.status || undefined,
      seasonId: form.seasonId?.trim() || undefined,
      limit: 100,
    });

  const columns: Column<Guild>[] = [
    { key: 'name', header: '길드명', render: (r) => <span className="font-medium text-zinc-200">{r.name}</span> },
    { key: 'slug', header: '슬러그', render: (r) => <span className="text-xs font-mono text-zinc-500">{r.slug}</span> },
    { key: 'season', header: '시즌', render: (r) => <span className="text-xs text-zinc-400">{r.seasonId}</span> },
    {
      key: 'status',
      header: '상태',
      render: (r) => <StatusBadge label={GUILD_STATUS_LABELS[r.status]} tone={guildStatusTone(r.status)} />,
    },
    { key: 'members', header: '인원', render: (r) => <span className="text-xs font-mono text-zinc-300">{r.memberCount}/{r.maxMembers}</span> },
    { key: 'point', header: '총 점수', render: (r) => <span className="text-xs font-mono text-zinc-300">{formatNumber(r.totalGuildPoint)}</span> },
    { key: 'rank', header: '순위', render: (r) => <span className="text-xs font-mono text-zinc-400">{r.currentSeasonRank ?? '–'}</span> },
    { key: 'owner', header: '길드장', render: (r) => <CopyableId value={r.ownerUid} /> },
    { key: 'createdAt', header: '생성일', render: (r) => <span className="text-xs font-mono text-zinc-500">{formatDate(r.createdAt)}</span> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageSection title="길드 검색">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-zinc-400 mb-1 block">이름 / 슬러그</label>
            <input
              type="text"
              value={form.q ?? ''}
              onChange={(e) => setForm({ ...form, q: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
              placeholder="길드명 또는 슬러그"
              className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">상태</label>
            <select
              value={form.status ?? ''}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">시즌 ID</label>
            <input
              type="text"
              value={form.seasonId ?? ''}
              onChange={(e) => setForm({ ...form, seasonId: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
              placeholder="(선택)"
              className="w-40 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
            />
          </div>
          <button onClick={applyFilter} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
            검색
          </button>
        </div>
      </PageSection>

      <QueryState isLoading={isLoading} error={error}>
        <span className="text-xs text-zinc-500">{guilds?.length ?? 0}개 길드</span>
        <DataTable
          columns={columns}
          data={guilds ?? []}
          rowKey={(r) => r.id}
          emptyMessage="해당 조건의 길드가 없습니다"
          onRowClick={(r) => setOpenGuildId(r.id)}
        />
      </QueryState>

      {openGuildId && (
        <GuildDetailModal guildId={openGuildId} open={openGuildId !== null} onClose={() => setOpenGuildId(null)} />
      )}
    </div>
  );
}

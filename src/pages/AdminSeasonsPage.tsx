import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { ConfirmButton } from '../components/ConfirmButton';
import { SeasonFormModal } from '../components/SeasonFormModal';
import { InlineMessage } from '../components/InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { seasonApi } from '../services/seasonApi';
import { SEASON_STATUS_LABELS, ACTIVE_SEASON_STATUSES } from '../lib/constants';
import { seasonStatusTone } from '../lib/statusTone';
import { formatDate } from '../lib/format';
import type { Season } from '../types/season';

/**
 * 시즌 관리 페이지.
 *  - 현재 시즌: status 가 진행중(ACTIVE_SEASON_STATUSES)인 첫 시즌을 강조 표시.
 *  - 목록 + 생성/수정(모달) + 종료(status='ended').
 */
export function AdminSeasonsPage() {
  const qc = useQueryClient();
  const { data: seasons, isLoading, error } = useQuery({ queryKey: ['seasons'], queryFn: seasonApi.list });

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Season | null>(null);

  const endMutation = useMutation({
    mutationFn: (id: string) => seasonApi.end(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['seasons'] }),
  });

  const current = seasons?.find((s) => ACTIVE_SEASON_STATUSES.includes(s.status));

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (s: Season) => {
    setEditTarget(s);
    setFormOpen(true);
  };

  const columns: Column<Season>[] = [
    { key: 'seasonId', header: '시즌 ID', render: (r) => <span className="font-mono text-xs text-zinc-400">{r.seasonId}</span> },
    { key: 'title', header: '제목', render: (r) => <span className="font-medium text-zinc-200">{r.title}</span> },
    {
      key: 'status',
      header: '상태',
      render: (r) => <StatusBadge label={SEASON_STATUS_LABELS[r.status]} tone={seasonStatusTone(r.status)} />,
    },
    {
      key: 'create',
      header: '길드 생성 기간',
      render: (r) => (
        <span className="text-xs font-mono text-zinc-400">
          {formatDate(r.guildCreateStartAt)} ~ {formatDate(r.guildCreateEndAt)}
        </span>
      ),
    },
    {
      key: 'tournament',
      header: '토너먼트 기간',
      render: (r) => (
        <span className="text-xs font-mono text-zinc-400">
          {formatDate(r.tournamentStartAt)} ~ {formatDate(r.tournamentEndAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(r)}
            className="text-xs text-violet-400 hover:text-violet-300 px-2 py-0.5 border border-violet-700/50 rounded hover:bg-violet-500/10"
          >
            수정
          </button>
          {r.status !== 'ended' && (
            <ConfirmButton
              tone="danger"
              confirmLabel="종료 확정"
              disabled={endMutation.isPending}
              onConfirm={() => endMutation.mutate(r.id)}
            >
              종료
            </ConfirmButton>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">시즌</h2>
        <button onClick={openCreate} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
          + 새 시즌 생성
        </button>
      </div>

      {endMutation.isError && (
        <InlineMessage kind="error">{errorToMessage(endMutation.error)}</InlineMessage>
      )}

      {current && (
        <PageSection accent title="현재 진행 중인 시즌">
          <div className="flex items-center gap-3 mb-3">
            <StatusBadge label={SEASON_STATUS_LABELS[current.status]} tone={seasonStatusTone(current.status)} />
            <span className="font-semibold text-zinc-200">{current.title}</span>
            <span className="font-mono text-xs text-zinc-500">{current.seasonId}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Period label="길드 생성" start={current.guildCreateStartAt} end={current.guildCreateEndAt} />
            <Period label="길드 가입" start={current.guildJoinStartAt} end={current.guildJoinEndAt} />
            <Period label="점수 집계" start={current.pointCollectStartAt} end={current.pointCollectEndAt} />
            <Period label="토너먼트" start={current.tournamentStartAt} end={current.tournamentEndAt} />
          </div>
        </PageSection>
      )}

      <QueryState isLoading={isLoading} error={error}>
        <DataTable columns={columns} data={seasons ?? []} rowKey={(r) => r.id} emptyMessage="시즌이 없습니다" />
      </QueryState>

      {formOpen && (
        <SeasonFormModal open={formOpen} onClose={() => setFormOpen(false)} initial={editTarget} />
      )}
    </div>
  );
}

function Period({ label, start, end }: { label: string; start: unknown; end: unknown }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-zinc-300 font-mono text-xs mt-0.5">
        {formatDate(start as string)} ~ {formatDate(end as string)}
      </p>
    </div>
  );
}

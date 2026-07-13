import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { personalScoreApi } from '../services/personalScoreApi';
import { userApi } from '../services/userApi';
import { errorToMessage } from '../lib/apiError';
import { formatNumber } from '../lib/format';
import {
  VERIFY_FLAG_LABELS,
  type GuildMemberPersonalScoreCoverage,
  type PersonalScore,
  type PsRank,
  type VerifyFlag,
} from '../types/personalScore';
import type { AdminUser } from '../types/user';

/**
 * 유저 점수 관리.
 * 개인점수(personalScore) 목록에 유저 프로필을 UID로 합쳐 닉네임과 입력 티어/점수를 보여준다.
 * 실제 저장 가능한 값은 백엔드가 받는 manualAdjust/overrideScore 이다.
 */
type ScoreRow = PersonalScore & { user?: AdminUser };

const FLAG_STYLE: Record<VerifyFlag, string> = {
  ok: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  caution: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  danger: 'bg-red-500/15 text-red-300 border-red-500/40',
  unverified: 'bg-zinc-700/40 text-zinc-400 border-zinc-600',
};

const FLAG_FILTERS: { value: VerifyFlag | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'danger', label: '위험' },
  { value: 'caution', label: '주의' },
  { value: 'unverified', label: '검증불가' },
  { value: 'ok', label: '정상' },
];

const FLAG_TONE: Record<VerifyFlag, 'success' | 'warning' | 'danger' | 'neutral'> = {
  ok: 'success',
  caution: 'warning',
  danger: 'danger',
  unverified: 'neutral',
};

const TIER_LABELS: Record<string, string> = {
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플래티넘',
  EMERALD: '에메랄드',
  DIAMOND: '다이아',
  MASTER: '마스터',
  GRANDMASTER: '그마',
  CHALLENGER: '챌린저',
};

const numOrZero = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const numOrNull = (value: string) => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function fmtRank(r: PsRank | null | undefined): string {
  if (!r || !r.tier) return '–';
  const apex = ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(r.tier.toUpperCase());
  const div = apex ? '' : ` ${r.division ?? ''}`.trimEnd();
  return `${TIER_LABELS[r.tier.toUpperCase()] ?? r.tier}${div} ${r.lp ?? 0}LP`;
}

function userName(row: ScoreRow): string {
  return (
    row.user?.displayName ??
    row.displayName ??
    row.user?.gameName ??
    row.gameName ??
    row.user?.email ??
    row.email ??
    row.riotId ??
    row.uid
  );
}

function userSub(row: ScoreRow): string {
  const riot = row.riotId ?? [row.user?.gameName, row.user?.tagLine].filter(Boolean).join('#');
  return riot || row.user?.email || '–';
}

function FlagBadge({ flag }: { flag: VerifyFlag }) {
  return (
    <span className={`px-2 py-0.5 text-[11px] rounded border ${FLAG_STYLE[flag]}`}>{VERIFY_FLAG_LABELS[flag]}</span>
  );
}

function storageLabel(value: string | null | undefined): string {
  if (value === 'server_db') return 'Server DB';
  if (value === 'firestore_import') return 'Firestore import';
  return value || 'unknown';
}

function mirrorTone(value: string | null | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  const normalized = (value ?? '').toUpperCase();
  if (normalized === 'MIRRORED' || normalized === 'SENT') return 'success';
  if (normalized === 'OUTBOX_PENDING' || normalized === 'PENDING') return 'warning';
  if (normalized === 'FAILED' || normalized === 'DEAD') return 'danger';
  return 'neutral';
}

function percent(ready: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((ready / total) * 100)}%`;
}

export function AdminPersonalScorePage() {
  const [search, setSearch] = useState('');
  const [flag, setFlag] = useState<VerifyFlag | 'all'>('all');
  const [editing, setEditing] = useState<ScoreRow | null>(null);

  const scoresQuery = useQuery({
    queryKey: ['personal-scores'],
    queryFn: () => personalScoreApi.list(200),
  });
  const usersQuery = useQuery({
    queryKey: ['admin-users', 'score-page-names'],
    queryFn: () => userApi.list({ limit: 200 }),
  });
  const coverageQuery = useQuery({
    queryKey: ['personal-score-guild-member-coverage'],
    queryFn: () => personalScoreApi.coverage({ limit: 1000 }),
  });

  const userByUid = useMemo(() => {
    const m = new Map<string, AdminUser>();
    for (const u of usersQuery.data ?? []) m.set(u.uid, u);
    return m;
  }, [usersQuery.data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = (scoresQuery.data ?? []).map((r): ScoreRow => ({ ...r, user: userByUid.get(r.uid) }));
    return all.filter((r) => {
      if (flag !== 'all' && r.verifyFlag !== flag) return false;
      if (!q) return true;
      return [
        r.uid,
        r.riotId,
        r.user?.displayName,
        r.displayName,
        r.user?.email,
        r.email,
        r.user?.gameName,
        r.gameName,
        r.user?.tagLine,
        r.tagLine,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [scoresQuery.data, search, flag, userByUid]);

  const counts = useMemo(() => {
    const c: Record<VerifyFlag, number> = { ok: 0, caution: 0, danger: 0, unverified: 0 };
    for (const r of scoresQuery.data ?? []) c[r.verifyFlag] += 1;
    return c;
  }, [scoresQuery.data]);

  const storageCounts = useMemo(() => {
    const all = scoresQuery.data ?? [];
    return {
      serverDb: all.filter((r) => r.storageSource === 'server_db').length,
      legacyMirrorPending: all.filter((r) => ['OUTBOX_PENDING', 'PENDING'].includes(String(r.firestoreMirrorStatus ?? '').toUpperCase())).length,
      legacyMirrorFailed: all.filter((r) => ['FAILED', 'DEAD'].includes(String(r.firestoreMirrorStatus ?? '').toUpperCase())).length,
      legacyMirrored: all.filter((r) => ['MIRRORED', 'SENT'].includes(String(r.firestoreMirrorStatus ?? '').toUpperCase())).length,
      missingPuuid: all.filter((r) => !r.puuid).length,
    };
  }, [scoresQuery.data]);

  const columns: Column<ScoreRow>[] = [
    {
      key: 'user',
      header: '유저',
      render: (r) => (
        <div className="min-w-44">
          <p className="font-medium text-zinc-200">{userName(r)}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{userSub(r)}</p>
          <div className="mt-1">
            <CopyableId value={r.uid} />
          </div>
        </div>
      ),
    },
    {
      key: 'reportedTier',
      header: '입력 티어',
      render: (r) => (
        <RankStack solo={r.reportedRank?.solo} flex={r.reportedRank?.flex} />
      ),
    },
    {
      key: 'scoreInput',
      header: '점수 입력값',
      render: (r) => (
        <ScoreStack
          rows={[
            ['입력', r.reportedScore],
            ['자동', r.autoScore],
          ]}
        />
      ),
    },
    {
      key: 'manual',
      header: '수정값',
      render: (r) => (
        <ScoreStack
          rows={[
            ['가산', r.manualAdjust],
            ['강제', r.overrideScore],
          ]}
        />
      ),
    },
    {
      key: 'final',
      header: '최종 점수',
      render: (r) => <FinalScoreCell row={r} />,
    },
    {
      key: 'storage',
      header: 'DB / mirror',
      render: (r) => (
        <div className="flex min-w-32 flex-col items-start gap-1.5">
          <StatusBadge label={storageLabel(r.storageSource)} tone={r.storageSource === 'server_db' ? 'success' : 'warning'} />
          <StatusBadge label={r.firestoreMirrorStatus ?? 'legacy mirror unknown'} tone={mirrorTone(r.firestoreMirrorStatus)} />
          {!r.puuid ? <StatusBadge label="PUUID 없음" tone="warning" /> : <StatusBadge label="PUUID 있음" tone="success" />}
        </div>
      ),
    },
    {
      key: 'verified',
      header: '검증',
      render: (r) => (
        <div className="flex flex-col gap-1.5">
          <FlagBadge flag={r.verifyFlag} />
          <span className="text-xs text-zinc-500">
            실제 {fmtRank(r.verifiedRank?.solo)} · {r.tierGap != null ? `${r.tierGap > 0 ? '+' : ''}${r.tierGap}티어` : '–'}
          </span>
        </div>
      ),
    },
    {
      key: 'action',
      header: '관리',
      render: (r) => (
        <button
          type="button"
          onClick={() => setEditing(r)}
          className="rounded bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700"
        >
          수정
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 max-w-6xl">
      <PageSection
        title="유저 점수 관리"
        description="닉네임, 입력 티어, 입력 점수, 보정값, 최종 점수를 함께 확인합니다."
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label className="mb-1 block text-xs text-zinc-400">검색</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="닉네임 / Riot ID / UID"
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {FLAG_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFlag(f.value)}
                  className={
                    flag === f.value
                      ? 'rounded border border-violet-500/60 bg-violet-600/20 px-3 py-1.5 text-xs text-violet-200'
                      : 'rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200'
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge label={`전체 ${formatNumber(scoresQuery.data?.length ?? 0)}`} />
            <StatusBadge label={`위험 ${formatNumber(counts.danger)}`} tone="danger" />
            <StatusBadge label={`주의 ${formatNumber(counts.caution)}`} tone="warning" />
            <StatusBadge label={`검증불가 ${formatNumber(counts.unverified)}`} />
            <StatusBadge label={`정상 ${formatNumber(counts.ok)}`} tone="success" />
          </div>
        </div>
      </PageSection>

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge label={`Server DB ${formatNumber(storageCounts.serverDb)}`} tone="success" />
        <StatusBadge
          label={`legacy pending ${formatNumber(storageCounts.legacyMirrorPending)}`}
          tone={storageCounts.legacyMirrorPending > 0 ? 'warning' : 'success'}
        />
        <StatusBadge
          label={`legacy failed ${formatNumber(storageCounts.legacyMirrorFailed)}`}
          tone={storageCounts.legacyMirrorFailed > 0 ? 'danger' : 'success'}
        />
        <StatusBadge
          label={`PUUID missing ${formatNumber(storageCounts.missingPuuid)}`}
          tone={storageCounts.missingPuuid > 0 ? 'warning' : 'success'}
        />
        <StatusBadge label={`legacy mirrored ${formatNumber(storageCounts.legacyMirrored)}`} />
      </div>

      <GuildMemberCoveragePanel
        coverage={coverageQuery.data ?? null}
        isLoading={coverageQuery.isLoading}
        error={coverageQuery.error}
        onRefresh={() => void coverageQuery.refetch()}
      />

      <QueryState isLoading={scoresQuery.isLoading || usersQuery.isLoading} error={scoresQuery.error ?? usersQuery.error}>
        <span className="text-xs text-zinc-500">{rows.length}명 표시</span>
        <DataTable columns={columns} data={rows} rowKey={(r) => r.uid} emptyMessage="해당 조건의 유저가 없습니다" />
      </QueryState>

      <ScoreEditModal row={editing} open={editing !== null} onClose={() => setEditing(null)} />
    </div>
  );
}

function GuildMemberCoveragePanel({
  coverage,
  isLoading,
  error,
  onRefresh,
}: {
  coverage: GuildMemberPersonalScoreCoverage | null;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
}) {
  const missing = coverage?.missingDisplaySummary ?? 0;
  const checked = coverage?.checked ?? 0;
  const ready = coverage?.displayReady ?? 0;
  return (
    <PageSection
      title="길드원 티어 표시 점검"
      description="길드원 목록에 my-info 티어, LP, 전투력 점수가 표시될 준비가 되었는지 Server DB 기준으로 확인합니다."
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={`checked ${formatNumber(checked)}`} tone="neutral" />
          <StatusBadge label={`ready ${formatNumber(ready)} (${percent(ready, checked)})`} tone={missing > 0 ? 'warning' : 'success'} />
          <StatusBadge label={`missing ${formatNumber(missing)}`} tone={missing > 0 ? 'warning' : 'success'} />
          <StatusBadge label={`personal_scores ${formatNumber(coverage?.personalScoreTableReady ?? 0)}`} tone="success" />
          <StatusBadge label={`profile summary ${formatNumber(coverage?.profileSummaryReady ?? 0)}`} tone="neutral" />
          <StatusBadge label={`server profile missing ${formatNumber(coverage?.missingServerProfile ?? 0)}`} tone={(coverage?.missingServerProfile ?? 0) > 0 ? 'danger' : 'success'} />
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300 hover:border-violet-500 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>

        {error ? <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage> : null}
        {isLoading ? <InlineMessage kind="info">길드원 개인점수 coverage를 확인하는 중입니다.</InlineMessage> : null}
        {coverage && missing === 0 ? (
          <InlineMessage kind="success">현재 active 길드원은 모두 티어/점수 표시 준비가 되어 있습니다.</InlineMessage>
        ) : null}
        {coverage && missing > 0 ? (
          <InlineMessage kind="warning">
            일부 길드원은 아직 /my-info 개인점수 요약이 없습니다. 해당 유저가 my-info에서 Riot 닉네임, 최고 티어, LP, 전투력 점수를 저장하면 길드원 목록에도 표시됩니다.
          </InlineMessage>
        ) : null}

        {coverage?.sampleMissing?.length ? (
          <div className="overflow-hidden rounded border border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-800 text-sm">
              <thead className="bg-zinc-950/80 text-xs text-zinc-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">guildId</th>
                  <th className="px-3 py-2 text-left font-medium">memberPublicId</th>
                  <th className="px-3 py-2 text-left font-medium">uid</th>
                  <th className="px-3 py-2 text-left font-medium">reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {coverage.sampleMissing.map((row) => (
                  <tr key={`${row.guildId}:${row.memberPublicId}`}>
                    <td className="px-3 py-2">
                      <CopyableId value={row.guildId} />
                    </td>
                    <td className="px-3 py-2">
                      <CopyableId value={row.memberPublicId} />
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">{row.uidMasked}</td>
                    <td className="px-3 py-2">
                      <StatusBadge label={row.reason} tone={row.reason === 'NO_SERVER_PROFILE' ? 'danger' : 'warning'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}

function RankStack({ solo, flex }: { solo?: PsRank | null; flex?: PsRank | null }) {
  return (
    <div className="flex min-w-36 flex-col gap-1">
      <MetaLine label="솔로" value={fmtRank(solo)} />
      <MetaLine label="자유" value={fmtRank(flex)} />
    </div>
  );
}

function ScoreStack({ rows }: { rows: [string, number | null | undefined][] }) {
  return (
    <div className="flex min-w-24 flex-col gap-1">
      {rows.map(([label, value]) => (
        <MetaLine key={label} label={label} value={formatNumber(value)} mono />
      ))}
    </div>
  );
}

function MetaLine({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className="w-7 shrink-0 text-zinc-600">{label}</span>
      <span className={mono ? 'font-mono text-zinc-300' : 'text-zinc-300'}>{value}</span>
    </span>
  );
}

function FinalScoreCell({ row }: { row: ScoreRow }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-base font-semibold text-violet-300">{formatNumber(row.finalScore)}</span>
      {row.overrideScore != null && <span className="text-[11px] text-amber-400">강제값 적용</span>}
    </div>
  );
}

function ScoreEditModal({ row, open, onClose }: { row: ScoreRow | null; open: boolean; onClose: () => void }) {
  if (!row) return null;
  return <ScoreEditDialog key={`${row.uid}:${row.updatedAt ?? ''}`} row={row} open={open} onClose={onClose} />;
}

function ScoreEditDialog({ row, open, onClose }: { row: ScoreRow; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [manualAdjust, setManualAdjust] = useState(() => String(row.manualAdjust ?? 0));
  const [overrideScore, setOverrideScore] = useState(() => (row.overrideScore == null ? '' : String(row.overrideScore)));

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['personal-scores'] });

  const saveMut = useMutation({
    mutationFn: () =>
      personalScoreApi.updateManual(row.uid, {
        manualAdjust: numOrZero(manualAdjust),
        overrideScore: numOrNull(overrideScore),
      }),
    onSuccess: () => {
      invalidate();
      onClose();
    },
  });

  const banMut = useMutation({
    mutationFn: () => userApi.updateProfile(row.uid, { status: 'banned' }),
    onSuccess: invalidate,
  });

  const nextOverride = numOrNull(overrideScore);
  const nextManual = numOrZero(manualAdjust);
  const previewFinal = nextOverride ?? row.autoScore + nextManual;

  return (
    <Modal
      open={open}
      title="유저 점수 수정"
      onClose={onClose}
      headerRight={<StatusBadge label={VERIFY_FLAG_LABELS[row.verifyFlag]} tone={FLAG_TONE[row.verifyFlag]} />}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 md:grid-cols-2">
          <InfoBlock label="닉네임" value={userName(row)} />
          <InfoBlock label="Riot ID" value={userSub(row)} />
          <InfoBlock label="UID" value={<CopyableId value={row.uid} />} />
          <InfoBlock label="최종 점수" value={<span className="font-mono text-violet-300">{formatNumber(row.finalScore)}</span>} />
        </div>

        <PageSection title="입력 티어와 점수">
          <div className="grid gap-3 md:grid-cols-3">
            <InfoBlock label="솔로 티어" value={fmtRank(row.reportedRank?.solo)} />
            <InfoBlock label="자유 티어" value={fmtRank(row.reportedRank?.flex)} />
            <InfoBlock label="입력 점수" value={<span className="font-mono">{formatNumber(row.reportedScore)}</span>} />
          </div>
        </PageSection>

        <PageSection title="점수 수정" accent>
          <div className="grid gap-3 md:grid-cols-3">
            <NumberInput label="수동 가산점" value={manualAdjust} onChange={setManualAdjust} placeholder="0" />
            <NumberInput label="강제 최종점수" value={overrideScore} onChange={setOverrideScore} placeholder="비우면 미적용" />
            <InfoBlock label="저장 후 예상 점수" value={<span className="font-mono text-violet-300">{formatNumber(previewFinal)}</span>} />
          </div>
        </PageSection>

        <div className="flex flex-wrap items-center gap-2">
          <ConfirmButton tone="primary" confirmLabel="점수 저장" disabled={saveMut.isPending} onConfirm={() => saveMut.mutate()}>
            저장
          </ConfirmButton>
          <ConfirmButton tone="danger" confirmLabel="밴 확정" disabled={banMut.isPending} onConfirm={() => banMut.mutate()}>
            유저 밴
          </ConfirmButton>
          <button type="button" onClick={onClose} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
            닫기
          </button>
          {(saveMut.isError || banMut.isError) && (
            <InlineMessage kind="error">{errorToMessage(saveMut.error ?? banMut.error)}</InlineMessage>
          )}
        </div>
      </div>
    </Modal>
  );
}

function InfoBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-900/50 px-3 py-2">
      <p className="mb-1 text-xs text-zinc-500">{label}</p>
      <div className="text-sm text-zinc-200">{value}</div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs text-zinc-400">{label}</label>
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
      />
    </div>
  );
}

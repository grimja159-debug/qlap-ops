import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { EntryTicketItemSelect } from '../components/EntryTicketItemSelect';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { errorToMessage } from '../lib/apiError';
import { shortId } from '../lib/format';
import type { Tone } from '../lib/statusTone';
import { itemApi } from '../services/itemApi';
import { liveCwAdminApi } from '../services/liveCwAdminApi';
import type {
  AdminLiveCwAdminActionResult,
  AdminLiveCwArchiveSummary,
  AdminLiveCwAuditLog,
  AdminLiveCwCoinLog,
  AdminLiveCwDetail,
  AdminLiveCwFilters,
  AdminLiveCwPatch,
  AdminLiveCwParticipant,
  AdminLiveCwPenaltyLog,
  AdminLiveCwPenaltyMonitor,
  AdminLiveCwPenaltyMonitorFilters,
  AdminLiveCwPenaltyUser,
  AdminLiveCwPolicy,
  AdminLiveCwDiscordServer,
  AdminLiveCwDiscordServerMonitor,
  AdminLiveCwRewardMonitor,
  AdminLiveCwRewardMonitorAggregate,
  AdminLiveCwRewardLedgerReconcileItem,
  AdminLiveCwRewardMonitorFilters,
  AdminLiveCwRewardMonitorTx,
  AdminLiveCwRewardMonitorWarning,
  AdminLiveCwRoom,
  AdminLiveCwServerDbMonitor,
  AdminLiveCwServerDbMonitorArchive,
  AdminLiveCwServerDbMonitorRoflJob,
  AdminLiveCwServerDbMonitorRoom,
  AdminLiveCwServerDbInspection,
  AdminLiveCwServerDbMutationJournal,
  AdminLiveCwServerDbSourceDocument,
  AdminLiveCwWorkerHealthSnapshot,
  AdminFirestoreDependencyMonitor,
  AdminFirestoreDependencyRecentRow,
  AdminFirestoreDependencySummaryRow,
  AdminQlapCoinMirrorOutboxRow,
  AdminQlapCoinMirrorReconcileSample,
} from '../types/liveCw';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'OPEN', label: 'OPEN' },
  { value: 'FULL', label: 'FULL' },
  { value: 'PARTICIPANTS_LOCKED', label: 'PARTICIPANTS_LOCKED' },
  { value: 'CAPTAINS_SELECTED', label: 'CAPTAINS_SELECTED' },
  { value: 'TEAM_LOCKED', label: 'TEAM_LOCKED' },
  { value: 'RESULT_REPORTED', label: 'RESULT_REPORTED' },
  { value: 'ROFL_UPLOADED', label: 'ROFL_UPLOADED' },
  { value: 'ROFL_PROCESSED', label: 'ROFL_PROCESSED' },
  { value: 'CONFIRMED', label: 'CONFIRMED' },
  { value: 'DISPUTED', label: 'DISPUTED' },
  { value: 'ADMIN_ENDED', label: 'ADMIN_ENDED' },
  { value: 'CANCELED', label: 'CANCELED' },
];

const PHASE_OPTIONS = [
  { value: '', label: 'All phases' },
  { value: 'recruiting', label: '모집중' },
  { value: 'active', label: '진행중' },
  { value: 'ended', label: '종료' },
] as const;

const CREATED_VIA_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'web', label: 'web' },
  { value: 'discord_bot', label: 'discord bot' },
] as const;

const BOOL_OPTIONS = [
  { value: 'true', label: '사용' },
  { value: 'false', label: '미사용' },
] as const;

const ELIGIBILITY_OPTIONS = [
  { value: 'KAKAO_ONLY', label: 'Kakao only' },
  { value: 'RIOT_TIER_ONLY', label: 'Riot tier only' },
  { value: 'KAKAO_OR_RIOT_TIER', label: 'Kakao or Riot tier' },
  { value: 'KAKAO_AND_RIOT_TIER', label: 'Kakao and Riot tier' },
  { value: 'DISABLED', label: 'Disabled' },
] as const;

const REWARD_MONITOR_PERIOD_OPTIONS = [
  { value: '1h', label: '최근 1시간' },
  { value: '24h', label: '최근 24시간' },
  { value: '7d', label: '최근 7일' },
  { value: 'all', label: '전체 recent' },
] as const;

const REWARD_MONITOR_STATUS_OPTIONS = [
  { value: '', label: 'All reward statuses' },
  { value: 'ISSUED', label: 'ISSUED' },
  { value: 'REISSUED', label: 'REISSUED' },
  { value: 'SKIPPED', label: 'SKIPPED' },
  { value: 'FAILED', label: 'FAILED' },
  { value: 'ERROR', label: 'ERROR' },
] as const;

const PENALTY_ACTION_OPTIONS = [
  { value: '', label: 'All penalty actions' },
  { value: 'RECRUITING_LEAVE', label: '모집중 나가기' },
  { value: 'ACTIVE_DROPOUT', label: '진행중 탈주' },
  { value: 'ROOM_CANCEL', label: '방취소' },
] as const;

const DEFAULT_REWARD_MONITOR_FILTERS: AdminLiveCwRewardMonitorFilters = {
  period: '7d',
  status: '',
  roomId: '',
  rewardTxId: '',
  rewardLimit: 50,
  coinLogLimit: 100,
  workerLimit: 30,
};

const DEFAULT_PENALTY_MONITOR_FILTERS: AdminLiveCwPenaltyMonitorFilters = {
  limit: 50,
  logLimit: 100,
  uid: '',
  action: '',
  activeOnly: false,
};

function statusTone(status: string): Tone {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'DISPUTED' || status === 'CANCELED') return 'danger';
  if (status === 'RESULT_REPORTED' || status === 'ROFL_UPLOADED' || status === 'ADMIN_ENDED') return 'warning';
  if (status === 'TEAM_LOCKED' || status === 'ROFL_PROCESSED') return 'info';
  return 'neutral';
}

function short(value: string | null | undefined): string {
  if (!value) return '-';
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

function formatDateTime(value: string | number | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('ko-KR');
}

function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('ko-KR') : '-';
}

function formatRemainingSeconds(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '-';
  const total = Math.ceil(value);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${minutes}분 ${String(total % 60).padStart(2, '0')}초`;
}

function renderJson(value: unknown): string {
  if (value == null) return '-';
  return JSON.stringify(value, null, 2);
}

function confirmAndRun(message: string, action: () => void) {
  if (window.confirm(message)) action();
}

async function copyToClipboard(value: string | null | undefined) {
  if (!value) return;
  await navigator.clipboard?.writeText(value);
}

function verificationTone(status: string | null | undefined): Tone {
  if (status === 'VERIFIED_BY_ROFL' || status === 'AUTO_CONFIRMED_NO_ROFL') return 'success';
  if (status === 'FLAGGED' || status === 'REVIEW_REQUIRED' || status === 'DISPUTED') return 'danger';
  if (status === 'PENDING_ROFL' || status === 'VERIFYING_ROFL') return 'warning';
  return 'neutral';
}

function archiveTone(status: string | null | undefined): Tone {
  if (status === 'ARCHIVED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'PENDING' || status === 'DRY_RUN' || status === 'DRY_RUN_PREVIEW') return 'warning';
  return 'neutral';
}

function rewardTone(rewardIssued: boolean, skipped: boolean): Tone {
  if (rewardIssued) return 'success';
  if (skipped) return 'warning';
  return 'neutral';
}

function serverDbJournalTone(status: string | null | undefined): Tone {
  if (status === 'COMMITTED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (status === 'STARTED') return 'warning';
  return 'neutral';
}

function liveCwCreatedViaTone(createdVia: string | null | undefined): Tone {
  if (createdVia === 'discord_bot') return 'accent';
  if (createdVia === 'web') return 'info';
  return 'neutral';
}

function formatCountMap(value: Record<string, number> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) return '-';
  return Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `${key} ${formatNumber(count)}`)
    .join(' · ');
}

function recordOf(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringOf(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function boolOf(value: unknown): boolean {
  return value === true;
}

export function AdminLiveCwPage() {
  const qc = useQueryClient();
  const [draftFilters, setDraftFilters] = useState<AdminLiveCwFilters>({ limit: 100 });
  const [filters, setFilters] = useState<AdminLiveCwFilters>({ limit: 100 });
  const [rewardMonitorDraft, setRewardMonitorDraft] = useState<AdminLiveCwRewardMonitorFilters>(DEFAULT_REWARD_MONITOR_FILTERS);
  const [rewardMonitorFilters, setRewardMonitorFilters] = useState<AdminLiveCwRewardMonitorFilters>(DEFAULT_REWARD_MONITOR_FILTERS);
  const [penaltyMonitorDraft, setPenaltyMonitorDraft] = useState<AdminLiveCwPenaltyMonitorFilters>(DEFAULT_PENALTY_MONITOR_FILTERS);
  const [penaltyMonitorFilters, setPenaltyMonitorFilters] = useState<AdminLiveCwPenaltyMonitorFilters>(DEFAULT_PENALTY_MONITOR_FILTERS);
  const [firestoreDependencyLimit, setFirestoreDependencyLimit] = useState(50);
  const [serverDbMonitorLimit, setServerDbMonitorLimit] = useState(20);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [patch, setPatch] = useState<AdminLiveCwPatch>({});
  const [policyDraft, setPolicyDraft] = useState<AdminLiveCwPolicy | null>(null);
  const [adminReason, setAdminReason] = useState('운영자 검토 요청');
  const [archiveReason, setArchiveReason] = useState('ADMIN_MANUAL_ARCHIVE');
  const [overrideWinnerTeam, setOverrideWinnerTeam] = useState<'BLUE' | 'RED' | ''>('');
  const [lastAdminAction, setLastAdminAction] = useState<AdminLiveCwAdminActionResult | null>(null);
  const [lastArchiveAction, setLastArchiveAction] = useState<Record<string, unknown> | null>(null);
  const [lastArchiveSignedUrl, setLastArchiveSignedUrl] = useState<Record<string, unknown> | null>(null);
  const [lastArchiveSummary, setLastArchiveSummary] = useState<AdminLiveCwArchiveSummary | null>(null);

  const policyQuery = useQuery({ queryKey: ['admin-live-cw-policy'], queryFn: liveCwAdminApi.getPolicy });
  const entryTicketItemsQuery = useQuery({
    queryKey: ['items', 'entry-tickets', 'live-cw-policy'],
    queryFn: itemApi.listAll,
    staleTime: 30000,
  });
  const rewardMonitorQuery = useQuery({
    queryKey: ['admin-live-cw-reward-monitor', rewardMonitorFilters],
    queryFn: () => liveCwAdminApi.getRewardMonitor(rewardMonitorFilters),
    refetchInterval: 30_000,
  });
  const penaltyMonitorQuery = useQuery({
    queryKey: ['admin-live-cw-penalty-monitor', penaltyMonitorFilters],
    queryFn: () => liveCwAdminApi.getPenaltyMonitor(penaltyMonitorFilters),
    refetchInterval: 30_000,
  });
  const discordServersQuery = useQuery({
    queryKey: ['admin-live-cw-discord-servers'],
    queryFn: liveCwAdminApi.getDiscordServers,
    refetchInterval: 30_000,
  });
  const firestoreDependencyQuery = useQuery({
    queryKey: ['admin-live-cw-firestore-dependencies', firestoreDependencyLimit],
    queryFn: () => liveCwAdminApi.getFirestoreDependencies({ limit: firestoreDependencyLimit }),
    refetchInterval: 30_000,
  });
  const serverDbMonitorQuery = useQuery({
    queryKey: ['admin-live-cw-server-db-monitor', serverDbMonitorLimit],
    queryFn: () => liveCwAdminApi.getServerDbMonitor({ limit: serverDbMonitorLimit }),
    refetchInterval: 30_000,
  });
  const roomsQuery = useQuery({
    queryKey: ['admin-live-cw-rooms', filters],
    queryFn: () => liveCwAdminApi.listRooms(filters),
  });
  const detailQuery = useQuery({
    queryKey: ['admin-live-cw-room', selectedRoomId],
    queryFn: () => liveCwAdminApi.getRoom(selectedRoomId),
    enabled: Boolean(selectedRoomId),
  });

  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const detail = detailQuery.data;
  const policy = policyDraft ?? policyQuery.data ?? null;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-live-cw-rooms'] });
    void qc.invalidateQueries({ queryKey: ['admin-live-cw-reward-monitor'] });
    void qc.invalidateQueries({ queryKey: ['admin-live-cw-penalty-monitor'] });
    void qc.invalidateQueries({ queryKey: ['admin-live-cw-discord-servers'] });
    void qc.invalidateQueries({ queryKey: ['admin-live-cw-firestore-dependencies'] });
    void qc.invalidateQueries({ queryKey: ['admin-live-cw-server-db-monitor'] });
    if (selectedRoomId) void qc.invalidateQueries({ queryKey: ['admin-live-cw-room', selectedRoomId] });
  };

  const updateMutation = useMutation({
    mutationFn: ({ roomId, input }: { roomId: string; input: AdminLiveCwPatch }) => liveCwAdminApi.updateRoom(roomId, input),
    onSuccess: invalidate,
  });
  const endMutation = useMutation({ mutationFn: liveCwAdminApi.endRoom, onSuccess: invalidate });
  const cancelMutation = useMutation({ mutationFn: liveCwAdminApi.cancelRoom, onSuccess: invalidate });
  const deleteMutation = useMutation({
    mutationFn: liveCwAdminApi.deleteRoom,
    onSuccess: () => {
      setSelectedRoomId('');
      invalidate();
    },
  });
  const policyMutation = useMutation({
    mutationFn: (input: Partial<AdminLiveCwPolicy>) => liveCwAdminApi.updatePolicy(input),
    onSuccess: (next) => {
      setPolicyDraft(next);
      void qc.invalidateQueries({ queryKey: ['admin-live-cw-policy'] });
    },
  });
  const rejudgeMutation = useMutation({
    mutationFn: ({ roomId, write }: { roomId: string; write: boolean }) => liveCwAdminApi.rejudgeRoom(roomId, { reason: adminReason, write }),
    onSuccess: (result) => {
      setLastAdminAction(result);
      invalidate();
    },
  });
  const overrideMutation = useMutation({
    mutationFn: ({ roomId, write }: { roomId: string; write: boolean }) =>
      liveCwAdminApi.overrideFinalResult(roomId, {
        winnerTeam: overrideWinnerTeam,
        reason: adminReason,
        write,
      }),
    onSuccess: (result) => {
      setLastAdminAction(result);
      invalidate();
    },
  });
  const reverseReissueMutation = useMutation({
    mutationFn: ({ roomId, winnerTeam }: { roomId: string; winnerTeam: 'BLUE' | 'RED' }) =>
      liveCwAdminApi.reverseReissueReward(roomId, { winnerTeam }),
    onSuccess: (result) => {
      setLastAdminAction(result as unknown as AdminLiveCwAdminActionResult);
      invalidate();
    },
  });
  const archiveMutation = useMutation({
    mutationFn: ({ roomId, write, force }: { roomId: string; write: boolean; force?: boolean }) =>
      liveCwAdminApi.archiveRoom(roomId, { reason: archiveReason, write, force }),
    onSuccess: (result) => {
      setLastArchiveAction(result);
      invalidate();
    },
  });
  const archiveRetryMutation = useMutation({
    mutationFn: ({ roomId, write, force }: { roomId: string; write: boolean; force?: boolean }) =>
      liveCwAdminApi.retryArchive(roomId, { reason: archiveReason || 'ADMIN_RETRY', write, force }),
    onSuccess: (result) => {
      setLastArchiveAction(result);
      invalidate();
    },
  });
  const archiveSignedUrlMutation = useMutation({
    mutationFn: ({ roomId, kind }: { roomId: string; kind: 'room' | 'audit' | 'result' }) =>
      liveCwAdminApi.getArchiveSignedUrl(roomId, kind),
    onSuccess: (result) => {
      setLastArchiveSignedUrl(result);
      window.open(result.url, '_blank', 'noopener,noreferrer');
    },
  });
  const archiveSummaryMutation = useMutation({
    mutationFn: ({ roomId, kind }: { roomId: string; kind: 'room' | 'audit' | 'result' }) =>
      liveCwAdminApi.getArchiveSummary(roomId, kind),
    onSuccess: setLastArchiveSummary,
  });

  const summary = useMemo(
    () => ({
      total: rooms.length,
      waitingRofl: rooms.filter((room) => room.status === 'RESULT_REPORTED').length,
      review: rooms.filter((room) => room.status === 'DISPUTED').length,
      ended: rooms.filter((room) => ['CONFIRMED', 'ADMIN_ENDED', 'CANCELED'].includes(room.status)).length,
    }),
    [rooms],
  );

  const columns: Column<AdminLiveCwRoom>[] = [
    {
      key: 'room',
      header: 'room',
      render: (room) => (
        <button
          type="button"
          onClick={() => {
            setSelectedRoomId(room.roomId);
            setPatch({});
            setLastAdminAction(null);
            setLastArchiveSummary(null);
          }}
          className="text-left"
        >
          <span className="block font-medium text-zinc-100">{room.title}</span>
          <span className="block font-mono text-[11px] text-zinc-500">{short(room.roomId)}</span>
        </button>
      ),
    },
    { key: 'phase', header: 'phase', render: (room) => <StatusBadge label={room.phase ?? '-'} tone="neutral" /> },
    { key: 'status', header: 'status', render: (room) => <StatusBadge label={room.status} tone={statusTone(room.status)} /> },
    { key: 'source', header: 'source', render: (room) => <StatusBadge label={room.createdVia ?? 'web'} tone={liveCwCreatedViaTone(room.createdVia)} /> },
    { key: 'players', header: 'players', render: (room) => `${formatNumber(room.participantCount)}/${formatNumber(room.capacity)}` },
    { key: 'teams', header: 'teams', render: (room) => `B ${room.blueTeamUids.length}/5 · R ${room.redTeamUids.length}/5` },
    { key: 'match', header: 'match', render: (room) => <span className="font-mono text-xs">{short(room.matchRecordId)}</span> },
    { key: 'created', header: 'created', render: (room) => <span className="text-xs">{formatDateTime(room.createdAt)}</span> },
  ];

  return (
    <div className="flex max-w-[96rem] flex-col gap-5">
      <PageSection title="Live CW Policy" description="참가 조건, 보상 정책, 운영 기본값을 확인합니다.">
        <QueryState isLoading={policyQuery.isLoading} error={policyQuery.error}>
          {policy ? (
            <div className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-4">
                <SelectField label="Live CW" value={String(policy.enabled)} onChange={(value) => setPolicyDraft({ ...policy, enabled: value === 'true' })} options={BOOL_OPTIONS} />
                <SelectField label="참가 조건" value={policy.eligibilityMode} onChange={(eligibilityMode) => setPolicyDraft({ ...policy, eligibilityMode: eligibilityMode as AdminLiveCwPolicy['eligibilityMode'] })} options={ELIGIBILITY_OPTIONS} />
                <SelectField label="보상 지급" value={String(policy.rewardEnabled)} onChange={(value) => setPolicyDraft({ ...policy, rewardEnabled: value === 'true' })} options={BOOL_OPTIONS} />
                <SelectField label="미연결 유저 보상" value={String(policy.allowRewardForDisconnectedUser)} onChange={(value) => setPolicyDraft({ ...policy, allowRewardForDisconnectedUser: value === 'true' })} options={BOOL_OPTIONS} />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <SelectField label="티어방 Riot 필수" value={String(policy.requireRiotForTierRestrictedRoom)} onChange={(value) => setPolicyDraft({ ...policy, requireRiotForTierRestrictedRoom: value === 'true' })} options={BOOL_OPTIONS} />
                <SelectField label="밸런스 팀 Riot 필수" value={String(policy.requireRiotForBalancedDraft)} onChange={(value) => setPolicyDraft({ ...policy, requireRiotForBalancedDraft: value === 'true' })} options={BOOL_OPTIONS} />
                <SelectField label="ANY방 카카오만 허용" value={String(policy.allowKakaoOnlyInAnyRoom)} onChange={(value) => setPolicyDraft({ ...policy, allowKakaoOnlyInAnyRoom: value === 'true' })} options={BOOL_OPTIONS} />
                <SelectField label="티어방 카카오만 허용" value={String(policy.allowKakaoOnlyInTierRestrictedRoom)} onChange={(value) => setPolicyDraft({ ...policy, allowKakaoOnlyInTierRestrictedRoom: value === 'true' })} options={BOOL_OPTIONS} />
              </div>
              <div className="rounded-md border border-zinc-700 bg-zinc-900/50 p-3">
                <div className="mb-2 text-sm font-semibold text-zinc-100">Live CW 입장권 정책</div>
                <div className="grid gap-3 md:grid-cols-4">
                  <SelectField
                    label="방 만들기 입장권"
                    value={String(policy.requireEntryTicketForRoomCreate ?? false)}
                    onChange={(value) => setPolicyDraft({ ...policy, requireEntryTicketForRoomCreate: value === 'true' })}
                    options={BOOL_OPTIONS}
                  />
                  <EntryTicketItemSelect
                    label="방 만들기 입장권"
                    value={policy.roomCreateEntryTicketItemId ?? null}
                    enabled={policy.requireEntryTicketForRoomCreate ?? false}
                    targetFeature="live_cw_create"
                    items={entryTicketItemsQuery.data ?? []}
                    loading={entryTicketItemsQuery.isLoading}
                    error={entryTicketItemsQuery.error}
                    onChange={(roomCreateEntryTicketItemId) => setPolicyDraft({ ...policy, roomCreateEntryTicketItemId })}
                  />
                  <SelectField
                    label="참가 입장권"
                    value={String(policy.requireEntryTicketForRoomJoin ?? false)}
                    onChange={(value) => setPolicyDraft({ ...policy, requireEntryTicketForRoomJoin: value === 'true' })}
                    options={BOOL_OPTIONS}
                  />
                  <EntryTicketItemSelect
                    label="참가 입장권"
                    value={policy.roomJoinEntryTicketItemId ?? null}
                    enabled={policy.requireEntryTicketForRoomJoin ?? false}
                    targetFeature="live_cw_join"
                    items={entryTicketItemsQuery.data ?? []}
                    loading={entryTicketItemsQuery.isLoading}
                    error={entryTicketItemsQuery.error}
                    onChange={(roomJoinEntryTicketItemId) => setPolicyDraft({ ...policy, roomJoinEntryTicketItemId })}
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-6">
                <NumberField label="실시간 참가수" value={policy.roomCapacity ?? 10} min={2} max={10} step={2} hint="짝수 2~10. ROFL 검증은 10명이 가장 안전합니다." onChange={(roomCapacity) => setPolicyDraft({ ...policy, roomCapacity })} />
                <NumberField label="참가 보상" value={policy.participationRewardQlcoin} min={0} onChange={(participationRewardQlcoin) => setPolicyDraft({ ...policy, participationRewardQlcoin })} />
                <NumberField label="승리 보너스" value={policy.winnerBonusQlcoin} min={0} onChange={(winnerBonusQlcoin) => setPolicyDraft({ ...policy, winnerBonusQlcoin })} />
                <NumberField label="방장 보상" value={policy.ownerRewardQlcoin} min={0} onChange={(ownerRewardQlcoin) => setPolicyDraft({ ...policy, ownerRewardQlcoin })} />
                <NumberField label="자동 만료(분)" value={policy.roomAutoExpireMinutes} min={1} onChange={(roomAutoExpireMinutes) => setPolicyDraft({ ...policy, roomAutoExpireMinutes })} />
                <NumberField label="ready timeout(초)" value={policy.readyTimeoutSeconds} min={0} onChange={(readyTimeoutSeconds) => setPolicyDraft({ ...policy, readyTimeoutSeconds })} />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <SelectField label="길드포인트 지급" value={String(policy.gpRewardEnabled ?? false)} onChange={(value) => setPolicyDraft({ ...policy, gpRewardEnabled: value === 'true' })} options={BOOL_OPTIONS} />
                <NumberField label="GP 승리(한판)" value={policy.gpPerWin ?? 0} min={0} hint="이긴 참가자 각자의 길드에 적립" onChange={(gpPerWin) => setPolicyDraft({ ...policy, gpPerWin })} />
                <NumberField label="GP 패배(한판)" value={policy.gpPerLoss ?? 0} min={0} hint="0이면 패배팀 GP 없음" onChange={(gpPerLoss) => setPolicyDraft({ ...policy, gpPerLoss })} />
                <NumberField label="무ROFL 보상배수" value={policy.noRoflRewardMultiplier ?? 1} min={0} max={1} step={0.1} hint="ROFL 미업로드로 초안판결 시 코인·GP에 곱하는 비율(0~1). 1=감액없음, 0.5=절반" onChange={(noRoflRewardMultiplier) => setPolicyDraft({ ...policy, noRoflRewardMultiplier })} />
                <NumberField label="일일 보상 한도(판)" value={policy.maxRewardedMatchesPerUserPerDay ?? 0} min={0} hint="어뷰징 방지: 1인당 하루 보상받는 내전 수 상한. 0=무제한. 초과 유저는 코인·GP 미지급(KST 자정 리셋)" onChange={(maxRewardedMatchesPerUserPerDay) => setPolicyDraft({ ...policy, maxRewardedMatchesPerUserPerDay })} />
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                <NumberField label="Reward warning 1h" value={policy.rewardMonitorRepeatRewardLogsThreshold1h ?? 3} min={1} hint="1시간 내 유저별 반복 지급 로그 경고 기준" onChange={(rewardMonitorRepeatRewardLogsThreshold1h) => setPolicyDraft({ ...policy, rewardMonitorRepeatRewardLogsThreshold1h })} />
                <NumberField label="Reward warning 24h" value={policy.rewardMonitorRepeatRewardLogsThreshold24h ?? 6} min={1} hint="24시간 내 유저별 반복 지급 로그 경고 기준" onChange={(rewardMonitorRepeatRewardLogsThreshold24h) => setPolicyDraft({ ...policy, rewardMonitorRepeatRewardLogsThreshold24h })} />
                <NumberField label="Reward warning 7d" value={policy.rewardMonitorRepeatRewardLogsThreshold7d ?? 18} min={1} hint="7일 내 유저별 반복 지급 로그 경고 기준" onChange={(rewardMonitorRepeatRewardLogsThreshold7d) => setPolicyDraft({ ...policy, rewardMonitorRepeatRewardLogsThreshold7d })} />
                <NumberField label="Reward warning all" value={policy.rewardMonitorRepeatRewardLogsThresholdAll ?? 25} min={1} hint="전체 기간 유저별 반복 지급 로그 경고 기준" onChange={(rewardMonitorRepeatRewardLogsThresholdAll) => setPolicyDraft({ ...policy, rewardMonitorRepeatRewardLogsThresholdAll })} />
                <NumberField label="Max reward recipients" value={policy.rewardMonitorMaxRewardRecipients ?? 10} min={1} hint="방 하나에서 보상 수령자가 이 값보다 많으면 경고" onChange={(rewardMonitorMaxRewardRecipients) => setPolicyDraft({ ...policy, rewardMonitorMaxRewardRecipients })} />
              </div>

              <div className="rounded-md border border-zinc-700 bg-zinc-900/50 p-3 text-xs leading-relaxed text-zinc-300">
                <p className="mb-1.5 font-semibold text-zinc-100">보상 설정 사용설명서</p>
                <ul className="list-disc space-y-1 pl-4">
                  <li><b className="text-zinc-100">보상 지급</b> : 코인·GP 모든 지급의 마스터 스위치. <b>꺼져 있으면 아래 보상값은 전부 무시</b>됩니다.</li>
                  <li><b className="text-zinc-100">코인</b> : <b>참가 보상</b>(참가자 전원) + <b>승리 보너스</b>(이긴 5명 추가) + <b>방장 보상</b>(방장 추가). 한 유저는 해당되는 항목이 모두 합산됩니다 (예: 방장이면서 승자 = 셋 다 받음).</li>
                  <li><b className="text-zinc-100">길드포인트 지급</b> : GP 적립 ON/OFF. 코인과 <b>별개 토글</b>(단, 위 ‘보상 지급’이 켜진 상태에서만 동작).</li>
                  <li><b className="text-zinc-100">GP 승리 / 패배(한판)</b> : 한 판당 적립할 GP. <b>참가자 각자가 속한 길드</b>에 들어갑니다 (예: 이긴 5명 중 A길드 2명·B길드 3명, GP승리=3 → A길드 +6, B길드 +9). 패배값 0이면 진 팀은 GP 없음.</li>
                  <li><b className="text-zinc-100">무ROFL 보상배수 (0~1)</b> : ROFL 리플을 제한시간 내 안 올려 <b>초안(신고값)으로 자동 판결</b>된 경기의 보상 비율. 1=감액없음, 0.5=절반. <b>코인·GP 둘 다</b>에 곱해집니다.</li>
                  <li><b className="text-zinc-100">일일 보상 한도(판)</b> : 어뷰징 방지. 1인당 하루 보상받는 내전 수 상한. <b>0=무제한</b>. 초과한 유저는 그 경기에서 <b>코인·GP 둘 다 못 받습니다</b>(방장이어도). 매일 <b>KST 자정</b> 리셋.</li>
                </ul>
                <p className="mt-2 text-zinc-400">※ GP는 해당 길드가 <b>현재 시즌에 등록</b>돼 있어야 적립됩니다(미등록 길드는 자동 제외). · 값 변경 후 아래 <b>정책 저장</b>을 눌러야 실제 적용됩니다.</p>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                <NumberField label="모집 기본(분)" value={policy.recruitmentDefaultMinutes ?? 30} min={1} onChange={(recruitmentDefaultMinutes) => setPolicyDraft({ ...policy, recruitmentDefaultMinutes })} />
                <NumberField label="모집 최소(분)" value={policy.recruitmentMinMinutes ?? 5} min={1} onChange={(recruitmentMinMinutes) => setPolicyDraft({ ...policy, recruitmentMinMinutes })} />
                <NumberField label="모집 최대(분)" value={policy.recruitmentMaxMinutes ?? 240} min={1} onChange={(recruitmentMaxMinutes) => setPolicyDraft({ ...policy, recruitmentMaxMinutes })} />
                <NumberField label="ROFL 업로드 제한(분)" value={policy.roflUploadWindowMinutes ?? 10} min={0} onChange={(roflUploadWindowMinutes) => setPolicyDraft({ ...policy, roflUploadWindowMinutes })} />
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <NumberField label="모집 연장(분)" value={policy.recruitmentExtensionMinutes ?? 5} min={1} onChange={(recruitmentExtensionMinutes) => setPolicyDraft({ ...policy, recruitmentExtensionMinutes })} />
                <NumberField label="모집 연장 최대(회)" value={policy.recruitmentMaxExtensionCount ?? 1} min={0} onChange={(recruitmentMaxExtensionCount) => setPolicyDraft({ ...policy, recruitmentMaxExtensionCount })} />
                <NumberField label="패널티 없음 캐시(초)" value={policy.penaltyInactiveCacheTtlSeconds ?? 120} min={1} onChange={(penaltyInactiveCacheTtlSeconds) => setPolicyDraft({ ...policy, penaltyInactiveCacheTtlSeconds })} />
                <NumberField label="패널티 재확인(초)" value={policy.penaltyRevalidateSeconds ?? 120} min={0} onChange={(penaltyRevalidateSeconds) => setPolicyDraft({ ...policy, penaltyRevalidateSeconds })} />
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <NumberField label="모집중 나가기 제한(분)" value={policy.recruitingLeavePenaltyMinutes ?? 0} min={0} hint="0이면 제한 없음" onChange={(recruitingLeavePenaltyMinutes) => setPolicyDraft({ ...policy, recruitingLeavePenaltyMinutes })} />
                <NumberField label="진행중 탈주 제한(분)" value={policy.activeDropoutPenaltyMinutes ?? 0} min={0} hint="0이면 제한 없음" onChange={(activeDropoutPenaltyMinutes) => setPolicyDraft({ ...policy, activeDropoutPenaltyMinutes })} />
                <NumberField label="방취소 제한(분)" value={policy.roomCancelPenaltyMinutes ?? 0} min={0} hint="0이면 제한 없음" onChange={(roomCancelPenaltyMinutes) => setPolicyDraft({ ...policy, roomCancelPenaltyMinutes })} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={policyMutation.isPending}
                  onClick={() => confirmAndRun('Live CW 정책을 저장할까요?', () => policyMutation.mutate(policy))}
                  className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                >
                  정책 저장
                </button>
                <span className="text-xs text-zinc-500">version {policy.policyVersion} · updated {formatDateTime(policy.updatedAt)}</span>
                {policyMutation.isError && <InlineMessage kind="error">{errorToMessage(policyMutation.error)}</InlineMessage>}
              </div>
            </div>
          ) : (
            <InlineMessage kind="info">정책을 불러오는 중입니다.</InlineMessage>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="Live CW Discord Servers" description="디스코드봇 Live CW 서버 등록 상태와 Server DB fallback 상태를 확인합니다.">
        <QueryState isLoading={discordServersQuery.isLoading} error={discordServersQuery.error}>
          {discordServersQuery.data && <DiscordServerMonitorPanel monitor={discordServersQuery.data} />}
        </QueryState>
      </PageSection>

      <PageSection title="Live CW Reward Monitor" description="최근 보상 지급, 중복 방지 skip, 방별/유저별 지급량, 자동확정 worker 로그를 확인합니다.">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_1.4fr_0.8fr]">
          <SelectField
            label="기간"
            value={rewardMonitorDraft.period ?? '7d'}
            onChange={(period) => setRewardMonitorDraft((prev) => ({ ...prev, period: period as AdminLiveCwRewardMonitorFilters['period'] }))}
            options={REWARD_MONITOR_PERIOD_OPTIONS}
          />
          <SelectField
            label="지급 상태"
            value={rewardMonitorDraft.status ?? ''}
            onChange={(status) => setRewardMonitorDraft((prev) => ({ ...prev, status: status as AdminLiveCwRewardMonitorFilters['status'] }))}
            options={REWARD_MONITOR_STATUS_OPTIONS}
          />
          <TextField
            label="roomId"
            value={rewardMonitorDraft.roomId ?? ''}
            onChange={(roomId) => setRewardMonitorDraft((prev) => ({ ...prev, roomId }))}
            placeholder="방 ID 정확 입력"
          />
          <TextField
            label="rewardTxId"
            value={rewardMonitorDraft.rewardTxId ?? ''}
            onChange={(rewardTxId) => setRewardMonitorDraft((prev) => ({ ...prev, rewardTxId }))}
            placeholder="liveCw:{roomId}:finalReward"
          />
          <NumberField
            label="limit"
            value={rewardMonitorDraft.rewardLimit ?? 50}
            min={10}
            max={200}
            step={10}
            onChange={(rewardLimit) => setRewardMonitorDraft((prev) => ({ ...prev, rewardLimit, coinLogLimit: Math.min(Math.max(rewardLimit * 2, 20), 300) }))}
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRewardMonitorFilters({ ...rewardMonitorDraft })}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            필터 적용
          </button>
          <button
            type="button"
            onClick={() => {
              setRewardMonitorDraft(DEFAULT_REWARD_MONITOR_FILTERS);
              setRewardMonitorFilters(DEFAULT_REWARD_MONITOR_FILTERS);
            }}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            초기화
          </button>
          <span className="text-xs text-zinc-500">
            roomId/rewardTxId는 정확 조회, status는 기간 내 제한 scan으로 필터링합니다.
          </span>
        </div>
        <QueryState isLoading={rewardMonitorQuery.isLoading} error={rewardMonitorQuery.error}>
          {rewardMonitorQuery.data ? (
            <RewardMonitorPanel
              monitor={rewardMonitorQuery.data}
              refreshing={rewardMonitorQuery.isFetching}
              onRefresh={() => void rewardMonitorQuery.refetch()}
              onSelectRoom={(roomId) => {
                setSelectedRoomId(roomId);
                setPatch({});
                setLastAdminAction(null);
              }}
            />
          ) : (
            <InlineMessage kind="info">보상 모니터링 데이터를 불러오는 중입니다.</InlineMessage>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="Firestore Dependency Monitor" description="Redis/Server DB/R2 경로를 타지 못하고 Firestore fallback이 발생한 경로를 집계합니다. 샘플 context는 UID/token 원문 없이 마스킹됩니다.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <NumberField
            label="표시 limit"
            value={firestoreDependencyLimit}
            min={10}
            max={200}
            step={10}
            onChange={(limit) => setFirestoreDependencyLimit(limit)}
          />
          <span className="pb-2 text-xs text-zinc-500">
            30초마다 자동 갱신됩니다. readCount가 큰 path부터 Server DB/Redis/R2로 옮기는 우선순위로 보면 됩니다.
          </span>
        </div>
        <QueryState isLoading={firestoreDependencyQuery.isLoading} error={firestoreDependencyQuery.error}>
          {firestoreDependencyQuery.data ? (
            <FirestoreDependencyPanel
              monitor={firestoreDependencyQuery.data}
              refreshing={firestoreDependencyQuery.isFetching}
              onRefresh={() => void firestoreDependencyQuery.refetch()}
            />
          ) : (
            <InlineMessage kind="info">Firestore dependency telemetry를 불러오는 중입니다.</InlineMessage>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="Live CW Server DB / ROFL Snapshot Monitor" description="Live CW 캐논 방, 상세 스냅샷, ROFL job, R2 archive가 Server DB에 얼마나 쌓이는지 읽기 전용으로 확인합니다.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <NumberField
            label="최근 row limit"
            value={serverDbMonitorLimit}
            min={5}
            max={100}
            step={5}
            onChange={(limit) => setServerDbMonitorLimit(limit)}
          />
          <span className="pb-2 text-xs text-zinc-500">
            30초마다 자동 갱신됩니다. DB를 수정하지 않고 SELECT count/sample만 수행합니다.
          </span>
        </div>
        <QueryState isLoading={serverDbMonitorQuery.isLoading} error={serverDbMonitorQuery.error}>
          {serverDbMonitorQuery.data ? (
            <ServerDbSnapshotMonitorPanel
              monitor={serverDbMonitorQuery.data}
              refreshing={serverDbMonitorQuery.isFetching}
              onRefresh={() => void serverDbMonitorQuery.refetch()}
              onSelectRoom={(roomId) => {
                setSelectedRoomId(roomId);
                setPatch({});
                setLastAdminAction(null);
              }}
            />
          ) : (
            <InlineMessage kind="info">Server DB snapshot monitor 데이터를 불러오는 중입니다.</InlineMessage>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="Live CW User Penalty Monitor" description="유저별 모집중 나가기, 진행중 탈주, 방취소 기록과 현재 시간 제한 상태를 확인합니다.">
        <div className="mb-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_0.8fr]">
          <TextField
            label="uid"
            value={penaltyMonitorDraft.uid ?? ''}
            onChange={(uid) => setPenaltyMonitorDraft((prev) => ({ ...prev, uid }))}
            placeholder="정확한 UID 입력 또는 비워두기"
          />
          <SelectField
            label="action"
            value={penaltyMonitorDraft.action ?? ''}
            onChange={(action) => setPenaltyMonitorDraft((prev) => ({ ...prev, action: action as AdminLiveCwPenaltyMonitorFilters['action'] }))}
            options={PENALTY_ACTION_OPTIONS}
          />
          <SelectField
            label="현재 제한"
            value={String(penaltyMonitorDraft.activeOnly ?? false)}
            onChange={(value) => setPenaltyMonitorDraft((prev) => ({ ...prev, activeOnly: value === 'true' }))}
            options={[
              { value: 'false', label: '전체' },
              { value: 'true', label: '제한 중만' },
            ]}
          />
          <NumberField
            label="user limit"
            value={penaltyMonitorDraft.limit ?? 50}
            min={10}
            max={200}
            step={10}
            onChange={(limit) => setPenaltyMonitorDraft((prev) => ({ ...prev, limit }))}
          />
          <NumberField
            label="log limit"
            value={penaltyMonitorDraft.logLimit ?? 100}
            min={10}
            max={300}
            step={10}
            onChange={(logLimit) => setPenaltyMonitorDraft((prev) => ({ ...prev, logLimit }))}
          />
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPenaltyMonitorFilters({ ...penaltyMonitorDraft })}
            className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600"
          >
            필터 적용
          </button>
          <button
            type="button"
            onClick={() => {
              setPenaltyMonitorDraft(DEFAULT_PENALTY_MONITOR_FILTERS);
              setPenaltyMonitorFilters(DEFAULT_PENALTY_MONITOR_FILTERS);
            }}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={() => void penaltyMonitorQuery.refetch()}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            새로고침
          </button>
          <span className="text-xs text-zinc-500">UID는 관리자 권한 API에서만 조회됩니다. 화면 기본 표시는 마스킹됩니다.</span>
        </div>
        <QueryState isLoading={penaltyMonitorQuery.isLoading} error={penaltyMonitorQuery.error}>
          {penaltyMonitorQuery.data ? (
            <PenaltyMonitorPanel
              monitor={penaltyMonitorQuery.data}
              refreshing={penaltyMonitorQuery.isFetching}
              onSelectRoom={(roomId) => {
                setSelectedRoomId(roomId);
                setPatch({});
                setLastAdminAction(null);
              }}
            />
          ) : (
            <InlineMessage kind="info">패널티 기록을 불러오는 중입니다.</InlineMessage>
          )}
        </QueryState>
      </PageSection>

      <PageSection title="Live CW Rooms" description="모집중, 진행중, 종료 상태를 운영 관점에서 확인합니다.">
        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <StatCell label="Total" value={formatNumber(summary.total)} />
          <StatCell label="ROFL 대기" value={formatNumber(summary.waitingRofl)} tone="text-amber-300" />
          <StatCell label="검토 필요" value={formatNumber(summary.review)} tone="text-red-300" />
          <StatCell label="종료" value={formatNumber(summary.ended)} tone="text-emerald-300" />
        </div>
        <div className="mb-4 grid gap-3 md:grid-cols-5">
          <SelectField label="phase" value={draftFilters.phase ?? ''} onChange={(phase) => setDraftFilters((prev) => ({ ...prev, phase: (phase || undefined) as AdminLiveCwFilters['phase'] }))} options={PHASE_OPTIONS} />
          <SelectField label="status" value={draftFilters.status ?? ''} onChange={(status) => setDraftFilters((prev) => ({ ...prev, status: status || undefined }))} options={STATUS_OPTIONS} />
          <SelectField label="source" value={draftFilters.createdVia ?? ''} onChange={(createdVia) => setDraftFilters((prev) => ({ ...prev, createdVia: createdVia || undefined }))} options={CREATED_VIA_OPTIONS} />
          <NumberField label="limit" value={draftFilters.limit ?? 100} min={1} max={200} onChange={(limit) => setDraftFilters((prev) => ({ ...prev, limit }))} />
          <SelectField
            label="deleted"
            value={draftFilters.includeDeleted ? 'true' : 'false'}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, includeDeleted: value === 'true' }))}
            options={[
              { value: 'false', label: '숨김' },
              { value: 'true', label: '포함' },
            ]}
          />
        </div>
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => setFilters({ ...draftFilters })} className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600">
            적용
          </button>
          <button
            type="button"
            onClick={() => {
              setDraftFilters({ limit: 100 });
              setFilters({ limit: 100 });
            }}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white"
          >
            초기화
          </button>
        </div>
        <QueryState isLoading={roomsQuery.isLoading} error={roomsQuery.error}>
          <DataTable columns={columns} data={rooms} rowKey={(room) => room.roomId} emptyMessage="Live CW 방이 없습니다." />
        </QueryState>
      </PageSection>

      <PageSection title="Room Detail" description={selectedRoomId ? selectedRoomId : '목록에서 방을 선택하세요.'}>
        <QueryState isLoading={detailQuery.isFetching} error={detailQuery.error}>
          {detail ? (
            <RoomDetail
              detail={detail}
              patch={patch}
              setPatch={setPatch}
              updatePending={updateMutation.isPending}
              endPending={endMutation.isPending}
              cancelPending={cancelMutation.isPending}
              deletePending={deleteMutation.isPending}
              rejudgePending={rejudgeMutation.isPending}
              overridePending={overrideMutation.isPending}
              adminReason={adminReason}
              setAdminReason={setAdminReason}
              overrideWinnerTeam={overrideWinnerTeam}
              setOverrideWinnerTeam={setOverrideWinnerTeam}
              lastAdminAction={lastAdminAction}
              archiveReason={archiveReason}
              setArchiveReason={setArchiveReason}
              lastArchiveAction={lastArchiveAction}
              lastArchiveSignedUrl={lastArchiveSignedUrl}
              lastArchiveSummary={lastArchiveSummary}
              onPatch={() => updateMutation.mutate({ roomId: detail.room.roomId, input: patch })}
              onEnd={() => endMutation.mutate(detail.room.roomId)}
              onCancel={() => cancelMutation.mutate(detail.room.roomId)}
              onDelete={() => deleteMutation.mutate(detail.room.roomId)}
              onRejudgeDryRun={() => rejudgeMutation.mutate({ roomId: detail.room.roomId, write: false })}
              onRejudgeWrite={() => confirmAndRun('재판정 요청을 실제로 기록할까요? 보상 회수/재지급은 수행하지 않습니다.', () => rejudgeMutation.mutate({ roomId: detail.room.roomId, write: true }))}
              onOverrideDryRun={() => overrideMutation.mutate({ roomId: detail.room.roomId, write: false })}
              onOverrideWrite={() => confirmAndRun('최종 결과 override 요청을 실제로 기록할까요? finalResult와 지갑은 바로 덮어쓰지 않습니다.', () => overrideMutation.mutate({ roomId: detail.room.roomId, write: true }))}
              reverseReissuePending={reverseReissueMutation.isPending}
              onReverseReissueWrite={() => {
                if (overrideWinnerTeam !== 'BLUE' && overrideWinnerTeam !== 'RED') return;
                confirmAndRun(
                  `정말 보상을 회수하고 ${overrideWinnerTeam} 승리로 재지급할까요? 실제 코인·GP·일일카운터가 변경되며 되돌릴 수 없습니다.`,
                  () => reverseReissueMutation.mutate({ roomId: detail.room.roomId, winnerTeam: overrideWinnerTeam }),
                );
              }}
              onArchiveDryRun={() => archiveMutation.mutate({ roomId: detail.room.roomId, write: false })}
              onArchiveWrite={() => confirmAndRun('Archive this room to R2 now? This writes private R2 objects and archive meta.', () => archiveMutation.mutate({ roomId: detail.room.roomId, write: true }))}
              onArchiveRetryDryRun={() => archiveRetryMutation.mutate({ roomId: detail.room.roomId, write: false })}
              onArchiveRetryWrite={() => confirmAndRun('Retry R2 archive write for this room?', () => archiveRetryMutation.mutate({ roomId: detail.room.roomId, write: true }))}
              onArchiveForceWrite={() => confirmAndRun('Force re-archive this room? This increments archiveVersion and creates replacement archive objects.', () => archiveMutation.mutate({ roomId: detail.room.roomId, write: true, force: true }))}
              onArchiveDownload={(kind) => archiveSignedUrlMutation.mutate({ roomId: detail.room.roomId, kind })}
              onArchiveSummary={(kind) => archiveSummaryMutation.mutate({ roomId: detail.room.roomId, kind })}
              archiveSummaryPending={archiveSummaryMutation.isPending}
            />
          ) : (
            <InlineMessage kind="info">방을 선택하면 결과 초안, ROFL 검증, 최종 결과, 보상, audit log가 표시됩니다.</InlineMessage>
          )}
        </QueryState>
        {[updateMutation, endMutation, cancelMutation, deleteMutation, rejudgeMutation, overrideMutation, reverseReissueMutation, archiveMutation, archiveRetryMutation, archiveSignedUrlMutation, archiveSummaryMutation].map((mutation, index) =>
          mutation.isError ? <InlineMessage key={index} kind="error">{errorToMessage(mutation.error)}</InlineMessage> : null,
        )}
      </PageSection>
    </div>
  );
}

function rewardStatusTone(status: string | null | undefined): Tone {
  if (status === 'ISSUED' || status === 'REISSUED') return 'success';
  if (status === 'LEGACY_IMPORTED') return 'info';
  if (status === 'SKIPPED') return 'warning';
  if (status === 'FAILED' || status === 'ERROR') return 'danger';
  return 'neutral';
}

function rewardWarningTone(severity: string | null | undefined): Tone {
  if (severity === 'danger') return 'danger';
  if (severity === 'warning') return 'warning';
  if (severity === 'info') return 'info';
  return 'neutral';
}

function ledgerReconcileTone(status: string | null | undefined): Tone {
  if (status === 'OK') return 'success';
  if (status === 'WOULD_LEGACY_IMPORT' || status === 'LEGACY_IMPORTED') return 'info';
  if (status === 'WOULD_REPAIR' || status === 'NOT_SUPPORTED_BY_RECONCILER') return 'warning';
  if (status === 'TOTAL_MISMATCH') return 'danger';
  return 'neutral';
}

function isLegacyRewardSummary(row: {
  reason?: string | null;
  serverRewardTxStatus?: string | null;
  status?: string | null;
}): boolean {
  return row.serverRewardTxStatus === 'LEGACY_IMPORTED'
    || row.status === 'LEGACY_IMPORTED'
    || row.status === 'WOULD_LEGACY_IMPORT'
    || row.reason === 'SERVER_DB_LEGACY_SUMMARY_PRESENT_NO_PAYOUT';
}

function LegacyRewardHelp() {
  return (
    <div className="rounded border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs leading-relaxed text-blue-100">
      <p className="font-semibold text-blue-200">과거 지급 기록 / 재지급 없음</p>
      <p className="mt-1 text-blue-100/80">
        Server DB 원장 도입 전에 Firestore 기준으로 이미 처리된 보상입니다. 감사용 summary만 맞춘 상태라 ledger row가 0이어도 정상이며, 지갑/코인/아웃박스는 다시 변경하지 않습니다.
      </p>
    </div>
  );
}

function mirrorOutboxTone(status: string | null | undefined): Tone {
  if (status === 'SENT') return 'success';
  if (status === 'PENDING' || status === 'FAILED') return 'warning';
  if (status === 'DEAD') return 'danger';
  return 'neutral';
}

function mirrorReconcileTone(ok: boolean | undefined): Tone {
  return ok ? 'success' : 'danger';
}

function mirrorCompareTone(compared: boolean | undefined): Tone {
  return compared ? 'info' : 'neutral';
}

function workerHealthTone(status: string | null | undefined): Tone {
  if (status === 'SUCCESS') return 'success';
  if (status === 'TIMEOUT' || status === 'SKIPPED') return 'warning';
  if (status === 'ERROR') return 'danger';
  if (status === 'DISABLED') return 'neutral';
  if (status === 'STARTED') return 'info';
  return 'neutral';
}

function penaltyActionLabel(action: string | null | undefined): string {
  if (action === 'RECRUITING_LEAVE') return '모집중 나가기';
  if (action === 'ACTIVE_DROPOUT') return '진행중 탈주';
  if (action === 'ROOM_CANCEL') return '방취소';
  return action || '-';
}

function penaltyActionTone(action: string | null | undefined): Tone {
  if (action === 'ACTIVE_DROPOUT') return 'danger';
  if (action === 'ROOM_CANCEL') return 'warning';
  if (action === 'RECRUITING_LEAVE') return 'info';
  return 'neutral';
}

function discordMonitorTone(monitor: AdminLiveCwDiscordServerMonitor): Tone {
  if (monitor.botError) return monitor.summary.dbCount > 0 ? 'warning' : 'danger';
  if (monitor.summary.dbOnlyCount > 0 || monitor.summary.botOnlyCount > 0) return 'warning';
  if (monitor.summary.effectiveCount > 0) return 'success';
  return 'neutral';
}

function DiscordServerMonitorPanel({ monitor }: { monitor: AdminLiveCwDiscordServerMonitor }) {
  const serverColumns: Column<AdminLiveCwDiscordServer>[] = [
    {
      key: 'guild',
      header: 'server',
      render: (row) => (
        <div className="flex min-w-[180px] items-center gap-2">
          {row.iconUrl ? <img src={row.iconUrl} alt="" className="h-7 w-7 rounded object-cover" /> : <div className="h-7 w-7 rounded bg-zinc-700" />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">{row.guildName}</p>
            <button type="button" onClick={() => void copyToClipboard(row.guildId)} className="font-mono text-[11px] text-zinc-500 hover:text-zinc-200">
              {short(row.guildId)}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'channel',
      header: 'channels',
      render: (row) => (
        <div className="space-y-0.5 text-xs text-zinc-400">
          <p>bot {short(row.botChannelId)}</p>
          <p>category {short(row.roomCategoryId)}</p>
          <p>rooms {formatNumber(row.provisionedRoomCount ?? 0)} · managed {formatNumber(row.managedRoomCount ?? 0)}</p>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'source',
      render: (row) => <StatusBadge label={row.source ?? 'bot'} tone={row.source ? 'info' : 'success'} />,
    },
    {
      key: 'updated',
      header: 'updated',
      render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.updatedAt ?? row.lastSeenAt ?? null)}</span>,
    },
  ];

  return (
    <div className="grid gap-4">
      {monitor.readiness && (
        <div className={`rounded border px-3 py-2 text-xs leading-relaxed ${
          monitor.readiness.canCreateLiveCwFromDiscord
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
            : 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        }`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              label={monitor.readiness.canCreateLiveCwFromDiscord ? 'Discord Live CW READY' : 'Discord Live CW BLOCKED'}
              tone={monitor.readiness.canCreateLiveCwFromDiscord ? 'success' : 'warning'}
            />
            <span>봇에서 <b>/내전생성</b>, <b>/내전참가</b>를 실행할 수 있는 운영 준비 상태입니다.</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            <StatusBadge label={`bot config ${monitor.readiness.botConfigured ? 'OK' : 'NO'}`} tone={monitor.readiness.botConfigured ? 'success' : 'danger'} />
            <StatusBadge label={`bot live ${monitor.readiness.botReachable ? 'OK' : 'NO'}`} tone={monitor.readiness.botReachable ? 'success' : 'danger'} />
            <StatusBadge label={`server ${monitor.readiness.hasVisibleServer ? 'OK' : 'NO'}`} tone={monitor.readiness.hasVisibleServer ? 'success' : 'danger'} />
            <StatusBadge label={`linked user ${monitor.readiness.hasLinkedDiscordAccount ? 'OK' : 'NO'}`} tone={monitor.readiness.hasLinkedDiscordAccount ? 'success' : 'warning'} />
          </div>
          {monitor.readiness.blockers.length > 0 && (
            <p className="mt-2">blockers: {monitor.readiness.blockers.map((blocker) => <code key={blocker} className="mx-1 rounded bg-black/20 px-1">{blocker}</code>)}</p>
          )}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-7">
        <StatCell label="status" value={monitor.source} tone={discordMonitorTone(monitor) === 'success' ? 'text-emerald-300' : discordMonitorTone(monitor) === 'danger' ? 'text-rose-300' : 'text-amber-300'} />
        <StatCell label="bot configured" value={monitor.botConfigured ? 'YES' : 'NO'} tone={monitor.botConfigured ? 'text-emerald-300' : 'text-amber-300'} />
        <StatCell label="bot live" value={formatNumber(monitor.summary.botCount)} />
        <StatCell label="server db" value={formatNumber(monitor.summary.dbCount)} />
        <StatCell label="effective" value={formatNumber(monitor.summary.effectiveCount)} />
        <StatCell label="linked accounts" value={formatNumber(monitor.summary.linkedDiscordAccounts ?? 0)} tone={(monitor.summary.linkedDiscordAccounts ?? 0) > 0 ? 'text-emerald-300' : 'text-amber-300'} />
        <StatCell label="discord rooms" value={formatNumber(monitor.summary.provisionedRoomCount ?? 0)} />
      </div>

      {(monitor.botError || monitor.summary.dbOnlyCount > 0 || monitor.summary.botOnlyCount > 0) && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          {monitor.botError && <p>bot API error: {monitor.botError}</p>}
          {monitor.summary.dbOnlyCount > 0 && <p>DB only servers: {formatNumber(monitor.summary.dbOnlyCount)}. 봇 live list에 안 보이는 등록 서버입니다.</p>}
          {monitor.summary.botOnlyCount > 0 && <p>Bot only servers: {formatNumber(monitor.summary.botOnlyCount)}. 아직 Server DB에 등록되지 않은 live 서버입니다.</p>}
        </div>
      )}

      {(monitor.summary.linkedDiscordAccounts ?? 0) <= 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
          <p className="font-semibold">디스코드 연동 유저가 아직 없습니다.</p>
          <p>봇 서버 등록은 되어 있어도 유저가 디스코드에서 <b>/연결</b>을 완료하기 전까지 <b>/내전생성</b>, <b>/내전참가</b>는 DISCORD_ACCOUNT_NOT_LINKED로 차단됩니다.</p>
        </div>
      )}

      {monitor.summary.provisionStatusCounts && Object.keys(monitor.summary.provisionStatusCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {Object.entries(monitor.summary.provisionStatusCounts).map(([status, count]) => (
            <span key={status} className="rounded border border-zinc-800 bg-zinc-950/70 px-2 py-1 text-zinc-300">
              {status}: <b className="text-zinc-100">{formatNumber(count)}</b>
            </span>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">effective servers</h3>
        <DataTable
          columns={serverColumns}
          data={monitor.effectiveServers}
          rowKey={(row) => row.guildId}
          emptyMessage="등록된 Live CW 디스코드 서버가 없습니다"
        />
      </div>

      {(monitor.dbOnly.length > 0 || monitor.botOnly.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">DB only</h3>
            <DataTable columns={serverColumns} data={monitor.dbOnly} rowKey={(row) => row.guildId} emptyMessage="DB only 서버 없음" />
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Bot only</h3>
            <DataTable columns={serverColumns} data={monitor.botOnly} rowKey={(row) => row.guildId} emptyMessage="Bot only 서버 없음" />
          </div>
        </div>
      )}

      <p className="text-xs text-zinc-600">generated {formatDateTime(monitor.generatedAt)} · 등록/해제 write는 bot-secret 내부 API만 허용됩니다.</p>
    </div>
  );
}

function firestoreDependencyTone(severity: string | null | undefined): Tone {
  if (severity === 'ERROR') return 'danger';
  if (severity === 'WARN') return 'warning';
  if (severity === 'INFO') return 'info';
  return 'neutral';
}

function FirestoreDependencyPanel({
  monitor,
  refreshing,
  onRefresh,
}: {
  monitor: AdminFirestoreDependencyMonitor;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const topColumns: Column<AdminFirestoreDependencySummaryRow>[] = [
    {
      key: 'path',
      header: 'path',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-100">{row.area}</p>
          <p className="font-mono text-[11px] text-zinc-500">{row.operation}</p>
        </div>
      ),
    },
    { key: 'hits', header: 'hits', render: (row) => <span className="font-semibold text-amber-300">{formatNumber(row.hitCount)}</span> },
    { key: 'reads', header: 'reads', render: (row) => <span className="font-semibold text-rose-300">{formatNumber(row.readCount)}</span> },
    { key: 'last', header: 'last seen', render: (row) => <span className="text-xs">{formatDateTime(row.lastSeenAt)}</span> },
  ];

  const recentColumns: Column<AdminFirestoreDependencyRecentRow>[] = [
    {
      key: 'severity',
      header: 'severity',
      render: (row) => <StatusBadge label={row.severity ?? '-'} tone={firestoreDependencyTone(row.severity)} />,
    },
    {
      key: 'path',
      header: 'path',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-100">{row.area ?? '-'}</p>
          <p className="font-mono text-[11px] text-zinc-500">{row.operation ?? '-'}</p>
          {row.note ? <p className="max-w-lg text-[11px] text-zinc-500">{row.note}</p> : null}
        </div>
      ),
    },
    {
      key: 'counts',
      header: 'counts',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>hits {formatNumber(row.hitCount)}</p>
          <p className="text-zinc-500">reads {formatNumber(row.readCount)}</p>
        </div>
      ),
    },
    {
      key: 'context',
      header: 'sample context',
      render: (row) => (
        <pre className="max-h-28 max-w-md overflow-auto rounded border border-zinc-800 bg-zinc-950/70 p-2 text-[11px] text-zinc-400">
          {renderJson(row.sampleContext)}
        </pre>
      ),
    },
    { key: 'last', header: 'last seen', render: (row) => <span className="text-xs">{formatDateTime(row.lastSeenAt)}</span> },
  ];

  const hasHits = monitor.summary.totalHits > 0 || monitor.summary.totalReads > 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid flex-1 gap-3 md:grid-cols-5">
          <StatCell label="status" value={hasHits ? 'fallback detected' : 'clean'} tone={hasHits ? 'text-amber-300' : 'text-emerald-300'} />
          <StatCell label="paths" value={formatNumber(monitor.summary.rows)} />
          <StatCell label="recent rows" value={formatNumber(monitor.summary.recentRows)} />
          <StatCell label="hits" value={formatNumber(monitor.summary.totalHits)} tone={hasHits ? 'text-amber-300' : 'text-zinc-100'} />
          <StatCell label="est. reads" value={formatNumber(monitor.summary.totalReads)} tone={hasHits ? 'text-rose-300' : 'text-zinc-100'} />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white disabled:opacity-50"
        >
          {refreshing ? '갱신 중' : '새로고침'}
        </button>
      </div>

      {hasHits ? (
        <InlineMessage kind="warning">
          Firestore fallback이 발생했습니다. readCount가 큰 path부터 Server DB/Redis/R2 경로로 옮기는 게 다음 절감 대상입니다.
        </InlineMessage>
      ) : (
        <InlineMessage kind="success">
          현재 집계된 Firestore fallback hit가 없습니다. 기본 Live CW 조회는 Redis/Server DB/R2 경로를 타고 있습니다.
        </InlineMessage>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Top dependency paths</h3>
        <DataTable columns={topColumns} data={monitor.top} rowKey={(row) => `${row.area}:${row.operation}`} emptyMessage="집계된 Firestore fallback이 없습니다." />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent samples</h3>
        <DataTable columns={recentColumns} data={monitor.recent} rowKey={(row) => row.eventKey ?? `${row.area}:${row.operation}:${row.lastSeenAt}`} emptyMessage="최근 Firestore fallback sample이 없습니다." />
      </div>

      <p className="text-xs text-zinc-600">generated {formatDateTime(monitor.generatedAt)} · 샘플 context는 UID/PUUID/email/token 원문 없이 저장됩니다.</p>
    </div>
  );
}

function ServerDbSnapshotMonitorPanel({
  monitor,
  refreshing,
  onRefresh,
  onSelectRoom,
}: {
  monitor: AdminLiveCwServerDbMonitor;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectRoom: (roomId: string) => void;
}) {
  const canonicalReady = (monitor.summary.canonicalRooms ?? 0) > 0 || (monitor.summary.roomIndex ?? 0) > 0;
  const roflReady = (monitor.summary.roflJobs ?? 0) > 0 || (monitor.summary.roflMatches ?? 0) > 0;

  const roomColumns: Column<AdminLiveCwServerDbMonitorRoom>[] = [
    {
      key: 'room',
      header: 'Room',
      render: (row) => (
        <div className="space-y-1">
          <button
            type="button"
            disabled={!row.roomId}
            onClick={() => row.roomId && onSelectRoom(row.roomId)}
            className="font-mono text-xs text-cyan-300 hover:text-cyan-100 disabled:text-zinc-500"
          >
            {row.roomId ?? '-'}
          </button>
          <p className="max-w-[18rem] truncate text-xs text-zinc-400">{row.title ?? '-'}</p>
          <p className="font-mono text-[11px] text-zinc-600">{row.matchRecordId ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge label={row.phase ?? 'phase?'} tone="neutral" />
          <StatusBadge label={row.status ?? 'status?'} tone={row.phase === 'ended' ? 'success' : row.phase === 'active' ? 'info' : 'neutral'} />
          {row.testMode && <StatusBadge label="TEST" tone="info" />}
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Result',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <p>{formatNumber(row.participantCount)} / {formatNumber(row.capacity)}명</p>
          <p className="text-zinc-400">draft {row.resultDraftStatus ?? '-'}</p>
          <p className="text-zinc-400">verify {row.verificationStatus ?? '-'}</p>
          <p className="text-zinc-400">final {row.finalResultSource ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Source',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <StatusBadge label={row.canonicalSource ?? 'unknown'} tone={row.canonicalSource === 'server_db_primary' ? 'success' : 'warning'} />
          <p className="text-zinc-500">{row.mirrorStatus ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => (
        <div className="space-y-1 text-xs text-zinc-400">
          <p>{formatDateTime(row.updatedAt)}</p>
          <p className="text-zinc-600">indexed {formatDateTime(row.indexedAt)}</p>
        </div>
      ),
    },
  ];

  const roflColumns: Column<AdminLiveCwServerDbMonitorRoflJob>[] = [
    {
      key: 'job',
      header: 'ROFL Job',
      render: (row) => (
        <div className="space-y-1">
          <p className="font-mono text-xs text-zinc-100">{row.jobId ?? '-'}</p>
          <button
            type="button"
            disabled={!row.roomId}
            onClick={() => row.roomId && onSelectRoom(row.roomId)}
            className="font-mono text-[11px] text-cyan-300 hover:text-cyan-100 disabled:text-zinc-500"
          >
            {row.roomId ?? '-'}
          </button>
          <p className="font-mono text-[11px] text-zinc-600">{row.matchRecordId ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge label={row.status ?? 'UNKNOWN'} tone={row.status === 'COMPLETED' || row.status === 'DONE' ? 'success' : row.status === 'FAILED' ? 'danger' : 'neutral'} />
          <StatusBadge label={row.storageMode ?? 'storage?'} tone={row.storageMode === 'private' ? 'success' : 'warning'} />
        </div>
      ),
    },
    {
      key: 'file',
      header: 'File',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <p>{formatNumber(row.fileSize)} bytes</p>
          <p className={row.localInputDeletedAt ? 'text-emerald-300' : 'text-amber-300'}>
            local input {row.localInputDeletedAt ? 'deleted' : 'retained/unknown'}
          </p>
          <p className="text-zinc-500">attempts {formatNumber(row.attempts)}</p>
        </div>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => (
        <div className="space-y-1 text-xs text-zinc-400">
          <p>{formatDateTime(row.updatedAt)}</p>
          <p className="text-zinc-600">finished {formatDateTime(row.finishedAt)}</p>
        </div>
      ),
    },
  ];

  const archiveColumns: Column<AdminLiveCwServerDbMonitorArchive>[] = [
    {
      key: 'archive',
      header: 'Archive',
      render: (row) => (
        <div className="space-y-1">
          <button
            type="button"
            disabled={!row.roomId}
            onClick={() => row.roomId && onSelectRoom(row.roomId)}
            className="font-mono text-xs text-cyan-300 hover:text-cyan-100 disabled:text-zinc-500"
          >
            {row.roomId ?? '-'}
          </button>
          <p className="font-mono text-[11px] text-zinc-600">{row.matchRecordId ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <StatusBadge label={row.archiveStatus ?? 'UNKNOWN'} tone={row.archiveStatus === 'ARCHIVED' ? 'success' : 'warning'} />
          <StatusBadge label={`v${formatNumber(row.archiveVersion)}`} tone="neutral" />
        </div>
      ),
    },
    {
      key: 'objects',
      header: 'Private objects',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <p className="font-mono text-zinc-400">{short(row.r2ObjectKey)}</p>
          <p className="font-mono text-zinc-500">{short(row.r2ResultObjectKey)}</p>
        </div>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      render: (row) => (
        <div className="space-y-1 text-xs text-zinc-400">
          <p>{formatDateTime(row.updatedAt)}</p>
          <p className="text-zinc-600">archived {formatDateTime(row.archivedAt)}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid flex-1 gap-3 md:grid-cols-5">
          <StatCell label="canonical rooms" value={formatNumber(monitor.summary.canonicalRooms ?? 0)} tone={canonicalReady ? 'text-emerald-300' : 'text-amber-300'} />
          <StatCell label="participants" value={formatNumber(monitor.summary.canonicalParticipants ?? 0)} />
          <StatCell label="snapshots" value={formatNumber(monitor.summary.detailSnapshots ?? 0)} />
          <StatCell label="ROFL jobs" value={formatNumber(monitor.summary.roflJobs ?? 0)} tone={roflReady ? 'text-emerald-300' : 'text-zinc-100'} />
          <StatCell label="archives" value={formatNumber(monitor.summary.archiveMetas ?? 0)} tone={(monitor.summary.archiveMetas ?? 0) > 0 ? 'text-emerald-300' : 'text-zinc-100'} />
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:text-white disabled:opacity-50"
        >
          {refreshing ? '갱신 중' : '새로고침'}
        </button>
      </div>

      {!canonicalReady ? (
        <InlineMessage kind="warning">
          이 서버 DB에는 아직 Live CW canonical/index row가 없습니다. 새 방 생성/스냅샷 rebuild/운영 데이터 복사 상태를 먼저 확인하세요.
        </InlineMessage>
      ) : (
        <InlineMessage kind="success">
          Live CW canonical/index row가 Server DB에서 읽히고 있습니다. 이 패널은 Firestore를 읽지 않습니다.
        </InlineMessage>
      )}

      <MatchEvidenceMonitorPanel monitor={monitor} />

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="room breakdown">
          <JsonBlock value={monitor.breakdowns.roomsByPhase} />
          <JsonBlock value={monitor.breakdowns.roomsByStatus} />
        </Panel>
        <Panel title="ROFL breakdown">
          <JsonBlock value={monitor.breakdowns.roflJobsByStatus} />
        </Panel>
        <Panel title="archive / mutation">
          <JsonBlock value={{ archive: monitor.breakdowns.archiveByStatus, mutation: monitor.breakdowns.mutationByStatus }} />
        </Panel>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent canonical rooms</h3>
        <DataTable columns={roomColumns} data={monitor.recentRooms} rowKey={(row) => row.roomId ?? row.matchRecordId ?? '-'} emptyMessage="최근 canonical room이 없습니다." />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent ROFL jobs</h3>
        <DataTable columns={roflColumns} data={monitor.recentRoflJobs} rowKey={(row) => row.jobId ?? row.matchRecordId ?? '-'} emptyMessage="최근 ROFL job이 없습니다." />
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent R2 archives</h3>
        <DataTable columns={archiveColumns} data={monitor.recentArchives} rowKey={(row) => row.roomId ?? row.matchRecordId ?? row.r2ObjectKey ?? '-'} emptyMessage="최근 R2 archive meta가 없습니다." />
      </div>

      <p className="text-xs text-zinc-600">generated {formatDateTime(monitor.generatedAt)} · readOnly={String(monitor.readOnly)} · private R2 URL은 표시하지 않습니다.</p>
    </div>
  );
}

function MatchEvidenceMonitorPanel({ monitor }: { monitor: AdminLiveCwServerDbMonitor }) {
  const evidence = monitor.matchEvidence;
  if (!evidence) return null;
  const latest = evidence.latestNonTestHistory ?? evidence.latestHistory;
  return (
    <Panel title="Live CW Match Evidence Monitor">
      <div className="grid gap-3 md:grid-cols-4">
        <StatCell
          label="non-TEST history"
          value={formatNumber(evidence.nonTestHistoryCount)}
          tone={evidence.strictProductionCheckReady ? 'text-emerald-300' : 'text-amber-300'}
        />
        <StatCell label="ROFL participants" value={formatNumber(evidence.nonTestRoflParticipantCount)} />
        <StatCell label="canonical participants" value={formatNumber(evidence.nonTestCanonicalParticipantCount)} />
        <StatCell label="R2 archives" value={formatNumber(evidence.nonTestArchiveCount)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge
          label={evidence.strictProductionCheckReady ? 'strict smoke ready' : 'strict smoke 대기'}
          tone={evidence.strictProductionCheckReady ? 'success' : 'warning'}
        />
        <StatusBadge label={evidence.strictProductionCheckReason} tone={evidence.strictProductionCheckReady ? 'success' : 'warning'} />
        <StatusBadge label="Server DB/R2/cache only" tone="info" />
      </div>
      {evidence.strictProductionCheckReady ? (
        <InlineMessage kind="success">
          비TEST 완료 전적이 있어 운영 strict 검증을 실행할 수 있습니다. 아래 smoke 명령으로 실제 전적 조회 경로를 확인하세요.
        </InlineMessage>
      ) : (
        <InlineMessage kind="warning">
          아직 비TEST 완료 Live CW 전적이 없습니다. 실제 방 1개가 종료된 뒤 이 패널이 strict smoke ready로 바뀌어야 합니다.
        </InlineMessage>
      )}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">latest evidence</p>
          {latest ? (
            <div className="mt-2 space-y-1 text-xs text-zinc-300">
              <p><span className="text-zinc-500">uid</span> <span className="font-mono">{latest.uidMasked ?? '-'}</span></p>
              <p><span className="text-zinc-500">room</span> <span className="font-mono">{latest.roomId ?? '-'}</span></p>
              <p><span className="text-zinc-500">match</span> <span className="font-mono">{latest.matchRecordId ?? '-'}</span></p>
              <p><span className="text-zinc-500">source</span> {latest.source ?? '-'}</p>
              <p><span className="text-zinc-500">finalized</span> {formatDateTime(latest.finalizedAt)}</p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-zinc-500">아직 match history evidence가 없습니다.</p>
          )}
        </div>
        <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">strict check command</p>
          <p className="mt-2 break-all font-mono text-xs text-cyan-200">{evidence.smokeCommand}</p>
          <p className="mt-2 text-xs text-zinc-500">{evidence.note}</p>
          <div className="mt-3 space-y-1 text-xs text-zinc-500">
            <p>1. 실제 Live CW 방 1개를 종료까지 진행</p>
            <p>2. 이 패널의 non-TEST history 증가 확인</p>
            <p>3. strict 명령 실행 후 Firestore fallback/readCount 0 확인</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PenaltyMonitorPanel({
  monitor,
  refreshing,
  onSelectRoom,
}: {
  monitor: AdminLiveCwPenaltyMonitor;
  refreshing: boolean;
  onSelectRoom: (roomId: string) => void;
}) {
  const userColumns: Column<AdminLiveCwPenaltyUser>[] = [
    {
      key: 'uid',
      header: 'User',
      render: (row) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-zinc-100">{row.uidMasked}</span>
            {row.uid ? <CopyButton value={row.uid} label="UID" /> : null}
          </div>
          <p className="font-mono text-[11px] text-zinc-500">hash {row.uidHash ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'counts',
      header: '기록',
      render: (row) => (
        <div className="grid min-w-[220px] grid-cols-3 gap-1 text-center text-xs">
          <div className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1">
            <p className="text-zinc-500">모집 나감</p>
            <p className="font-semibold text-sky-200">{formatNumber(row.recruitingLeaveCount)}</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1">
            <p className="text-zinc-500">탈주</p>
            <p className="font-semibold text-rose-200">{formatNumber(row.activeDropoutCount)}</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1">
            <p className="text-zinc-500">방취소</p>
            <p className="font-semibold text-amber-200">{formatNumber(row.roomCancelCount)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'penalty',
      header: '현재 제한',
      render: (row) => (
        <div className="space-y-1">
          <StatusBadge label={row.currentPenaltyActive ? 'ACTIVE' : 'CLEAR'} tone={row.currentPenaltyActive ? 'danger' : 'success'} />
          <p className="text-xs text-zinc-300">{formatRemainingSeconds(row.currentPenaltyRemainingSeconds)}</p>
          <p className="text-[11px] text-zinc-500">until {formatDateTime(row.currentPenaltyUntilAt)}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: '누적 제한',
      render: (row) => <span className="font-semibold text-zinc-100">{formatNumber(row.totalPenaltyMinutes)}분</span>,
    },
    {
      key: 'activeRoom',
      header: '참여 중인 방',
      render: (row) =>
        row.activeRoom?.roomId ? (
          <button
            type="button"
            onClick={() => onSelectRoom(row.activeRoom?.roomId ?? '')}
            className="text-left font-mono text-xs text-violet-300 hover:text-violet-200"
          >
            {short(row.activeRoom.roomId)}
            <span className="block text-[11px] text-zinc-500">{row.activeRoom.status ?? '-'}</span>
          </button>
        ) : (
          <span className="text-xs text-zinc-500">-</span>
        ),
    },
    {
      key: 'recentLogs',
      header: '최근 로그',
      render: (row) => (
        <div className="max-w-[320px] space-y-1">
          {row.recentLogs.length > 0 ? row.recentLogs.slice(0, 3).map((log) => (
            <div key={log.penaltyId ?? `${log.action}-${log.createdAt}`} className="flex items-center gap-2 text-xs">
              <StatusBadge label={penaltyActionLabel(log.action)} tone={penaltyActionTone(log.action)} />
              <span className="text-zinc-400">{formatNumber(log.penaltyMinutes)}분</span>
              <span className="truncate text-zinc-500">{formatDateTime(log.createdAt)}</span>
            </div>
          )) : <span className="text-xs text-zinc-500">최근 로그 없음</span>}
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'updated',
      render: (row) => <span className="text-xs text-zinc-400">{formatDateTime(row.updatedAt)}</span>,
    },
  ];

  const logColumns: Column<AdminLiveCwPenaltyLog>[] = [
    {
      key: 'createdAt',
      header: 'created',
      render: (row) => <span className="text-xs text-zinc-400">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'uid',
      header: 'User',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-zinc-100">{row.uidMasked}</span>
          {row.uid ? <CopyButton value={row.uid} label="UID" /> : null}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'action',
      render: (row) => <StatusBadge label={penaltyActionLabel(row.action)} tone={penaltyActionTone(row.action)} />,
    },
    {
      key: 'penalty',
      header: 'penalty',
      render: (row) => (
        <div className="text-xs">
          <p className="font-semibold text-zinc-100">{formatNumber(row.penaltyMinutes)}분</p>
          <p className="text-zinc-500">{row.active ? '제한 중' : '만료/없음'}</p>
        </div>
      ),
    },
    {
      key: 'roomId',
      header: 'room',
      render: (row) =>
        row.roomId ? (
          <button type="button" onClick={() => onSelectRoom(row.roomId ?? '')} className="font-mono text-xs text-violet-300 hover:text-violet-200">
            {short(row.roomId)}
          </button>
        ) : <span className="text-xs text-zinc-500">-</span>,
    },
    {
      key: 'reason',
      header: 'reason',
      render: (row) => <span className="text-xs text-zinc-300">{row.reason ?? '-'}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-3">
          <StatCell label="users" value={formatNumber(monitor.summary.usersRead)} />
          <StatCell label="active penalties" value={formatNumber(monitor.summary.activePenaltyUsers)} tone="text-rose-300" />
          <StatCell label="recruit leaves" value={formatNumber(monitor.summary.totalRecruitingLeaves)} tone="text-sky-300" />
          <StatCell label="dropouts" value={formatNumber(monitor.summary.totalActiveDropouts)} tone="text-rose-300" />
          <StatCell label="room cancels" value={formatNumber(monitor.summary.totalRoomCancels)} tone="text-amber-300" />
          <StatCell label="total minutes" value={`${formatNumber(monitor.summary.totalPenaltyMinutes)}분`} />
        </div>
        <span className="text-xs text-zinc-500">
          {refreshing ? 'refreshing...' : 'idle'} · generated {formatDateTime(monitor.generatedAt)}
        </span>
      </div>

      <div className="rounded border border-zinc-800">
        <div className="border-b border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-200">유저별 패널티 현황</div>
        <DataTable columns={userColumns} data={monitor.users} rowKey={(row) => row.uid ?? row.uidHash ?? row.uidMasked} emptyMessage="패널티 누적 유저가 없습니다." />
      </div>

      <div className="rounded border border-zinc-800">
        <div className="border-b border-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-200">최근 penalty logs</div>
        <DataTable columns={logColumns} data={monitor.recentLogs} rowKey={(row) => row.penaltyId ?? `${row.uid}-${row.action}-${row.createdAt}`} emptyMessage="최근 penalty log가 없습니다." />
      </div>
    </div>
  );
}

function RewardMonitorPanel({
  monitor,
  refreshing,
  onRefresh,
  onSelectRoom,
}: {
  monitor: AdminLiveCwRewardMonitor;
  refreshing: boolean;
  onRefresh: () => void;
  onSelectRoom: (roomId: string) => void;
}) {
  const rewardColumns: Column<AdminLiveCwRewardMonitorTx>[] = [
    {
      key: 'status',
      header: 'status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge label={row.status} tone={rewardStatusTone(row.status)} />
          {isLegacyRewardSummary(row) ? (
            <>
              <StatusBadge label="과거 지급 기록" tone="info" />
              <StatusBadge label="재지급 없음" tone="success" />
            </>
          ) : null}
          {row.serverRewardTxStatus ? (
            <StatusBadge label={`summary ${row.serverRewardTxStatus}`} tone={rewardStatusTone(row.serverRewardTxStatus)} />
          ) : null}
          {row.serverLedgerStatus ? (
            <StatusBadge label={`ledger ${row.serverLedgerStatus}`} tone={ledgerReconcileTone(row.serverLedgerStatus)} />
          ) : null}
          {row.serverLedgerStatus === 'WOULD_LEGACY_IMPORT' ? (
            <StatusBadge label="summary only / no payout" tone="info" />
          ) : null}
          {row.safeTestReward && <StatusBadge label="TEST" tone="info" />}
          {row.skipped && <span className="text-[11px] text-amber-300">{row.reason ?? 'skipped'}</span>}
          {isLegacyRewardSummary(row) ? <span className="text-[11px] text-blue-300">이미 지급된 과거 Firestore 기록입니다.</span> : null}
        </div>
      ),
    },
    {
      key: 'room',
      header: 'room',
      render: (row) => (
        <button
          type="button"
          className="text-left font-mono text-xs text-violet-300 hover:text-violet-200"
          onClick={() => row.roomId && onSelectRoom(row.roomId)}
        >
          <span className="block">{short(row.roomId ?? '-')}</span>
          <span className="block text-zinc-500">{short(row.matchRecordId ?? '-')}</span>
        </button>
      ),
    },
    { key: 'source', header: 'source', render: (row) => <span className="text-xs">{row.finalizeSource ?? '-'}</span> },
    {
      key: 'coin',
      header: 'coin',
      render: (row) => (
        <div className="text-xs">
          <p className="font-semibold text-emerald-300">{formatNumber(row.totalCoin)}</p>
          <p className="text-zinc-500">max {formatNumber(row.expectedMaxCoin)}</p>
        </div>
      ),
    },
    { key: 'gp', header: 'GP', render: (row) => formatNumber(row.gpTotal) },
    { key: 'count', header: 'rewards', render: (row) => `${formatNumber(row.rewardCount)}명` },
    { key: 'created', header: 'created', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
  ];

  const roomColumns: Column<AdminLiveCwRewardMonitorAggregate>[] = [
    {
      key: 'room',
      header: 'room',
      render: (row) => (
        <button
          type="button"
          className="font-mono text-xs text-violet-300 hover:text-violet-200"
          onClick={() => row.roomId && onSelectRoom(row.roomId)}
        >
          {short(row.roomId ?? '-')}
        </button>
      ),
    },
    { key: 'coin', header: 'coin', render: (row) => <span className="font-semibold text-emerald-300">{formatNumber(row.totalCoin)}</span> },
    { key: 'gp', header: 'GP', render: (row) => formatNumber(row.gpTotal) },
    { key: 'tx', header: 'tx', render: (row) => `${formatNumber(row.transactionCount)}건` },
    { key: 'state', header: 'state', render: (row) => `${formatNumber(row.issuedCount)} issued / ${formatNumber(row.skippedCount)} skipped` },
  ];

  const userColumns: Column<AdminLiveCwRewardMonitorAggregate>[] = [
    { key: 'uid', header: 'uid', render: (row) => <span className="font-mono text-xs">{shortId(row.uid)}</span> },
    { key: 'coin', header: 'coin', render: (row) => <span className="font-semibold text-emerald-300">{formatNumber(row.totalCoin)}</span> },
    { key: 'logs', header: 'logs', render: (row) => `${formatNumber(row.logCount)}건` },
    {
      key: 'room',
      header: 'latest room',
      render: (row) => (
        <button
          type="button"
          className="font-mono text-xs text-violet-300 hover:text-violet-200"
          onClick={() => row.latestRoomId && onSelectRoom(row.latestRoomId)}
        >
          {short(row.latestRoomId ?? '-')}
        </button>
      ),
    },
    { key: 'latest', header: 'latest', render: (row) => <span className="text-xs">{formatDateTime(row.latestCreatedAt)}</span> },
  ];

  const coinLogColumns: Column<AdminLiveCwCoinLog>[] = [
    { key: 'amount', header: 'amount', render: (row) => <span className="font-semibold text-emerald-300">{formatNumber(row.amount)}</span> },
    { key: 'uid', header: 'uid', render: (row) => <span className="font-mono text-xs">{shortId(row.uid)}</span> },
    {
      key: 'room',
      header: 'room',
      render: (row) => (
        <button
          type="button"
          className="font-mono text-xs text-violet-300 hover:text-violet-200"
          onClick={() => row.roomId && onSelectRoom(row.roomId)}
        >
          {short(row.roomId ?? '-')}
        </button>
      ),
    },
    { key: 'rewardTxId', header: 'rewardTxId', render: (row) => <span className="font-mono text-xs">{short(row.rewardTxId ?? '-')}</span> },
    { key: 'created', header: 'created', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
  ];

  const writeReasons = Object.entries(monitor.worker.write.reasonCounts ?? {});
  const dryRunReasons = Object.entries(monitor.worker.dryRun.reasonCounts ?? {});
  const rewardReconcileWorker = monitor.worker.rewardReconcileDryRun;
  const rewardReconcileReasons = Object.entries(rewardReconcileWorker?.reasonCounts ?? {});
  const rewardReconcileDispositions = Object.entries(rewardReconcileWorker?.dispositionCounts ?? {});
  const rewardReconcileManualReasons = Object.entries(rewardReconcileWorker?.manualReviewCounts ?? {});
  const warnings = monitor.warnings ?? [];
  const ledgerReconcile = monitor.ledgerReconcile;
  const legacyLedgerItems = (ledgerReconcile?.items ?? []).filter((item) => isLegacyRewardSummary(item));
  const legacyRewardTransactions = monitor.rewardTransactions.filter((item) => isLegacyRewardSummary(item));
  const warningCounts = monitor.summary.warningCounts ?? {};
  const warningThresholds = monitor.warningThresholds ?? {};
  const dangerWarnings = warningCounts.danger ?? 0;
  const targetedRoomId = monitor.filters?.roomId?.trim() ?? '';
  const targetedRewardTxId = monitor.filters?.rewardTxId?.trim() ?? '';
  const isSingleRoomMode = targetedRoomId.length > 0 || targetedRewardTxId.length > 0;
  const latestWriteWorker = recordOf(monitor.worker.recentWrite?.[0]);
  const writeWorkerMode = stringOf(latestWriteWorker.mode) ?? '-';
  const writeWorkerDryRun = latestWriteWorker.dryRun === true || writeWorkerMode === 'dry-run';
  const writeWorkerAllowBulk = latestWriteWorker.allowBulkWrite === true;
  const writeWorkerCutoff = stringOf(latestWriteWorker.minSubmittedAt);
  const writeWorkerInterval = typeof latestWriteWorker.intervalSeconds === 'number' ? latestWriteWorker.intervalSeconds : null;
  const writeWorkerChecked = typeof latestWriteWorker.checked === 'number' ? latestWriteWorker.checked : null;
  const writeWorkerFinalized = typeof latestWriteWorker.finalized === 'number' ? latestWriteWorker.finalized : null;
  const writeWorkerSkipped = typeof latestWriteWorker.skipped === 'number' ? latestWriteWorker.skipped : null;
  const writeWorkerMaxLimit = typeof latestWriteWorker.maxBulkWriteLimit === 'number' ? latestWriteWorker.maxBulkWriteLimit : null;
  const writeWorkerBlockedBulk = latestWriteWorker.blockedBulkWrite === true;
  const writeWorkerSource = stringOf(latestWriteWorker.source) ?? '-';
  const writeWorkerBudgetStatus = stringOf(latestWriteWorker.budgetStatus);
  const writeWorkerCandidatePosture =
    writeWorkerChecked === 0
      ? 'candidate 0'
      : writeWorkerFinalized && writeWorkerFinalized > 0
        ? `${formatNumber(writeWorkerFinalized)} finalized`
        : writeWorkerSkipped && writeWorkerSkipped > 0
          ? `${formatNumber(writeWorkerSkipped)} skipped`
          : 'candidate unknown';
  const writeWorkerSafetyOk =
    writeWorkerMode === 'write' &&
    writeWorkerAllowBulk &&
    Boolean(writeWorkerCutoff) &&
    writeWorkerSource === 'server-db' &&
    typeof writeWorkerMaxLimit === 'number' &&
    writeWorkerMaxLimit <= 5 &&
    !writeWorkerBlockedBulk;
  const serverDbWorkerHealth = monitor.worker.serverDbHealth ?? [];
  const firstOperationChecks = [
    {
      label: 'danger warnings',
      ok: dangerWarnings === 0,
      value: `${formatNumber(dangerWarnings)} danger`,
    },
    {
      label: 'reward transaction visibility',
      ok: monitor.summary.rewardTransactionsRead > 0,
      value: `${formatNumber(monitor.summary.rewardTransactionsRead)} tx`,
    },
    {
      label: 'qlCoin log visibility',
      ok: monitor.summary.coinLogsRead > 0,
      value: `${formatNumber(monitor.summary.coinLogsRead)} logs`,
    },
    {
      label: 'write worker log visibility',
      ok: monitor.worker.write.entries > 0,
      value: `${formatNumber(monitor.worker.write.entries)} entries`,
    },
    {
      label: 'dry-run worker log visibility',
      ok: monitor.worker.dryRun.entries > 0,
      value: `${formatNumber(monitor.worker.dryRun.entries)} entries`,
    },
  ];
  const warningColumns: Column<AdminLiveCwRewardMonitorWarning>[] = [
    {
      key: 'severity',
      header: 'severity',
      render: (row) => <StatusBadge label={row.severity} tone={rewardWarningTone(row.severity)} />,
    },
    {
      key: 'code',
      header: 'code',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-100">{row.code}</p>
          <p className="max-w-lg text-xs text-zinc-500">{row.message}</p>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'target',
      render: (row) => (
        <div className="grid gap-0.5 font-mono text-[11px] text-zinc-400">
          <button
            type="button"
            disabled={!row.roomId}
            className="text-left text-violet-300 hover:text-violet-200 disabled:cursor-not-allowed disabled:text-zinc-600"
            onClick={() => row.roomId && onSelectRoom(row.roomId)}
          >
            room {short(row.roomId ?? '-')}
          </button>
          <span>tx {short(row.rewardTxId ?? '-')}</span>
          {row.uid ? <span>uid {short(row.uid)}</span> : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'amount',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>amount {formatNumber(row.amount)}</p>
          <p className="text-zinc-500">expected {formatNumber(row.expectedAmount)}</p>
          {typeof row.count === 'number' ? <p className="text-zinc-500">count {formatNumber(row.count)}</p> : null}
        </div>
      ),
    },
    { key: 'created', header: 'created', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
  ];
  const ledgerColumns: Column<AdminLiveCwRewardLedgerReconcileItem>[] = [
    {
      key: 'status',
      header: 'ledger',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge label={row.status} tone={ledgerReconcileTone(row.status)} />
          {isLegacyRewardSummary(row) ? (
            <>
              <StatusBadge label="legacy summary" tone="info" />
              <StatusBadge label="no payout" tone="success" />
            </>
          ) : null}
          {row.status === 'WOULD_LEGACY_IMPORT' ? (
            <StatusBadge label="summary import ready" tone="info" />
          ) : null}
          {row.recommendedDisposition === 'MANUAL_REVIEW_BEFORE_ANY_TARGETED_WRITE' ? (
            <StatusBadge label="manual review before write" tone="warning" />
          ) : null}
          <span className="text-[11px] text-zinc-500">{row.reason}</span>
          {row.manualReviewReason ? <span className="text-[11px] text-amber-300">{row.manualReviewReason}</span> : null}
          {isLegacyRewardSummary(row) ? <span className="text-[11px] text-blue-300">ledger row 0 정상</span> : null}
        </div>
      ),
    },
    {
      key: 'room',
      header: 'room',
      render: (row) => (
        <button
          type="button"
          className="text-left font-mono text-xs text-violet-300 hover:text-violet-200"
          onClick={() => row.roomId && onSelectRoom(row.roomId)}
        >
          <span className="block">{short(row.roomId ?? '-')}</span>
          <span className="block text-zinc-500">{short(row.rewardTxId ?? '-')}</span>
        </button>
      ),
    },
    { key: 'firestore', header: 'firestore', render: (row) => <StatusBadge label={row.firestoreStatus} tone={rewardStatusTone(row.firestoreStatus)} /> },
    {
      key: 'rows',
      header: 'rows',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>{formatNumber(row.existingLedgerRows)} / {formatNumber(row.expectedLedgerRows)}</p>
          <p className="text-zinc-500">summary {row.serverRewardTxExists ? 'yes' : 'no'}</p>
          {isLegacyRewardSummary(row) ? <p className="text-blue-300">과거 지급은 summary만 보존</p> : null}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'amount',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>DB {formatNumber(row.serverRewardTxTotalAmount)}</p>
          <p className="text-zinc-500">FS {formatNumber(row.firestoreTotalCoin)}</p>
        </div>
      ),
    },
    { key: 'created', header: 'created', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
  ];
  const qlapMirror = monitor.qlapCoinMirror;
  const qlapMirrorOutboxRows = qlapMirror?.outbox.recentLegacy ?? qlapMirror?.outbox.recent ?? [];
  const qlapMirrorLatestOutboxReports = qlapMirror?.r2Reports.latestLegacyOutbox ?? qlapMirror?.r2Reports.latestOutbox ?? [];
  const qlapMirrorLatestReconcileReports = qlapMirror?.r2Reports.latestLegacyReconcile ?? qlapMirror?.r2Reports.latestReconcile ?? [];
  const qlapMirrorDryRunWorker = qlapMirror?.worker?.legacyDryRun ?? qlapMirror?.worker?.dryRun;
  const qlapMirrorWriteWorker = qlapMirror?.worker?.legacyWrite ?? qlapMirror?.worker?.write;
  const workerHealthColumns: Column<AdminLiveCwWorkerHealthSnapshot>[] = [
    {
      key: 'worker',
      header: 'worker',
      render: (row) => (
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-100">{row.worker}</p>
          <p className="text-[11px] text-zinc-500">{row.mode ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge label={row.status} tone={workerHealthTone(row.status)} />
          {row.budgetStatus ? <StatusBadge label={`budget ${row.budgetStatus}`} tone={row.budgetStatus === 'OK' ? 'success' : 'warning'} /> : null}
        </div>
      ),
    },
    {
      key: 'runs',
      header: 'runs',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>run {formatNumber(row.runCount)} / ok {formatNumber(row.successCount)}</p>
          <p className="text-zinc-500">err {formatNumber(row.errorCount)} · timeout {formatNumber(row.timeoutCount)} · skip {formatNumber(row.skippedCount)}</p>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'time',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>{formatNumber(row.durationMs)}ms</p>
          <p className="text-zinc-500">limit {formatNumber(row.cycleTimeoutMs)}ms</p>
        </div>
      ),
    },
    {
      key: 'last',
      header: 'last',
      render: (row) => (
        <div className="text-xs text-zinc-400">
          <p>{formatDateTime(row.updatedAt)}</p>
          {row.lastSuccessAt ? <p className="text-emerald-300">ok {formatDateTime(row.lastSuccessAt)}</p> : null}
          {row.lastErrorAt ? <p className="text-red-300">err {formatDateTime(row.lastErrorAt)}</p> : null}
          {row.lastTimeoutAt ? <p className="text-amber-300">timeout {formatDateTime(row.lastTimeoutAt)}</p> : null}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'reason',
      render: (row) => (
        <div className="max-w-md text-xs text-zinc-400">
          <p>{row.reason ?? row.error ?? '-'}</p>
          {row.consecutiveFailures > 0 ? <p className="text-amber-300">consecutive failures {formatNumber(row.consecutiveFailures)}</p> : null}
        </div>
      ),
    },
  ];
  const mirrorFirestoreCompared = qlapMirror?.reconcile.firestoreCompared === true;
  const mirrorOutboxColumns: Column<AdminQlapCoinMirrorOutboxRow>[] = [
    {
      key: 'status',
      header: 'status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge label={row.status ?? '-'} tone={mirrorOutboxTone(row.status)} />
          <span className="text-[11px] text-zinc-500">attempts {formatNumber(row.attempts)}</span>
        </div>
      ),
    },
    {
      key: 'target',
      header: 'target',
      render: (row) => (
        <div className="grid gap-0.5 font-mono text-[11px] text-zinc-400">
          <span>{short(row.targetPath ?? '-')}</span>
          <span>{row.aggregateType ?? '-'}</span>
        </div>
      ),
    },
    { key: 'op', header: 'op', render: (row) => <span className="text-xs">{row.op ?? '-'}</span> },
    { key: 'version', header: 'version', render: (row) => formatNumber(row.walletVersion) },
    { key: 'source', header: 'source', render: (row) => <span className="font-mono text-xs">{short(row.sourceIdHash ?? '-')}</span> },
    { key: 'created', header: 'created', render: (row) => <span className="text-xs">{formatDateTime(row.createdAt)}</span> },
  ];
  const mirrorSampleColumns: Column<AdminQlapCoinMirrorReconcileSample>[] = [
    { key: 'status', header: 'status', render: (row) => <StatusBadge label={row.status} tone={row.status.includes('MISMATCH') || row.status.includes('MISSING') ? 'danger' : 'warning'} /> },
    { key: 'uid', header: 'uid', render: (row) => <span className="font-mono text-xs">{row.maskedUid}</span> },
    {
      key: 'balance',
      header: 'balance',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>DB {formatNumber(row.serverBalance)}</p>
          <p className="text-zinc-500">ledger {formatNumber(row.ledgerSum)}</p>
          <p className="text-zinc-500">FS {formatNumber(row.firestoreQlapcoin)}</p>
        </div>
      ),
    },
    {
      key: 'version',
      header: 'version',
      render: (row) => (
        <div className="text-xs text-zinc-300">
          <p>DB {formatNumber(row.serverWalletVersion)}</p>
          <p className="text-zinc-500">FS {formatNumber(row.firestoreWalletVersion)}</p>
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-zinc-500">
          generated {formatDateTime(monitor.generatedAt)} · 30초 자동 갱신 {refreshing ? '중' : '대기'}
        </div>
        <button type="button" onClick={onRefresh} className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800">
          새로고침
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCell label="reward tx" value={formatNumber(monitor.summary.rewardTransactionsRead)} />
        <StatCell label="coin logs" value={formatNumber(monitor.summary.coinLogsRead)} />
        <StatCell label="recent coin" value={formatNumber(monitor.summary.totalCoinRecent)} tone="text-emerald-300" />
        <StatCell label="qlCoin logs total" value={formatNumber(monitor.summary.coinLogTotalRecent)} tone="text-cyan-300" />
        <StatCell label="GP" value={formatNumber(monitor.summary.gpTotalRecent)} tone="text-violet-300" />
        <StatCell label="ledger repair" value={formatNumber(ledgerReconcile?.wouldRepair ?? 0)} tone={(ledgerReconcile?.wouldRepair ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300'} />
        <StatCell label="legacy import" value={formatNumber(ledgerReconcile?.wouldLegacyImport ?? 0)} tone={(ledgerReconcile?.wouldLegacyImport ?? 0) > 0 ? 'text-blue-300' : 'text-zinc-300'} />
        <StatCell label="warnings" value={`${formatNumber(warnings.length)} (${formatNumber(warningCounts.danger ?? 0)} danger)`} tone={warnings.some((warning) => warning.severity === 'danger') ? 'text-red-300' : warnings.length > 0 ? 'text-amber-300' : 'text-emerald-300'} />
      </div>

      <Panel title="auto-finalize write worker state">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={writeWorkerSafetyOk ? 'write worker guarded' : 'write worker check'} tone={writeWorkerSafetyOk ? 'success' : 'warning'} />
          <StatusBadge label={`current ${writeWorkerMode}`} tone={writeWorkerDryRun ? 'success' : 'warning'} />
          <StatusBadge label={`bulk ${writeWorkerAllowBulk ? 'enabled' : 'disabled'}`} tone={writeWorkerAllowBulk ? 'warning' : 'success'} />
          <StatusBadge label={`source ${writeWorkerSource}`} tone={writeWorkerSource === 'server-db' ? 'success' : 'danger'} />
          <StatusBadge label={`interval ${writeWorkerInterval ? `${writeWorkerInterval}s` : '-'}`} tone="neutral" />
          <StatusBadge label={`max ${formatNumber(writeWorkerMaxLimit)}`} tone={writeWorkerMaxLimit && writeWorkerMaxLimit <= 5 ? 'success' : 'warning'} />
          <StatusBadge label={`checked ${formatNumber(writeWorkerChecked)}`} tone="neutral" />
          <StatusBadge label={writeWorkerCandidatePosture} tone={writeWorkerFinalized && writeWorkerFinalized > 0 && !writeWorkerDryRun ? 'warning' : writeWorkerChecked === 0 ? 'success' : 'neutral'} />
          {writeWorkerBudgetStatus ? <StatusBadge label={`budget ${writeWorkerBudgetStatus}`} tone={writeWorkerBudgetStatus === 'OK' ? 'success' : 'warning'} /> : null}
          {writeWorkerBlockedBulk ? <StatusBadge label="blocked bulk" tone="danger" /> : null}
        </div>
        {writeWorkerMode === 'write' && writeWorkerAllowBulk ? (
          <p className="mt-2 text-xs text-amber-200">
            운영 write worker가 켜져 있습니다. 최근 로그 기준으로 cutoff, max limit, server-db source가 함께 표시될 때만 안전한 상태입니다. 후보가 0이면 이번 cycle에서 확정/지급한 방이 없습니다.
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            PM2 process name includes "write" because the production write profile is prepared. The effective mode is taken from the latest worker log. When this shows current dry-run and bulk disabled, it is not finalizing rooms or issuing rewards.
          </p>
        )}
        {writeWorkerCutoff ? (
          <p className="mt-1 font-mono text-[11px] text-zinc-500">minSubmittedAt cutoff {writeWorkerCutoff}</p>
        ) : (
          <p className="mt-1 text-xs text-amber-300">No cutoff was found in the latest worker log. Do not enable bulk write without a cutoff.</p>
        )}
        {!writeWorkerSafetyOk && writeWorkerMode === 'write' ? (
          <p className="mt-1 text-xs text-red-300">
            Write worker safety posture is incomplete. Check source, cutoff, max bulk limit, and blockedBulkWrite before trusting automatic payouts.
          </p>
        ) : null}
      </Panel>

      <Panel title="Server DB worker health">
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusBadge label={`${formatNumber(serverDbWorkerHealth.length)} snapshots`} tone={serverDbWorkerHealth.length > 0 ? 'success' : 'warning'} />
          <StatusBadge label="source Server DB admin_settings" tone="info" />
          <StatusBadge label="PM2 log fallback still shown below" tone="neutral" />
        </div>
        <DataTable
          columns={workerHealthColumns}
          data={serverDbWorkerHealth}
          rowKey={(row) => row.worker}
          emptyMessage="아직 Server DB worker health snapshot이 없습니다. 워커 재시작 후 한 cycle이 돌면 표시됩니다."
        />
        <p className="mt-2 text-xs text-zinc-500">
          이 패널은 워커가 직접 Server DB에 남긴 마지막 실행 상태입니다. 기존 PM2 로그 파싱보다 안정적인 운영 확인용이며, 보상/방 데이터는 변경하지 않습니다.
        </p>
      </Panel>

      <Panel title="reward anomaly warnings">
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusBadge label={`danger ${formatNumber(warningCounts.danger ?? 0)}`} tone="danger" />
          <StatusBadge label={`warning ${formatNumber(warningCounts.warning ?? 0)}`} tone="warning" />
          <StatusBadge label={`info ${formatNumber(warningCounts.info ?? 0)}`} tone="info" />
          <StatusBadge label={`ISSUED / SKIPPED ${formatNumber(monitor.summary.statusCounts.ISSUED ?? 0)} / ${formatNumber(monitor.summary.statusCounts.SKIPPED ?? 0)}`} tone="neutral" />
          <StatusBadge label={`repeat threshold ${formatNumber(warningThresholds.repeatRewardLogs ?? 0)}`} tone="neutral" />
          <StatusBadge label={`max recipients ${formatNumber(warningThresholds.maxRewardRecipients ?? 0)}`} tone="neutral" />
        </div>
        <DataTable columns={warningColumns} data={warnings.slice(0, 12)} rowKey={(row) => row.warningId} emptyMessage="No reward anomaly warnings in the current filter." />
        <p className="mt-2 text-xs text-zinc-500">
          Warnings are computed from the current bounded monitor result. They do not write data or change rewards.
        </p>
      </Panel>

      <Panel title="Server DB ledger reconcile">
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusBadge label={`checked ${formatNumber(ledgerReconcile?.checked ?? 0)}`} tone="neutral" />
          <StatusBadge label={`OK ${formatNumber(ledgerReconcile?.ok ?? 0)}`} tone="success" />
          <StatusBadge label={`would repair ${formatNumber(ledgerReconcile?.wouldRepair ?? 0)}`} tone={(ledgerReconcile?.wouldRepair ?? 0) > 0 ? 'warning' : 'neutral'} />
          <StatusBadge label={`legacy import ${formatNumber(ledgerReconcile?.wouldLegacyImport ?? 0)}`} tone={(ledgerReconcile?.wouldLegacyImport ?? 0) > 0 ? 'info' : 'neutral'} />
          <StatusBadge label={`mismatch ${formatNumber(ledgerReconcile?.totalMismatch ?? 0)}`} tone={(ledgerReconcile?.totalMismatch ?? 0) > 0 ? 'danger' : 'neutral'} />
          <StatusBadge label={`not supported ${formatNumber(ledgerReconcile?.notSupported ?? 0)}`} tone="warning" />
          <StatusBadge label={`legacy imported ${formatNumber(legacyRewardTransactions.length || legacyLedgerItems.length)}`} tone={(legacyRewardTransactions.length || legacyLedgerItems.length) > 0 ? 'info' : 'neutral'} />
        </div>
        {legacyLedgerItems.length > 0 || legacyRewardTransactions.length > 0 ? <div className="mb-3"><LegacyRewardHelp /></div> : null}
        <DataTable
          columns={ledgerColumns}
          data={(ledgerReconcile?.items ?? []).slice(0, 12)}
          rowKey={(row) => row.rewardTxId}
          emptyMessage="Current result window has no Server DB ledger repair candidates."
        />
        <p className="mt-2 text-xs text-zinc-500">
          This panel compares the visible reward transactions with the local Server DB ledger. It is read-only; actual repair still requires a targeted reconciler CLI command.
        </p>
      </Panel>

      <Panel title="QLapCoin Server DB ledger / legacy evidence">
        {qlapMirror ? (
          <div className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              <StatCell label="outbox total" value={formatNumber(qlapMirror.outbox.stats.total)} />
              <StatCell label="pending" value={formatNumber(qlapMirror.outbox.stats.pending)} tone={qlapMirror.outbox.stats.pending > 0 ? 'text-amber-300' : 'text-emerald-300'} />
              <StatCell label="sent" value={formatNumber(qlapMirror.outbox.stats.sent)} tone="text-emerald-300" />
              <StatCell label="failed" value={formatNumber(qlapMirror.outbox.stats.failed)} tone={qlapMirror.outbox.stats.failed > 0 ? 'text-amber-300' : 'text-emerald-300'} />
              <StatCell label="dead" value={formatNumber(qlapMirror.outbox.stats.dead)} tone={qlapMirror.outbox.stats.dead > 0 ? 'text-red-300' : 'text-emerald-300'} />
              <StatCell label="reconcile" value={qlapMirror.reconcile.ok ? 'OK' : 'CHECK'} tone={qlapMirror.reconcile.ok ? 'text-emerald-300' : 'text-red-300'} />
              <StatCell label="checked" value={formatNumber(qlapMirror.reconcile.checked)} />
              <StatCell
                label="legacy FS mismatch"
                value={mirrorFirestoreCompared ? formatNumber(qlapMirror.reconcile.firestoreMismatches + qlapMirror.reconcile.firestoreMissing + qlapMirror.reconcile.firestoreInvalid) : 'skipped'}
                tone={mirrorFirestoreCompared && (qlapMirror.reconcile.firestoreMismatches + qlapMirror.reconcile.firestoreMissing + qlapMirror.reconcile.firestoreInvalid) > 0 ? 'text-red-300' : 'text-zinc-400'}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={qlapMirror.status === 'RETIRED' ? 'mirror retired' : 'mirror legacy'} tone={qlapMirror.status === 'RETIRED' ? 'neutral' : 'warning'} />
              <StatusBadge label={qlapMirror.sourceOfTruth === 'SERVER_DB_LEDGER_WALLET' ? 'Server DB canonical' : 'source check'} tone={qlapMirror.sourceOfTruth === 'SERVER_DB_LEDGER_WALLET' ? 'success' : 'warning'} />
              <StatusBadge label={`mirror ${qlapMirror.reconcile.ok ? 'OK' : 'CHECK'}`} tone={mirrorReconcileTone(qlapMirror.reconcile.ok)} />
              <StatusBadge label={mirrorFirestoreCompared ? 'legacy Firestore compare ON' : 'legacy Firestore compare OFF'} tone={mirrorCompareTone(mirrorFirestoreCompared)} />
              <StatusBadge label={`DB total ${formatNumber(qlapMirror.reconcile.serverBalanceTotal)}`} tone="neutral" />
              <StatusBadge label={`ledger ${formatNumber(qlapMirror.reconcile.ledgerSumTotal)}`} tone="neutral" />
              <StatusBadge label={mirrorFirestoreCompared ? `legacy FS ${formatNumber(qlapMirror.reconcile.firestoreQlapcoinTotal)}` : 'Firestore reads 0'} tone="neutral" />
              <StatusBadge label={mirrorFirestoreCompared ? `version missing ${formatNumber(qlapMirror.reconcile.mirrorVersionMissing)}` : 'version check skipped'} tone={mirrorFirestoreCompared ? 'warning' : 'neutral'} />
              <StatusBadge label={qlapMirror.r2Reports.available ? 'R2 reports available' : 'R2 unavailable'} tone={qlapMirror.r2Reports.available ? 'success' : 'warning'} />
            </div>
            {!mirrorFirestoreCompared ? (
              <p className="rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                QLapCoin Firestore mirror workers are retired. Server DB ledger/wallet data is the source of truth; old outbox/R2 rows are displayed only as legacy audit evidence.
              </p>
            ) : null}
            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">legacy outbox rows</p>
                <DataTable columns={mirrorOutboxColumns} data={qlapMirrorOutboxRows.slice(0, 10)} rowKey={(row) => String(row.outboxId)} emptyMessage="No legacy mirror outbox rows." />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">legacy reconcile samples</p>
                <DataTable columns={mirrorSampleColumns} data={qlapMirror.reconcile.samples.slice(0, 10)} rowKey={(row) => `${row.maskedUid}-${row.status}-${row.serverBalance ?? '-'}-${row.firestoreQlapcoin ?? '-'}`} emptyMessage="No mirror reconcile issues." />
              </div>
            </div>
            <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
              <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                <p className="font-semibold text-zinc-300">legacy outbox R2 reports</p>
                {qlapMirrorLatestOutboxReports.slice(0, 3).map((key) => (
                  <p key={key} className="font-mono text-[11px] text-zinc-500">{short(key)}</p>
                ))}
                {qlapMirrorLatestOutboxReports.length === 0 ? <p className="text-zinc-600">-</p> : null}
              </div>
              <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                <p className="font-semibold text-zinc-300">legacy reconcile R2 reports</p>
                {qlapMirrorLatestReconcileReports.slice(0, 3).map((key) => (
                  <p key={key} className="font-mono text-[11px] text-zinc-500">{short(key)}</p>
                ))}
                {qlapMirrorLatestReconcileReports.length === 0 ? <p className="text-zinc-600">-</p> : null}
              </div>
            </div>
            {qlapMirror.worker ? (
              <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
                <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-300">legacy dry-run worker</p>
                    <StatusBadge label={qlapMirror.worker.status === 'RETIRED' ? 'retired' : `${formatNumber(qlapMirrorDryRunWorker?.entries ?? 0)} logs`} tone="neutral" />
                  </div>
                  <JsonBlock value={qlapMirrorDryRunWorker?.latest ?? null} />
                </div>
                <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-zinc-300">legacy write worker</p>
                    <StatusBadge label={qlapMirror.worker.status === 'RETIRED' ? 'retired' : `${formatNumber(qlapMirrorWriteWorker?.entries ?? 0)} logs`} tone="neutral" />
                  </div>
                  <JsonBlock value={qlapMirrorWriteWorker?.latest ?? null} />
                </div>
              </div>
            ) : null}
            <p className="text-xs text-zinc-500">
              This panel is read-only. QLapCoin Firestore mirror writes are retired; current balances and reward evidence are checked from Server DB ledger/wallet data.
            </p>
          </div>
        ) : (
          <InlineMessage kind="warning">QLapCoin mirror monitor data is not included in this API response yet.</InlineMessage>
        )}
      </Panel>

      <Panel title="first live operation checklist">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          {firstOperationChecks.map((item) => (
            <div key={item.label} className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
              <StatusBadge label={item.ok ? 'OK' : 'CHECK'} tone={item.ok ? 'success' : 'warning'} />
              <p className="mt-2 text-[11px] uppercase tracking-wide text-zinc-500">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-zinc-200">{item.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-500">
          First operation flow: resultDraft, finalResult, reward tx, qlCoinLogs, R2 archive, cache hit/miss, and room detail should be checked before widening write worker scope.
        </p>
      </Panel>

      <Panel title="single room rehearsal guide">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={isSingleRoomMode ? 'single-room filter active' : 'set roomId first'} tone={isSingleRoomMode ? 'success' : 'warning'} />
          <StatusBadge label={`roomId ${targetedRoomId ? short(targetedRoomId) : '-'}`} tone="neutral" />
          <StatusBadge label={`rewardTxId ${targetedRewardTxId ? short(targetedRewardTxId) : '-'}`} tone="neutral" />
          <StatusBadge label="bulk write not required" tone="info" />
        </div>
        <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
          <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
            <p className="font-semibold text-zinc-300">Before write</p>
            <p>1. Filter this monitor by the exact roomId.</p>
            <p>2. Check danger warnings are 0.</p>
            <p>3. Run targeted auto-finalize dry-run for the same roomId.</p>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
            <p className="font-semibold text-zinc-300">After single-room write</p>
            <p>1. Confirm one reward tx or skipped reward entry.</p>
            <p>2. Confirm qlCoinLogs and wallet changes match the room.</p>
            <p>3. Open the room detail and verify finalResult, archive, cache, audit logs.</p>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Use targeted roomId writes only for rehearsal. Do not widen the PM2 write worker scope until this panel, room detail, and gateway/API logs are clean.
        </p>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="최근 liveCwRewardTransactions">
          <DataTable columns={rewardColumns} data={monitor.rewardTransactions.slice(0, 12)} rowKey={(row) => row.rewardTxId} emptyMessage="최근 보상 트랜잭션이 없습니다." />
        </Panel>
        <Panel title="최근 qlCoinLogs">
          <DataTable columns={coinLogColumns} data={monitor.coinLogs.slice(0, 12)} rowKey={(row) => row.logId} emptyMessage="최근 Live CW 코인 로그가 없습니다." />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="방별 최근 총 지급량">
          <DataTable columns={roomColumns} data={monitor.byRoom.slice(0, 10)} rowKey={(row) => String(row.roomId ?? row.matchRecordId ?? '-')} emptyMessage="방별 지급 집계가 없습니다." />
        </Panel>
        <Panel title="유저별 최근 지급량">
          <DataTable columns={userColumns} data={monitor.byUser.slice(0, 10)} rowKey={(row) => String(row.uid ?? '-')} emptyMessage="유저별 지급 집계가 없습니다." />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="write worker 요약">
          <div className="grid gap-2 text-sm text-zinc-300">
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="checked" value={formatNumber(monitor.worker.write.checked)} />
              <StatCell label="finalized" value={formatNumber(monitor.worker.write.finalized)} tone="text-emerald-300" />
              <StatCell label="skipped" value={formatNumber(monitor.worker.write.skipped)} tone="text-amber-300" />
            </div>
            <div className="flex flex-wrap gap-1">
              {writeReasons.length === 0 ? <span className="text-xs text-zinc-500">skip reason 없음</span> : writeReasons.map(([reason, count]) => (
                <StatusBadge key={reason} label={`${reason} ${count}`} tone={reason === 'FINALIZED' ? 'success' : 'neutral'} />
              ))}
            </div>
            <JsonBlock value={monitor.worker.write.latest} />
          </div>
        </Panel>
        <Panel title="dry-run worker 요약">
          <div className="grid gap-2 text-sm text-zinc-300">
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="checked" value={formatNumber(monitor.worker.dryRun.checked)} />
              <StatCell label="eligible" value={formatNumber(monitor.worker.dryRun.finalized)} tone="text-cyan-300" />
              <StatCell label="skipped" value={formatNumber(monitor.worker.dryRun.skipped)} tone="text-amber-300" />
            </div>
            <div className="flex flex-wrap gap-1">
              {dryRunReasons.length === 0 ? <span className="text-xs text-zinc-500">skip reason 없음</span> : dryRunReasons.map(([reason, count]) => (
                <StatusBadge key={reason} label={`${reason} ${count}`} tone={reason === 'DRY_RUN_ELIGIBLE' ? 'warning' : 'neutral'} />
              ))}
            </div>
            <JsonBlock value={monitor.worker.dryRun.latest} />
          </div>
        </Panel>
        <Panel title="reward reconcile worker">
          <div className="grid gap-2 text-sm text-zinc-300">
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="checked" value={formatNumber(rewardReconcileWorker?.checked ?? 0)} />
              <StatCell label="would repair" value={formatNumber(rewardReconcileWorker?.wouldRepair ?? 0)} tone={(rewardReconcileWorker?.wouldRepair ?? 0) > 0 ? 'text-amber-300' : 'text-emerald-300'} />
              <StatCell label="failed" value={formatNumber(rewardReconcileWorker?.failed ?? 0)} tone={(rewardReconcileWorker?.failed ?? 0) > 0 ? 'text-red-300' : 'text-emerald-300'} />
            </div>
            <div className="flex flex-wrap gap-1">
              {rewardReconcileReasons.length === 0 ? <span className="text-xs text-zinc-500">reconcile reason 없음</span> : rewardReconcileReasons.map(([reason, count]) => (
                <StatusBadge key={reason} label={`${reason} ${count}`} tone={reason === 'SERVER_DB_LEDGER_PRESENT' ? 'success' : reason.includes('MISSING') ? 'warning' : 'neutral'} />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              <StatusBadge label={`legacy import ${formatNumber(rewardReconcileWorker?.wouldLegacyImport ?? 0)}`} tone={(rewardReconcileWorker?.wouldLegacyImport ?? 0) > 0 ? 'info' : 'neutral'} />
              {(rewardReconcileWorker?.wouldRepair ?? 0) > 0 ? <StatusBadge label="do not bulk write" tone="danger" /> : null}
            </div>
            {rewardReconcileDispositions.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {rewardReconcileDispositions.map(([disposition, count]) => (
                  <StatusBadge
                    key={disposition}
                    label={`${disposition} ${count}`}
                    tone={disposition.includes('DO_NOT_WRITE') ? 'danger' : disposition.includes('SUMMARY_ONLY') ? 'info' : disposition.includes('MANUAL') ? 'warning' : 'neutral'}
                  />
                ))}
              </div>
            ) : null}
            {rewardReconcileManualReasons.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {rewardReconcileManualReasons.map(([reason, count]) => (
                  <StatusBadge key={reason} label={`${reason} ${count}`} tone={reason.includes('MISSING') ? 'warning' : 'neutral'} />
                ))}
              </div>
            ) : null}
            {(rewardReconcileWorker?.wouldRepair ?? 0) > 0 ? (
              <p className="text-xs text-amber-200">
                Would-repair rows can mutate Server DB wallets. Run reward-repair-audit first and use targeted writes only after manual approval.
              </p>
            ) : null}
            <JsonBlock value={rewardReconcileWorker?.latest ?? null} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RoomDetail({
  detail,
  patch,
  setPatch,
  updatePending,
  endPending,
  cancelPending,
  deletePending,
  rejudgePending,
  overridePending,
  adminReason,
  setAdminReason,
  overrideWinnerTeam,
  setOverrideWinnerTeam,
  lastAdminAction,
  archiveReason,
  setArchiveReason,
  lastArchiveAction,
  lastArchiveSignedUrl,
  lastArchiveSummary,
  onPatch,
  onEnd,
  onCancel,
  onDelete,
  onRejudgeDryRun,
  onRejudgeWrite,
  onOverrideDryRun,
  onOverrideWrite,
  reverseReissuePending,
  onReverseReissueWrite,
  onArchiveDryRun,
  onArchiveWrite,
  onArchiveRetryDryRun,
  onArchiveRetryWrite,
  onArchiveForceWrite,
  onArchiveDownload,
  onArchiveSummary,
  archiveSummaryPending,
}: {
  detail: AdminLiveCwDetail;
  patch: AdminLiveCwPatch;
  setPatch: (patch: AdminLiveCwPatch) => void;
  updatePending: boolean;
  endPending: boolean;
  cancelPending: boolean;
  deletePending: boolean;
  rejudgePending: boolean;
  overridePending: boolean;
  adminReason: string;
  setAdminReason: (value: string) => void;
  overrideWinnerTeam: 'BLUE' | 'RED' | '';
  setOverrideWinnerTeam: (value: 'BLUE' | 'RED' | '') => void;
  lastAdminAction: AdminLiveCwAdminActionResult | null;
  archiveReason: string;
  setArchiveReason: (value: string) => void;
  lastArchiveAction: Record<string, unknown> | null;
  lastArchiveSignedUrl: Record<string, unknown> | null;
  lastArchiveSummary: AdminLiveCwArchiveSummary | null;
  onPatch: () => void;
  onEnd: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onRejudgeDryRun: () => void;
  onRejudgeWrite: () => void;
  onOverrideDryRun: () => void;
  onOverrideWrite: () => void;
  reverseReissuePending: boolean;
  onReverseReissueWrite: () => void;
  onArchiveDryRun: () => void;
  onArchiveWrite: () => void;
  onArchiveRetryDryRun: () => void;
  onArchiveRetryWrite: () => void;
  onArchiveForceWrite: () => void;
  onArchiveDownload: (kind: 'room' | 'audit' | 'result') => void;
  onArchiveSummary: (kind: 'room' | 'audit' | 'result') => void;
  archiveSummaryPending: boolean;
}) {
  const match = detail.match;
  const blue = detail.participants.filter((participant) => participant.team === 'BLUE');
  const red = detail.participants.filter((participant) => participant.team === 'RED');
  const unassigned = detail.participants.filter((participant) => participant.team !== 'BLUE' && participant.team !== 'RED');
  const verificationStatus = match?.verification?.status ?? '-';
  const rewardIssued = match?.reward?.rewardIssued ?? false;
  const rewardSkipped = match?.reward?.skipped ?? false;
  const archiveStatus = typeof detail.archiveMeta?.archiveStatus === 'string' ? detail.archiveMeta.archiveStatus : '-';
  const rewardTransaction = recordOf(detail.rewardTransaction);
  const rewardTransactionStatus = stringOf(rewardTransaction.status) ?? '-';
  const safeTestReward = boolOf(rewardTransaction.safeTestReward);
  const rewardEvidenceStage = stringOf(rewardTransaction.evidenceStage) ?? (rewardTransaction.evidenceBeforeFinalize || rewardTransaction.evidenceAfterFinalize ? 'STRUCTURED' : 'LEGACY');
  const rejudgeHistory = Array.isArray(match?.rejudgeHistory) ? match.rejudgeHistory.map(recordOf) : [];
  const overrideHistory = Array.isArray(match?.adminOverrideHistory) ? match.adminOverrideHistory.map(recordOf) : [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid gap-4">
        <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium text-zinc-100">{detail.room.title}</p>
              <p className="font-mono text-xs text-zinc-500">
                {detail.room.roomId} <CopyButton value={detail.room.roomId} label="roomId 복사" />
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={detail.room.status} tone={statusTone(detail.room.status)} />
              <StatusBadge label={detail.room.createdVia ?? 'web'} tone={liveCwCreatedViaTone(detail.room.createdVia)} />
              <StatusBadge label={`verification ${verificationStatus}`} tone={verificationTone(verificationStatus)} />
              <StatusBadge label={rewardIssued ? 'reward issued' : rewardSkipped ? 'reward skipped' : 'reward pending'} tone={rewardTone(rewardIssued, rewardSkipped)} />
              <StatusBadge label={`archive ${archiveStatus}`} tone={archiveTone(archiveStatus)} />
            </div>
          </div>
          <div className="grid gap-2 text-xs text-zinc-400 md:grid-cols-3">
            <Info label="phase" value={detail.room.phase ?? '-'} />
            <Info label="createdVia" value={detail.room.createdVia ?? 'web'} />
            <Info label="match" value={<>{detail.room.matchRecordId} <CopyButton value={detail.room.matchRecordId} label="matchRecordId 복사" /></>} mono />
            <Info label="owner" value={short(detail.room.ownerUid)} mono />
            <Info label="players" value={`${detail.room.participantCount}/${detail.room.capacity}`} />
            <Info label="discordGuildId" value={detail.room.discordGuildId ? short(detail.room.discordGuildId) : '-'} mono />
            <Info label="discordProvision" value={detail.room.discordProvisionStatus ?? '-'} />
            <Info label="created" value={formatDateTime(detail.room.createdAt)} />
            <Info label="updated" value={formatDateTime(detail.room.updatedAt)} />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <TextField label="방 제목" value={patch.title ?? detail.room.title} onChange={(title) => setPatch({ ...patch, title })} />
          <SelectField label="상태" value={patch.status ?? detail.room.status} onChange={(status) => setPatch({ ...patch, status })} options={STATUS_OPTIONS.filter((option) => option.value)} />
          <TextAreaField label="관리자 메모" value={patch.adminNote ?? detail.room.adminNote ?? ''} onChange={(adminNote) => setPatch({ ...patch, adminNote })} rows={2} />
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton disabled={updatePending} onClick={() => confirmAndRun('방 정보를 저장할까요?', onPatch)}>
            저장
          </ActionButton>
          <ActionButton disabled={endPending} tone="neutral" onClick={() => confirmAndRun('방을 관리자 종료 처리할까요?', onEnd)}>
            종료
          </ActionButton>
          <ActionButton disabled={cancelPending} tone="danger" onClick={() => confirmAndRun('방을 취소 처리할까요?', onCancel)}>
            취소
          </ActionButton>
          <ActionButton disabled={deletePending} tone="danger" onClick={() => confirmAndRun('방을 soft-delete 처리할까요?', onDelete)}>
            삭제
          </ActionButton>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="resultDraft">
            <Info label="winnerTeam" value={match?.resultDraft?.winnerTeam ?? '-'} />
            <Info label="score" value={`${match?.resultDraft?.blueScore ?? '-'} : ${match?.resultDraft?.redScore ?? '-'}`} />
            <Info label="submittedAt" value={formatDateTime(match?.resultDraft?.submittedAt)} />
            <Info label="roflDeadlineAt" value={formatDateTime(match?.resultDraft?.roflDeadlineAt)} />
            <Info label="status" value={match?.resultDraft?.status ?? '-'} />
          </Panel>
          <Panel title="verification">
            <Info label="status" value={match?.verification?.status ?? '-'} />
            <Info label="source" value={match?.verification?.source ?? '-'} />
            <Info label="checkedAt" value={formatDateTime(match?.verification?.checkedAt)} />
            <Info label="mismatchFlags" value={(match?.verification?.mismatchFlags ?? []).join(', ') || '-'} />
            <JsonBlock value={match?.verification?.nicknameMismatchCandidates ?? []} />
          </Panel>
          <Panel title="finalResult">
            <Info label="source" value={match?.finalResult?.source ?? '-'} />
            <Info label="winnerTeam" value={match?.finalResult?.winnerTeam ?? '-'} />
            <Info label="confirmedAt" value={formatDateTime(match?.finalResult?.confirmedAt)} />
            <Info label="confirmedBy" value={short(match?.finalResult?.confirmedBy)} mono />
            <Info label="rewardTxId" value={short(match?.finalResult?.rewardTxId)} mono />
          </Panel>
          <Panel title="reward">
            <Info label="rewardIssued" value={String(match?.reward?.rewardIssued ?? false)} />
            <Info label="skipped" value={String(match?.reward?.skipped ?? false)} />
            <Info label="rewardTxId" value={short(match?.reward?.rewardTxId)} mono />
            <JsonBlock value={match?.reward?.rewards ?? []} />
          </Panel>
        </div>

        <Panel title="liveCwRewardTransactions">
          <div className="mb-2 flex flex-wrap gap-2">
            <StatusBadge label={rewardTransactionStatus} tone={rewardStatusTone(rewardTransactionStatus)} />
            {rewardTransactionStatus === 'LEGACY_IMPORTED' ? (
              <>
                <StatusBadge label="과거 지급 기록" tone="info" />
                <StatusBadge label="재지급 없음" tone="success" />
              </>
            ) : null}
            {safeTestReward ? <StatusBadge label="TEST reward" tone="accent" /> : <StatusBadge label="production policy" tone="neutral" />}
            <StatusBadge label={`evidence ${rewardEvidenceStage}`} tone={rewardEvidenceStage === 'LEGACY' ? 'warning' : 'info'} />
          </div>
          {rewardTransactionStatus === 'LEGACY_IMPORTED' ? <div className="mb-3"><LegacyRewardHelp /></div> : null}
          {rewardEvidenceStage === 'LEGACY' && (
            <InlineMessage kind="info">legacy evidence입니다. 기존 문서라 pre-finalize 상태가 섞여 보일 수 있습니다.</InlineMessage>
          )}
          {rewardTransaction.evidenceBeforeFinalize || rewardTransaction.evidenceAfterFinalize ? (
            <div className="grid gap-2 lg:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-zinc-300">evidenceBeforeFinalize</p>
                <JsonBlock value={rewardTransaction.evidenceBeforeFinalize ?? null} />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-zinc-300">evidenceAfterFinalize</p>
                <JsonBlock value={rewardTransaction.evidenceAfterFinalize ?? null} />
              </div>
            </div>
          ) : null}
          <JsonBlock value={detail.rewardTransaction ?? null} />
        </Panel>

        <ServerDbInspectionPanel inspection={detail.serverDb} />

        <Panel title="R2 Archive">
          <Info label="archiveStatus" value={<StatusBadge label={archiveStatus} tone={archiveTone(archiveStatus)} />} />
          <Info label="archivedAt" value={formatDateTime(detail.archiveMeta?.archivedAt as string | undefined)} />
          <Info label="archiveReason" value={String(detail.archiveMeta?.archiveReason ?? '-')} />
          <Info label="r2ObjectKey" value={<>{short(detail.archiveMeta?.r2ObjectKey as string | undefined)} <CopyButton value={detail.archiveMeta?.r2ObjectKey as string | undefined} label="room object key 복사" /></>} mono />
          <Info label="r2AuditObjectKey" value={<>{short(detail.archiveMeta?.r2AuditObjectKey as string | undefined)} <CopyButton value={detail.archiveMeta?.r2AuditObjectKey as string | undefined} label="audit object key 복사" /></>} mono />
          <Info label="r2ResultObjectKey" value={<>{short(detail.archiveMeta?.r2ResultObjectKey as string | undefined)} <CopyButton value={detail.archiveMeta?.r2ResultObjectKey as string | undefined} label="result object key 복사" /></>} mono />
          <Info label="archiveVersion" value={String(detail.archiveMeta?.archiveVersion ?? '-')} />
          <Info label="lastArchiveError" value={String(detail.archiveMeta?.lastArchiveError ?? '-')} />
          <TextField label="archive reason" value={archiveReason} onChange={setArchiveReason} />
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={() => onArchiveDownload('room')}>방 스냅샷 다운로드</ActionButton>
            <ActionButton onClick={() => onArchiveDownload('audit')}>감사 로그 다운로드</ActionButton>
            <ActionButton onClick={() => onArchiveDownload('result')}>결과 JSON 다운로드</ActionButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton disabled={archiveSummaryPending} onClick={() => onArchiveSummary('result')}>결과 JSON 요약</ActionButton>
            <ActionButton disabled={archiveSummaryPending} onClick={() => onArchiveSummary('room')}>방 스냅샷 요약</ActionButton>
            <ActionButton disabled={archiveSummaryPending} onClick={() => onArchiveSummary('audit')}>감사 로그 요약</ActionButton>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton onClick={onArchiveDryRun}>archive dry-run</ActionButton>
            <ActionButton tone="warning" onClick={onArchiveWrite}>archive write</ActionButton>
            <ActionButton tone="warning" onClick={onArchiveRetryDryRun}>retry dry-run</ActionButton>
            <ActionButton tone="warning" onClick={onArchiveRetryWrite}>retry write</ActionButton>
            <ActionButton tone="danger" onClick={onArchiveForceWrite}>force re-archive</ActionButton>
          </div>
          <p className="text-xs text-zinc-500">Private R2 object입니다. 공개 URL은 노출하지 않고, 다운로드 버튼을 누를 때만 짧은 signed URL을 새 탭으로 엽니다.</p>
          {lastArchiveSummary && (
            <div className="rounded border border-cyan-500/25 bg-cyan-500/10 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusBadge label={`R2 ${lastArchiveSummary.kind}`} tone="info" />
                <StatusBadge label={lastArchiveSummary.storageMode ?? 'private'} tone="neutral" />
                <span className="font-mono text-[11px] text-cyan-100">{short(lastArchiveSummary.objectKey)}</span>
                <CopyButton value={lastArchiveSummary.objectKey} label="summary object key 복사" />
              </div>
              <JsonBlock value={lastArchiveSummary.summary} />
            </div>
          )}
          {lastArchiveAction && <JsonBlock value={lastArchiveAction} />}
          {lastArchiveSignedUrl && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-semibold text-zinc-300">last signed URL request</p>
              <JsonBlock value={{ ...lastArchiveSignedUrl, url: '[opened in new tab]' }} />
            </div>
          )}
        </Panel>

        <Panel title="liveCwAuditLogs">
          <AuditLogList logs={detail.auditLogs ?? []} />
        </Panel>
      </div>

      <div className="grid content-start gap-4">
        <Panel title="관리자 재판정 / override 요청">
          <div className="grid gap-2 rounded border border-zinc-800 bg-zinc-950/40 p-2">
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={`rejudge history ${rejudgeHistory.length}`} tone={rejudgeHistory.length ? 'warning' : 'neutral'} />
              <StatusBadge label={`override history ${overrideHistory.length}`} tone={overrideHistory.length ? 'warning' : 'neutral'} />
              <StatusBadge label="request-only" tone="info" />
            </div>
            <AdminRequestHistory title="최근 재판정 요청" rows={rejudgeHistory} />
            <AdminRequestHistory title="최근 override 요청" rows={overrideHistory} />
          </div>
          <TextAreaField label="사유" value={adminReason} onChange={setAdminReason} rows={3} />
          <SelectField
            label="override winnerTeam"
            value={overrideWinnerTeam}
            onChange={(value) => setOverrideWinnerTeam(value as 'BLUE' | 'RED' | '')}
            options={[
              { value: '', label: '선택 안 함' },
              { value: 'BLUE', label: 'BLUE' },
              { value: 'RED', label: 'RED' },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton disabled={rejudgePending} onClick={onRejudgeDryRun}>
              재판정 dry-run
            </ActionButton>
            <ActionButton disabled={rejudgePending} tone="warning" onClick={onRejudgeWrite}>
              재판정 요청 기록
            </ActionButton>
            <ActionButton disabled={overridePending} tone="warning" onClick={onOverrideDryRun}>
              override dry-run
            </ActionButton>
            <ActionButton disabled={overridePending || !overrideWinnerTeam} tone="danger" onClick={onOverrideWrite}>
              override 요청 기록
            </ActionButton>
            <ActionButton disabled={reverseReissuePending || !overrideWinnerTeam} tone="danger" onClick={onReverseReissueWrite}>
              보상 회수+재지급 (실지급)
            </ActionButton>
          </div>
          <InlineMessage kind="info" className="mt-2 block">
            dry-run은 미리보기만 합니다. "override 요청 기록"은 history/audit/cache만 남기고 지갑은 안 건드립니다.
          </InlineMessage>
          <p className="mt-1 text-xs text-rose-300">
            <b>보상 회수+재지급</b>은 위 winnerTeam으로 <b>실제 코인·GP·일일카운터를 회수 후 재지급</b>합니다(되돌릴 수 없음). 이미 확정·지급된 경기에만, 결과가 실제로 뒤집힌 경우에만 사용하세요. 같은 승자면 무동작.
          </p>
          {lastAdminAction && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold text-zinc-300">{lastAdminAction.dryRun ? 'last dry-run' : 'last write'}</p>
              <JsonBlock value={lastAdminAction.planned} />
            </div>
          )}
        </Panel>

        <TeamBox title="BLUE" participants={blue} captains={detail.room.captainUids ?? []} />
        <TeamBox title="RED" participants={red} captains={detail.room.captainUids ?? []} />
        <TeamBox title="UNASSIGNED" participants={unassigned} captains={detail.room.captainUids ?? []} />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-900/35 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
      <div className="grid gap-2 text-xs text-zinc-400">{children}</div>
    </div>
  );
}

function AdminRequestHistory({ title, rows }: { title: string; rows: Record<string, unknown>[] }) {
  const visibleRows = rows.slice(-3).reverse();
  if (visibleRows.length === 0) {
    return (
      <div>
        <p className="text-[11px] font-semibold text-zinc-500">{title}</p>
        <p className="text-[11px] text-zinc-600">기록 없음</p>
      </div>
    );
  }
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold text-zinc-500">{title}</p>
      <div className="grid gap-1">
        {visibleRows.map((row, index) => (
          <div key={`${title}-${index}`} className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge label={stringOf(row.status) ?? stringOf(row.type) ?? 'REQUEST'} tone="warning" />
              <span className="font-mono text-[11px] text-zinc-500">{formatDateTime(stringOf(row.requestedAt))}</span>
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{stringOf(row.reason) ?? '-'}</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">{stringOf(row.note) ?? 'finalResult와 지갑은 이 요청만으로 변경되지 않습니다.'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <p className="min-w-0">
      <span className="text-zinc-500">{label}: </span>
      <span className={mono ? 'font-mono text-zinc-300' : 'text-zinc-300'}>{value}</span>
    </p>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-72 overflow-auto rounded border border-zinc-800 bg-zinc-950/70 p-2 text-[11px] leading-relaxed text-zinc-400">
      {renderJson(value)}
    </pre>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'neutral' | 'danger' | 'warning';
}) {
  const classes = {
    primary: 'bg-violet-600 text-white hover:bg-violet-500',
    neutral: 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600',
    danger: 'bg-red-600 text-white hover:bg-red-500',
    warning: 'bg-amber-600 text-white hover:bg-amber-500',
  };
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${classes[tone]}`}>
      {children}
    </button>
  );
}

function CopyButton({ value, label }: { value: string | null | undefined; label: string }) {
  return (
    <button
      type="button"
      disabled={!value}
      title={label}
      onClick={() => void copyToClipboard(value)}
      className="ml-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
    >
      복사
    </button>
  );
}

function ServerDbInspectionPanel({ inspection }: { inspection: AdminLiveCwServerDbInspection | null | undefined }) {
  const sourceDocuments = inspection?.sourceDocuments?.rows ?? [];
  const mutationJournal = inspection?.mutationJournal?.rows ?? [];
  const sourceColumns: Column<AdminLiveCwServerDbSourceDocument>[] = [
    {
      key: 'documentType',
      header: 'type',
      render: (row) => <StatusBadge label={row.documentType ?? '-'} tone={row.documentType === 'room' ? 'success' : 'neutral'} />,
    },
    {
      key: 'collectionId',
      header: 'collection',
      render: (row) => <span className="font-mono text-xs">{row.collectionId ?? '-'}</span>,
    },
    {
      key: 'docId',
      header: 'doc',
      render: (row) => (
        <div className="space-y-1">
          <p className="font-mono text-xs text-zinc-200">{row.docIdMasked ?? '-'}</p>
          <p className="font-mono text-[11px] text-zinc-500">hash {row.docIdHash ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'status',
      render: (row) => (
        <div className="flex flex-col gap-1">
          <StatusBadge label={row.status ?? '-'} tone={row.status === 'CONFIRMED' ? 'success' : 'neutral'} />
          <span className="text-[11px] text-zinc-500">{row.source ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'uid',
      header: 'uid',
      render: (row) => (
        <div className="space-y-1">
          <p className="font-mono text-xs text-zinc-300">{row.uidMasked ?? '-'}</p>
          <p className="font-mono text-[11px] text-zinc-500">hash {row.uidHash ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'updated',
      render: (row) => <span className="text-xs">{formatDateTime(row.updatedAt)}</span>,
    },
  ];
  const journalColumns: Column<AdminLiveCwServerDbMutationJournal>[] = [
    {
      key: 'status',
      header: 'status',
      render: (row) => <StatusBadge label={row.status ?? '-'} tone={serverDbJournalTone(row.status)} />,
    },
    {
      key: 'action',
      header: 'action',
      render: (row) => (
        <div className="space-y-1">
          <p className="font-mono text-xs text-zinc-200">{row.action ?? '-'}</p>
          <p className="text-[11px] text-zinc-500">{row.source ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'actor',
      header: 'actor',
      render: (row) => (
        <div className="space-y-1">
          <p className="text-xs text-zinc-300">{row.actorRole ?? '-'}</p>
          <p className="font-mono text-[11px] text-zinc-500">{row.actorUidMasked ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'time',
      header: 'time',
      render: (row) => (
        <div className="space-y-1 text-xs">
          <p>created {formatDateTime(row.createdAt)}</p>
          <p className="text-zinc-500">commit {formatDateTime(row.committedAt)}</p>
        </div>
      ),
    },
    {
      key: 'error',
      header: 'error',
      render: (row) => <span className={row.error ? 'text-red-300' : 'text-zinc-500'}>{row.error ? short(row.error) : '-'}</span>,
    },
  ];

  if (!inspection) {
    return (
      <Panel title="Server DB mirror / journal">
        <InlineMessage kind="warning">Server DB inspection 데이터가 아직 응답에 포함되지 않았습니다.</InlineMessage>
      </Panel>
    );
  }

  const snapshot = inspection.detailSnapshot;
  const latestJournal = mutationJournal[0] ?? null;
  const hasMirror = Boolean(snapshot || sourceDocuments.length > 0);

  return (
    <Panel title="Server DB mirror / journal">
      <div className="flex flex-wrap gap-2">
        <StatusBadge label={hasMirror ? 'mirror visible' : 'mirror missing'} tone={hasMirror ? 'success' : 'warning'} />
        <StatusBadge label={`source docs ${formatNumber(inspection.sourceDocuments?.count ?? 0)}`} tone={(inspection.sourceDocuments?.count ?? 0) > 0 ? 'success' : 'warning'} />
        <StatusBadge label={`journal ${formatNumber(inspection.mutationJournal?.count ?? 0)}`} tone={(inspection.mutationJournal?.count ?? 0) > 0 ? 'success' : 'warning'} />
        <StatusBadge label={inspection.dbPath ?? 'server-db'} tone="neutral" />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">detail snapshot</p>
          <Info label="status" value={snapshot?.status ?? '-'} />
          <Info label="phase" value={snapshot?.phase ?? '-'} />
          <Info label="source" value={snapshot?.source ?? '-'} />
          <Info label="updatedAt" value={formatDateTime(snapshot?.updatedAt)} />
          <Info label="indexedAt" value={formatDateTime(snapshot?.indexedAt)} />
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">counts</p>
          <Info label="source by type" value={formatCountMap(inspection.sourceDocuments?.byType)} />
          <Info label="source by collection" value={formatCountMap(inspection.sourceDocuments?.byCollection)} />
          <Info label="journal by status" value={formatCountMap(inspection.mutationJournal?.byStatus)} />
          <Info label="journal by action" value={formatCountMap(inspection.mutationJournal?.byAction)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">source documents</p>
        <DataTable
          columns={sourceColumns}
          data={sourceDocuments.slice(0, 12)}
          rowKey={(row) => `${row.collectionId ?? '-'}:${row.docIdHash ?? row.docIdMasked ?? row.updatedAt ?? '-'}`}
          emptyMessage="Server DB source document mirror가 없습니다."
        />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">mutation journal</p>
        <DataTable
          columns={journalColumns}
          data={mutationJournal.slice(0, 12)}
          rowKey={(row) => row.mutationId ?? `${row.action ?? '-'}:${row.createdAt ?? '-'}`}
          emptyMessage="Server DB mutation journal이 없습니다."
        />
      </div>

      {latestJournal ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-zinc-300">latest journal payload summary</p>
          <JsonBlock value={{ action: latestJournal.action, status: latestJournal.status, payload: latestJournal.payload, after: latestJournal.after, error: latestJournal.error }} />
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        Public 화면이 아니라 관리자 상세용 점검 패널입니다. actor/doc/participant UID는 원문 대신 masked/hash 값만 표시합니다.
      </p>
    </Panel>
  );
}

function TeamBox({ title, participants, captains }: { title: string; participants: AdminLiveCwParticipant[]; captains: string[] }) {
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-900/35 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</p>
        <span className="text-xs text-zinc-500">{participants.length}</span>
      </div>
      <div className="grid gap-2">
        {participants.length === 0 && <p className="text-xs text-zinc-500">empty</p>}
        {participants.map((participant) => (
          <div key={participant.uid} className="rounded border border-zinc-700/50 bg-zinc-950/40 px-2 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-100">{participant.selectedPlayRiotId || participant.mainRiotId || participant.riotId || 'Riot ID 없음'}</p>
                <p className="truncate text-xs text-zinc-500">{shortId(participant.uid)}</p>
                <p className="truncate text-xs text-zinc-500">
                  {[participant.highestTier, participant.highestRank, typeof participant.highestLp === 'number' ? `${participant.highestLp}LP` : null].filter(Boolean).join(' ') || 'NO_TIER'} · score {participant.personalScore ?? '-'}
                </p>
              </div>
              {captains.includes(participant.uid) && <StatusBadge label="captain" tone="warning" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditLogList({ logs }: { logs: AdminLiveCwAuditLog[] }) {
  if (logs.length === 0) return <p className="text-xs text-zinc-500">audit log 없음</p>;
  return (
    <div className="grid max-h-96 gap-2 overflow-auto">
      {logs.map((log) => {
        const after = recordOf(log.after);
        const isArchiveDryRun = log.action === 'ARCHIVE_R2_DRY_RUN';
        return (
          <div key={log.auditId} className="rounded border border-zinc-800 bg-zinc-950/50 p-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={log.action} tone={isArchiveDryRun ? 'warning' : 'neutral'} />
                {isArchiveDryRun && <StatusBadge label="미리보기 · 실제 변경 없음" tone="warning" />}
              </div>
              <span className="text-[11px] text-zinc-500">{formatDateTime(log.createdAt)}</span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-zinc-500">
              actor {short(log.actorUid)} · role {log.actorRole ?? '-'}
            </p>
            {isArchiveDryRun && (
              <p className="mt-1 text-xs text-amber-300">
                previewArchiveVersion {String(after.previewArchiveVersion ?? after.wouldArchiveVersion ?? '-')} · persisted=false
              </p>
            )}
            {log.reason && <p className="mt-1 text-xs text-zinc-400">reason: {log.reason}</p>}
            <JsonBlock value={{ before: log.before ?? null, after: log.after ?? null }} />
          </div>
        );
      })}
    </div>
  );
}

function StatCell({ label, value, tone = 'text-zinc-100' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-zinc-700/50 bg-zinc-900/60 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

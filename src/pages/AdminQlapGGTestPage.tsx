import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmButton } from '../components/ConfirmButton';
import { DataTable, type Column } from '../components/DataTable';
import { TextAreaField, TextField, SelectField } from '../components/Field';
import { InlineMessage } from '../components/InlineMessage';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime } from '../lib/format';
import { qlapggTestApi } from '../services/qlapggTestApi';
import type {
  ActAsResult,
  DryRunResult,
  QlapggActionResult,
  QlapggExecutionLog,
  QlapggGuildJoinRequest,
  QlapggLiveCwJoinRequest,
  QlapggTournamentJoinRequest,
  TestUser,
} from '../types/testLab';

const QLAPGG_BASE_URL = (
  (import.meta.env.VITE_QLAPGG_FRONTEND_BASE_URL as string | undefined) ?? 'http://localhost:5173'
).replace(/\/+$/, '');
const DEFAULT_RETURN_TO = '/guild';
const EMPTY_USERS: TestUser[] = [];

type ActionKey = 'guild' | 'liveCw' | 'tournament';

interface DryRunRecord {
  signature: string;
  result: QlapggActionResult;
}

interface SignedRequest<T> {
  request: T;
  signature: string;
}

interface ActionResultRow extends DryRunResult {
  id: string;
  status: 'success' | 'failed';
}

const actionResultColumns: Column<ActionResultRow>[] = [
  {
    key: 'status',
    header: '결과',
    render: (row) => (
      <StatusBadge label={row.status === 'success' ? '성공' : '실패'} tone={row.status === 'success' ? 'success' : 'danger'} />
    ),
  },
  {
    key: 'target',
    header: '대상',
    render: (row) => (
      <span className="font-mono text-xs text-zinc-300">
        {row.uid ?? row.guildId ?? row.targetId ?? '-'}
      </span>
    ),
  },
  {
    key: 'reason',
    header: '사유',
    render: (row) => <span className="text-xs text-zinc-500">{row.reason ?? 'OK'}</span>,
  },
  {
    key: 'paths',
    header: '예상 문서 경로',
    render: (row) => (
      <div className="flex max-w-md flex-col gap-0.5">
        {(row.paths ?? []).length > 0
          ? row.paths?.map((path) => (
              <span key={path} className="font-mono text-[11px] text-zinc-500">
                {path}
              </span>
            ))
          : <span className="text-xs text-zinc-600">-</span>}
      </div>
    ),
  },
];

const logColumns: Column<QlapggExecutionLog>[] = [
  {
    key: 'createdAt',
    header: 'createdAt',
    render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span>,
  },
  {
    key: 'action',
    header: 'action',
    render: (row) => <span className="font-mono text-xs text-zinc-300">{row.action}</span>,
  },
  {
    key: 'actorUid',
    header: 'actorUid',
    render: (row) => <span className="font-mono text-xs text-zinc-400">{row.actorUid}</span>,
  },
  {
    key: 'target',
    header: 'target',
    render: (row) => (
      <span className="font-mono text-xs text-zinc-400">{row.targetUid ?? row.targetId ?? '-'}</span>
    ),
  },
  {
    key: 'dryRun',
    header: 'dryRun',
    render: (row) => <StatusBadge label={row.dryRun ? 'true' : 'false'} tone={row.dryRun ? 'warning' : 'neutral'} />,
  },
];

function isSelectableTestUser(user: TestUser): boolean {
  return user.isTestUser === true || user.uid.startsWith('test_');
}

function idsSignature(action: ActionKey, targetId: string, ids: string[]): string {
  return `${action}:${targetId.trim()}:${[...ids].sort().join('|')}`;
}

function splitIds(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function openQlapggWithToken(result: ActAsResult) {
  const url = new URL('/admin-test-signin', QLAPGG_BASE_URL);
  const params = new URLSearchParams({
    token: result.customToken,
    returnTo: result.returnTo || DEFAULT_RETURN_TO,
    uid: result.uid,
  });
  url.hash = params.toString();
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
}

function actionRows(result: QlapggActionResult | undefined): ActionResultRow[] {
  if (!result) return [];
  return [
    ...result.success.map((row, index) => ({ ...row, id: `success-${index}-${row.uid ?? row.guildId ?? row.targetId ?? ''}`, status: 'success' as const })),
    ...result.failed.map((row, index) => ({ ...row, id: `failed-${index}-${row.uid ?? row.guildId ?? row.targetId ?? ''}`, status: 'failed' as const })),
  ];
}

export function AdminQlapGGTestPage() {
  const queryClient = useQueryClient();
  const [batchId, setBatchId] = useState('');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [loginUid, setLoginUid] = useState('');
  const [guildId, setGuildId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [guildIdsText, setGuildIdsText] = useState('');
  const [dryRuns, setDryRuns] = useState<Record<ActionKey, DryRunRecord | null>>({
    guild: null,
    liveCw: null,
    tournament: null,
  });

  const usersQuery = useQuery({
    queryKey: ['qlapgg-test-users', batchId.trim()],
    queryFn: () => qlapggTestApi.listUsers({ batchId: batchId.trim() || undefined }),
  });
  const logsQuery = useQuery({
    queryKey: ['qlapgg-test-logs'],
    queryFn: () => qlapggTestApi.logs(30),
  });

  const users = usersQuery.data?.users ?? EMPTY_USERS;
  const selectedUsers = useMemo(
    () => selectedUids.map((uid) => users.find((user) => user.uid === uid)).filter((user): user is TestUser => Boolean(user)),
    [selectedUids, users],
  );
  const selectedUserIds = useMemo(() => selectedUsers.map((user) => user.uid), [selectedUsers]);
  const selectableUsers = users.filter(isSelectableTestUser);
  const guildIds = useMemo(() => splitIds(guildIdsText), [guildIdsText]);

  const invalidateQlapggTest = () => {
    void queryClient.invalidateQueries({ queryKey: ['qlapgg-test-users'] });
    void queryClient.invalidateQueries({ queryKey: ['qlapgg-test-logs'] });
  };

  const actAsMutation = useMutation({
    mutationFn: qlapggTestApi.actAs,
    onSuccess: (result) => {
      openQlapggWithToken(result);
      void queryClient.invalidateQueries({ queryKey: ['qlapgg-test-logs'] });
    },
  });

  const guildDryRunMutation = useMutation({
    mutationFn: ({ request }: SignedRequest<QlapggGuildJoinRequest>) => qlapggTestApi.guildJoin(request),
    onSuccess: (result, variables) => {
      setDryRuns((current) => ({ ...current, guild: { signature: variables.signature, result } }));
      invalidateQlapggTest();
    },
  });
  const guildRunMutation = useMutation({
    mutationFn: qlapggTestApi.guildJoin,
    onSuccess: invalidateQlapggTest,
  });

  const liveDryRunMutation = useMutation({
    mutationFn: ({ request }: SignedRequest<QlapggLiveCwJoinRequest>) => qlapggTestApi.liveCwJoin(request),
    onSuccess: (result, variables) => {
      setDryRuns((current) => ({ ...current, liveCw: { signature: variables.signature, result } }));
      invalidateQlapggTest();
    },
  });
  const liveRunMutation = useMutation({
    mutationFn: qlapggTestApi.liveCwJoin,
    onSuccess: invalidateQlapggTest,
  });

  const tournamentDryRunMutation = useMutation({
    mutationFn: ({ request }: SignedRequest<QlapggTournamentJoinRequest>) => qlapggTestApi.tournamentJoin(request),
    onSuccess: (result, variables) => {
      setDryRuns((current) => ({ ...current, tournament: { signature: variables.signature, result } }));
      invalidateQlapggTest();
    },
  });
  const tournamentRunMutation = useMutation({
    mutationFn: qlapggTestApi.tournamentJoin,
    onSuccess: invalidateQlapggTest,
  });

  const toggleUid = (uid: string, checked: boolean) => {
    setSelectedUids((current) => {
      if (checked) return current.includes(uid) ? current : [...current, uid];
      return current.filter((item) => item !== uid);
    });
  };

  const userColumns: Column<TestUser>[] = [
    {
      key: 'select',
      header: '선택',
      render: (user) => (
        <input
          type="checkbox"
          checked={selectedUids.includes(user.uid)}
          disabled={!isSelectableTestUser(user)}
          onChange={(event) => toggleUid(user.uid, event.target.checked)}
          aria-label={`${user.uid} 선택`}
        />
      ),
    },
    { key: 'uid', header: 'uid', render: (user) => <span className="font-mono text-xs text-zinc-300">{user.uid}</span> },
    { key: 'displayName', header: '닉네임', render: (user) => <span>{user.displayName ?? '-'}</span> },
    { key: 'riotId', header: 'Riot ID', render: (user) => <span className="font-mono text-xs">{user.riotId ?? '-'}</span> },
    { key: 'tier', header: '티어', render: (user) => <StatusBadge label={user.tier ?? '없음'} tone={user.tier ? 'info' : 'neutral'} /> },
    { key: 'plan', header: '플랜', render: (user) => <span className="text-xs text-zinc-400">{user.plan ?? '-'}</span> },
    {
      key: 'isTestUser',
      header: 'isTestUser',
      render: (user) => <StatusBadge label={user.isTestUser ? 'true' : 'prefix'} tone={isSelectableTestUser(user) ? 'success' : 'danger'} />,
    },
    {
      key: 'seedBatchId',
      header: 'testBatchId',
      render: (user) => <span className="font-mono text-xs text-zinc-500">{user.seedBatchId ?? '-'}</span>,
    },
    {
      key: 'guildJoined',
      header: '길드 가입',
      render: (user) => (
        <StatusBadge
          label={user.guildJoined ? user.guildId ?? '가입됨' : '미가입'}
          tone={user.guildJoined ? 'success' : 'neutral'}
        />
      ),
    },
  ];

  const loginUser = users.find((user) => user.uid === loginUid);
  const canActAs = Boolean(loginUser && isSelectableTestUser(loginUser));
  const guildSignature = idsSignature('guild', guildId, selectedUserIds);
  const liveSignature = idsSignature('liveCw', roomId, selectedUserIds);
  const tournamentSignature = idsSignature('tournament', tournamentId, guildIds);
  const canRunGuild = guildId.trim() !== '' && selectedUserIds.length > 0;
  const canDryRunLive = roomId.trim() !== '' && selectedUserIds.length >= 1 && selectedUserIds.length <= 10;
  const canRunLive = roomId.trim() !== '' && selectedUserIds.length === 10;
  const canRunTournament = tournamentId.trim() !== '' && guildIds.length > 0;
  const canCommitGuild =
    dryRuns.guild?.signature === guildSignature && dryRuns.guild.result.failed.length === 0 && canRunGuild;
  const canCommitLive =
    dryRuns.liveCw?.signature === liveSignature && dryRuns.liveCw.result.failed.length === 0 && canRunLive;
  const canCommitTournament =
    dryRuns.tournament?.signature === tournamentSignature && dryRuns.tournament.result.failed.length === 0 && canRunTournament;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">QLapGG 테스트</h2>
        <p className="text-sm text-zinc-400">
          생성된 테스트 유저를 사용해 QLapGG의 길드, 실시간 내전, 길드 멸망전 흐름을 검증합니다.
        </p>
        <InlineMessage kind="info">
          ENABLE_TEST_LAB=true 일 때만 API가 활성화됩니다. 테스트 유저가 아닌 UID가 섞이면 요청 전체가 실패합니다.
        </InlineMessage>
      </div>

      <PageSection
        title="테스트 유저 목록"
        description="기존 관리자페이지에서 생성된 테스트 유저를 조회하고 QLapGG 테스트 대상으로 선택합니다."
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedUids(selectableUsers.slice(0, 10).map((user) => user.uid))}
              disabled={selectableUsers.length === 0}
              className="rounded bg-zinc-700 px-3 py-1.5 text-xs text-zinc-100 disabled:opacity-50"
            >
              상위 10명 선택
            </button>
            <button
              type="button"
              onClick={() => setSelectedUids([])}
              className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300"
            >
              선택 해제
            </button>
          </div>
        }
        accent
      >
        <div className="mb-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <TextField
            label="batchId 필터"
            value={batchId}
            onChange={setBatchId}
            placeholder="예: seed_20260609_..."
            hint="비워두면 최근 테스트 유저를 조회합니다."
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                void usersQuery.refetch();
                void logsQuery.refetch();
              }}
              className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700"
            >
              새로고침
            </button>
          </div>
        </div>
        <QueryState isLoading={usersQuery.isLoading} error={usersQuery.error}>
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>조회 {users.length}명</span>
            <span>선택 {selectedUsers.length}명</span>
            {selectedUsers.length > 0 && (
              <span className="font-mono text-zinc-600">{selectedUsers.slice(0, 5).map((user) => user.uid).join(', ')}</span>
            )}
          </div>
          <DataTable
            columns={userColumns}
            data={users}
            rowKey={(user) => user.uid}
            emptyMessage="조회된 테스트 유저가 없습니다."
          />
        </QueryState>
      </PageSection>

      <PageSection
        title="QLapGG 유저 로그인 테스트"
        description="테스트 유저 전용 impersonation-token을 발급하고 QLapGG 프론트의 custom-token 로그인 브리지로 엽니다."
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <SelectField
            label="테스트 유저"
            value={loginUid}
            onChange={setLoginUid}
            options={[
              { value: '', label: '테스트 유저 선택' },
              ...users.map((user) => ({
                value: user.uid,
                label: `${user.displayName ?? user.uid} (${user.uid})`,
              })),
            ]}
            hint="isTestUser=true 또는 test_ prefix UID만 백엔드에서 허용합니다."
          />
          <div className="flex items-end">
            <button
              type="button"
              disabled={!canActAs || actAsMutation.isPending}
              onClick={() => actAsMutation.mutate({ uid: loginUid, returnTo: DEFAULT_RETURN_TO })}
              className="rounded bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {actAsMutation.isPending ? '준비 중...' : '이 유저로 QLapGG 열기'}
            </button>
          </div>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          <InlineMessage kind="info">QLapGG URL: {QLAPGG_BASE_URL}/admin-test-signin</InlineMessage>
          {actAsMutation.isError && <InlineMessage kind="error">{errorToMessage(actAsMutation.error)}</InlineMessage>}
          {actAsMutation.isSuccess && <InlineMessage kind="success">QLapGG 테스트 로그인 창을 열었습니다.</InlineMessage>}
        </div>
      </PageSection>

      <PageSection
        title="길드 가입 테스트"
        description="guildId에 선택한 테스트 유저를 가입시키는 흐름을 dryRun으로 먼저 검증합니다."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3">
            <TextField label="guildId" value={guildId} onChange={setGuildId} required />
            <SelectedUsersPreview users={selectedUsers} />
            <ActionButtons
              dryRunLabel="길드 가입 dryRun"
              runLabel="길드 가입 실행"
              dryRunPending={guildDryRunMutation.isPending}
              runPending={guildRunMutation.isPending}
              dryRunDisabled={!canRunGuild}
              runDisabled={!canCommitGuild}
              onDryRun={() =>
                guildDryRunMutation.mutate({
                  signature: guildSignature,
                  request: {
                    guildId: guildId.trim(),
                    uids: selectedUserIds,
                    dryRun: true,
                    reason: 'QLapGG guild join dryRun',
                  },
                })
              }
              onRun={() =>
                guildRunMutation.mutate({
                  guildId: guildId.trim(),
                  uids: selectedUserIds,
                  dryRun: false,
                  reason: 'QLapGG guild join execution',
                })
              }
            />
            <CommitHint record={dryRuns.guild} signature={guildSignature} canCommit={canCommitGuild} />
            <MutationError mutation={guildDryRunMutation} />
            <MutationError mutation={guildRunMutation} />
          </div>
          <ActionResultTable result={guildRunMutation.data ?? dryRuns.guild?.result} />
        </div>
      </PageSection>

      <PageSection
        title="실시간 내전 참가 테스트"
        description="roomId에 테스트 유저 10명을 참가시키는 흐름을 검증합니다."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3">
            <TextField label="roomId" value={roomId} onChange={setRoomId} required />
            <SelectedUsersPreview users={selectedUsers} requiredCount={10} />
            <ActionButtons
              dryRunLabel="내전 참가 dryRun"
              runLabel="내전 참가 실행"
              dryRunPending={liveDryRunMutation.isPending}
              runPending={liveRunMutation.isPending}
              dryRunDisabled={!canDryRunLive}
              runDisabled={!canCommitLive}
              onDryRun={() =>
                liveDryRunMutation.mutate({
                  signature: liveSignature,
                  request: {
                    roomId: roomId.trim(),
                    uids: selectedUserIds,
                    dryRun: true,
                    reason: 'QLapGG live custom room join dryRun',
                  },
                })
              }
              onRun={() =>
                liveRunMutation.mutate({
                  roomId: roomId.trim(),
                  uids: selectedUserIds,
                  dryRun: false,
                  reason: 'QLapGG live custom room join execution',
                })
              }
            />
            <CommitHint record={dryRuns.liveCw} signature={liveSignature} canCommit={canCommitLive} />
            <MutationError mutation={liveDryRunMutation} />
            <MutationError mutation={liveRunMutation} />
          </div>
          <ActionResultTable result={liveRunMutation.data ?? dryRuns.liveCw?.result} />
        </div>
      </PageSection>

      <PageSection
        title="길드 멸망전 참가 테스트"
        description="tournamentId와 guildId 목록을 입력해 길드 신청 흐름을 검증합니다."
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-3">
            <TextField label="tournamentId" value={tournamentId} onChange={setTournamentId} required />
            <TextAreaField
              label="guildId 목록"
              value={guildIdsText}
              onChange={setGuildIdsText}
              rows={4}
              placeholder="guildA, guildB 또는 줄바꿈으로 입력"
              hint={`입력된 guildId ${guildIds.length}개`}
              required
            />
            <ActionButtons
              dryRunLabel="멸망전 참가 dryRun"
              runLabel="멸망전 참가 실행"
              dryRunPending={tournamentDryRunMutation.isPending}
              runPending={tournamentRunMutation.isPending}
              dryRunDisabled={!canRunTournament}
              runDisabled={!canCommitTournament}
              onDryRun={() =>
                tournamentDryRunMutation.mutate({
                  signature: tournamentSignature,
                  request: {
                    tournamentId: tournamentId.trim(),
                    guildIds,
                    dryRun: true,
                    reason: 'QLapGG tournament guild join dryRun',
                  },
                })
              }
              onRun={() =>
                tournamentRunMutation.mutate({
                  tournamentId: tournamentId.trim(),
                  guildIds,
                  dryRun: false,
                  reason: 'QLapGG tournament guild join execution',
                })
              }
            />
            <CommitHint record={dryRuns.tournament} signature={tournamentSignature} canCommit={canCommitTournament} />
            <MutationError mutation={tournamentDryRunMutation} />
            <MutationError mutation={tournamentRunMutation} />
          </div>
          <ActionResultTable result={tournamentRunMutation.data ?? dryRuns.tournament?.result} />
        </div>
      </PageSection>

      <PageSection title="실행 로그" description="최근 QLapGG 테스트 실행 결과를 admin audit log 기반으로 표시합니다.">
        <QueryState isLoading={logsQuery.isLoading} error={logsQuery.error}>
          <DataTable
            columns={logColumns}
            data={logsQuery.data?.logs ?? []}
            rowKey={(row) => row.id}
            emptyMessage="QLapGG 테스트 실행 로그가 없습니다."
          />
        </QueryState>
      </PageSection>
    </div>
  );
}

function SelectedUsersPreview({ users, requiredCount }: { users: TestUser[]; requiredCount?: number }) {
  const tone = requiredCount == null || users.length === requiredCount ? 'info' : 'warning';
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-900/30 p-3">
      <div className="mb-2 flex items-center gap-2">
        <StatusBadge label={`선택 ${users.length}명`} tone={tone} />
        {requiredCount != null && <span className="text-xs text-zinc-500">필수 {requiredCount}명</span>}
      </div>
      <div className="max-h-28 overflow-auto font-mono text-xs text-zinc-500">
        {users.length > 0 ? users.map((user) => <div key={user.uid}>{user.uid}</div>) : '선택된 테스트 유저가 없습니다.'}
      </div>
    </div>
  );
}

function ActionButtons({
  dryRunLabel,
  runLabel,
  dryRunPending,
  runPending,
  dryRunDisabled,
  runDisabled,
  onDryRun,
  onRun,
}: {
  dryRunLabel: string;
  runLabel: string;
  dryRunPending: boolean;
  runPending: boolean;
  dryRunDisabled: boolean;
  runDisabled: boolean;
  onDryRun: () => void;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={dryRunDisabled || dryRunPending}
        onClick={onDryRun}
        className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600 disabled:opacity-50"
      >
        {dryRunPending ? '검증 중...' : dryRunLabel}
      </button>
      <ConfirmButton
        tone="danger"
        confirmLabel="실제 실행 확정"
        disabled={runDisabled || runPending}
        onConfirm={onRun}
      >
        {runPending ? '실행 중...' : runLabel}
      </ConfirmButton>
    </div>
  );
}

function CommitHint({
  record,
  signature,
  canCommit,
}: {
  record: DryRunRecord | null;
  signature: string;
  canCommit: boolean;
}) {
  if (!record) return <InlineMessage kind="info">기본값은 dryRun=true입니다. dryRun 결과 확인 후 실제 실행이 활성화됩니다.</InlineMessage>;
  if (record.signature !== signature) return <InlineMessage kind="info">입력값이 변경되어 dryRun을 다시 실행해야 합니다.</InlineMessage>;
  if (record.result.failed.length > 0) return <InlineMessage kind="error">dryRun 실패 항목이 있어 실제 실행이 비활성화되었습니다.</InlineMessage>;
  if (canCommit) return <InlineMessage kind="success">dryRun이 통과했습니다. 실제 실행 버튼을 사용할 수 있습니다.</InlineMessage>;
  return <InlineMessage kind="info">dryRun 결과 확인이 필요합니다.</InlineMessage>;
}

function MutationError({
  mutation,
}: {
  mutation: { isError: boolean; error: unknown };
}) {
  return mutation.isError ? <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage> : null;
}

function ActionResultTable({ result }: { result: QlapggActionResult | undefined }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={result?.dryRun ? 'dryRun=true' : result ? 'dryRun=false' : '결과 없음'} tone={result?.dryRun ? 'warning' : result ? 'success' : 'neutral'} />
        {result && <span className="text-xs text-zinc-500">targetId {result.targetId}</span>}
        {result && <span className="text-xs text-zinc-600">{formatDateTime(result.createdAt)}</span>}
      </div>
      <DataTable
        columns={actionResultColumns}
        data={actionRows(result)}
        rowKey={(row) => row.id}
        emptyMessage="dryRun 또는 실행 결과가 없습니다."
      />
    </div>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmButton } from '../components/ConfirmButton';
import { DataTable, type Column } from '../components/DataTable';
import { InlineMessage } from '../components/InlineMessage';
import { NotImplementedNotice } from '../components/NotImplementedNotice';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/Field';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { StatusBadge } from '../components/StatusBadge';
import { errorToMessage } from '../lib/apiError';
import { CURRENCY_LABELS, GUILD_MEMBER_ROLE_LABELS, PLAN_LABELS, SEASON_STATUS_LABELS } from '../lib/constants';
import { formatDateTime, formatNumber } from '../lib/format';
import { guildApi, type GuildRankingRebuildResult } from '../services/guildApi';
import { testLabApi } from '../services/testLabApi';
import type {
  AssignGuildMembersRequest,
  TestLabAuditLog,
  BulkGuildPointsRequest,
  BulkWalletRequest,
  CleanupCounts,
  CleanupRequest,
  ScenarioRequest,
  SeedGuildsRequest,
  SeedUsersRequest,
  TestLabEndpointSpec,
  TestLabSummary,
} from '../types/testLab';

type LabTab = 'seed' | 'guilds' | 'wallet' | 'season' | 'scenario' | 'cleanup';

const TABS: { key: LabTab; label: string }[] = [
  { key: 'seed', label: '유저 생성' },
  { key: 'guilds', label: '길드/멤버/점수' },
  { key: 'wallet', label: '재화 일괄' },
  { key: 'season', label: '시즌 도구' },
  { key: 'scenario', label: '시나리오' },
  { key: 'cleanup', label: '정리' },
];

const endpointColumns: Column<TestLabEndpointSpec>[] = [
  {
    key: 'method',
    header: 'Method',
    render: (r) => <span className="font-mono text-xs text-zinc-300">{r.method}</span>,
  },
  {
    key: 'path',
    header: 'Path',
    render: (r) => <span className="font-mono text-xs text-zinc-300">{r.path}</span>,
  },
  {
    key: 'state',
    header: '상태',
    render: (r) => <StatusBadge label={r.state === 'implemented' ? '연결됨' : 'API 필요'} tone={r.state === 'implemented' ? 'success' : 'warning'} />,
  },
  {
    key: 'note',
    header: '설명',
    render: (r) => <span className="text-xs text-zinc-500">{r.note}</span>,
  },
];

const reasonHint = '모든 테스트 데이터 생성/변경은 감사 로그(testLabAuditLogs)용 reason이 필수입니다. (1~300자)';

/** 성공 후 관련 React Query 를 폭넓게 무효화해 화면(유저/길드/로그/요약)을 갱신한다. */
function useTestLabInvalidate() {
  const qc = useQueryClient();
  return () => {
    for (const key of testLabApi.invalidateQueryKeys) {
      void qc.invalidateQueries({ queryKey: [key] });
    }
  };
}

export function AdminTestLabPage() {
  const [tab, setTab] = useState<LabTab>('seed');
  const isProd = import.meta.env.PROD;
  const summaryQuery = useQuery({
    queryKey: ['test-lab-summary'],
    queryFn: testLabApi.summary,
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wide">테스트랩</h2>
        <InlineMessage kind="info">
          모든 작업은 <span className="text-zinc-300">super_admin 전용</span>이며, 생성되는 데이터에는 isTestUser/isTestGuild·seedBatchId·source=test-lab 가 붙어 실데이터와 구분됩니다. 변경 내역은 testLabAuditLogs 에 기록됩니다.
        </InlineMessage>
      </div>

      {isProd && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <p className="text-sm font-semibold text-red-400">Production 환경 감지</p>
          <p className="text-xs text-zinc-400 mt-1">
            테스트 데이터라도 production 에서는 신중히 사용하세요. 삭제는 dryRun 으로 먼저 확인하고, 실제 삭제 시 확인 문구(DELETE TEST DATA)가 필요합니다.
          </p>
        </div>
      )}

      <PageSection title="테스트 데이터 요약" description="QLapServices의 읽기 전용 summary API 결과입니다." accent>
        <QueryState isLoading={summaryQuery.isLoading} error={summaryQuery.error}>
          <SummaryPanel summary={summaryQuery.data} />
        </QueryState>
      </PageSection>

      <PageSection
        title="작업"
        right={
          <div className="flex flex-wrap gap-1">
            {TABS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={
                  tab === item.key
                    ? 'text-xs px-2.5 py-1 rounded bg-violet-600/20 border border-violet-500/50 text-violet-300'
                    : 'text-xs px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }
              >
                {item.label}
              </button>
            ))}
          </div>
        }
      >
        {tab === 'seed' && <SeedUsersPanel />}
        {tab === 'guilds' && <GuildLabPanel />}
        {tab === 'wallet' && <WalletPanel />}
        {tab === 'season' && <SeasonPanel />}
        {tab === 'scenario' && <ScenarioPanel />}
        {tab === 'cleanup' && <CleanupPanel />}
      </PageSection>

      <PageSection title="API 연결 상태" description="seed/scenario/cleanup 등 7개 mutation 은 QLapServices에 구현되어 실제 호출됩니다.">
        <DataTable
          columns={endpointColumns}
          data={testLabApi.endpoints}
          rowKey={(r) => r.key}
          emptyMessage="등록된 테스트랩 API 명세가 없습니다"
        />
        <div className="mt-3 text-xs text-zinc-500">
          성공 후 무효화 대상 쿼리: {testLabApi.invalidateQueryKeys.map((key) => <code key={key} className="ml-1 text-zinc-400">{key}</code>)}
        </div>
      </PageSection>
    </div>
  );
}

function SummaryPanel({ summary }: { summary: TestLabSummary | undefined }) {
  const currentSeason = summary?.currentSeason;
  const currentSeasonLabel = currentSeason
    ? [currentSeason.title, currentSeason.seasonId ?? currentSeason.id].filter(Boolean).join(' / ')
    : '–';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <SummaryCell label="테스트 유저" value={formatNumber(summary?.testUserCount)} />
        <SummaryCell label="테스트 길드" value={formatNumber(summary?.testGuildCount)} />
        <SummaryCell label="최근 seedBatchId" value={summary?.latestSeedBatchId ?? '–'} />
        <SummaryCell label="현재 시즌" value={currentSeasonLabel} />
        <SummaryCell label="최근 생성" value={formatDateTime(summary?.latestSeedCreatedAt)} />
      </div>
      {currentSeason?.status && (
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>현재 시즌 상태</span>
          <StatusBadge
            label={SEASON_STATUS_LABELS[currentSeason.status] ?? currentSeason.status}
            tone={currentSeason.status === 'ended' ? 'neutral' : 'accent'}
          />
        </div>
      )}
      <RecentAuditLogs logs={summary?.recentAuditLogs ?? []} />
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-900/50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-zinc-300 break-all">{value}</p>
    </div>
  );
}

function RecentAuditLogs({ logs }: { logs: TestLabAuditLog[] }) {
  const columns: Column<TestLabAuditLog>[] = [
    { key: 'createdAt', header: '시각', render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span> },
    { key: 'action', header: '작업', render: (row) => <span className="text-xs text-zinc-300">{row.action}</span> },
    { key: 'seedBatchId', header: 'seedBatchId', render: (row) => <span className="font-mono text-xs text-zinc-400">{row.seedBatchId ?? '–'}</span> },
    { key: 'dryRun', header: 'dryRun', render: (row) => <StatusBadge label={row.dryRun ? 'true' : 'false'} tone={row.dryRun ? 'warning' : 'neutral'} /> },
    { key: 'reason', header: '사유', render: (row) => <span className="text-xs text-zinc-400">{row.reason}</span> },
    { key: 'createdBy', header: '처리자', render: (row) => <span className="font-mono text-xs text-zinc-500">{row.createdBy}</span> },
  ];

  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">최근 테스트랩 감사 로그</p>
      <DataTable
        columns={columns}
        data={logs}
        rowKey={(row) => row.id}
        emptyMessage="테스트랩 감사 로그가 없습니다"
      />
    </div>
  );
}

function SeedUsersPanel() {
  const invalidate = useTestLabInvalidate();
  const [form, setForm] = useState<SeedUsersRequest>({
    count: 30,
    displayNamePrefix: '테스트유저',
    emailPrefix: 'testuser',
    mockProvider: 'guest',
    plan: 'free',
    role: 'user',
    identityVerified: false,
    createRiotProfile: true,
    initialQlCoin: 1000,
    reason: '길드 화면 테스트용',
  });
  const mutation = useMutation({ mutationFn: testLabApi.seedUsers, onSuccess: invalidate });
  const valid = form.count >= 1 && form.displayNamePrefix.trim() !== '' && form.emailPrefix.trim() !== '' && form.reason.trim().length >= 1;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid md:grid-cols-3 gap-3">
        <NumberField label="생성 수" value={form.count} min={1} max={200} onChange={(count) => setForm({ ...form, count })} required />
        <TextField label="닉네임 prefix" value={form.displayNamePrefix} onChange={(displayNamePrefix) => setForm({ ...form, displayNamePrefix })} required />
        <TextField label="이메일 prefix" value={form.emailPrefix} onChange={(emailPrefix) => setForm({ ...form, emailPrefix })} required />
        <SelectField
          label="mockProvider"
          value={form.mockProvider}
          onChange={(mockProvider) => setForm({ ...form, mockProvider: mockProvider as SeedUsersRequest['mockProvider'] })}
          options={['guest', 'google', 'kakao', 'mock'].map((value) => ({ value, label: value }))}
        />
        <SelectField
          label="기본 plan"
          value={form.plan}
          onChange={(plan) => setForm({ ...form, plan: plan as SeedUsersRequest['plan'] })}
          options={Object.entries(PLAN_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <NumberField label="시작 QL 코인" value={form.initialQlCoin} min={0} max={1000000} onChange={(initialQlCoin) => setForm({ ...form, initialQlCoin })} />
      </div>
      <ToggleRow label="identityVerified" checked={form.identityVerified} onChange={(identityVerified) => setForm({ ...form, identityVerified })} />
      <ToggleRow label="Riot ID 자동 생성" checked={form.createRiotProfile} onChange={(createRiotProfile) => setForm({ ...form, createRiotProfile })} />
      <TextAreaField label="reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} hint={reasonHint} required />
      <ActionRow
        label="테스트 유저 생성"
        confirmLabel="TEST DATA CREATE"
        pending={mutation.isPending}
        disabled={!valid}
        onRun={() => mutation.mutate(form)}
      />
      <ResultRow
        mutation={mutation}
        success={(data) => `${formatNumber(data.createdUserCount)}명 생성 완료 · seedBatchId ${data.seedBatchId}`}
      />
    </div>
  );
}

function GuildLabPanel() {
  const invalidate = useTestLabInvalidate();
  const [guilds, setGuilds] = useState<SeedGuildsRequest>({
    seasonId: '',
    count: 10,
    namePrefix: '테스트길드',
    slugPrefix: 'test-guild',
    maxMembers: 20,
    createOwners: true,
    useExistingTestUsers: true,
    status: 'active',
    reason: '길드 목록 테스트용',
  });
  const [members, setMembers] = useState<AssignGuildMembersRequest>({
    seasonId: '',
    guildId: '',
    targetAllTestGuilds: true,
    membersPerGuild: 5,
    roleRatio: { owner: 1, manager: 1, member: 3 },
    useExistingTestUsers: true,
    autoCreateMissingUsers: true,
    reason: '길드원 배치 테스트용',
  });
  const [points, setPoints] = useState<BulkGuildPointsRequest>({
    seasonId: '',
    guildId: '',
    targetAllTestGuilds: true,
    totalGuildPoint: 1000,
    soloRankPoint: 500,
    flexRankPoint: 300,
    discordActivityPoint: 200,
    distribution: 'random',
    reason: '길드 랭킹 테스트용',
  });

  const guildMutation = useMutation({ mutationFn: testLabApi.seedGuilds, onSuccess: invalidate });
  const memberMutation = useMutation({ mutationFn: testLabApi.assignGuildMembers, onSuccess: invalidate });
  const pointMutation = useMutation({ mutationFn: testLabApi.bulkGuildPoints, onSuccess: invalidate });

  return (
    <div className="grid xl:grid-cols-3 gap-4">
      <SubPanel title="테스트 길드 생성">
        <TextField label="seasonId" value={guilds.seasonId} onChange={(seasonId) => setGuilds({ ...guilds, seasonId })} required />
        <NumberField label="생성 수" value={guilds.count} min={1} max={200} onChange={(count) => setGuilds({ ...guilds, count })} required />
        <TextField label="길드명 prefix" value={guilds.namePrefix} onChange={(namePrefix) => setGuilds({ ...guilds, namePrefix })} required />
        <TextField label="slug prefix" value={guilds.slugPrefix} onChange={(slugPrefix) => setGuilds({ ...guilds, slugPrefix })} required />
        <NumberField label="maxMembers" value={guilds.maxMembers} min={1} max={200} onChange={(maxMembers) => setGuilds({ ...guilds, maxMembers })} />
        <SelectField label="상태" value={guilds.status} onChange={(status) => setGuilds({ ...guilds, status: status as SeedGuildsRequest['status'] })} options={[{ value: 'active', label: '활성' }, { value: 'locked', label: '잠김' }]} />
        <ToggleRow label="owner 자동 생성" checked={guilds.createOwners} onChange={(createOwners) => setGuilds({ ...guilds, createOwners })} />
        <ToggleRow label="기존 테스트 유저 사용" checked={guilds.useExistingTestUsers} onChange={(useExistingTestUsers) => setGuilds({ ...guilds, useExistingTestUsers })} />
        <TextAreaField label="reason" value={guilds.reason} onChange={(reason) => setGuilds({ ...guilds, reason })} required />
        <ActionRow
          label="테스트 길드 생성"
          confirmLabel="TEST DATA CREATE"
          pending={guildMutation.isPending}
          disabled={guilds.seasonId.trim() === '' || guilds.count < 1 || guilds.reason.trim() === ''}
          onRun={() => guildMutation.mutate(guilds)}
        />
        <ResultRow mutation={guildMutation} success={(d) => `길드 ${formatNumber(d.createdGuildCount)}개 생성 · seedBatchId ${d.seedBatchId}`} />
      </SubPanel>

      <SubPanel title="길드원 자동 배치">
        <TextField label="seasonId" value={members.seasonId} onChange={(seasonId) => setMembers({ ...members, seasonId })} required />
        <TextField label="guildId" value={members.guildId ?? ''} onChange={(guildId) => setMembers({ ...members, guildId })} hint="비우면 전체 테스트 길드 대상" />
        <NumberField label="길드당 인원" value={members.membersPerGuild} min={1} max={200} onChange={(membersPerGuild) => setMembers({ ...members, membersPerGuild })} />
        {(['owner', 'manager', 'member'] as const).map((role) => (
          <NumberField
            key={role}
            label={`${GUILD_MEMBER_ROLE_LABELS[role]} 비율`}
            value={members.roleRatio[role]}
            min={0}
            max={200}
            onChange={(value) => setMembers({ ...members, roleRatio: { ...members.roleRatio, [role]: value } })}
          />
        ))}
        <ToggleRow label="부족하면 테스트 유저 자동 생성" checked={members.autoCreateMissingUsers} onChange={(autoCreateMissingUsers) => setMembers({ ...members, autoCreateMissingUsers })} />
        <TextAreaField label="reason" value={members.reason} onChange={(reason) => setMembers({ ...members, reason })} required />
        <ActionRow
          label="길드원 배치"
          confirmLabel="TEST DATA CREATE"
          pending={memberMutation.isPending}
          disabled={members.seasonId.trim() === '' || members.reason.trim() === ''}
          onRun={() => memberMutation.mutate(members)}
        />
        <ResultRow mutation={memberMutation} success={(d) => `길드 ${formatNumber(d.guildCount)}개에 멤버 ${formatNumber(d.assignedMembers)}명 배치`} />
      </SubPanel>

      <SubPanel title="길드 포인트 조작">
        <TextField label="seasonId" value={points.seasonId} onChange={(seasonId) => setPoints({ ...points, seasonId })} required />
        <TextField label="guildId" value={points.guildId ?? ''} onChange={(guildId) => setPoints({ ...points, guildId })} hint="비우면 전체 테스트 길드 대상" />
        <NumberField label="총 길드 포인트" value={points.totalGuildPoint} min={0} max={10000000} onChange={(totalGuildPoint) => setPoints({ ...points, totalGuildPoint })} />
        <NumberField label="솔로 랭크 점수" value={points.soloRankPoint} min={0} max={10000000} onChange={(soloRankPoint) => setPoints({ ...points, soloRankPoint })} />
        <NumberField label="자유 랭크 점수" value={points.flexRankPoint} min={0} max={10000000} onChange={(flexRankPoint) => setPoints({ ...points, flexRankPoint })} />
        <NumberField label="디스코드 활동 점수" value={points.discordActivityPoint} min={0} max={10000000} onChange={(discordActivityPoint) => setPoints({ ...points, discordActivityPoint })} />
        <SelectField
          label="분포"
          value={points.distribution}
          onChange={(distribution) => setPoints({ ...points, distribution: distribution as BulkGuildPointsRequest['distribution'] })}
          options={[{ value: 'even', label: '균등' }, { value: 'random', label: '랜덤' }, { value: 'top_heavy', label: '상위 집중' }]}
        />
        <TextAreaField label="reason" value={points.reason} onChange={(reason) => setPoints({ ...points, reason })} required />
        <ActionRow
          label="포인트 적용"
          confirmLabel="TEST DATA CREATE"
          pending={pointMutation.isPending}
          disabled={points.seasonId.trim() === '' || points.reason.trim() === ''}
          onRun={() => pointMutation.mutate(points)}
        />
        <ResultRow mutation={pointMutation} success={(d) => `길드 ${formatNumber(d.guildCount)}개 포인트 적용 · ${d.rankingNote}`} />
      </SubPanel>
    </div>
  );
}

function WalletPanel() {
  const invalidate = useTestLabInvalidate();
  const [form, setForm] = useState<BulkWalletRequest>({
    uid: '',
    guildId: '',
    target: 'allTestUsers',
    currency: 'qlcoin',
    direction: 'grant',
    amount: 1000,
    reason: '재화/상점 테스트용',
  });
  const mutation = useMutation({ mutationFn: testLabApi.bulkWallet, onSuccess: invalidate });
  const valid =
    form.amount >= 0 &&
    form.reason.trim() !== '' &&
    (form.target !== 'singleUser' || (form.uid ?? '').trim() !== '') &&
    (form.target !== 'guildMembers' || (form.guildId ?? '').trim() !== '');

  return (
    <div className="max-w-xl flex flex-col gap-3">
      <SelectField
        label="대상"
        value={form.target}
        onChange={(target) => setForm({ ...form, target: target as BulkWalletRequest['target'] })}
        options={[{ value: 'allTestUsers', label: '테스트 유저 전체' }, { value: 'singleUser', label: 'UID 직접 입력' }, { value: 'guildMembers', label: '특정 길드원 전체' }]}
      />
      <TextField label="UID" value={form.uid ?? ''} onChange={(uid) => setForm({ ...form, uid })} hint="대상이 'UID 직접 입력'일 때 필수 (테스트 유저만 가능)" />
      <TextField label="guildId" value={form.guildId ?? ''} onChange={(guildId) => setForm({ ...form, guildId })} hint="대상이 '특정 길드원'일 때 필수 (테스트 길드만 가능)" />
      <div className="grid md:grid-cols-3 gap-3">
        <SelectField label="재화" value={form.currency} onChange={(currency) => setForm({ ...form, currency: currency as BulkWalletRequest['currency'] })} options={Object.entries(CURRENCY_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="방향" value={form.direction} onChange={(direction) => setForm({ ...form, direction: direction as BulkWalletRequest['direction'] })} options={[{ value: 'grant', label: '지급' }, { value: 'revoke', label: '차감' }, { value: 'set', label: '설정' }]} />
        <NumberField label="수량" value={form.amount} min={0} max={10000000} onChange={(amount) => setForm({ ...form, amount })} required />
      </div>
      <TextAreaField label="reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} hint={reasonHint} required />
      <ActionRow
        label="재화 일괄 적용"
        confirmLabel="TEST DATA CREATE"
        pending={mutation.isPending}
        disabled={!valid}
        onRun={() => mutation.mutate(form)}
      />
      <ResultRow mutation={mutation} success={(d) => `대상 ${formatNumber(d.targeted)}명 중 ${formatNumber(d.changed)}명 변경 (${d.currency}/${d.direction})`} />
    </div>
  );
}

function SeasonPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    seasonId: '',
    topN: 100,
    reason: '길드 랭킹 스냅샷 재생성',
  });
  const rebuildMutation = useMutation({
    mutationFn: (input: { dryRun: boolean }) =>
      guildApi.rebuildRankingSnapshot(form.seasonId.trim(), {
        dryRun: input.dryRun,
        topN: form.topN,
        reason: form.reason.trim(),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-guilds'] });
      void qc.invalidateQueries({ queryKey: ['test-lab-summary'] });
    },
  });
  const plannedEndpoints = testLabApi.endpoints.filter((e) => e.key === 'season-clone');
  const valid = form.seasonId.trim() !== '' && form.topN >= 1 && form.topN <= 500 && form.reason.trim() !== '';

  return (
    <div className="max-w-3xl flex flex-col gap-4">
      <InlineMessage kind="info">
        시즌 상태 변경은 <span className="text-zinc-300">시즌 관리</span> 페이지에서 처리합니다. 랭킹 재계산은 QLapGuild의 스냅샷 rebuild API에 연결되며, 미리보기는 write 없이 실행됩니다.
      </InlineMessage>
      <SubPanel title="길드 랭킹 스냅샷 재생성">
        <TextField label="seasonId" value={form.seasonId} onChange={(seasonId) => setForm({ ...form, seasonId })} required />
        <NumberField label="topN" value={form.topN} min={1} max={500} onChange={(topN) => setForm({ ...form, topN })} />
        <TextAreaField label="reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} hint="admin audit와 스냅샷 근거에 남길 사유입니다." required />
        <div className="flex flex-wrap items-center gap-3">
          <ConfirmButton
            tone="neutral"
            confirmLabel="dryRun 실행"
            disabled={!valid || rebuildMutation.isPending}
            onConfirm={() => rebuildMutation.mutate({ dryRun: true })}
          >
            {rebuildMutation.isPending ? '처리 중...' : '미리보기'}
          </ConfirmButton>
          <ConfirmButton
            tone="danger"
            confirmLabel="REBUILD RANKING SNAPSHOT"
            disabled={!valid || rebuildMutation.isPending}
            onConfirm={() => rebuildMutation.mutate({ dryRun: false })}
          >
            실제 스냅샷 생성
          </ConfirmButton>
          <span className="text-xs text-zinc-500">실제 생성은 QLapGuild Redis 랭킹 캐시를 무효화합니다.</span>
        </div>
        <RankingRebuildResult result={rebuildMutation.data} error={rebuildMutation.error} />
      </SubPanel>
      {plannedEndpoints.length > 0 && (
        <NotImplementedNotice
          title="아직 계획 상태인 시즌 도구"
          reason="시즌 복제는 별도 백엔드 정책이 필요해 아직 버튼을 열지 않았습니다. 기존 시즌 생성/수정/롤오버는 시즌 관리 페이지에서 사용하세요."
          endpoints={plannedEndpoints}
        />
      )}
    </div>
  );
}

function RankingRebuildResult({ result, error }: { result: GuildRankingRebuildResult | undefined; error: unknown }) {
  if (error) return <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage>;
  if (!result) return null;
  const rowCount = Array.isArray(result.snapshot?.rows) ? result.snapshot.rows.length : 0;
  return (
    <InlineMessage kind={result.wrote ? 'success' : 'info'}>
      {result.wrote ? '스냅샷 생성 완료' : '미리보기 완료'} · seasonId {result.documentId} · guildCount {formatNumber(result.snapshot?.guildCount)} · rows {formatNumber(rowCount)} · Server DB read {formatNumber(result.estimatedServerDbReadCount)} · Server DB write {formatNumber(result.estimatedServerDbWriteCount)}
    </InlineMessage>
  );
}

function ScenarioPanel() {
  const invalidate = useTestLabInvalidate();
  const [form, setForm] = useState<ScenarioRequest>({
    scenario: 'starter_demo',
    seasonId: '',
    reason: '초기 스피드 데모 구성',
  });
  const mutation = useMutation({ mutationFn: testLabApi.scenario, onSuccess: invalidate });

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="flex flex-col gap-3">
        <SelectField
          label="시나리오"
          value={form.scenario}
          onChange={(scenario) => setForm({ ...form, scenario: scenario as ScenarioRequest['scenario'] })}
          options={[
            { value: 'starter_demo', label: '초기 스피드 데모' },
            { value: 'guild_ranking', label: '길드 경쟁 화면 테스트' },
            { value: 'tournament_advance', label: '토너먼트 진출 테스트' },
            { value: 'wallet_shop', label: '재화/상점 테스트' },
          ]}
        />
        <TextField label="seasonId" value={form.seasonId ?? ''} onChange={(seasonId) => setForm({ ...form, seasonId })} hint="비우면 현재 진행 시즌 사용" />
        <TextAreaField label="reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} required />
        <ActionRow
          label="시나리오 실행"
          confirmLabel="TEST DATA CREATE"
          pending={mutation.isPending}
          disabled={form.reason.trim() === ''}
          onRun={() => mutation.mutate(form)}
        />
        <ResultRow
          mutation={mutation}
          success={(d) => `[${d.scenario}] 실행 완료 · seedBatchId ${d.seedBatchId}` + (d.users != null ? ` · 유저 ${formatNumber(d.users)}` : '') + (d.guilds != null ? ` · 길드 ${formatNumber(d.guilds)}` : '')}
        />
      </div>
      <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-4 text-xs text-zinc-500 leading-relaxed">
        <p className="font-medium text-zinc-300 mb-2">구성 예시</p>
        <p>초기 스피드 데모: 테스트 유저 50명, 길드 10개, 길드당 5명, 유저별 QL 코인 1000.</p>
        <p className="mt-2">길드 경쟁: 유저 40명 + 길드 20개 + 랜덤 포인트로 순위 형성.</p>
        <p className="mt-2">토너먼트 진출: 길드 16개, 상위 집중 포인트 부여.</p>
        <p className="mt-2">재화/상점: 테스트 유저 30명에 QL 코인 5000 지급.</p>
        <p className="mt-3 text-zinc-600">하나의 seedBatchId 로 묶여 생성되어 정리 탭에서 한 번에 삭제할 수 있습니다.</p>
      </div>
    </div>
  );
}

const CLEANUP_TARGETS = ['users', 'guilds', 'members', 'wallets', 'linkedAccounts', 'logs'] as const;

function CleanupPanel() {
  const invalidate = useTestLabInvalidate();
  const [form, setForm] = useState<CleanupRequest>({
    seedBatchId: '',
    targets: ['users', 'guilds', 'members', 'wallets', 'linkedAccounts'],
    dryRun: true,
    confirmation: '',
    reason: '테스트 데이터 정리',
  });
  const mutation = useMutation({ mutationFn: testLabApi.cleanup, onSuccess: invalidate });
  const baseValid = form.seedBatchId.trim() !== '' && form.targets.length > 0 && form.reason.trim() !== '';
  const canDelete = baseValid && form.confirmation === 'DELETE TEST DATA';

  return (
    <div className="max-w-2xl flex flex-col gap-3">
      <TextField label="seedBatchId" value={form.seedBatchId} onChange={(seedBatchId) => setForm({ ...form, seedBatchId })} hint="생성 시 반환된 seedBatchId. 이 배치의 테스트 데이터만 삭제됩니다." required />
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
        {CLEANUP_TARGETS.map((target) => (
          <label key={target} className="flex items-center gap-2 rounded border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={form.targets.includes(target)}
              onChange={(event) =>
                setForm({
                  ...form,
                  targets: event.target.checked
                    ? [...form.targets, target]
                    : form.targets.filter((item) => item !== target),
                })
              }
            />
            {target}
          </label>
        ))}
      </div>
      <TextField label="실제 삭제 확인 문구" value={form.confirmation} onChange={(confirmation) => setForm({ ...form, confirmation })} hint="실제 삭제 시 DELETE TEST DATA를 정확히 입력" />
      <TextAreaField label="reason" value={form.reason} onChange={(reason) => setForm({ ...form, reason })} required />
      <div className="flex items-center gap-3">
        <ConfirmButton
          tone="neutral"
          confirmLabel="dryRun 실행"
          disabled={!baseValid || mutation.isPending}
          onConfirm={() => mutation.mutate({ ...form, dryRun: true })}
        >
          {mutation.isPending ? '처리 중...' : 'dryRun 실행'}
        </ConfirmButton>
        <ConfirmButton
          tone="danger"
          confirmLabel="삭제 확정"
          disabled={!canDelete || mutation.isPending}
          onConfirm={() => mutation.mutate({ ...form, dryRun: false })}
        >
          실제 삭제
        </ConfirmButton>
        <InlineMessage kind="info">실제 삭제는 isTestUser/isTestGuild + seedBatchId 가 있는 데이터만 지웁니다.</InlineMessage>
      </div>
      <ResultRow
        mutation={mutation}
        success={(d) => {
          const counts = d.deleted ?? d.wouldDelete;
          const label = d.dryRun ? 'dryRun(미삭제)' : '삭제 완료';
          return `${label} · ${counts ? formatCleanupCounts(counts) : ''}`;
        }}
      />
    </div>
  );
}

function formatCleanupCounts(counts: CleanupCounts): string {
  return (Object.entries(counts) as [keyof CleanupCounts, number][])
    .filter(([, value]) => value > 0)
    .map(([key, value]) => `${key} ${value}`)
    .join(', ') || '대상 없음';
}

function SubPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-zinc-700/60 bg-zinc-900/30 p-4 flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{title}</p>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-400">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function ActionRow({
  label,
  confirmLabel,
  pending,
  disabled,
  onRun,
  tone = 'danger',
}: {
  label: string;
  confirmLabel: string;
  pending: boolean;
  disabled: boolean;
  onRun: () => void;
  tone?: 'danger' | 'primary' | 'neutral';
}) {
  return (
    <div className="flex items-center gap-3">
      <ConfirmButton tone={tone} confirmLabel={confirmLabel} disabled={disabled || pending} onConfirm={onRun}>
        {pending ? '처리 중...' : label}
      </ConfirmButton>
    </div>
  );
}

function ResultRow<T>({
  mutation,
  success,
}: {
  mutation: { isSuccess: boolean; isError: boolean; data: T | undefined; error: unknown };
  success: (data: T) => string;
}) {
  if (mutation.isError) {
    return <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>;
  }
  if (mutation.isSuccess && mutation.data !== undefined) {
    return <InlineMessage kind="success">{success(mutation.data)}</InlineMessage>;
  }
  return null;
}

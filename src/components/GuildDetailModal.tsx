import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';
import { CopyableId } from './CopyableId';
import { ConfirmButton } from './ConfirmButton';
import { InlineMessage } from './InlineMessage';
import { GuildEmblemEditor, GuildEmblemPreview } from './GuildEmblemTools';
import { DataTable, type Column } from './DataTable';
import { NumberField, SelectField, TextAreaField, TextField } from './Field';
import { guildApi } from '../services/guildApi';
import { errorToMessage } from '../lib/apiError';
import {
  GUILD_STATUSES,
  GUILD_STATUS_LABELS,
  GUILD_MEMBER_ROLE_LABELS,
  GUILD_MEMBER_STATUS_LABELS,
  type GuildStatus,
} from '../lib/constants';
import { guildStatusTone, memberStatusTone } from '../lib/statusTone';
import { formatDate, formatDateTime, formatNumber, formatSignedNumber } from '../lib/format';
import type { Guild, GuildMember, GuildActionLog, GuildPointLog } from '../types/guild';
import type { GuildMemberScoreDiagnostic, GuildMemberScoreDiagnosticSource } from '../services/guildApi';

interface GuildDetailModalProps {
  guildId: string;
  open: boolean;
  onClose: () => void;
}

type Tab = 'info' | 'members' | 'logs' | 'manage';

const TABS: { key: Tab; label: string }[] = [
  { key: 'info', label: '정보' },
  { key: 'members', label: '길드원' },
  { key: 'logs', label: '로그' },
  { key: 'manage', label: '관리' },
];

const ADD_ROLE_OPTIONS = [
  { value: 'member', label: GUILD_MEMBER_ROLE_LABELS.member },
  { value: 'manager', label: GUILD_MEMBER_ROLE_LABELS.manager },
] as const;

export function GuildDetailModal({ guildId, open, onClose }: GuildDetailModalProps) {
  const [tab, setTab] = useState<Tab>('info');
  const qc = useQueryClient();

  const guildQ = useQuery({ queryKey: ['guild', guildId], queryFn: () => guildApi.get(guildId), enabled: open });
  const membersQ = useQuery({
    queryKey: ['guild', guildId, 'members'],
    queryFn: () => guildApi.members(guildId),
    enabled: open && (tab === 'members' || tab === 'manage'),
  });
  const logsQ = useQuery({
    queryKey: ['guild', guildId, 'logs'],
    queryFn: () => guildApi.logs(guildId),
    enabled: open && tab === 'logs',
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['admin-guilds'] });
    void qc.invalidateQueries({ queryKey: ['guild', guildId] });
    void qc.invalidateQueries({ queryKey: ['guild', guildId, 'members'] });
    void qc.invalidateQueries({ queryKey: ['guild', guildId, 'logs'] });
  };

  const kickMut = useMutation({
    mutationFn: (uid: string) => guildApi.kickMember(guildId, uid),
    onSuccess: invalidate,
  });

  const guild = guildQ.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={guild ? guild.name : '길드 상세'}
      headerRight={guild && <StatusBadge label={GUILD_STATUS_LABELS[guild.status]} tone={guildStatusTone(guild.status)} />}
    >
      <QueryState isLoading={guildQ.isLoading} error={guildQ.error}>
        {guild && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1 border-b border-zinc-700/60">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTab(item.key)}
                  className={
                    tab === item.key
                      ? '-mb-px border-b-2 border-violet-500 px-3 py-2 text-sm text-violet-300'
                      : 'px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300'
                  }
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === 'info' && <GuildInfo guild={guild} />}

            {tab === 'members' && (
              <div className="flex flex-col gap-3">
                <AddMemberForm guildId={guildId} onInvalidate={invalidate} />
                <QueryState isLoading={membersQ.isLoading} error={membersQ.error}>
                  <MembersTable
                    guildId={guildId}
                    members={membersQ.data ?? []}
                    onKick={(uid) => kickMut.mutate(uid)}
                    kicking={kickMut.isPending}
                  />
                  {kickMut.isError && <InlineMessage kind="error" className="mt-2">{errorToMessage(kickMut.error)}</InlineMessage>}
                </QueryState>
              </div>
            )}

            {tab === 'logs' && (
              <QueryState isLoading={logsQ.isLoading} error={logsQ.error}>
                <GuildLogTables actions={logsQ.data?.guildActions ?? []} points={logsQ.data?.guildPoints ?? []} />
              </QueryState>
            )}

            {tab === 'manage' && <ManageTab key={guild.guildId} guild={guild} onInvalidate={invalidate} onDeleted={onClose} />}
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

function GuildInfo({ guild }: { guild: Guild }) {
  return (
    <div className="flex flex-col gap-4">
      <GuildEmblemPreview guild={guild} />

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4 text-sm md:grid-cols-3">
        <Info label="길드 ID"><CopyableId value={guild.guildId} full /></Info>
        <Info label="슬러그">{guild.slug}</Info>
        <Info label="시즌">{guild.seasonId}</Info>
        <Info label="길드장 UID"><CopyableId value={guild.ownerUid} /></Info>
        <Info label="인원">{guild.memberCount} / {guild.maxMembers}</Info>
        <Info label="현재 순위">{guild.currentSeasonRank ?? '-'}</Info>
        <Info label="지역">{guild.region}</Info>
        <Info label="생성일">{formatDate(guild.createdAt)}</Info>
        <Info label="디스코드">{guild.discordUrl ?? '-'}</Info>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4 text-sm md:grid-cols-4">
        <Info label="총 길드 포인트"><span className="font-mono">{formatNumber(guild.totalGuildPoint)}</span></Info>
        <Info label="솔로 랭크"><span className="font-mono">{formatNumber(guild.soloRankPoint)}</span></Info>
        <Info label="자유 랭크"><span className="font-mono">{formatNumber(guild.flexRankPoint)}</span></Info>
        <Info label="디스코드 활동"><span className="font-mono">{formatNumber(guild.discordActivityPoint)}</span></Info>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-violet-700/40 bg-violet-900/10 p-4 text-sm md:grid-cols-3">
        <Info label="길드 스코어">
          <span className="font-mono text-violet-300">{guild.guildScore != null ? formatNumber(guild.guildScore) : '-'}</span>
        </Info>
        <Info label="대표 로스터">
          <span className="text-xs text-zinc-400">{(guild.scoreRoster ?? guild.rosterUids ?? []).length}명 합산</span>
        </Info>
      </div>

      {guild.description && (
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
          <p className="mb-1 text-xs text-zinc-500">소개</p>
          <p className="whitespace-pre-wrap text-sm text-zinc-300">{guild.description}</p>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-0.5 text-zinc-300">{children}</div>
    </div>
  );
}

function ManageTab({
  guild,
  onInvalidate,
  onDeleted,
}: {
  guild: Guild;
  onInvalidate: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(guild.name);
  const [description, setDescription] = useState(guild.description ?? '');
  const [maxMembers, setMaxMembers] = useState(guild.maxMembers);
  const [status, setStatus] = useState<GuildStatus>(guild.status);
  const [newOwnerUid, setNewOwnerUid] = useState('');
  const [transferFromUid, setTransferFromUid] = useState('');
  const [transferToUid, setTransferToUid] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const updateMut = useMutation({
    mutationFn: (input: Parameters<typeof guildApi.update>[1]) => guildApi.update(guild.guildId, input),
    onSuccess: onInvalidate,
  });
  const ownerMut = useMutation({
    mutationFn: (uid: string) => guildApi.changeOwner(guild.guildId, uid),
    onSuccess: () => {
      onInvalidate();
      setNewOwnerUid('');
    },
  });
  const transferMut = useMutation({
    mutationFn: () =>
      guildApi.transferMemberUid(guild.guildId, {
        fromUid: transferFromUid.trim(),
        toUid: transferToUid.trim(),
        reason: transferReason.trim(),
      }),
    onSuccess: () => {
      onInvalidate();
      setTransferFromUid('');
      setTransferToUid('');
      setTransferReason('');
    },
  });
  const deleteMut = useMutation({
    mutationFn: (phrase: string) => guildApi.remove(guild.guildId, phrase),
    onSuccess: () => {
      onInvalidate();
      onDeleted();
    },
  });

  const statusOptions = GUILD_STATUSES.map((item) => ({ value: item, label: GUILD_STATUS_LABELS[item] }));
  const hasBasicChanges =
    name.trim() !== guild.name ||
    description !== (guild.description ?? '') ||
    maxMembers !== guild.maxMembers ||
    status !== guild.status;

  return (
    <div className="flex flex-col gap-4">
      <Section title="엠블럼">
        <GuildEmblemEditor guild={guild} onInvalidate={onInvalidate} />
      </Section>

      <Section title="상태 빠른 변경">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={GUILD_STATUS_LABELS[guild.status]} tone={guildStatusTone(guild.status)} />
          {guild.status !== 'active' && (
            <ConfirmButton tone="primary" confirmLabel="활성화 확정" disabled={updateMut.isPending} onConfirm={() => updateMut.mutate({ status: 'active' })}>
              활성화
            </ConfirmButton>
          )}
          {guild.status !== 'locked' && (
            <ConfirmButton tone="neutral" confirmLabel="잠금 확정" disabled={updateMut.isPending} onConfirm={() => updateMut.mutate({ status: 'locked' })}>
              잠금
            </ConfirmButton>
          )}
          {guild.status !== 'disbanded' && (
            <ConfirmButton tone="danger" confirmLabel="해체 확정" disabled={updateMut.isPending} onConfirm={() => updateMut.mutate({ status: 'disbanded' })}>
              해체
            </ConfirmButton>
          )}
          {guild.status !== 'banned' && (
            <ConfirmButton tone="danger" confirmLabel="정지 확정" disabled={updateMut.isPending} onConfirm={() => updateMut.mutate({ status: 'banned' })}>
              정지
            </ConfirmButton>
          )}
        </div>
      </Section>

      <Section title="기본 정보 수정">
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="길드명" value={name} onChange={setName} required />
          <NumberField label="최대 인원" value={maxMembers} min={1} max={300} onChange={setMaxMembers} />
          <SelectField label="상태" value={status} onChange={(value) => setStatus(value as GuildStatus)} options={statusOptions} />
        </div>
        <TextAreaField label="소개" value={description} onChange={setDescription} />
        <div className="flex items-center gap-3">
          <ConfirmButton
            tone="primary"
            confirmLabel="저장 확정"
            disabled={updateMut.isPending || name.trim().length < 2 || !hasBasicChanges}
            onConfirm={() => updateMut.mutate({ name: name.trim(), description, maxMembers, status })}
          >
            {updateMut.isPending ? '저장 중...' : '저장'}
          </ConfirmButton>
          {updateMut.isSuccess && <InlineMessage kind="success">저장되었습니다.</InlineMessage>}
          {updateMut.isError && <InlineMessage kind="error">{errorToMessage(updateMut.error)}</InlineMessage>}
        </div>
      </Section>

      <Section title="길드장 변경">
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="새 길드장 UID"
            value={newOwnerUid}
            onChange={setNewOwnerUid}
            className="min-w-[260px]"
            hint="기존 길드원을 owner로 승격합니다."
          />
          <ConfirmButton
            tone="primary"
            confirmLabel="길드장 변경 확정"
            disabled={ownerMut.isPending || newOwnerUid.trim() === ''}
            onConfirm={() => ownerMut.mutate(newOwnerUid.trim())}
          >
            길드장 변경
          </ConfirmButton>
        </div>
        {ownerMut.isSuccess && <InlineMessage kind="success" className="mt-2">길드장이 변경되었습니다.</InlineMessage>}
        {ownerMut.isError && <InlineMessage kind="error" className="mt-2">{errorToMessage(ownerMut.error)}</InlineMessage>}
      </Section>

      <Section title="길드 계정 UID 이관">
        <p className="mb-3 text-xs text-zinc-400">
          같은 유저가 새 계정으로 바뀐 경우에만 사용하세요. 기존 UID는 left 처리하고 새 UID가 같은 역할의 active 멤버가 됩니다.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField label="기존 UID" value={transferFromUid} onChange={setTransferFromUid} placeholder="현재 길드원 UID" />
          <TextField label="새 UID" value={transferToUid} onChange={setTransferToUid} placeholder="이관받을 새 계정 UID" />
        </div>
        <TextAreaField
          label="이관 사유"
          value={transferReason}
          onChange={setTransferReason}
          placeholder="예: Google 계정 변경으로 기존 길드 소속 이관"
        />
        <div className="flex items-center gap-3">
          <ConfirmButton
            tone="primary"
            confirmLabel="UID 이관 확정"
            disabled={
              transferMut.isPending ||
              transferFromUid.trim() === '' ||
              transferToUid.trim() === '' ||
              transferFromUid.trim() === transferToUid.trim() ||
              transferReason.trim().length < 3
            }
            onConfirm={() => transferMut.mutate()}
          >
            {transferMut.isPending ? '이관 중...' : 'UID 이관'}
          </ConfirmButton>
          {transferMut.isSuccess && <InlineMessage kind="success">길드 계정 이관이 완료되었습니다.</InlineMessage>}
          {transferMut.isError && <InlineMessage kind="error">{errorToMessage(transferMut.error)}</InlineMessage>}
        </div>
      </Section>

      <Section title="완전 삭제 (복구 불가)" danger>
        <p className="mb-2 text-xs text-zinc-400">
          길드 문서와 멤버 연결을 제거합니다. 보통은 해체/정지를 먼저 사용하세요.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="확인 문구"
            value={confirmation}
            onChange={setConfirmation}
            hint="정확히 DELETE GUILD 입력"
            className="min-w-[220px]"
          />
          <ConfirmButton
            tone="danger"
            confirmLabel="영구 삭제 확정"
            disabled={deleteMut.isPending || confirmation !== 'DELETE GUILD'}
            onConfirm={() => deleteMut.mutate(confirmation)}
          >
            완전 삭제
          </ConfirmButton>
        </div>
        {deleteMut.isError && <InlineMessage kind="error" className="mt-2">{errorToMessage(deleteMut.error)}</InlineMessage>}
      </Section>
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 ${danger ? 'border-red-500/30 bg-red-500/5' : 'border-zinc-700/60 bg-zinc-800/40'}`}>
      <h3 className={`mb-3 text-xs font-medium uppercase tracking-wide ${danger ? 'text-red-300' : 'text-zinc-500'}`}>{title}</h3>
      {children}
    </div>
  );
}

function AddMemberForm({ guildId, onInvalidate }: { guildId: string; onInvalidate: () => void }) {
  const [uid, setUid] = useState('');
  const [role, setRole] = useState<'member' | 'manager'>('member');

  const addMut = useMutation({
    mutationFn: () => guildApi.addMember(guildId, { uid: uid.trim(), role }),
    onSuccess: () => {
      onInvalidate();
      setUid('');
      setRole('member');
    },
  });

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="길드원 추가 (UID)"
          value={uid}
          onChange={setUid}
          placeholder="추가할 유저 UID"
          className="min-w-[240px] flex-1"
          hint="관리자 직접 추가입니다. 가입 조건, 티켓, 본인 인증 절차를 건너뜁니다."
        />
        <SelectField
          label="역할"
          value={role}
          onChange={(value) => setRole(value as 'member' | 'manager')}
          options={ADD_ROLE_OPTIONS}
          className="w-32"
        />
        <ConfirmButton
          tone="primary"
          confirmLabel="길드원 추가 확정"
          disabled={addMut.isPending || uid.trim() === ''}
          onConfirm={() => addMut.mutate()}
        >
          {addMut.isPending ? '추가 중...' : '+ 추가'}
        </ConfirmButton>
      </div>
      {addMut.isSuccess && <InlineMessage kind="success" className="mt-2">길드원이 추가되었습니다.</InlineMessage>}
      {addMut.isError && <InlineMessage kind="error" className="mt-2">{errorToMessage(addMut.error)}</InlineMessage>}
    </div>
  );
}

function MembersTable({
  guildId,
  members,
  onKick,
  kicking,
}: {
  guildId: string;
  members: GuildMember[];
  onKick: (uid: string) => void;
  kicking: boolean;
}) {
  const [diagnosticTarget, setDiagnosticTarget] = useState<GuildMember | null>(null);
  const diagnosticPublicId = diagnosticTarget?.memberPublicId ?? '';
  const diagnosticQ = useQuery({
    queryKey: ['guild', guildId, 'member-score-diagnostic', diagnosticPublicId],
    queryFn: () => guildApi.memberScoreDiagnostic(guildId, diagnosticPublicId),
    enabled: diagnosticPublicId.length > 0,
  });

  const columns: Column<GuildMember>[] = [
    { key: 'uid', header: 'UID', render: (row) => <CopyableId value={row.uid} /> },
    { key: 'riotId', header: 'Riot ID', render: (row) => <span className="text-xs text-zinc-400">{row.riotId ?? '-'}</span> },
    { key: 'role', header: '역할', render: (row) => <span className="text-xs text-zinc-300">{GUILD_MEMBER_ROLE_LABELS[row.role] ?? row.role}</span> },
    {
      key: 'memberScore',
      header: '전투력',
      render: (row) =>
        row.memberScore != null ? (
          <span className="font-mono text-xs text-violet-300">{row.memberScore}</span>
        ) : (
          <span className="text-xs text-zinc-600">-</span>
        ),
    },
    {
      key: 'status',
      header: '상태',
      render: (row) => <StatusBadge label={GUILD_MEMBER_STATUS_LABELS[row.status] ?? row.status} tone={memberStatusTone(row.status)} />,
    },
    {
      key: 'joinedAt',
      header: '가입일',
      render: (row) => <span className="font-mono text-xs text-zinc-500">{formatDate(row.joinedAt)}</span>,
    },
    {
      key: 'diagnostic',
      header: '점수 출처',
      render: (row) =>
        row.memberPublicId ? (
          <button
            type="button"
            onClick={() => setDiagnosticTarget(row)}
            className="rounded border border-violet-500/40 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/10"
          >
            진단
          </button>
        ) : (
          <span className="text-xs text-zinc-600">publicId 없음</span>
        ),
    },
    {
      key: 'action',
      header: '관리',
      render: (row) =>
        row.role === 'owner' ? (
          <span className="text-xs text-zinc-600">길드장</span>
        ) : row.status === 'active' ? (
          <ConfirmButton tone="danger" confirmLabel="강제 탈퇴 확정" disabled={kicking} onConfirm={() => onKick(row.uid)}>
            강제 탈퇴
          </ConfirmButton>
        ) : (
          <span className="text-xs text-zinc-600">-</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <DataTable columns={columns} data={members} rowKey={(row) => row.id} emptyMessage="길드원이 없습니다" />
      {diagnosticTarget && (
        <MemberScoreDiagnosticPanel
          member={diagnosticTarget}
          diagnostic={diagnosticQ.data}
          isLoading={diagnosticQ.isLoading}
          error={diagnosticQ.error}
          onClose={() => setDiagnosticTarget(null)}
        />
      )}
    </div>
  );
}

function MemberScoreDiagnosticPanel({
  member,
  diagnostic,
  isLoading,
  error,
  onClose,
}: {
  member: GuildMember;
  diagnostic?: GuildMemberScoreDiagnostic;
  isLoading: boolean;
  error: unknown;
  onClose: () => void;
}) {
  return (
    <div className="rounded-lg border border-violet-700/50 bg-violet-950/10 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-violet-100">길드원 점수 출처 진단</p>
          <p className="mt-1 text-xs text-zinc-400">
            memberPublicId 기준으로 Server DB의 personal_scores, server_user_profiles, guild_member_rows를 비교합니다.
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Riot ID {member.riotId ?? '-'} · publicId {member.memberPublicId ?? '-'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
          닫기
        </button>
      </div>

      {isLoading && <InlineMessage kind="info">진단 정보를 불러오는 중입니다.</InlineMessage>}
      {Boolean(error) && <InlineMessage kind="error">{errorToMessage(error)}</InlineMessage>}
      {!isLoading && !error && diagnostic && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 text-xs md:grid-cols-4">
            <Info label="선택된 출처">
              <span className="font-mono text-violet-200">{diagnostic.selectedSource ?? '-'}</span>
            </Info>
            <Info label="시즌">{diagnostic.seasonId ?? '-'}</Info>
            <Info label="UID 표시">
              <span className={diagnostic.uidExposed ? 'text-red-300' : 'text-emerald-300'}>
                {diagnostic.uidExposed ? '원문 노출됨' : '마스킹'}
              </span>
            </Info>
            <Info label="확인 시각">{diagnostic.checkedAt ? formatDateTime(diagnostic.checkedAt) : '-'}</Info>
          </div>

          {diagnostic.found ? (
            <div className="grid gap-3 md:grid-cols-3">
              <DiagnosticSourceCard title="1순위 personal_scores" source={diagnostic.sources?.personalScores} active={diagnostic.selectedSource === 'personal_scores'} />
              <DiagnosticSourceCard title="2순위 server_user_profiles" source={diagnostic.sources?.serverUserProfiles} active={diagnostic.selectedSource === 'server_user_profiles'} />
              <DiagnosticSourceCard title="3순위 guild_member_rows" source={diagnostic.sources?.guildMemberRows} active={diagnostic.selectedSource === 'guild_member_rows'} />
            </div>
          ) : (
            <InlineMessage kind="warning">{diagnostic.message ?? '길드원 publicId를 찾지 못했습니다.'}</InlineMessage>
          )}
        </div>
      )}
    </div>
  );
}

function DiagnosticSourceCard({
  title,
  source,
  active,
}: {
  title: string;
  source?: GuildMemberScoreDiagnosticSource;
  active: boolean;
}) {
  return (
    <div className={`rounded border p-3 ${active ? 'border-violet-500/60 bg-violet-500/10' : 'border-zinc-700/60 bg-zinc-900/40'}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-zinc-200">{title}</p>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] ${source?.exists ? 'border-emerald-500/40 text-emerald-300' : 'border-zinc-700 text-zinc-500'}`}>
          {source?.exists ? '있음' : '없음'}
        </span>
      </div>
      <div className="space-y-1 text-xs text-zinc-400">
        <p>티어: <span className="font-mono text-zinc-200">{source?.tier ?? '-'}</span></p>
        <p>LP: <span className="font-mono text-zinc-200">{source?.lp ?? '-'}</span></p>
        <p>점수: <span className="font-mono text-violet-200">{source?.finalScore ?? '-'}</span></p>
        <p>검증: <span className="font-mono text-zinc-300">{source?.verifyFlag ?? '-'}</span></p>
        <p>갱신: <span className="font-mono text-zinc-500">{source?.updatedAt ? formatDateTime(source.updatedAt) : '-'}</span></p>
      </div>
    </div>
  );
}

function GuildLogTables({ actions, points }: { actions: GuildActionLog[]; points: GuildPointLog[] }) {
  const actionCols: Column<GuildActionLog>[] = [
    { key: 'createdAt', header: '시각', render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span> },
    { key: 'action', header: '액션', render: (row) => <span className="text-xs text-zinc-300">{row.action}</span> },
    { key: 'uid', header: '대상', render: (row) => <CopyableId value={row.uid} /> },
  ];

  const pointCols: Column<GuildPointLog>[] = [
    { key: 'createdAt', header: '시각', render: (row) => <span className="text-xs text-zinc-500">{formatDateTime(row.createdAt)}</span> },
    { key: 'source', header: '출처', render: (row) => <span className="text-xs text-zinc-400">{row.source ?? '-'}</span> },
    {
      key: 'point',
      header: '점수',
      render: (row) => {
        const value = typeof row.point === 'number' ? row.point : typeof row.amount === 'number' ? row.amount : 0;
        return <span className="font-mono text-xs text-zinc-300">{formatSignedNumber(value)}</span>;
      },
    },
    {
      key: 'reason',
      header: '사유',
      render: (row) => (
        <span className="block max-w-[240px] truncate text-xs text-zinc-300" title={row.reason ?? undefined}>
          {row.reason ?? '-'}
        </span>
      ),
    },
    { key: 'createdBy', header: '관리자', render: (row) => <CopyableId value={row.createdBy ?? row.uid ?? null} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">길드 행동 로그</h3>
        <DataTable columns={actionCols} data={actions} rowKey={(row) => row.id} emptyMessage="행동 로그 없음" />
      </div>
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">길드 포인트 로그</h3>
        <DataTable columns={pointCols} data={points} rowKey={(row) => row.id} emptyMessage="포인트 로그 없음" />
      </div>
    </div>
  );
}

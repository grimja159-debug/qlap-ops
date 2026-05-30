import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from './Modal';
import { QueryState } from './QueryState';
import { StatusBadge } from './StatusBadge';
import { CopyableId } from './CopyableId';
import { DataTable, type Column } from './DataTable';
import { NotImplementedNotice } from './NotImplementedNotice';
import { guildApi } from '../services/guildApi';
import {
  GUILD_STATUS_LABELS,
  GUILD_MEMBER_ROLE_LABELS,
  GUILD_MEMBER_STATUS_LABELS,
} from '../lib/constants';
import { guildStatusTone, memberStatusTone } from '../lib/statusTone';
import { formatDate, formatDateTime, formatNumber, formatSignedNumber } from '../lib/format';
import type { Guild, GuildMember, GuildActionLog, GuildPointLog } from '../types/guild';

/**
 * 길드 상세 모달 (조회 전용).
 *  - 정보 : 길드 기본 정보 + 점수 분해
 *  - 길드원 : GET /api/admin/guilds/:id/members
 *  - 로그 : GET /api/admin/guilds/:id/logs (행동/점수)
 *  - 관리 : 길드장 변경/강퇴/공지/설정 등은 백엔드 미연결 → 필요한 API 안내.
 */
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

export function GuildDetailModal({ guildId, open, onClose }: GuildDetailModalProps) {
  const [tab, setTab] = useState<Tab>('info');

  const guildQ = useQuery({ queryKey: ['guild', guildId], queryFn: () => guildApi.get(guildId), enabled: open });
  const membersQ = useQuery({
    queryKey: ['guild', guildId, 'members'],
    queryFn: () => guildApi.members(guildId),
    enabled: open && tab === 'members',
  });
  const logsQ = useQuery({
    queryKey: ['guild', guildId, 'logs'],
    queryFn: () => guildApi.logs(guildId),
    enabled: open && tab === 'logs',
  });

  const guild = guildQ.data;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={guild ? guild.name : '길드 상세'}
      headerRight={
        guild && <StatusBadge label={GUILD_STATUS_LABELS[guild.status]} tone={guildStatusTone(guild.status)} />
      }
    >
      <QueryState isLoading={guildQ.isLoading} error={guildQ.error}>
        {guild && (
          <div className="flex flex-col gap-4">
            <div className="flex gap-1 border-b border-zinc-700/60">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={
                    tab === t.key
                      ? 'px-3 py-2 text-sm text-violet-300 border-b-2 border-violet-500 -mb-px'
                      : 'px-3 py-2 text-sm text-zinc-500 hover:text-zinc-300'
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'info' && <GuildInfo guild={guild} />}

            {tab === 'members' && (
              <QueryState isLoading={membersQ.isLoading} error={membersQ.error}>
                <MembersTable members={membersQ.data ?? []} />
              </QueryState>
            )}

            {tab === 'logs' && (
              <QueryState isLoading={logsQ.isLoading} error={logsQ.error}>
                <GuildLogTables
                  actions={logsQ.data?.guildActions ?? []}
                  points={logsQ.data?.guildPoints ?? []}
                />
              </QueryState>
            )}

            {tab === 'manage' && (
              <NotImplementedNotice
                title="길드 관리 (생성 / 삭제 / 길드장 변경 / 강제 탈퇴 / 공지 / 설정 / 신청 관리)"
                reason="이 변경 기능들은 QLapGuild API 에 있으나 nginx 에서 외부로 노출되지 않아(=어드민 콘솔이 호출 불가) QLapServices Admin API 에는 대응 엔드포인트가 없습니다. 콘솔에서 처리하려면 QLapServices 에 운영자용 길드 관리 엔드포인트를 추가하거나, QLapGuild API 를 nginx 로 프록시해야 합니다."
                endpoints={[
                  { method: 'POST', path: '/api/admin/guilds', note: '운영자 길드 생성(기간 제약 없이)' },
                  { method: 'DELETE', path: '/api/admin/guilds/:id', note: '길드 삭제/해체' },
                  { method: 'PATCH', path: '/api/admin/guilds/:id/owner', note: '길드장 변경 { newOwnerUid }' },
                  { method: 'DELETE', path: '/api/admin/guilds/:id/members/:uid', note: '길드원 강제 탈퇴' },
                  { method: 'PATCH', path: '/api/admin/guilds/:id/notice', note: '길드 공지 수정' },
                  { method: 'PATCH', path: '/api/admin/guilds/:id/settings', note: '길드 설정 수정' },
                  { method: 'GET', path: '/api/admin/guilds/:id/applications', note: '가입 신청 목록/수락/거절' },
                ]}
              />
            )}
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

function GuildInfo({ guild }: { guild: Guild }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        <Info label="길드 ID"><CopyableId value={guild.guildId} full /></Info>
        <Info label="슬러그">{guild.slug}</Info>
        <Info label="시즌">{guild.seasonId}</Info>
        <Info label="길드장 UID"><CopyableId value={guild.ownerUid} /></Info>
        <Info label="인원">{guild.memberCount} / {guild.maxMembers}</Info>
        <Info label="현재 순위">{guild.currentSeasonRank ?? '–'}</Info>
        <Info label="지역">{guild.region}</Info>
        <Info label="생성일">{formatDate(guild.createdAt)}</Info>
        <Info label="디스코드">{guild.discordUrl ?? '–'}</Info>
      </div>

      <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Info label="총 길드 점수"><span className="font-mono">{formatNumber(guild.totalGuildPoint)}</span></Info>
        <Info label="솔로 랭크"><span className="font-mono">{formatNumber(guild.soloRankPoint)}</span></Info>
        <Info label="자유 랭크"><span className="font-mono">{formatNumber(guild.flexRankPoint)}</span></Info>
        <Info label="디스코드 활동"><span className="font-mono">{formatNumber(guild.discordActivityPoint)}</span></Info>
      </div>

      {guild.description && (
        <div className="rounded-lg border border-zinc-700/60 bg-zinc-800/40 p-4">
          <p className="text-xs text-zinc-500 mb-1">소개</p>
          <p className="text-sm text-zinc-300 whitespace-pre-wrap">{guild.description}</p>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="text-zinc-300 mt-0.5">{children}</div>
    </div>
  );
}

function MembersTable({ members }: { members: GuildMember[] }) {
  const columns: Column<GuildMember>[] = [
    { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'riotId', header: 'Riot ID', render: (r) => <span className="text-xs text-zinc-400">{r.riotId ?? '–'}</span> },
    { key: 'role', header: '역할', render: (r) => <span className="text-xs text-zinc-300">{GUILD_MEMBER_ROLE_LABELS[r.role] ?? r.role}</span> },
    {
      key: 'status',
      header: '상태',
      render: (r) => (
        <StatusBadge label={GUILD_MEMBER_STATUS_LABELS[r.status] ?? r.status} tone={memberStatusTone(r.status)} />
      ),
    },
    { key: 'joinedAt', header: '가입일', render: (r) => <span className="text-xs font-mono text-zinc-500">{formatDate(r.joinedAt)}</span> },
  ];
  return <DataTable columns={columns} data={members} rowKey={(r) => r.id} emptyMessage="길드원이 없습니다" />;
}

function GuildLogTables({ actions, points }: { actions: GuildActionLog[]; points: GuildPointLog[] }) {
  const actionCols: Column<GuildActionLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'action', header: '액션', render: (r) => <span className="text-xs text-zinc-300">{r.action}</span> },
    { key: 'uid', header: '대상', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'gm', header: 'GM티켓', render: (r) => <span className="text-xs text-zinc-500">{r.usedGmTiket ? '사용' : '–'}</span> },
  ];
  const pointCols: Column<GuildPointLog>[] = [
    { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'source', header: '출처', render: (r) => <span className="text-xs text-zinc-400">{r.source ?? '–'}</span> },
    { key: 'point', header: '점수', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatSignedNumber(r.point ?? 0)}</span> },
    { key: 'uid', header: '대상', render: (r) => <CopyableId value={r.uid ?? null} /> },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">길드 행동 로그</h3>
        <DataTable columns={actionCols} data={actions} rowKey={(r) => r.id} emptyMessage="행동 로그 없음" />
      </div>
      <div>
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">길드 점수 로그</h3>
        <DataTable columns={pointCols} data={points} rowKey={(r) => r.id} emptyMessage="점수 로그 없음" />
      </div>
    </div>
  );
}

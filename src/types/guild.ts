/**
 * 길드 타입.
 *
 * 엔드포인트 (QLapServices API/src/modules/guilds/guildRoutes.ts):
 *   GET /api/admin/guilds?seasonId=&status=&q=&limit=  → { ok, guilds: Guild[] }
 *   GET /api/admin/guilds/:id                          → { ok, guild }
 *   GET /api/admin/guilds/:id/members                  → { ok, members: GuildMember[] }
 *   GET /api/admin/guilds/:id/logs                     → { ok, logs: { guildActions, guildPoints } }
 *
 * 조회 외 변경 계열(생성/수정/삭제/길드장변경/길드원 추가·강퇴)은 QLapServices guildRoutes 에
 * super_admin 전용으로 구현되어 있다. 호출 시그니처는 services/guildApi.ts 참고.
 *
 * [스키마] 길드 문서는 qlapgg(QLapGuild)와 동일 컬렉션을 공유한다. 길드원은 정식 위치
 *  guildMembers/{guildId}/members 에 저장되며, 어드민 API 도 여기서 읽고/쓴다(과거 guilds/{id}/members
 *  서브컬렉션은 폐기). 가입 인덱스는 userGuilds/{uid}, 시즌 랭킹은 guildSeasonEntries 에 반영된다.
 */
import type { IsoDate } from './common';
import type { GuildStatus, GuildMemberRole, GuildMemberStatus } from '../lib/constants';

export interface Guild {
  id: string;
  guildId: string;
  seasonId: string;
  name: string;
  nameLower: string;
  slug: string;
  description: string;
  recruitmentMessage: string;
  emblemUrl: string | null;
  ownerUid: string;
  discordUrl: string | null;
  discordGuildId: string | null;
  region: string;
  status: GuildStatus;
  isRecruiting: boolean;
  memberCount: number;
  maxMembers: number;
  totalGuildPoint: number;
  soloRankPoint: number;
  flexRankPoint: number;
  discordActivityPoint: number;
  currentSeasonRank: number | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  // 길드 스코어(전투력) — 워커가 산출(없을 수 있음). rosterUids=수동 지정, scoreRoster=실제 합산 로스터.
  guildScore?: number;
  rosterUids?: string[];
  scoreRoster?: string[];
}

export interface GuildMember {
  id: string; // = uid
  uid: string;
  memberPublicId?: string;
  riotId: string | null;
  puuid: string | null;
  role: GuildMemberRole;
  status: GuildMemberStatus;
  joinedAt: IsoDate;
  leftAt?: IsoDate;
  // 길드 스코어 워커가 기록(없을 수 있음).
  memberScore?: number;
  soloRankScore?: number;
  flexRankScore?: number;
  tierBaseScore?: number;
  lpBonus?: number;
}

/** 길드 행동 로그 1건 (guildActionLogs). */
export interface GuildActionLog {
  id: string;
  seasonId: string | null;
  guildId: string;
  uid: string;
  action: string;
  usedGmTiket?: boolean;
  createdAt: IsoDate;
  storageSource?: string | null;
  firestoreReads?: number | null;
}

/** 길드 점수 로그 1건 (guildPointLogs). 스키마가 유동적이라 핵심 필드만 명시. */
export interface GuildPointLog {
  id: string;
  guildId: string;
  seasonId?: string | null;
  uid?: string | null;
  source?: string;
  point?: number;
  amount?: number;
  reason?: string | null;
  createdBy?: string | null;
  createdAt: IsoDate;
  storageSource?: string | null;
  firestoreReads?: number | null;
  [key: string]: unknown;
}

export interface GuildLogs {
  guildActions: GuildActionLog[];
  guildPoints: GuildPointLog[];
}

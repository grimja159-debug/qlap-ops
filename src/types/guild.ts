/**
 * 길드 타입.
 *
 * 엔드포인트 (QLapServices API/src/modules/guilds/guildRoutes.ts):
 *   GET /api/admin/guilds?seasonId=&status=&q=&limit=  → { ok, guilds: Guild[] }
 *   GET /api/admin/guilds/:id                          → { ok, guild }
 *   GET /api/admin/guilds/:id/members                  → { ok, members: GuildMember[] }
 *   GET /api/admin/guilds/:id/logs                     → { ok, logs: { guildActions, guildPoints } }
 *
 * 어드민 API는 길드 "조회"만 제공한다(생성/삭제/길드장변경/강퇴/공지/설정은 미구현).
 * 해당 변경 API는 QLapGuild API에 있으나 nginx에서 외부로 노출되지 않아 콘솔에서 도달 불가.
 * → ADMIN_GUIDE.md "필요한 추가 API" 참고.
 */
import type { IsoDate } from './common';
import type { GuildStatus, GuildMemberRole, GuildMemberStatus } from '../lib/constants';

export interface Guild {
  id: string;
  guildId: string;
  seasonId: string;
  name: string;
  slug: string;
  description: string;
  emblemUrl: string | null;
  ownerUid: string;
  discordUrl: string | null;
  discordGuildId: string | null;
  region: string;
  status: GuildStatus;
  memberCount: number;
  maxMembers: number;
  totalGuildPoint: number;
  soloRankPoint: number;
  flexRankPoint: number;
  discordActivityPoint: number;
  currentSeasonRank: number | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface GuildMember {
  id: string; // = uid
  uid: string;
  riotId: string | null;
  puuid: string | null;
  role: GuildMemberRole;
  status: GuildMemberStatus;
  joinedAt: IsoDate;
  leftAt?: IsoDate;
}

/** 길드 행동 로그 1건 (guildActionLogs). */
export interface GuildActionLog {
  id: string;
  seasonId: string | null;
  guildId: string;
  uid: string;
  action: string;
  usedGmTiket?: boolean;
  gmTiketLogId?: string | null;
  createdAt: IsoDate;
}

/** 길드 점수 로그 1건 (guildPointLogs). 스키마가 유동적이라 핵심 필드만 명시. */
export interface GuildPointLog {
  id: string;
  guildId: string;
  seasonId?: string | null;
  uid?: string | null;
  source?: string;
  point?: number;
  createdAt: IsoDate;
  [key: string]: unknown;
}

export interface GuildLogs {
  guildActions: GuildActionLog[];
  guildPoints: GuildPointLog[];
}

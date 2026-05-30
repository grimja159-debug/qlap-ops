/**
 * 길드 관리 API (조회 전용).
 *
 * 엔드포인트 (QLapServices Admin API):
 *   GET /api/admin/guilds?seasonId=&status=&q=&limit=  목록      → { guilds }
 *   GET /api/admin/guilds/:id                          상세      → { guild }
 *   GET /api/admin/guilds/:id/members                  길드원    → { members }
 *   GET /api/admin/guilds/:id/logs                     로그      → { logs }
 *
 * 변경 계열(생성/삭제/길드장변경/강퇴/공지/설정/신청관리)은 QLapServices Admin API에 없다.
 * 해당 기능은 QLapGuild API에 있으나 nginx에서 외부로 노출되지 않아 콘솔에서 호출 불가.
 *   → AdminGuildsPage 에서 "필요한 추가 API"로 안내, ADMIN_GUIDE.md 에 정리.
 */
import { api, buildQuery } from './api';
import type { Guild, GuildMember, GuildLogs } from '../types/guild';

export interface GuildListFilter {
  seasonId?: string;
  status?: string;
  q?: string;
  limit?: number;
}

export const guildApi = {
  list: (filter: GuildListFilter = {}) =>
    api
      .get<{ guilds: Guild[] }>(`/api/admin/guilds${buildQuery({ ...filter })}`)
      .then((r) => r.guilds),

  get: (id: string) =>
    api.get<{ guild: Guild }>(`/api/admin/guilds/${encodeURIComponent(id)}`).then((r) => r.guild),

  members: (id: string) =>
    api
      .get<{ members: GuildMember[] }>(`/api/admin/guilds/${encodeURIComponent(id)}/members`)
      .then((r) => r.members),

  logs: (id: string) =>
    api.get<{ logs: GuildLogs }>(`/api/admin/guilds/${encodeURIComponent(id)}/logs`).then((r) => r.logs),
};

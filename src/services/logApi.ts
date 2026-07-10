/**
 * 운영 로그 API.
 *
 * 엔드포인트 (QLapServices Admin API):
 *   GET /api/admin/logs/qlCoin?...                                    → { qlCoinLogs }
 *   GET /api/admin/logs/guildActions?...                            → { guildActions }
 *   GET /api/admin/logs/guildPoints?...                             → { guildPoints }
 *
 * 응답 키가 로그 종류마다 다르므로(:key 에 따라 qlCoinLogs/guildActions/guildPoints)
 * 그 키를 직접 꺼내 통일된 배열로 반환한다.
 *
 * QL 코인 로그는 createdBy 로 "누가" 조작했는지 추적 가능 → 운영 감사 핵심.
 */
import { api, buildQuery } from './api';
import type { CurrencyLog, LogFilter } from '../types/log';
import type { GuildActionLog, GuildPointLog } from '../types/guild';

export const logApi = {
  /** QL 코인 로그. uid 필터로 특정 유저의 활동 로그를 볼 수 있다. */
  qlCoin: (filter: LogFilter = {}) =>
    api
      .get<{ qlCoinLogs: CurrencyLog[] }>(`/api/admin/logs/qlCoin${buildQuery({ ...filter })}`)
      .then((r) => r.qlCoinLogs),

  guildActions: (filter: LogFilter = {}) =>
    api
      .get<{ guildActions: GuildActionLog[] }>(
        `/api/admin/logs/guildActions${buildQuery({ ...filter })}`,
      )
      .then((r) => r.guildActions),

  guildPoints: (filter: LogFilter = {}) =>
    api
      .get<{ guildPoints: GuildPointLog[] }>(
        `/api/admin/logs/guildPoints${buildQuery({ ...filter })}`,
      )
      .then((r) => r.guildPoints),
};

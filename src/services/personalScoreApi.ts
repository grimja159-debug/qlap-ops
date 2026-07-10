/**
 * 개인 점수 관리 API (QLapServices Admin).
 * 목록/단건 조회는 operator+, 수동 보정(updateManual)은 super_admin(백엔드 게이트).
 */
import { api, buildQuery } from './api';
import type { GuildMemberPersonalScoreCoverage, PersonalScore } from '../types/personalScore';

export interface PersonalScoreManualInput {
  manualAdjust?: number;
  overrideScore?: number | null;
}

export const personalScoreApi = {
  list: (limit = 200) =>
    api
      .get<{ personalScores: PersonalScore[] }>(`/api/admin/personal-scores${buildQuery({ limit })}`)
      .then((r) => r.personalScores),

  coverage: (input: { limit?: number; guildId?: string; includeInactive?: boolean } = {}) =>
    api
      .get<{ coverage: GuildMemberPersonalScoreCoverage }>(
        `/api/admin/personal-scores/coverage${buildQuery({
          limit: input.limit ?? 1000,
          guildId: input.guildId || undefined,
          includeInactive: input.includeInactive ? 'true' : undefined,
        })}`,
      )
      .then((r) => r.coverage),

  get: (uid: string) =>
    api
      .get<{ personalScore: PersonalScore | null }>(`/api/admin/personal-scores/${encodeURIComponent(uid)}`)
      .then((r) => r.personalScore),

  /** 수동 보정: overrideScore(강제값) 또는 manualAdjust(가산). super_admin. */
  updateManual: (uid: string, input: PersonalScoreManualInput) =>
    api
      .put<{ personalScore: PersonalScore }>(`/api/admin/personal-scores/${encodeURIComponent(uid)}`, input)
      .then((r) => r.personalScore),
};

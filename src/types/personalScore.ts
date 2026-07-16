/**
 * 개인 점수(personalScore) 타입 — 유저별 전역 전투력.
 *
 * 엔드포인트 (QLapServices):
 *   GET /api/admin/personal-scores?limit=     목록(검증 플래그 포함)      → { personalScores }
 *   GET /api/admin/personal-scores/:uid                                   → { personalScore }
 *   PUT /api/admin/personal-scores/:uid       수동 보정(super_admin)       → { personalScore }
 *   GET /api/players/:puuid/personal-score    (공개, 전적 페이지용)
 *
 * 점수는 유저 자기보고 티어로 계산(autoScore)되고, 워커가 실제 티어(TopRating)와 비교해
 * verifyFlag(ok/caution/danger/unverified)를 매긴다. finalScore = overrideScore ?? (autoScore + manualAdjust).
 */
export type VerifyFlag = 'ok' | 'caution' | 'danger' | 'unverified';

export interface PsRank {
  tier?: string;
  division?: string | null;
  lp?: number;
}

export interface PersonalScore {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  gameName?: string | null;
  tagLine?: string | null;
  puuid: string | null;
  riotId: string | null;
  autoScore: number;
  manualAdjust: number;
  overrideScore: number | null;
  finalScore: number;
  reportedRank: { solo: PsRank | null; flex: PsRank | null } | null;
  verifiedRank: { solo: PsRank | null; flex: PsRank | null } | null;
  reportedScore: number;
  verifiedScore: number | null;
  scoreGap: number | null;
  tierGap: number | null;
  verifyFlag: VerifyFlag;
  source: string;
  storageSource?: string | null;
  firestoreMirrorStatus?: string | null;
  settingsVersion?: string | null;
  updatedAt: string | null;
  updatedBy?: string | null;
}

export interface GuildMemberPersonalScoreCoverageSample {
  guildId: string;
  memberPublicId: string;
  uidMasked: string;
  reason: 'NO_PERSONAL_SCORE_SUMMARY' | 'NO_SERVER_PROFILE' | string;
  hasServerProfile?: boolean;
  hasRiotId?: boolean;
  hasHighestTier?: boolean;
  hasHighestLp?: boolean;
  hasPersonalScoreField?: boolean;
  suggestedAction?: string;
}

export interface GuildMemberPersonalScoreCoverage {
  ok: true;
  write: false;
  source: 'server_db_only' | string;
  guildId: string;
  includeInactive: boolean;
  checked: number;
  displayReady: number;
  missingDisplaySummary: number;
  personalScoreTableReady: number;
  profileSummaryReady: number;
  embeddedSummaryReady: number;
  missingServerProfile: number;
  missingReasonCounts?: Record<string, number>;
  suggestedActionCounts?: Record<string, number>;
  sampleMissing: GuildMemberPersonalScoreCoverageSample[];
}

export const VERIFY_FLAG_LABELS: Record<VerifyFlag, string> = {
  ok: '정상',
  caution: '주의',
  danger: '위험',
  unverified: '검증불가',
};

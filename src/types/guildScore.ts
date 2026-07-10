export type RankScoreMode = 'max_solo_flex' | 'sum_solo_flex' | 'solo_only' | 'flex_only';
export type GuildScoreMode = 'sum_selected_roster' | 'sum_all_members';

export interface AnchorCorrectionSettings {
  enabled: boolean;
  anchors: string[];
  maxGap: number;
}

export interface GuildScoreSettings {
  version: string;
  name: string;
  description: string;
  tierBasis: string;
  lpBasis: string;
  rankScoreMode: RankScoreMode;
  guildScoreMode: GuildScoreMode;
  guildRosterSize: number;
  lpBonusAppliesTo: string[];
  tiers: Record<string, number>;
  masterPlusLpBonus: Record<string, number>;
  anchorCorrection: AnchorCorrectionSettings;
  formula: Record<string, string>;
}

export interface RankInput {
  tier: string;
  division?: string | null;
  lp?: number;
}

export interface PersonalScore {
  tierKey: string | null;
  tierBaseScore: number;
  lpBonus: number;
  score: number;
}

export interface ScorePreview {
  settingsVersion: string;
  rankScoreMode: RankScoreMode;
  input: { solo: RankInput | null; flex: RankInput | null };
  soloRankScore: number;
  flexRankScore: number;
  memberScore: number;
  tierBaseScore: number;
  lpBonus: number;
  solo: PersonalScore;
  flex: PersonalScore;
}

export const RANK_SCORE_MODE_LABELS: Record<RankScoreMode, string> = {
  max_solo_flex: '솔로/자유 중 높은 값',
  sum_solo_flex: '솔로 + 자유 합산',
  solo_only: '솔로만',
  flex_only: '자유만',
};

export const GUILD_SCORE_MODE_LABELS: Record<GuildScoreMode, string> = {
  sum_selected_roster: '대표 로스터 합산',
  sum_all_members: '전체 멤버 합산',
};

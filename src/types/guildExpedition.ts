export type ExpeditionScopeMode = 'ALL' | 'GUILD_ONLY' | 'PATHS';

export interface ExpeditionGuildLevelTier {
  level: number;
  multiplier: number;
}

export interface ExpeditionBuff {
  id: string;
  label: string;
  multiplier: number;
  activeUntil: string | null;
}

export interface ExpeditionMonster {
  id: string;
  label: string;
  stage: number;
  hp: number | null;
  imageKey: string | null;
}

export interface ExpeditionSettings {
  enabled: boolean;
  dailyMaxActiveMinutes: number;
  dailyMaxGp: number;
  dailyMaxQlcoin: number;
  rewardCalcIntervalMinutes: number;
  gpRandomMin: number;
  gpRandomMax: number;
  qlcoinRandomMin: number;
  qlcoinRandomMax: number;
  pityEnabled: boolean;
  pityGuaranteeMinutes: number;
  pityGuaranteeGp: number;
  pityGuaranteeQlcoin: number;
  heartbeatIntervalSeconds: number;
  maxBeatIntervalSeconds: number;
  activityWindowSeconds: number;
  minInteractionsPerWindow: number;
  interactionsCapPerWindow: number;
  scopeMode: ExpeditionScopeMode;
  scopePaths: string[];
  guildLevelEnabled: boolean;
  guildLevelMultiplierTable: ExpeditionGuildLevelTier[];
  buffsEnabled: boolean;
  buffs: ExpeditionBuff[];
  monsters: ExpeditionMonster[];
  stageLabels: string[];
  statusMessages: string[];
  updatedAt: string | null;
  updatedBy?: string | null;
}

export type ExpeditionUpdate = Partial<
  Omit<ExpeditionSettings, 'updatedAt' | 'updatedBy' | 'guildLevelMultiplierTable' | 'buffs' | 'monsters'>
>;

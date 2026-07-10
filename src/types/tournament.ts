export type TournamentStatus = 'draft' | 'open' | 'in_progress' | 'finished' | 'cancelled';
export type EntryRequirementMode = 'FREE' | 'TICKET' | 'QLAP_COIN' | 'PRO_ONLY' | 'CUSTOM';
export type PrizeType = 'GUILD_POINT' | 'QLAP_COIN' | 'TICKET' | 'ITEM' | 'CASH_LIKE' | 'CUSTOM';
export type BracketType = 'single_elimination' | 'double_elimination';

export interface EntryRequirement {
  mode: EntryRequirementMode;
  amount?: number;
  label?: string;
  description?: string;
}

export interface Prize {
  rank: number;
  type: PrizeType;
  label: string;
  amount?: number;
  extraText?: string;
}

export interface TournamentTemplate {
  id: string;
  templateId?: string;
  name: string;
  description?: string;
  guildScoreLimit: number;
  defaultEntryRequirement: EntryRequirement;
  defaultPrizes: Prize[];
  bracketType: BracketType;
  teamSize: number;
  minGuilds: number;
  maxGuilds: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tournament {
  id: string;
  tournamentId?: string;
  templateId?: string;
  title: string;
  name?: string;
  description?: string;
  status: TournamentStatus;
  guildScoreLimit: number;
  entryRequirement: EntryRequirement;
  prizes: Prize[];
  bracketType: BracketType;
  teamSize: number;
  minGuilds: number;
  maxGuilds: number;
  registrationStartAt?: string;
  registrationEndAt?: string;
  tournamentStartAt?: string;
  tournamentEndAt?: string;
  registeredGuildCount: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  userPageVisible: boolean;
}

export interface TournamentTemplateInput {
  name: string;
  description?: string;
  guildScoreLimit: number;
  defaultEntryRequirement: EntryRequirement;
  defaultPrizes: Prize[];
  bracketType: BracketType;
  teamSize: number;
  minGuilds: number;
  maxGuilds: number;
  isActive: boolean;
}

export interface TournamentInput {
  templateId?: string;
  title: string;
  description?: string;
  status: TournamentStatus;
  guildScoreLimit: number;
  entryRequirement: EntryRequirement;
  prizes: Prize[];
  bracketType: BracketType;
  teamSize: number;
  minGuilds: number;
  maxGuilds: number;
  registrationStartAt?: string;
  registrationEndAt?: string;
  tournamentStartAt?: string;
  tournamentEndAt?: string;
}

export interface SeedDefaultTournamentTemplatesResult {
  templates: TournamentTemplate[];
  created: number;
  updated: number;
}

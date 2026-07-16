import type { CurrencyType, GuildMemberRole, GuildStatus, PlanId, SeasonStatus, UserRole } from '../lib/constants';
import type { IsoDate } from './common';

export type TestLabApiState = 'planned' | 'implemented';
export type TestLabMockProvider = 'guest' | 'google' | 'kakao' | 'mock';
export type TestLabWalletDirection = 'grant' | 'revoke' | 'set';
export type TestLabScenarioId = 'starter_demo' | 'guild_ranking' | 'tournament_advance' | 'wallet_shop';
export type TestLabCleanupTarget = 'users' | 'guilds' | 'members' | 'wallets' | 'linkedAccounts' | 'logs';

export interface TestLabEndpointSpec {
  key: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  note: string;
  state: TestLabApiState;
}

export interface TestLabSummary {
  testUserCount: number;
  testGuildCount: number;
  latestSeedBatchId: string | null;
  latestSeedCreatedAt: IsoDate | null;
  currentSeason: TestLabCurrentSeason | null;
  recentAuditLogs: TestLabAuditLog[];
}

export interface TestLabCurrentSeason {
  id?: string;
  seasonId?: string;
  title?: string;
  status?: SeasonStatus;
}

export interface TestLabAuditLog {
  id: string;
  action: string;
  seedBatchId: string | null;
  dryRun: boolean;
  requestSummary?: Record<string, unknown>;
  resultSummary?: Record<string, unknown>;
  createdBy: string;
  reason: string;
  createdAt: IsoDate | null;
  environment: string;
}

export interface TestUser {
  uid: string;
  displayName: string | null;
  riotId: string | null;
  tier: string | null;
  plan: string | null;
  guildJoined: boolean;
  guildId: string | null;
  seedBatchId: string | null;
  isTestUser: boolean;
}

export interface DryRunResult {
  uid?: string;
  guildId?: string;
  targetId?: string;
  ok: boolean;
  reason: string | null;
  paths?: string[];
}

export interface ActAsResult {
  uid: string;
  customToken: string;
  returnTo: string;
  expiresInSeconds: number;
}

export interface QlapggActionResult {
  action: string;
  dryRun: boolean;
  targetId: string;
  success: DryRunResult[];
  failed: DryRunResult[];
  createdAt: IsoDate;
}

export interface QlapggExecutionLog {
  id: string;
  action: string;
  actorUid: string;
  targetUid: string | null;
  targetId: string | null;
  dryRun: boolean;
  createdAt: IsoDate;
}

export interface QlapggTestUsersResponse {
  users: TestUser[];
}

export interface QlapggExecutionLogsResponse {
  logs: QlapggExecutionLog[];
}

export interface QlapggGuildJoinRequest {
  guildId: string;
  uids: string[];
  dryRun?: boolean;
  reason?: string;
}

export interface QlapggLiveCwJoinRequest {
  roomId: string;
  uids: string[];
  dryRun?: boolean;
  reason?: string;
}

export interface QlapggTournamentJoinRequest {
  tournamentId: string;
  guildIds: string[];
  dryRun?: boolean;
  reason?: string;
}

export interface SeedUsersRequest {
  count: number;
  displayNamePrefix: string;
  emailPrefix: string;
  mockProvider: TestLabMockProvider;
  plan: PlanId;
  role: Extract<UserRole, 'user'>;
  identityVerified: boolean;
  createRiotProfile: boolean;
  initialQlCoin: number;
  reason: string;
  profileOverrides?: SeedUserProfileOverride[];
}

export interface SeedUserProfileOverride {
  index: number;
  purpose?: 'normal' | 'failure' | 'pro';
  plan?: PlanId;
  createRiotProfile?: boolean;
  riotId?: string | null;
  gameName?: string | null;
  tagLine?: string | null;
  puuid?: string | null;
  tier?: string | null;
  highestRank?: string | null;
  highestLp?: number;
  personalScore?: number;
  isPro?: boolean;
  proUntilDays?: number | null;
}

export interface SeedGuildsRequest {
  seasonId: string;
  count: number;
  namePrefix: string;
  slugPrefix: string;
  maxMembers: number;
  createOwners: boolean;
  useExistingTestUsers: boolean;
  status: Extract<GuildStatus, 'active' | 'locked'>;
  reason: string;
}

export interface AssignGuildMembersRequest {
  seasonId: string;
  guildId?: string;
  targetAllTestGuilds: boolean;
  membersPerGuild: number;
  roleRatio: Record<GuildMemberRole, number>;
  useExistingTestUsers: boolean;
  autoCreateMissingUsers: boolean;
  reason: string;
}

export interface BulkGuildPointsRequest {
  seasonId: string;
  guildId?: string;
  targetAllTestGuilds: boolean;
  totalGuildPoint: number;
  soloRankPoint: number;
  flexRankPoint: number;
  discordActivityPoint: number;
  distribution: 'even' | 'random' | 'top_heavy';
  reason: string;
}

export interface BulkWalletRequest {
  uid?: string;
  guildId?: string;
  target: 'singleUser' | 'allTestUsers' | 'guildMembers';
  currency: CurrencyType;
  direction: TestLabWalletDirection;
  amount: number;
  reason: string;
}

export interface SeasonQuickActionRequest {
  seasonId: string;
  action: 'setStatus' | 'clone' | 'recalculateRankings';
  status?: Extract<SeasonStatus, 'registration' | 'point_collection' | 'tournament' | 'ended'>;
  reason: string;
}

export interface ScenarioRequest {
  scenario: TestLabScenarioId;
  seasonId?: string;
  reason: string;
}

export interface CleanupRequest {
  seedBatchId: string;
  targets: TestLabCleanupTarget[];
  dryRun: boolean;
  confirmation: string;
  reason: string;
}

/* ─────────────────────────── mutation 응답 ─────────────────────────── */
// 백엔드는 { ok:true, ...data } 봉투로 내려주며, api.post 는 data 부분을 그대로 반환한다.

export interface SeedUsersResult {
  seedBatchId: string;
  createdUserCount: number;
  sampleUids: string[];
}

export interface SeedGuildsResult {
  seedBatchId: string;
  createdGuildCount: number;
  ownerCount: number;
  sampleGuildIds: string[];
}

export interface AssignGuildMembersResult {
  seedBatchId: string;
  guildCount: number;
  assignedMembers: number;
  poolSize: number;
}

export interface BulkWalletResult {
  seedBatchId: string;
  targeted: number;
  changed: number;
  currency: CurrencyType;
  direction: TestLabWalletDirection;
}

export interface BulkGuildPointsResult {
  seedBatchId: string;
  guildCount: number;
  rankingNote: string;
}

export interface ScenarioResult {
  seedBatchId: string;
  scenario: TestLabScenarioId;
  seasonId: string;
  users?: number;
  guilds?: number;
  assignedMembers?: number;
  pointedGuilds?: number;
}

export interface CleanupCounts {
  users: number;
  wallets: number;
  linkedAccounts: number;
  access: number;
  guilds: number;
  members: number;
  logs: number;
}

export interface CleanupResult {
  seedBatchId: string;
  dryRun: boolean;
  wouldDelete?: CleanupCounts;
  deleted?: CleanupCounts;
}

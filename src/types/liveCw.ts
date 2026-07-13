export interface AdminLiveCwParticipant {
  roomId: string;
  uid: string;
  puuid: string | null;
  riotId: string | null;
  mainRiotId?: string | null;
  selectedPlayRiotId?: string | null;
  displayName: string | null;
  highestTier?: string | null;
  highestRank?: string | null;
  highestLp?: number | null;
  personalScore?: number | null;
  joinedAt: string;
  status: string;
  team: string;
  slot?: number | null;
  isOwner: boolean;
  isManager: boolean;
}

export interface AdminLiveCwRoom {
  roomId: string;
  sourceType?: string;
  createdVia?: 'web' | 'discord_bot' | string;
  title: string;
  ownerUid: string;
  managerUids?: string[];
  status: string;
  phase?: 'recruiting' | 'active' | 'ended' | null;
  capacity: number;
  participantCount: number;
  participantUids?: string[];
  blueTeamUids: string[];
  redTeamUids: string[];
  captainUids?: string[];
  matchRecordId: string;
  tierRestriction?: string;
  bestOf?: number;
  banMode?: string;
  adminDeleted?: boolean;
  adminEndedAt?: string | null;
  adminNote?: string | null;
  discordGuildId?: string | null;
  discordProvisionStatus?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CLEANED' | string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminLiveCwMatch {
  matchRecordId: string;
  status: string;
  expectedParticipants?: AdminLiveCwParticipant[];
  resultDraft?: null | {
    reportedByUid?: string;
    winnerTeam?: string;
    blueScore?: number | null;
    redScore?: number | null;
    submittedAt?: string;
    roflDeadlineAt?: string;
    status?: string;
    version?: number;
  };
  reportedResult?: null | { winnerTeam?: string; reportedByUid?: string; reportedAt?: string; version?: number };
  roflResult?: null | {
    winnerTeam?: string | null;
    jobId?: string;
    participantVerification?: {
      status?: string;
      matchedCount?: number | null;
      expectedCount?: number | null;
      roflCount?: number | null;
    };
  };
  finalResult?: null | {
    source?: string;
    winnerTeam?: string;
    confirmedBy?: string;
    confirmedAt?: string;
    rewardTxId?: string;
    mismatchFlags?: string[];
  };
  verification?: null | {
    status?: string;
    source?: string;
    mismatchFlags?: string[];
    nicknameMismatchCandidates?: unknown[];
    checkedAt?: string;
    roflDeadlineAt?: string | null;
  };
  reward?: null | {
    rewardTxId?: string;
    rewardIssued?: boolean;
    skipped?: boolean;
    rewards?: Array<{ uid?: string; amount?: number }>;
  };
  adminOverride?: unknown;
  adminOverrideHistory?: unknown[];
  rejudgeHistory?: unknown[];
  dispute?: null | { reason?: string; reportedWinnerTeam?: string | null; roflWinnerTeam?: string | null };
}

export interface AdminLiveCwAuditLog {
  auditId: string;
  roomId: string;
  matchRecordId?: string | null;
  action: string;
  actorUid: string;
  actorRole?: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  createdAt?: string;
}

export interface AdminLiveCwServerDbSourceDocument {
  collectionId?: string | null;
  docIdMasked?: string | null;
  docIdHash?: string | null;
  documentType?: string | null;
  status?: string | null;
  source?: string | null;
  updatedAt?: string | null;
  indexedAt?: string | null;
  uidMasked?: string | null;
  uidHash?: string | null;
}

export interface AdminLiveCwServerDbMutationJournal {
  mutationId?: string | null;
  roomId?: string | null;
  matchRecordId?: string | null;
  action?: string | null;
  status?: string | null;
  source?: string | null;
  actorRole?: string | null;
  actorUidMasked?: string | null;
  actorUidHash?: string | null;
  payload?: unknown;
  before?: unknown;
  after?: unknown;
  error?: string | null;
  createdAt?: string | null;
  committedAt?: string | null;
  failedAt?: string | null;
  updatedAt?: string | null;
}

export interface AdminLiveCwServerDbInspection {
  generatedAt?: string;
  dbPath?: string;
  detailSnapshot?: null | {
    roomId?: string | null;
    matchRecordId?: string | null;
    phase?: string | null;
    status?: string | null;
    source?: string | null;
    updatedAt?: string | null;
    indexedAt?: string | null;
  };
  sourceDocuments?: {
    count?: number;
    byType?: Record<string, number>;
    byCollection?: Record<string, number>;
    rows?: AdminLiveCwServerDbSourceDocument[];
  };
  mutationJournal?: {
    count?: number;
    byStatus?: Record<string, number>;
    byAction?: Record<string, number>;
    rows?: AdminLiveCwServerDbMutationJournal[];
  };
}

export interface AdminLiveCwDetail {
  room: AdminLiveCwRoom;
  participants: AdminLiveCwParticipant[];
  match: AdminLiveCwMatch | null;
  archiveMeta?: Record<string, unknown> | null;
  rewardTransaction?: Record<string, unknown> | null;
  auditLogs?: AdminLiveCwAuditLog[];
  serverDb?: AdminLiveCwServerDbInspection;
}

export interface AdminLiveCwFilters {
  status?: string;
  phase?: 'recruiting' | 'active' | 'ended';
  createdVia?: '' | 'web' | 'discord_bot' | string;
  includeDeleted?: boolean;
  limit?: number;
}

export interface AdminLiveCwPatch {
  title?: string;
  status?: string;
  managerUids?: string[];
  adminNote?: string;
}

export interface AdminLiveCwAdminActionResult {
  roomId: string;
  matchRecordId?: string | null;
  dryRun: boolean;
  planned: Record<string, unknown>;
  detail?: AdminLiveCwDetail;
}

export interface AdminLiveCwArchiveSummary {
  roomId: string;
  kind: 'room' | 'audit' | 'result';
  objectKey: string;
  storageMode?: string;
  summary: Record<string, unknown>;
}

export interface AdminLiveCwRewardMonitorTx {
  rewardTxId: string;
  roomId: string | null;
  matchRecordId: string | null;
  status: string;
  rewardEnabled: boolean;
  skipped: boolean;
  reason: string | null;
  safeTestReward: boolean;
  rewardDayKey: string | null;
  winnerTeam: string | null;
  finalizeSource: string | null;
  rewardMultiplier: number;
  totalCoin: number;
  gpTotal: number;
  rewardCount: number;
  cappedCount: number;
  participationRewardQlcoin?: number;
  winnerBonusQlcoin?: number;
  ownerRewardQlcoin?: number;
  expectedEstimatedCoin?: number;
  expectedMaxCoin?: number;
  maxSingleCoinReward?: number;
  serverLedgerStatus?: string;
  serverLedgerExpectedRows?: number;
  serverLedgerRows?: number;
  serverRewardTxExists?: boolean;
  serverRewardTxStatus?: string | null;
  serverRewardTxTotalAmount?: number;
  storageSource?: string | null;
  serverDbPrimaryEvidence?: boolean;
  createdAt: string | null;
}

export interface AdminLiveCwCoinLog {
  logId: string;
  uid: string | null;
  amount: number;
  type: string | null;
  reason: string | null;
  roomId: string | null;
  matchRecordId: string | null;
  rewardTxId: string | null;
  createdAt: string | null;
}

export interface AdminLiveCwRewardMonitorAggregate {
  roomId?: string | null;
  uid?: string | null;
  matchRecordId?: string | null;
  transactionCount?: number;
  logCount?: number;
  totalCoin: number;
  gpTotal?: number;
  issuedCount?: number;
  skippedCount?: number;
  latestCreatedAt?: string | null;
  latestStatus?: string | null;
  latestRoomId?: string | null;
  latestRewardTxId?: string | null;
}

export interface AdminLiveCwRewardMonitorFilters {
  period?: '1h' | '24h' | '7d' | 'all';
  status?: '' | 'ISSUED' | 'REISSUED' | 'SKIPPED' | 'FAILED' | 'ERROR';
  roomId?: string;
  rewardTxId?: string;
  rewardLimit?: number;
  coinLogLimit?: number;
  workerLimit?: number;
}

export interface AdminLiveCwRewardMonitorWarning {
  warningId: string;
  severity: 'info' | 'warning' | 'danger';
  code: string;
  message: string;
  roomId?: string | null;
  matchRecordId?: string | null;
  rewardTxId?: string | null;
  uid?: string | null;
  amount?: number;
  expectedAmount?: number;
  count?: number;
  createdAt?: string | null;
}

export interface AdminLiveCwWorkerSummary {
  entries: number;
  checked: number;
  finalized: number;
  skipped: number;
  ok?: number;
  wouldRepair?: number;
  repaired?: number;
  wouldLegacyImport?: number;
  legacyImported?: number;
  failed?: number;
  reasonCounts: Record<string, number>;
  dispositionCounts?: Record<string, number>;
  manualReviewCounts?: Record<string, number>;
  latest: Record<string, unknown> | null;
}

export interface AdminLiveCwRewardLedgerReconcileItem {
  rewardTxId: string;
  roomId: string | null;
  matchRecordId: string | null;
  status: string;
  firestoreStatus: string;
  reason: string;
  manualReviewReason?: string | null;
  recommendedDisposition?: string | null;
  expectedLedgerRows: number;
  existingLedgerRows: number;
  serverRewardTxExists: boolean;
  serverRewardTxStatus: string | null;
  serverRewardTxTotalAmount: number;
  firestoreTotalCoin: number;
  storageSource?: string | null;
  serverDbPrimaryEvidence?: boolean;
  createdAt: string | null;
}

export interface AdminLiveCwRewardLedgerReconcile {
  checked: number;
  ok: number;
  wouldRepair: number;
  wouldLegacyImport: number;
  totalMismatch: number;
  notSupported: number;
  statusCounts: Record<string, number>;
  items: AdminLiveCwRewardLedgerReconcileItem[];
}

export interface AdminQlapCoinMirrorOutboxStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  dead: number;
}

export interface AdminQlapCoinMirrorOutboxRow {
  outboxId: number;
  eventKey: string | null;
  aggregateType: string | null;
  aggregateId: string | null;
  targetPath: string | null;
  op: string | null;
  sourceTable: string | null;
  sourceIdHash: string | null;
  walletVersion: number | null;
  status: string | null;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string | null;
  sentAt: string | null;
}

export interface AdminQlapCoinMirrorReconcileSample {
  maskedUid: string;
  status: string;
  serverBalance?: number;
  ledgerSum?: number;
  firestoreQlapcoin?: number | null;
  serverWalletVersion?: number;
  firestoreWalletVersion?: number | null;
}

export interface AdminQlapCoinMirrorReconcile {
  ok: boolean;
  checked: number;
  excludeTestWallets: boolean;
  maxDocs: number;
  firestoreCompared?: boolean;
  firestoreSkippedReason?: string | null;
  serverBalanceTotal: number;
  ledgerSumTotal: number;
  firestoreQlapcoinTotal: number;
  serverLedgerMatches: number;
  serverLedgerMismatches: number;
  firestoreMatches: number;
  firestoreMismatches: number;
  firestoreMissing: number;
  firestoreInvalid: number;
  mirrorVersionMissing: number;
  mirrorVersionBehind: number;
  mirrorVersionAhead: number;
  samples: AdminQlapCoinMirrorReconcileSample[];
}

export interface AdminQlapCoinMirrorMonitor {
  generatedAt: string;
  status?: string;
  sourceOfTruth?: string;
  note?: string;
  outbox: {
    status?: string;
    stats: AdminQlapCoinMirrorOutboxStats;
    recent?: AdminQlapCoinMirrorOutboxRow[];
    recentLegacy?: AdminQlapCoinMirrorOutboxRow[];
  };
  reconcile: AdminQlapCoinMirrorReconcile;
  r2Reports: {
    available: boolean;
    status?: string;
    note?: string;
    error?: string;
    latestOutbox?: string[];
    latestReconcile?: string[];
    latestLegacyOutbox?: string[];
    latestLegacyReconcile?: string[];
  };
  worker?: {
    status?: string;
    dryRun?: AdminLiveCwWorkerSummary;
    write?: AdminLiveCwWorkerSummary;
    legacyDryRun?: AdminLiveCwWorkerSummary;
    legacyWrite?: AdminLiveCwWorkerSummary;
    recentDryRun?: Record<string, unknown>[];
    recentWrite?: Record<string, unknown>[];
    recentLegacyDryRun?: Record<string, unknown>[];
    recentLegacyWrite?: Record<string, unknown>[];
  };
}

export interface AdminLiveCwRewardMonitor {
  generatedAt: string;
  limits: {
    rewardLimit: number;
    coinLogLimit: number;
    workerLimit: number;
    period?: string;
    status?: string;
    roomId?: string;
    rewardTxId?: string;
  };
  filters?: {
    period: string;
    fromIso: string | null;
    status: string | null;
    roomId: string | null;
    rewardTxId: string | null;
    rewardScanLimit: number;
    coinLogScanLimit: number;
    rewardTransactionsScanned: number;
    coinLogsScanned: number;
  };
  summary: {
    rewardTransactionsRead: number;
    coinLogsRead: number;
    statusCounts: Record<string, number>;
    totalCoinRecent: number;
    gpTotalRecent: number;
    coinLogTotalRecent: number;
    warningCounts?: Record<string, number>;
    warnings?: number;
  };
  warningThresholds?: {
    repeatRewardLogs?: number;
    maxRewardRecipients?: number;
  };
  warnings?: AdminLiveCwRewardMonitorWarning[];
  ledgerReconcile?: AdminLiveCwRewardLedgerReconcile;
  rewardTransactions: AdminLiveCwRewardMonitorTx[];
  coinLogs: AdminLiveCwCoinLog[];
  byRoom: AdminLiveCwRewardMonitorAggregate[];
  byUser: AdminLiveCwRewardMonitorAggregate[];
  worker: {
    serverDbHealth?: AdminLiveCwWorkerHealthSnapshot[];
    write: AdminLiveCwWorkerSummary;
    dryRun: AdminLiveCwWorkerSummary;
    rewardReconcileDryRun?: AdminLiveCwWorkerSummary;
    recentWrite: Record<string, unknown>[];
    recentDryRun: Record<string, unknown>[];
    recentRewardReconcileDryRun?: Record<string, unknown>[];
  };
  qlapCoinMirror?: AdminQlapCoinMirrorMonitor;
}

export interface AdminLiveCwWorkerHealthSnapshot {
  worker: string;
  mode: string | null;
  status: 'STARTED' | 'SUCCESS' | 'ERROR' | 'TIMEOUT' | 'SKIPPED' | 'DISABLED' | string;
  updatedAt: string;
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastTimeoutAt: string | null;
  lastSkippedAt: string | null;
  durationMs: number | null;
  cycleTimeoutMs: number | null;
  budgetStatus: string | null;
  exitCode: number | null;
  error: string | null;
  reason: string | null;
  consecutiveFailures: number;
  runCount: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  skippedCount: number;
  details: Record<string, unknown> | null;
}

export interface AdminLiveCwPenaltyLog {
  penaltyId: string | null;
  uid: string | null;
  uidMasked: string;
  uidHash: string | null;
  roomId: string | null;
  action: 'RECRUITING_LEAVE' | 'ACTIVE_DROPOUT' | 'ROOM_CANCEL' | string | null;
  reason: string | null;
  penaltyMinutes: number;
  penaltyUntilAt: string | null;
  active: boolean;
  source: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
}

export interface AdminLiveCwPenaltyUser {
  uid: string | null;
  uidMasked: string;
  uidHash: string | null;
  recruitingLeaveCount: number;
  activeDropoutCount: number;
  roomCancelCount: number;
  totalPenaltyMinutes: number;
  currentPenaltyUntilAt: string | null;
  currentPenaltyActive: boolean;
  currentPenaltyRemainingSeconds: number;
  updatedAt: string | null;
  activeRoom: null | {
    roomId: string | null;
    matchRecordId: string | null;
    status: string | null;
    phase: string | null;
    updatedAt: string | null;
  };
  recentLogs: AdminLiveCwPenaltyLog[];
}

export interface AdminLiveCwPenaltyMonitorFilters {
  limit?: number;
  logLimit?: number;
  uid?: string;
  action?: 'RECRUITING_LEAVE' | 'ACTIVE_DROPOUT' | 'ROOM_CANCEL' | '';
  activeOnly?: boolean;
}

export interface AdminLiveCwPenaltyMonitor {
  generatedAt: string;
  limits: {
    limit: number;
    logLimit: number;
    uid: string | null;
    action: string | null;
    activeOnly: boolean;
  };
  summary: {
    usersRead: number;
    logsRead: number;
    activePenaltyUsers: number;
    totalRecruitingLeaves: number;
    totalActiveDropouts: number;
    totalRoomCancels: number;
    totalPenaltyMinutes: number;
  };
  users: AdminLiveCwPenaltyUser[];
  recentLogs: AdminLiveCwPenaltyLog[];
}

export interface AdminFirestoreDependencySummaryRow {
  area: string;
  operation: string;
  hitCount: number;
  readCount: number;
  lastSeenAt: string | null;
}

export interface AdminFirestoreDependencyRecentRow {
  eventKey: string | null;
  eventDate: string | null;
  service: string | null;
  area: string | null;
  operation: string | null;
  severity: 'INFO' | 'WARN' | 'ERROR' | string | null;
  contextHash: string | null;
  sampleContext: Record<string, unknown>;
  hitCount: number;
  readCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  note: string | null;
}

export interface AdminFirestoreDependencyMonitor {
  generatedAt: string;
  limits: {
    limit: number;
  };
  summary: {
    rows: number;
    recentRows: number;
    totalHits: number;
    totalReads: number;
    warnCount: number;
  };
  top: AdminFirestoreDependencySummaryRow[];
  recent: AdminFirestoreDependencyRecentRow[];
}

export interface AdminLiveCwServerDbMonitorRoom {
  roomId: string | null;
  matchRecordId: string | null;
  phase: string | null;
  status: string | null;
  title: string | null;
  participantCount: number;
  capacity: number;
  resultDraftStatus: string | null;
  verificationStatus: string | null;
  finalResultSource: string | null;
  rewardTxId: string | null;
  canonicalSource: string | null;
  mirrorStatus: string | null;
  testMode: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  indexedAt: string | null;
}

export interface AdminLiveCwServerDbMonitorRoflJob {
  jobId: string | null;
  roomId: string | null;
  matchRecordId: string | null;
  region: string | null;
  status: string | null;
  storageMode: string | null;
  localInputDeletedAt: string | null;
  fileSize: number;
  attempts: number;
  createdAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
}

export interface AdminLiveCwServerDbMonitorArchive {
  roomId: string | null;
  matchRecordId: string | null;
  archiveStatus: string | null;
  archiveVersion: number;
  r2ObjectKey: string | null;
  r2ResultObjectKey: string | null;
  archivedAt: string | null;
  updatedAt: string | null;
}

export interface AdminLiveCwMatchEvidenceSummary {
  strictProductionCheckReady: boolean;
  strictProductionCheckReason: string;
  nonTestHistoryCount: number;
  nonTestRoflParticipantCount: number;
  nonTestCanonicalParticipantCount: number;
  nonTestArchiveCount: number;
  latestHistory: null | {
    uidMasked: string | null;
    roomId: string | null;
    matchRecordId: string | null;
    source: string | null;
    finalizedAt: string | null;
    updatedAt: string | null;
  };
  latestNonTestHistory: null | {
    uidMasked: string | null;
    roomId: string | null;
    matchRecordId: string | null;
    source: string | null;
    finalizedAt: string | null;
    updatedAt: string | null;
  };
  smokeCommand: string;
  note: string;
}

export interface AdminLiveCwServerDbMonitor {
  generatedAt: string;
  source: string;
  readOnly: boolean;
  limits: {
    limit: number;
  };
  summary: Record<string, number>;
  breakdowns: {
    roomsByPhase: Record<string, number>;
    roomsByStatus: Record<string, number>;
    roomsByCreatedVia: Record<string, number>;
    roflJobsByStatus: Record<string, number>;
    archiveByStatus: Record<string, number>;
    mutationByStatus: Record<string, number>;
  };
  matchEvidence?: AdminLiveCwMatchEvidenceSummary;
  recentRooms: AdminLiveCwServerDbMonitorRoom[];
  recentRoflJobs: AdminLiveCwServerDbMonitorRoflJob[];
  recentArchives: AdminLiveCwServerDbMonitorArchive[];
}

export interface AdminLiveCwDiscordServer {
  guildId: string;
  guildName: string;
  iconUrl: string | null;
  bannerUrl: string | null;
  botChannelId: string | null;
  roomCategoryId: string | null;
  categoryId: string | null;
  managedRoomCount?: number;
  provisionedRoomCount?: number;
  source?: string;
  registeredAt?: string | null;
  updatedAt?: string | null;
  lastSeenAt?: string | null;
}

export interface AdminLiveCwDiscordServerMonitor {
  generatedAt: string;
  botConfigured: boolean;
  source: 'bot' | 'server_db_fallback' | 'bot_error' | 'empty' | string;
  botError: string | null;
  readiness?: {
    canCreateLiveCwFromDiscord: boolean;
    canJoinLiveCwFromDiscord: boolean;
    botConfigured: boolean;
    botReachable: boolean;
    hasVisibleServer: boolean;
    hasLinkedDiscordAccount: boolean;
    blockers: string[];
  };
  summary: {
    dbCount: number;
    botCount: number;
    effectiveCount: number;
    dbOnlyCount: number;
    botOnlyCount: number;
    linkedDiscordAccounts?: number;
    provisionedRoomCount?: number;
    provisionStatusCounts?: Record<string, number>;
  };
  dbServers: AdminLiveCwDiscordServer[];
  botServers: AdminLiveCwDiscordServer[];
  dbOnly: AdminLiveCwDiscordServer[];
  botOnly: AdminLiveCwDiscordServer[];
  effectiveServers: AdminLiveCwDiscordServer[];
}

export type LiveCwEligibilityMode =
  | 'KAKAO_ONLY'
  | 'RIOT_TIER_ONLY'
  | 'KAKAO_OR_RIOT_TIER'
  | 'KAKAO_AND_RIOT_TIER'
  | 'DISABLED';

export interface AdminLiveCwPolicy {
  enabled: boolean;
  eligibilityMode: LiveCwEligibilityMode;
  requireRiotForTierRestrictedRoom: boolean;
  requireRiotForBalancedDraft: boolean;
  allowKakaoOnlyInAnyRoom: boolean;
  allowKakaoOnlyInTierRestrictedRoom: boolean;
  rewardEnabled: boolean;
  participationRewardQlcoin: number;
  winnerBonusQlcoin: number;
  ownerRewardQlcoin: number;
  gpRewardEnabled: boolean;
  gpPerWin: number;
  gpPerLoss: number;
  noRoflRewardMultiplier: number;
  maxRewardedMatchesPerUserPerDay: number;
  rewardMonitorRepeatRewardLogsThreshold1h: number;
  rewardMonitorRepeatRewardLogsThreshold24h: number;
  rewardMonitorRepeatRewardLogsThreshold7d: number;
  rewardMonitorRepeatRewardLogsThresholdAll: number;
  rewardMonitorMaxRewardRecipients: number;
  allowRewardForDisconnectedUser: boolean;
  roomCapacity: number;
  roomAutoExpireMinutes: number;
  recruitmentDefaultMinutes: number;
  recruitmentMinMinutes: number;
  recruitmentMaxMinutes: number;
  recruitmentExtensionMinutes: number;
  recruitmentMaxExtensionCount: number;
  roflUploadWindowMinutes: number;
  penaltyInactiveCacheTtlSeconds: number;
  penaltyRevalidateSeconds: number;
  recruitingLeavePenaltyMinutes: number;
  activeDropoutPenaltyMinutes: number;
  roomCancelPenaltyMinutes: number;
  requireEntryTicketForRoomCreate: boolean;
  roomCreateEntryTicketItemId: string | null;
  requireEntryTicketForRoomJoin: boolean;
  roomJoinEntryTicketItemId: string | null;
  readyTimeoutSeconds: number;
  policyVersion: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

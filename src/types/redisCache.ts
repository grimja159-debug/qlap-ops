export interface RedisStatus {
  configured: boolean;
  url: string | null;
  status: string;
  lastError: string | null;
  ping?: string | null;
  runtimeCheckedAt?: string | null;
  runtimeCheckError?: string | null;
  dir?: string | null;
  maxmemory?: number | null;
  maxmemoryHuman?: string | null;
  maxmemoryPolicy?: string | null;
  appendonly?: string | null;
  usedMemory?: number | null;
  usedMemoryHuman?: string | null;
  processId?: number | null;
  connectedClients?: number | null;
  uptimeSeconds?: number | null;
}

export interface LiveCwCachePolicy {
  liveListTtlSeconds: number;
  liveRoomTtlSeconds: number;
  endedListTtlSeconds: number;
  endedRoomTtlSeconds: number;
  participantRecordTtlSeconds: number;
  liveRoomClientPollSeconds: number;
  endedRoomClientPollSeconds: number;
  adminLiveCwPollSeconds: number;
  policyVersion: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export type LiveCwCachePolicyPatch = Partial<
  Pick<
    LiveCwCachePolicy,
    | 'liveListTtlSeconds'
    | 'liveRoomTtlSeconds'
    | 'endedListTtlSeconds'
    | 'endedRoomTtlSeconds'
    | 'participantRecordTtlSeconds'
    | 'liveRoomClientPollSeconds'
    | 'endedRoomClientPollSeconds'
    | 'adminLiveCwPollSeconds'
  >
>;

export interface ManagedCacheEntry {
  keyPattern: string;
  data: string;
  ttlSeconds: number | string;
  firestoreRefresh: string;
}

export interface RedisNamespacePreset {
  id: string;
  label: string;
  pattern: string;
  purgeAllowed: boolean;
}

export interface RedisKeyMetadata {
  key: string;
  keyMasked?: boolean;
  group?: string;
  type: string;
  ttlSeconds: number;
  ttlState: 'missing' | 'no-expire' | 'expires' | string;
  memoryUsage?: number | null;
  memoryUsageHuman?: string | null;
}

export interface RedisKeyGroupSummary {
  group: string;
  count: number;
  memoryUsage: number;
  memoryUsageHuman?: string | null;
  expiring: number;
  noExpire: number;
  missing: number;
  ttlBuckets: Record<string, number>;
  minTtlSeconds: number | null;
  maxTtlSeconds: number | null;
}

export interface RedisKeySummary {
  totalKeys: number;
  totalMemoryUsage: number;
  totalMemoryUsageHuman?: string | null;
  maskedKeys: number;
  groups: RedisKeyGroupSummary[];
}

export interface RedisNamespaceBrowseResult {
  namespace: string;
  label: string;
  pattern: string;
  purgeAllowed: boolean;
  limit: number;
  count: number;
  scanComplete: boolean;
  summary?: RedisKeySummary;
  rows: RedisKeyMetadata[];
  note?: string;
}

export interface RedisNamespacePurgeResult {
  namespace: string;
  pattern: string;
  dryRun: boolean;
  limit: number;
  matched: number;
  deleted: number;
  scanComplete: boolean;
  keysPreview: string[];
  note?: string;
}

export interface RedisLiveCwDrilldownSection {
  id: string;
  label: string;
  pattern: string;
  limit: number;
  count: number;
  scanComplete: boolean;
  summary?: RedisKeySummary;
  rows: RedisKeyMetadata[];
}

export interface RedisLiveCwDrilldown {
  checkedAt: string;
  fallbackUsed: boolean;
  valueExposed: boolean;
  source: string;
  note?: string;
  sections: RedisLiveCwDrilldownSection[];
}

export interface RedisCacheSettingsPayload {
  redis: RedisStatus;
  policy: LiveCwCachePolicy;
  managedCaches: ManagedCacheEntry[];
  namespaces?: RedisNamespacePreset[];
  liveCwDrilldown?: RedisLiveCwDrilldown;
  notes?: Record<string, string>;
}

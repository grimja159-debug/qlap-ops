export type RoflJobStatus = 'queued' | 'processing' | 'done' | 'failed' | 'canceled' | string;

export interface AdminRoflJob {
  jobId: string;
  status: RoflJobStatus;
  sourceType: string | null;
  matchRecordId: string | null;
  roomId: string | null;
  tournamentId: string | null;
  tournamentMatchId: string | null;
  guildId: string | null;
  uploaderUid: string;
  region: string;
  originalFileName: string;
  fileSize: number | null;
  r2Bucket: string | null;
  r2ObjectKey: string | null;
  storageMode: string | null;
  localInputDeletedAt: string | null;
  localInputDeleteError: string | null;
  rawFileCleanup?: {
    status: 'NOT_LOCAL' | 'DELETED' | 'DELETE_FAILED' | 'PENDING_WORKER' | 'CLEANUP_PENDING' | string;
    rawFileDeleted: boolean;
    deletedAt: string | null;
    deleteError: string | null;
    bytes: number | null;
    storageMode: string | null;
    localPathHidden: boolean;
  };
  jsonOutputPrefix: string | null;
  attempts: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  processingStartedAt: string | null;
  finishedAt: string | null;
  adminActionHistory?: unknown[];
  r2JsonArtifacts?: {
    storageMode: 'private' | string;
    publicUrl: string | null;
    jsonOutputPrefix: string | null;
    available: boolean;
    artifacts: Array<{
      artifact: AdminRoflArtifactKind;
      fileName: string;
      objectKey: string | null;
      signedUrlRequired: boolean;
    }>;
  };
  matchVerification: {
    matchStatus: string | null;
    reportedWinnerTeam: string | null;
    roflWinnerTeam: string | null;
    participantVerificationStatus: string | null;
    matchedCount: number | null;
    expectedCount: number | null;
    roflCount: number | null;
    teamMatchedCount: number | null;
    finalResultExists: boolean;
    disputeReason: string | null;
  } | null;
}

export type AdminRoflJobAction = 'retry' | 'reprocess' | 'cancel';
export type AdminRoflArtifactKind = 'manifest' | 'summary' | 'players' | 'teams' | 'rawBasic';

export interface AdminRoflJobFilters {
  status?: string;
  sourceType?: string;
  matchRecordId?: string;
  roomId?: string;
  uploaderUid?: string;
  limit?: number;
}

export interface AdminRoflLocalArtifactSample {
  bucket: 'jobs' | 'input' | 'output';
  path: string;
  bytes: number;
  ageHours: number;
  modifiedAt: string;
}

export interface AdminRoflLocalArtifactBucket {
  bucket: 'jobs' | 'input' | 'output';
  root: string;
  exists: boolean;
  underDataRoot: boolean;
  extensions: string[];
  scannedFiles: number;
  totalFiles: number;
  staleFiles: number;
  totalBytes: number;
  staleBytes: number;
  sampleStaleFiles: AdminRoflLocalArtifactSample[];
  truncated: boolean;
}

export interface AdminRoflLocalArtifactMonitor {
  generatedAt: string;
  write: false;
  cutoffHours: number;
  maxFiles: number;
  ok: boolean;
  totals: {
    scannedFiles: number;
    totalFiles: number;
    staleFiles: number;
    totalBytes: number;
    staleBytes: number;
  };
  buckets: AdminRoflLocalArtifactBucket[];
  cleanupCommandPreview: {
    dryRun: string;
    writeRequiresManualApproval: string;
  };
}

export interface AdminR2ArtifactObject {
  objectKey: string;
  sizeBytes: number | null;
  lastModified: string | null;
  storageClass: string | null;
  type: string;
}

export interface AdminR2ArtifactList {
  bucket: string;
  prefix: string;
  limit: number;
  count: number;
  hasMore: boolean;
  nextContinuationToken: string | null;
  storageMode: 'private';
  publicUrl: null;
  objects: AdminR2ArtifactObject[];
  note?: string | null;
}

/**
 * 어드민 유저 관리 타입.
 *
 * [핵심] 백엔드의 "공개 사용자" 형태는 toPublicUser()
 * (QLapServices API/src/modules/guilds/guildFirestoreService.ts) 가 만든다.
 *   GET /api/admin/users        → { ok, users: AdminUser[] }
 *   GET /api/admin/users/:uid    → { ok, user: AdminUser }
 *
 * 주의: 백엔드에는 'nickname' 필드가 없다. 표시명은 displayName 이다.
 *       상태는 active|banned|deleted (suspended 없음). 잔액은 지갑(user_wallets)에서 합쳐 내려온다.
 */
import type { IsoDate } from './common';
import type { PlanId, UserRole, UserStatus, IdentityProvider } from '../lib/constants';

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  riotId: string | null;
  gameName: string | null;
  tagLine: string | null;
  puuid: string | null;
  plan: PlanId;
  role: UserRole;
  status: UserStatus;
  qlCoinBalance: number;
  identityVerified: boolean;
  identityProvider: IdentityProvider;
  kakaoVerified?: boolean;
  /** 운영자 CS 메모(super_admin 이 작성). 없으면 빈 문자열. */
  memo: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  lastSeenAt: IsoDate;
}

/**
 * 유저 목록 조회 파라미터. 백엔드 listUsers 가 서버사이드로 처리한다.
 *  - q: displayName/email/riotId/gameName/uid 부분일치(스캔 윈도우 내 필터)
 *  - role/status/plan: 서버사이드 equality 필터
 */
export interface UserListParams {
  limit?: number;
  cursor?: string | null;
  q?: string;
  type?: UserSearchField | 'all';
  role?: UserRole;
  status?: UserStatus;
  plan?: PlanId;
}

export interface AdminUserListResult {
  users: AdminUser[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UserCompletenessSample {
  uidMasked: string;
  missing: string[];
}

export interface UserCompletenessReport {
  ok?: boolean;
  write: false;
  migration: false;
  source: 'server_db_only' | string;
  checkedAt: IsoDate;
  limit: number;
  counts: {
    checked: number;
    active: number;
    proPlan: number;
    kakaoVerified: number;
    kakaoLinked: number;
    discordLinked: number;
    riotLinked: number;
    puuidReady: number;
    personalScoreSummaryReady: number;
    profileImageReady: number;
    walletReady: number;
    accessReady: number;
  };
  missing: Record<
    | 'kakaoVerified'
    | 'kakaoLinked'
    | 'discordLinked'
    | 'riotLinked'
    | 'puuidReady'
    | 'personalScoreSummaryReady'
    | 'profileImageReady'
    | 'walletReady'
    | 'accessReady',
    number
  >;
  coverage: Record<
    | 'kakaoVerifiedPct'
    | 'discordLinkedPct'
    | 'riotLinkedPct'
    | 'puuidReadyPct'
    | 'personalScoreSummaryReadyPct'
    | 'profileImageReadyPct'
    | 'walletReadyPct'
    | 'accessReadyPct',
    number
  >;
  sampleMissing: UserCompletenessSample[];
  note?: string;
}

/**
 * PATCH /api/admin/users/:uid/access 의 본문.
 * 보낸 필드만 부분 수정된다(merge). role/status/plan 변경, 본인인증·Riot 정보 정정에 쓴다.
 * 백엔드 readUserAccessInput() 이 검증한다.
 */
export interface UserAccessProfilePatch {
  plan?: PlanId;
  role?: UserRole;
  status?: UserStatus;
  identityVerified?: boolean;
  identityProvider?: IdentityProvider;
  riotId?: string | null;
  gameName?: string | null;
  tagLine?: string | null;
  puuid?: string | null;
}

/**
 * POST /api/admin/users 의 본문(운영자 유저 생성).
 * 백엔드가 Firebase Auth UID를 발급한 뒤 Server DB 프로필/지갑/권한/연동 정보를 만든다.
 * Firestore mirror/outbox는 백엔드 정책에 따라 별도 동기화된다.
 */
export interface UserCreateInput {
  email: string;
  displayName: string;
  password?: string;
  plan?: PlanId;
  role?: UserRole;
  status?: UserStatus;
  identityVerified?: boolean;
  identityProvider?: IdentityProvider;
  riotId?: string;
  gameName?: string;
  tagLine?: string;
  puuid?: string;
  initialQlCoin?: number;
}

export interface UserCreateResult {
  user: AdminUser;
  temporaryPassword: string | null;
}

/** 유저 검색 기준 — 백엔드에 검색 API가 없어 클라이언트에서 필터링하는 키들. */
export interface UserPersonalScoreDiagnostics {
  exists: boolean;
  riotId?: string | null;
  puuidPresent?: boolean;
  finalScore?: number;
  autoScore?: number;
  manualAdjust?: number;
  overrideScore?: number | null;
  reportedScore?: number;
  verifiedScore?: number | null;
  verifyFlag?: string;
  source?: string;
  firestoreMirrorStatus?: string;
  updatedAt?: IsoDate | null;
  updatedBy?: string | null;
  verifiedAt?: IsoDate | null;
  rank?: unknown;
  reportedRank?: unknown;
  verifiedRank?: unknown;
}

export interface UserFirestoreMirrorOutboxRow {
  outboxId: number | null;
  aggregateType: string | null;
  aggregateId: string | null;
  targetPath: string | null;
  op: string | null;
  sourceTable: string | null;
  sourceId: string | null;
  status: string;
  attempts: number;
  nextAttemptAt: IsoDate | null;
  lastError: string | null;
  createdAt: IsoDate | null;
  sentAt: IsoDate | null;
}

export interface UserFirestoreMirrorOutboxDiagnostics {
  counts: Record<string, number>;
  lastCreatedAt: IsoDate | null;
  lastSentAt: IsoDate | null;
  recent: UserFirestoreMirrorOutboxRow[];
}

export interface UserWalletDiagnostics {
  exists: boolean;
  qlapcoinBalance?: number;
  pendingQlapcoinBalance?: number;
  version?: number;
  updatedAt?: IsoDate | null;
}

export interface UserServerProfileDiagnostics {
  exists: boolean;
  plan?: string | null;
  role?: string | null;
  status?: string | null;
  identityVerified?: boolean | null;
  identityProvider?: string | null;
  firestoreMirrorStatus?: string | null;
  updatedAt?: IsoDate | null;
  lastLoginAt?: IsoDate | null;
}

export interface UserLinkedAccountsDiagnostics {
  exists: boolean;
  discordLinked?: boolean;
  kakaoLinked?: boolean;
  naverLinked?: boolean;
  riotLinked?: boolean;
  firestoreMirrorStatus?: string | null;
  updatedAt?: IsoDate | null;
}

export interface UserDataDiagnostics {
  uid: string;
  checkedAt: IsoDate;
  personalScore: UserPersonalScoreDiagnostics;
  firestoreMirrorOutbox: UserFirestoreMirrorOutboxDiagnostics;
  wallet: UserWalletDiagnostics;
  serverProfile: UserServerProfileDiagnostics;
  linkedAccounts: UserLinkedAccountsDiagnostics;
}

export interface UserPersonalScoreMirrorRetryResult {
  uid: string;
  write: boolean;
  matched: number;
  reset: number;
  statuses: Record<string, number>;
  outboxIds: number[];
  reason: string | null;
}

export type UserSearchField = 'uid' | 'riotId' | 'displayName' | 'email';

export const USER_SEARCH_FIELD_LABELS: Record<UserSearchField, string> = {
  uid: 'UID',
  riotId: 'Riot ID',
  displayName: '닉네임',
  email: '이메일',
};

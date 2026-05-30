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
  gmTiketBalance: number;
  identityVerified: boolean;
  identityProvider: IdentityProvider;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  lastSeenAt: IsoDate;
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

/** 유저 검색 기준 — 백엔드에 검색 API가 없어 클라이언트에서 필터링하는 키들. */
export type UserSearchField = 'uid' | 'riotId' | 'displayName' | 'email';

export const USER_SEARCH_FIELD_LABELS: Record<UserSearchField, string> = {
  uid: 'UID',
  riotId: 'Riot ID',
  displayName: '닉네임',
  email: '이메일',
};

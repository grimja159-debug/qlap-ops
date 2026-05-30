/**
 * 로그인한 본인(운영자) 프로필 타입.
 *
 * 출처: GET /api/me → { ok, user } 의 user.
 * 백엔드 QLapUserProfile (QLapServices API/src/modules/users/userProfiles.ts)와 동일 형태다.
 */
import type { IsoDate } from './common';
import type { PlanId, UserRole, UserStatus, IdentityProvider } from '../lib/constants';

export type Role = UserRole;

export interface MeResponse {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
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
  connectedAccounts: {
    discord: string | null;
    kakao: string | null;
    naver: string | null;
    riot: string | null;
  };
  createdAt: IsoDate;
  updatedAt: IsoDate;
  lastLoginAt: IsoDate;
}

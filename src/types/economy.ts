/**
 * QL 코인 지급·차감 타입.
 *
 * 엔드포인트 (QLapServices API/src/modules/guilds/guildRoutes.ts):
 *   POST /api/admin/users/:uid/grant-qlcoin   본문 { amount, reason }
 *   POST /api/admin/users/:uid/revoke-qlcoin  본문 { amount, reason }
 * 응답: { ok, result: { logId, user: AdminUser } }
 *
 * amount 는 항상 "양수"로 보내고, 차감은 revoke-* 엔드포인트로 구분한다
 * (백엔드가 revoke- 면 음수로 바꿔 처리). reason 은 1~300자 필수.
 */
import type { AdminUser } from './user';
import type { CurrencyType } from '../lib/constants';

export type { CurrencyType };

/** 지급/차감 방향. */
export type EconomyDirection = 'grant' | 'revoke';

export interface EconomyChangeRequest {
  uid: string;
  currency: CurrencyType;
  direction: EconomyDirection;
  amount: number; // 양수
  reason: string;
}

/** grant/revoke 응답의 result. */
export interface EconomyChangeResult {
  logId: string;
  user: AdminUser;
}

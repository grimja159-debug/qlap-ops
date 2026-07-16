/**
 * QL 코인 지급·차감 API.
 *
 * 엔드포인트:
 *   POST /api/admin/users/:uid/grant-qlcoin    본문 { amount, reason } → { result }
 *   POST /api/admin/users/:uid/revoke-qlcoin
 *
 * amount 는 항상 양수로 보내고, 지급/차감은 grant-/revoke- 접두사로 구분한다.
 * 차감 시 잔액이 음수가 되면 백엔드가 INSUFFICIENT_BALANCE 로 막는다.
 */
import { api } from './api';
import type { EconomyChangeRequest, EconomyChangeResult, CurrencyType } from '../types/economy';

/** 프론트 통화 코드 → 백엔드 라우트 접미사. */
const CURRENCY_PATH: Record<CurrencyType, string> = {
  qlcoin: 'qlcoin',
};

export const economyApi = {
  change: ({ uid, currency, direction, amount, reason }: EconomyChangeRequest) => {
    const action = direction === 'grant' ? 'grant' : 'revoke';
    const path = `/api/admin/users/${encodeURIComponent(uid)}/${action}-${CURRENCY_PATH[currency]}`;
    return api.post<{ result: EconomyChangeResult }>(path, { amount, reason }).then((r) => r.result);
  },
};

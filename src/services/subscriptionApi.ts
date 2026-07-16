/**
 * 구독관리 API 클라이언트 (subscriptions + Server DB user access 권위 reconcile).
 *
 * 수동 PRO 지급/연장/회수는 모두 audit log 에 기록된다(백엔드 subscription.* 액션).
 * 권한 판단의 진짜 소스는 Server DB user access/profile projection이며, 목록의 proUntil/isPro 는 그것을 반영한다.
 */
import { api, buildQuery } from './api';
import type { Subscription, SubscriptionMutationRequest } from '../types/billing';
import type { SubscriptionTier } from '../lib/constants';

export const subscriptionApi = {
  list: (filters: { tier?: SubscriptionTier; uid?: string; limit?: number } = {}) =>
    api
      .get<{ subscriptions: Subscription[]; count: number }>(
        `/api/admin/subscriptions${buildQuery({ ...filters, limit: filters.limit ?? 100 })}`,
      )
      .then((r) => r.subscriptions),

  getByUid: (uid: string) =>
    api.get<{ subscription: Subscription }>(`/api/admin/subscriptions/${encodeURIComponent(uid)}`).then((r) => r.subscription),

  grant: (uid: string, body: SubscriptionMutationRequest) =>
    api.post<{ subscription: Subscription }>(`/api/admin/subscriptions/${encodeURIComponent(uid)}/grant`, body).then((r) => r.subscription),

  extend: (uid: string, body: SubscriptionMutationRequest) =>
    api.post<{ subscription: Subscription }>(`/api/admin/subscriptions/${encodeURIComponent(uid)}/extend`, body).then((r) => r.subscription),

  subtract: (uid: string, body: SubscriptionMutationRequest) =>
    api.post<{ subscription: Subscription }>(`/api/admin/subscriptions/${encodeURIComponent(uid)}/subtract`, body).then((r) => r.subscription),

  revoke: (uid: string, body: SubscriptionMutationRequest) =>
    api.post<{ subscription: Subscription }>(`/api/admin/subscriptions/${encodeURIComponent(uid)}/revoke`, body).then((r) => r.subscription),
};

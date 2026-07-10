/**
 * 결제관리 API 클라이언트 (billing_orders / billing_payments).
 *
 * 모든 응답이 { ok, ... } 봉투이므로 각 함수에서 실제 키만 꺼내 반환한다.
 * 환불/취소/만료는 dryRun=true(미리보기)와 dryRun=false(실행)를 같은 엔드포인트로 호출한다.
 */
import { api, buildQuery } from './api';
import type {
  BillingOrder,
  BillingOrderDetail,
  BillingMonitorReport,
  BillingPayment,
  CancelPlan,
  ExpirePendingResult,
  MutationResult,
  RefundPlan,
  RefundRequest,
} from '../types/billing';
import type { BillingOrderStatus, BillingPaymentStatus } from '../lib/constants';

export const billingApi = {
  getMonitor: () =>
    api.get<{ monitor: BillingMonitorReport }>('/api/admin/billing/monitor').then((r) => r.monitor),

  listOrders: (filters: { status?: BillingOrderStatus; uid?: string; limit?: number } = {}) =>
    api
      .get<{ orders: BillingOrder[] }>(`/api/admin/billing/orders${buildQuery({ ...filters, limit: filters.limit ?? 100 })}`)
      .then((r) => r.orders),

  getOrder: (orderId: string) =>
    api.get<{ order: BillingOrder; payments: BillingPayment[] }>(
      `/api/admin/billing/orders/${encodeURIComponent(orderId)}`,
    ) as Promise<BillingOrderDetail>,

  listPayments: (filters: { status?: BillingPaymentStatus; uid?: string; limit?: number } = {}) =>
    api
      .get<{ payments: BillingPayment[] }>(`/api/admin/billing/payments${buildQuery({ ...filters, limit: filters.limit ?? 100 })}`)
      .then((r) => r.payments),

  /** PENDING 만료. dryRun 기본 true. 실행하려면 { dryRun:false }. */
  expirePending: (dryRun: boolean) =>
    api.post<ExpirePendingResult & { ok: true }>('/api/admin/billing/orders/expire-pending', { dryRun }),

  /** PAID 주문 환불(내부 처리). TOSS_REFUND_ENABLED=false 면 MANUAL_REFUND_REQUIRED 로 둔다. */
  refund: (orderId: string, body: RefundRequest) =>
    api.post<MutationResult<RefundPlan> & { ok: true }>(
      `/api/admin/billing/orders/${encodeURIComponent(orderId)}/refund`,
      body,
    ),

  /** PENDING 주문 내부 취소. */
  cancel: (orderId: string, body: RefundRequest) =>
    api.post<MutationResult<CancelPlan> & { ok: true }>(
      `/api/admin/billing/orders/${encodeURIComponent(orderId)}/cancel`,
      body,
    ),
};

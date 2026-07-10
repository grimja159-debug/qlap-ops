/**
 * 결제관리/구독관리 타입.
 *
 * 백엔드(QLapServices API)와 1:1:
 *   결제관리:
 *     GET  /api/admin/billing/orders                  → { ok, orders }
 *     GET  /api/admin/billing/orders/:orderId         → { ok, order, payments }
 *     POST /api/admin/billing/orders/expire-pending   → { ok, dryRun, cutoff, count, candidates|expired }
 *     POST /api/admin/billing/orders/:orderId/refund  → { ok, dryRun, plan }
 *     POST /api/admin/billing/orders/:orderId/cancel  → { ok, dryRun, plan }
 *     GET  /api/admin/billing/payments                → { ok, payments }
 *   구독관리:
 *     GET  /api/admin/subscriptions                   → { ok, subscriptions, count }
 *     GET  /api/admin/subscriptions/:uid              → { ok, subscription }
 *     POST /api/admin/subscriptions/:uid/grant|extend|revoke → { ok, subscription }
 *
 * 컬렉션/상태머신: QLap Billing API Server/docs/BILLING_COLLECTIONS.md
 */
import type { IsoDate } from './common';
import type {
  BillingOrderStatus,
  BillingPaymentStatus,
  SubscriptionTier,
  PlanId,
  UserRole,
} from '../lib/constants';

export interface BillingStorageMeta {
  storageSource?: 'server_db' | 'firestore_fallback' | string | null;
  serverDbSource?: string | null;
  serverDbMirrorStatus?: string | null;
  serverDbCreatedAt?: IsoDate | null;
  serverDbUpdatedAt?: IsoDate | null;
}

export interface BillingOrder extends BillingStorageMeta {
  id: string;
  orderId: string;
  uid: string;
  productId: string | null;
  productName: string | null;
  productType: string | null;
  amount: number | null;
  currency: string | null;
  proDays: number | null;
  status: BillingOrderStatus;
  paymentKey?: string | null;
  method?: string | null;
  latestPaymentId?: string | null;
  source?: string | null;
  approvedAt?: IsoDate;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
  // 운영 처리 흔적
  manualRefundRequired?: boolean;
  refundReason?: string | null;
  refundedBy?: string | null;
  refundedAt?: IsoDate;
  refundProvider?: string | null;
  cancelReason?: string | null;
  canceledBy?: string | null;
  canceledInternallyAt?: IsoDate;
  expireReason?: string | null;
  expiredBy?: string | null;
  expiredAt?: IsoDate;
  adminMemo?: string | null;
}

export interface BillingPayment extends BillingStorageMeta {
  id: string;
  paymentId: string;
  orderId: string;
  uid: string;
  paymentKey: string | null;
  status: BillingPaymentStatus;
  manualRefundRequired?: boolean;
  amount: number | null;
  currency: string | null;
  method?: string | null;
  approvedAt?: IsoDate;
  receiptUrl?: string | null;
  refundReason?: string | null;
  canceledInternallyAt?: IsoDate;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface BillingOrderDetail {
  order: BillingOrder;
  payments: BillingPayment[];
}

export interface ExpirePendingResult {
  dryRun: boolean;
  cutoff: string;
  count: number;
  candidates?: Array<{ orderId: string; uid: string | null; amount: number | null; createdAt: string | null }>;
  expired?: string[];
}

export interface RefundPlan {
  orderId: string;
  uid: string;
  from: string;
  to: string;
  pgRefunded: boolean;
  provider: string;
  proUntilBefore: string | null;
  proUntilAfter: string | null;
  proDaysRevoked: number | 'ALL';
  stillPro: boolean;
  reason: string;
  adminMemo: string | null;
}

export interface CancelPlan {
  orderId: string;
  from: string;
  to: string;
  reason: string;
  adminMemo: string | null;
}

export interface MutationResult<T> {
  dryRun: boolean;
  plan: T;
}

/** 환불/취소 실행 요청 본문. dryRun=false 로 보내야 실제 실행된다. */
export interface RefundRequest {
  reason: string;
  adminMemo?: string;
  dryRun: boolean;
}

export interface Subscription extends BillingStorageMeta {
  uid: string;
  tier: SubscriptionTier;
  isPro: boolean;
  proUntil: string | null;
  remainingDays: number;
  basePlan: PlanId;
  role: UserRole;
  email: string | null;
  displayName: string | null;
  lastOrderId: string | null;
  lastPaymentId: string | null;
  lastPaidAt: string | null;
  source: string | null;
  updatedAt: string | null;
}

export interface SubscriptionMutationRequest {
  /** grant/extend 에만 필요. */
  days?: number;
  reason: string;
}

export interface BillingMonitorStatusCount {
  status: string;
  count: number;
}

export interface BillingMonitorRecentOrder {
  orderId: string;
  uidMasked: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BillingMonitorRecentPayment {
  paymentId: string;
  orderId: string | null;
  uidMasked: string | null;
  status: string | null;
  amount: number | null;
  currency: string | null;
  source: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface BillingMonitorRecentEvent {
  eventId: string;
  type: string;
  source: string;
  uidMasked: string | null;
  orderId: string | null;
  eventType: string | null;
  createdAt: string;
}

export interface BillingMonitorRecentOutbox {
  outboxId: number;
  eventKeyHash: string;
  aggregateType: string;
  aggregateIdMasked: string;
  targetPathMasked: string;
  sourceTable: string;
  sourceIdMasked: string;
  status: string;
  attempts: number;
  nextAttemptAt: string | null;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface BillingMonitorRecentGrantLedger {
  entryIdMasked: string;
  uidMasked: string | null;
  orderIdMasked: string;
  paymentKeyMasked: string | null;
  type: string;
  status: string;
  productId: string | null;
  amount: number | null;
  currency: string | null;
  proDays: number | null;
  source: string;
  createdAt: string;
  idempotencyKeyHint: string;
}

export interface BillingMonitorReport {
  ok: boolean;
  generatedAt: string;
  health: 'OK' | 'WARN';
  summary: {
    ordersTotal: number;
    paymentsTotal: number;
    eventsTotal: number;
    grantLedgerTotal: number;
    outboxTotal: number;
    outboxPendingOrFailed: number;
    oldestPendingOutboxAgeSeconds: number | null;
  };
  ordersByStatus: BillingMonitorStatusCount[];
  paymentsByStatus: BillingMonitorStatusCount[];
  outboxByStatus: BillingMonitorStatusCount[];
  outboxBySourceTable: BillingMonitorStatusCount[];
  recentOrders: BillingMonitorRecentOrder[];
  recentPayments: BillingMonitorRecentPayment[];
  recentEvents: BillingMonitorRecentEvent[];
  recentOutbox: BillingMonitorRecentOutbox[];
  recentGrantLedger: BillingMonitorRecentGrantLedger[];
  warnings: string[];
}

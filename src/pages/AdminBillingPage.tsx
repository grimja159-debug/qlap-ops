import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { billingOrderStatusTone, billingPaymentStatusTone, dataSourceLabel, dataSourceTitle, type Tone } from '../lib/statusTone';
import {
  BILLING_ORDER_STATUSES,
  BILLING_ORDER_STATUS_LABELS,
  BILLING_PAYMENT_STATUSES,
  BILLING_PAYMENT_STATUS_LABELS,
  type BillingOrderStatus,
  type BillingPaymentStatus,
} from '../lib/constants';
import { billingApi } from '../services/billingApi';
import { subscriptionApi } from '../services/subscriptionApi';
import type { BillingOrder, BillingMonitorReport, RefundPlan, CancelPlan } from '../types/billing';

/**
 * 결제관리 — billing_orders 주문 목록 / billing_payments 결제 결과.
 *
 *  - 주문/결제 결과 탭, 상태·UID 필터.
 *  - 상세 모달: uid·이메일·상품·금액·결제수단·승인일·상태 + 연결된 결제내역.
 *  - PENDING 만료(dry-run 후 실행), PENDING 취소, PAID 환불(2단계 확인 + dry-run 미리보기).
 *  - 환불은 PG 실제 취소를 하지 않고 내부 상태/권한만 정리한다(MANUAL_REFUND_REQUIRED).
 *    실제 토스 환불은 운영자가 토스 콘솔에서 수동 처리. (TOSS_REFUND_ENABLED=false)
 */
type Tab = 'orders' | 'payments';
type ActionKind = 'refund' | 'cancel';

const PROD = (v: string | null) => (v && v.trim() ? v : '–');

function StorageBadge({ row }: { row: { storageSource?: string | null; serverDbSource?: string | null; serverDbMirrorStatus?: string | null } }) {
  const isServerDb = row.storageSource === 'server_db';
  const label = dataSourceLabel(row.storageSource);
  const title = dataSourceTitle({ source: row.storageSource, serverDbSource: row.serverDbSource, serverDbMirrorStatus: row.serverDbMirrorStatus });
  return (
    <span
      title={title}
      className={
        isServerDb
          ? 'inline-flex rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300'
          : 'inline-flex rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-300'
      }
    >
      {label}
    </span>
  );
}

export function AdminBillingPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('orders');
  const [statusFilter, setStatusFilter] = useState<BillingOrderStatus | ''>('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<BillingPaymentStatus | ''>('');
  const [uidFilter, setUidFilter] = useState('');
  const [appliedUid, setAppliedUid] = useState('');
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [action, setAction] = useState<{ order: BillingOrder; kind: ActionKind } | null>(null);

  const monitor = useQuery({
    queryKey: ['billing-monitor'],
    queryFn: () => billingApi.getMonitor(),
    refetchInterval: 30_000,
  });

  const orders = useQuery({
    queryKey: ['billing-orders', statusFilter, appliedUid],
    queryFn: () => billingApi.listOrders({ status: statusFilter || undefined, uid: appliedUid || undefined }),
    enabled: tab === 'orders',
  });

  const payments = useQuery({
    queryKey: ['billing-payments', paymentStatusFilter, appliedUid],
    queryFn: () => billingApi.listPayments({ status: paymentStatusFilter || undefined, uid: appliedUid || undefined }),
    enabled: tab === 'payments',
  });

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ['billing-monitor'] });
    void qc.invalidateQueries({ queryKey: ['billing-orders'] });
    void qc.invalidateQueries({ queryKey: ['billing-payments'] });
    void qc.invalidateQueries({ queryKey: ['billing-order'] });
    void qc.invalidateQueries({ queryKey: ['subscriptions'] });
  };

  const orderColumns: Column<BillingOrder>[] = [
    { key: 'createdAt', header: '주문시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
    { key: 'orderId', header: '주문ID', render: (r) => <CopyableId value={r.orderId} /> },
    { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'storage', header: 'DB', render: (r) => <StorageBadge row={r} /> },
    { key: 'product', header: '상품', render: (r) => <span className="text-xs text-zinc-300">{PROD(r.productName)}</span> },
    { key: 'amount', header: '금액', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatNumber(r.amount)}원</span> },
    {
      key: 'status',
      header: '상태',
      render: (r) => <StatusBadge label={BILLING_ORDER_STATUS_LABELS[r.status] ?? r.status} tone={billingOrderStatusTone(r.status)} />,
    },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={() => setDetailOrderId(r.orderId)}
          className="text-xs text-violet-400 hover:text-violet-300 px-2 py-0.5 border border-violet-700/50 rounded hover:bg-violet-500/10"
        >
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <BillingMonitorPanel monitor={monitor.data} isLoading={monitor.isLoading} error={monitor.error} onRefresh={() => void monitor.refetch()} />

      {/* 만료 처리 */}
      <ExpirePendingPanel onDone={invalidateAll} />

      {/* 필터 + 탭 */}
      <PageSection
        title="결제 내역"
        right={
          <div className="flex gap-1">
            {(['orders', 'payments'] as Tab[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className={
                  tab === k
                    ? 'text-xs px-2.5 py-1 rounded bg-violet-600/20 border border-violet-500/50 text-violet-300'
                    : 'text-xs px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-500 hover:text-zinc-300'
                }
              >
                {k === 'orders' ? '주문(billing_orders)' : '결제결과(billing_payments)'}
              </button>
            ))}
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tab === 'orders' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as BillingOrderStatus | '')}
              className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200"
            >
              <option value="">전체 상태</option>
              {BILLING_ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BILLING_ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          {tab === 'payments' && (
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as BillingPaymentStatus | '')}
              className="px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200"
            >
              <option value="">전체 상태</option>
              {BILLING_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {BILLING_PAYMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="UID 필터"
            value={uidFilter}
            onChange={(e) => setUidFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setAppliedUid(uidFilter.trim())}
            className="w-72 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-violet-500"
          />
          <button
            type="button"
            onClick={() => setAppliedUid(uidFilter.trim())}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded"
          >
            적용
          </button>
          {appliedUid && (
            <button
              type="button"
              onClick={() => {
                setUidFilter('');
                setAppliedUid('');
              }}
              className="text-sm text-zinc-400 hover:text-zinc-200 px-2 py-1.5"
            >
              초기화
            </button>
          )}
        </div>

        {tab === 'orders' ? (
          <QueryState isLoading={orders.isLoading} error={orders.error}>
            <DataTable columns={orderColumns} data={orders.data ?? []} rowKey={(r) => r.orderId} emptyMessage="주문이 없습니다" />
          </QueryState>
        ) : (
          <QueryState isLoading={payments.isLoading} error={payments.error}>
            <DataTable
              columns={[
                { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
                { key: 'paymentId', header: '결제ID', render: (r) => <CopyableId value={r.paymentId} /> },
                { key: 'orderId', header: '주문ID', render: (r) => <CopyableId value={r.orderId} /> },
                { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
                { key: 'storage', header: 'DB', render: (r) => <StorageBadge row={r} /> },
                { key: 'amount', header: '금액', render: (r) => <span className="font-mono text-xs text-zinc-300">{formatNumber(r.amount)}원</span> },
                { key: 'method', header: '수단', render: (r) => <span className="text-xs text-zinc-400">{PROD(r.method ?? null)}</span> },
                {
                  key: 'status',
                  header: '상태',
                  render: (r) => (
                    <StatusBadge label={BILLING_PAYMENT_STATUS_LABELS[r.status] ?? r.status} tone={billingPaymentStatusTone(r.status)} />
                  ),
                },
              ]}
              data={payments.data ?? []}
              rowKey={(r) => r.id}
              emptyMessage="결제 결과가 없습니다"
            />
          </QueryState>
        )}
      </PageSection>

      {detailOrderId && (
        <OrderDetailModal
          orderId={detailOrderId}
          onClose={() => setDetailOrderId(null)}
          onRefund={(order) => {
            setAction({ order, kind: 'refund' });
          }}
          onCancel={(order) => {
            setAction({ order, kind: 'cancel' });
          }}
        />
      )}

      {action && (
        <RefundCancelModal
          order={action.order}
          kind={action.kind}
          onClose={() => setAction(null)}
          onDone={() => {
            invalidateAll();
            setAction(null);
            setDetailOrderId(null);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────── Webhook / Outbox 모니터 ───────────────────── */

function monitorStatusTone(status?: string | null): Tone {
  if (status === 'OK' || status === 'SENT' || status === 'PAID' || status === 'GRANTED') return 'success';
  if (status === 'WARN' || status === 'PENDING' || status === 'FAILED' || status === 'MANUAL_REFUND_REQUIRED') return 'warning';
  if (status === 'DEAD' || status === 'FAIL') return 'danger';
  return 'neutral';
}

function secondsLabel(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return '–';
  if (seconds < 60) return `${seconds}초`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
  return `${Math.floor(seconds / 3600)}시간 ${Math.floor((seconds % 3600) / 60)}분`;
}

function StatusCountChips({ rows }: { rows: Array<{ status: string; count: number }> }) {
  if (rows.length === 0) return <span className="text-xs text-zinc-500">없음</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.slice(0, 8).map((row) => (
        <span key={row.status} className="inline-flex items-center gap-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300">
          <span className="text-zinc-500">{row.status}</span>
          <span className="font-mono text-zinc-100">{formatNumber(row.count)}</span>
        </span>
      ))}
    </div>
  );
}

function BillingMonitorPanel({
  monitor,
  isLoading,
  error,
  onRefresh,
}: {
  monitor?: BillingMonitorReport;
  isLoading: boolean;
  error: unknown;
  onRefresh: () => void;
}) {
  return (
    <PageSection
      title="Billing Webhook / Outbox Monitor"
      description="Server DB 결제 projection과 Toss webhook 이벤트를 확인합니다. legacy mirror outbox는 읽기 전용 진단이며 Firestore 쓰기를 실행하지 않습니다."
      right={
        <button type="button" onClick={onRefresh} className="text-xs px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700">
          새로고침
        </button>
      }
    >
      <QueryState isLoading={isLoading} error={error}>
        {monitor && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={monitor.health} tone={monitorStatusTone(monitor.health)} />
              <span className="text-xs text-zinc-500">생성 {formatDateTime(monitor.generatedAt)}</span>
              <span className="text-xs text-zinc-500">30초 자동 갱신</span>
            </div>

            {monitor.warnings.length > 0 && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                {monitor.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <div className="grid gap-3 md:grid-cols-6">
              {[
                ['orders', monitor.summary.ordersTotal],
                ['payments', monitor.summary.paymentsTotal],
                ['events', monitor.summary.eventsTotal],
                ['grant ledger', monitor.summary.grantLedgerTotal],
                ['legacy outbox', monitor.summary.outboxTotal],
                ['legacy pending/failed', monitor.summary.outboxPendingOrFailed],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
                  <p className="text-[11px] text-zinc-500">{label}</p>
                  <p className="mt-1 font-mono text-lg text-zinc-100">{formatNumber(value as number)}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">주문 상태</p>
                <StatusCountChips rows={monitor.ordersByStatus} />
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">결제 상태</p>
                <StatusCountChips rows={monitor.paymentsByStatus} />
              </div>
              <div className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="mb-2 text-xs font-medium text-zinc-300">Legacy mirror outbox 상태</p>
                <StatusCountChips rows={monitor.outboxByStatus} />
                <p className="mt-2 text-[11px] text-zinc-500">읽기 전용 진단 · 가장 오래된 대기: {secondsLabel(monitor.summary.oldestPendingOutboxAgeSeconds)}</p>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <DataTable
                columns={[
                  { key: 'createdAt', header: 'Webhook/Event', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
                  { key: 'type', header: 'type', render: (r) => <StatusBadge label={r.type} tone="info" /> },
                  { key: 'eventType', header: 'eventType', render: (r) => <span className="text-xs text-zinc-300">{r.eventType ?? '–'}</span> },
                  { key: 'uid', header: 'uid', render: (r) => <span className="font-mono text-xs text-zinc-500">{r.uidMasked ?? '–'}</span> },
                  { key: 'order', header: 'order', render: (r) => <span className="font-mono text-xs text-zinc-400">{r.orderId ?? '–'}</span> },
                ]}
                data={monitor.recentEvents}
                rowKey={(r) => r.eventId}
                emptyMessage="최근 billing event가 없습니다"
              />

              <DataTable
                columns={[
                  { key: 'id', header: 'outbox', render: (r) => <span className="font-mono text-xs text-zinc-400">#{r.outboxId}</span> },
                  { key: 'status', header: '상태', render: (r) => <StatusBadge label={r.status} tone={monitorStatusTone(r.status)} /> },
                  { key: 'source', header: 'source', render: (r) => <span className="text-xs text-zinc-300">{r.sourceTable}</span> },
                  { key: 'target', header: 'target', render: (r) => <span className="font-mono text-[11px] text-zinc-500">{r.targetPathMasked}</span> },
                  { key: 'attempts', header: '시도', render: (r) => <span className="font-mono text-xs text-zinc-300">{r.attempts}</span> },
                ]}
                data={monitor.recentOutbox}
                rowKey={(r) => String(r.outboxId)}
                emptyMessage="최근 legacy billing mirror outbox가 없습니다"
              />
            </div>

            <div className="rounded-md border border-zinc-800 bg-zinc-950/30 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium text-zinc-300">최근 PRO 지급 원장 / 중복 방지</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    같은 orderId는 `server_billing_grant_ledger.entry_id` UNIQUE 기준으로 한 번만 지급됩니다.
                  </p>
                </div>
                <StatusBadge label="IDEMPOTENT" tone="success" />
              </div>
              <DataTable
                columns={[
                  { key: 'createdAt', header: '시각', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.createdAt)}</span> },
                  { key: 'status', header: '상태', render: (r) => <StatusBadge label={r.status} tone={monitorStatusTone(r.status)} /> },
                  { key: 'type', header: '종류', render: (r) => <span className="text-xs text-zinc-300">{r.type}</span> },
                  { key: 'order', header: 'order', render: (r) => <span className="font-mono text-xs text-zinc-500">{r.orderIdMasked}</span> },
                  { key: 'uid', header: 'uid', render: (r) => <span className="font-mono text-xs text-zinc-500">{r.uidMasked ?? '–'}</span> },
                  {
                    key: 'grant',
                    header: '지급',
                    render: (r) => (
                      <span className="text-xs text-zinc-300">
                        {r.proDays != null ? `${formatNumber(r.proDays)}일` : '–'}
                        {r.amount != null ? ` · ${formatNumber(r.amount)}${r.currency ? ` ${r.currency}` : ''}` : ''}
                      </span>
                    ),
                  },
                  { key: 'source', header: 'source', render: (r) => <span className="text-xs text-zinc-400">{r.source}</span> },
                ]}
                data={monitor.recentGrantLedger ?? []}
                rowKey={(r) => `${r.entryIdMasked}-${r.createdAt}`}
                emptyMessage="최근 PRO 지급 원장이 없습니다"
              />
            </div>

            <p className="text-[11px] text-zinc-500">
              이 패널은 읽기 전용입니다. 재처리, 환불, 만료 실행은 기존 버튼과 dry-run 절차를 통해서만 수행합니다.
            </p>
          </div>
        )}
      </QueryState>
    </PageSection>
  );
}

/* ───────────────────── PENDING 만료 패널 ───────────────────── */

function ExpirePendingPanel({ onDone }: { onDone: () => void }) {
  const [preview, setPreview] = useState<{ count: number; cutoff: string } | null>(null);
  const mutation = useMutation({
    mutationFn: (dryRun: boolean) => billingApi.expirePending(dryRun),
    onSuccess: (res, dryRun) => {
      if (dryRun) setPreview({ count: res.count, cutoff: res.cutoff });
      else {
        setPreview(null);
        onDone();
      }
    },
  });

  return (
    <PageSection
      title="PENDING 주문 만료 처리"
      description="결제창 이탈·중단으로 confirm 까지 못 간 60분 초과 PENDING 주문을 EXPIRED 로 전환합니다. 먼저 미리보기(dry-run) 후 실행하세요."
    >
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => mutation.mutate(true)}
          disabled={mutation.isPending}
          className="text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 px-3 py-1.5 rounded"
        >
          미리보기(dry-run)
        </button>
        {preview && (
          <>
            <span className="text-sm text-zinc-400">
              만료 대상 <span className="text-amber-400 font-semibold">{preview.count}</span>건 (cutoff {formatDateTime(preview.cutoff)})
            </span>
            {preview.count > 0 && (
              <ConfirmButton tone="danger" confirmLabel="만료 실행" onConfirm={() => mutation.mutate(false)} disabled={mutation.isPending}>
                {preview.count}건 만료 실행
              </ConfirmButton>
            )}
          </>
        )}
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        {mutation.isSuccess && !mutation.variables && <InlineMessage kind="success">만료 처리 완료.</InlineMessage>}
      </div>
    </PageSection>
  );
}

/* ───────────────────── 주문 상세 모달 ───────────────────── */

function OrderDetailModal({
  orderId,
  onClose,
  onRefund,
  onCancel,
}: {
  orderId: string;
  onClose: () => void;
  onRefund: (order: BillingOrder) => void;
  onCancel: (order: BillingOrder) => void;
}) {
  const detail = useQuery({ queryKey: ['billing-order', orderId], queryFn: () => billingApi.getOrder(orderId) });
  const order = detail.data?.order;
  // 구매자 이메일/현재 구독 상태는 구독 reconcile 에서 가져온다(billing_orders 엔 email 이 없다).
  const sub = useQuery({
    queryKey: ['subscriptions', 'uid', order?.uid],
    queryFn: () => subscriptionApi.getByUid(order!.uid),
    enabled: !!order?.uid,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`주문 상세 — ${orderId}`}
      headerRight={
        order ? <StatusBadge label={BILLING_ORDER_STATUS_LABELS[order.status] ?? order.status} tone={billingOrderStatusTone(order.status)} /> : undefined
      }
    >
      <QueryState isLoading={detail.isLoading} error={detail.error}>
        {order && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Row label="UID"><CopyableId value={order.uid} full /></Row>
              <Row label="이메일">{sub.data?.email ?? '–'}</Row>
              <Row label="상품명">{PROD(order.productName)}</Row>
              <Row label="상품유형">{PROD(order.productType)}</Row>
              <Row label="금액"><span className="font-mono">{formatNumber(order.amount)}원 ({order.currency ?? 'KRW'})</span></Row>
              <Row label="PRO 일수">{order.proDays != null ? `${order.proDays}일` : '–'}</Row>
              <Row label="결제수단">{PROD(order.method ?? null)}</Row>
              <Row label="승인일">{formatDateTime(order.approvedAt)}</Row>
              <Row label="주문일">{formatDateTime(order.createdAt)}</Row>
              <Row label="paymentKey"><CopyableId value={order.paymentKey ?? null} /></Row>
              <Row label="storage"><StorageBadge row={order} /></Row>
              <Row label="mirror">{order.serverDbSource ?? '-'} / {order.serverDbMirrorStatus ?? '-'}</Row>
              {order.refundReason && <Row label="환불사유">{order.refundReason}</Row>}
              {order.cancelReason && <Row label="취소사유">{order.cancelReason}</Row>}
              {order.adminMemo && <Row label="관리자메모">{order.adminMemo}</Row>}
              {order.manualRefundRequired && (
                <Row label="PG 수동환불">
                  <span className="text-amber-400">필요 — 토스 콘솔에서 직접 환불 처리</span>
                </Row>
              )}
            </dl>

            {sub.data && (
              <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3 text-xs text-zinc-400">
                구매자 현재 구독: <span className="text-zinc-200">{sub.data.tier}</span>
                {sub.data.proUntil && ` · proUntil ${formatDate(sub.data.proUntil)} (남은 ${sub.data.remainingDays}일)`}
              </div>
            )}

            <div>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">결제 결과(billing_payments)</h3>
              <DataTable
                columns={[
                  { key: 'paymentId', header: '결제ID', render: (r) => <CopyableId value={r.paymentId} /> },
                  { key: 'storage', header: 'DB', render: (r) => <StorageBadge row={r} /> },
                  { key: 'amount', header: '금액', render: (r) => <span className="font-mono text-xs">{formatNumber(r.amount)}원</span> },
                  {
                    key: 'status',
                    header: '상태',
                    render: (r) => (
                      <StatusBadge label={BILLING_PAYMENT_STATUS_LABELS[r.status] ?? r.status} tone={billingPaymentStatusTone(r.status)} />
                    ),
                  },
                  { key: 'approvedAt', header: '승인일', render: (r) => <span className="text-xs text-zinc-500">{formatDateTime(r.approvedAt)}</span> },
                ]}
                data={detail.data?.payments ?? []}
                rowKey={(r) => r.id}
                emptyMessage="결제 결과 없음"
              />
            </div>

            {/* 액션: 상태에 따라 환불/취소 노출 */}
            <div className="flex items-center gap-3 border-t border-zinc-700/60 pt-3">
              {order.status === 'PAID' && (
                <button
                  onClick={() => onRefund(order)}
                  className="text-sm bg-red-600/90 hover:bg-red-600 text-white px-3 py-1.5 rounded"
                >
                  환불 처리…
                </button>
              )}
              {order.status === 'PENDING' && (
                <button
                  onClick={() => onCancel(order)}
                  className="text-sm bg-amber-600/90 hover:bg-amber-600 text-white px-3 py-1.5 rounded"
                >
                  주문 취소…
                </button>
              )}
              <span className="text-xs text-zinc-600">환불/취소는 2단계 확인 후 실행됩니다.</span>
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] uppercase tracking-wide text-zinc-600">{label}</dt>
      <dd className="text-zinc-200">{children}</dd>
    </div>
  );
}

/* ───────────────────── 환불/취소 2단계 모달 ───────────────────── */

function RefundCancelModal({
  order,
  kind,
  onClose,
  onDone,
}: {
  order: BillingOrder;
  kind: ActionKind;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  const [memo, setMemo] = useState('');
  const [preview, setPreview] = useState<RefundPlan | CancelPlan | null>(null);

  const isRefund = kind === 'refund';
  const title = isRefund ? '환불 처리(내부)' : 'PENDING 주문 취소';

  const mutation = useMutation({
    mutationFn: (dryRun: boolean) => {
      const body = { reason: reason.trim(), adminMemo: memo.trim() || undefined, dryRun };
      return isRefund ? billingApi.refund(order.orderId, body) : billingApi.cancel(order.orderId, body);
    },
    onSuccess: (res, dryRun) => {
      if (dryRun) setPreview(res.plan);
      else onDone();
    },
  });

  const canSubmit = reason.trim().length > 0 && !mutation.isPending;

  return (
    <Modal open onClose={onClose} title={`${title} — ${order.orderId}`} size="md">
      <div className="flex flex-col gap-3">
        {isRefund && (
          <div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300/90">
            ⚠️ 실제 토스 결제취소 API 는 호출하지 않습니다(TOSS_REFUND_ENABLED=false). 내부 상태/권한만 정리하며
            주문은 <b>MANUAL_REFUND_REQUIRED</b> 로 표시됩니다. 실제 PG 환불은 토스 콘솔에서 직접 처리하세요.
          </div>
        )}

        <label className="text-xs text-zinc-400">
          사유 <span className="text-red-400">*</span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="환불/취소 사유 (필수, 1~300자)"
            className="mt-1 w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
          />
        </label>
        <label className="text-xs text-zinc-400">
          관리자 메모(선택)
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="내부 참고용 메모"
            className="mt-1 w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:border-violet-500"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => mutation.mutate(true)}
            className="text-sm bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-100 px-3 py-1.5 rounded"
          >
            미리보기(dry-run)
          </button>
          {preview && (
            <ConfirmButton
              tone="danger"
              confirmLabel={isRefund ? '환불 실행' : '취소 실행'}
              disabled={!canSubmit}
              onConfirm={() => mutation.mutate(false)}
            >
              {isRefund ? '환불 실행' : '취소 실행'}
            </ConfirmButton>
          )}
        </div>

        {preview && (
          <div className="rounded border border-zinc-700/60 bg-zinc-900/40 p-3 text-xs text-zinc-300 space-y-1">
            <div>상태 변경: <span className="text-zinc-200">{preview.from} → {preview.to}</span></div>
            {'proUntilBefore' in preview && (
              <>
                <div>proUntil: {preview.proUntilBefore ? formatDate(preview.proUntilBefore) : '–'} → {preview.proUntilAfter ? formatDate(preview.proUntilAfter) : '만료/회수'}</div>
                <div>회수 일수: {String(preview.proDaysRevoked)} · PG환불됨: {String(preview.pgRefunded)}</div>
              </>
            )}
            <div className="text-zinc-500">미리보기 결과입니다. 실제 반영은 "{isRefund ? '환불 실행' : '취소 실행'}" 후 한번 더 확인하세요.</div>
          </div>
        )}

        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { formatDate, formatDateTime, shortId } from '../lib/format';
import { dataSourceLabel, dataSourceTitle, subscriptionTierTone } from '../lib/statusTone';
import { SUBSCRIPTION_TIERS, SUBSCRIPTION_TIER_LABELS, type SubscriptionTier } from '../lib/constants';
import { subscriptionApi } from '../services/subscriptionApi';
import type { Subscription } from '../types/billing';

type ManageKind = 'grant' | 'extend' | 'subtract' | 'revoke';

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

function manageKindLabel(kind: ManageKind): string {
  if (kind === 'grant') return 'PRO 지급';
  if (kind === 'extend') return 'PRO 연장';
  if (kind === 'subtract') return '일수 차감';
  return 'PRO 회수';
}

function manageConfirmLabel(kind: ManageKind): string {
  if (kind === 'grant') return '지급 실행';
  if (kind === 'extend') return '연장 실행';
  if (kind === 'subtract') return '차감 실행';
  return '회수 실행';
}

function manageButtonLabel(kind: ManageKind, days: number): string {
  if (kind === 'grant') return `PRO ${days}일 지급`;
  if (kind === 'extend') return `PRO ${days}일 연장`;
  if (kind === 'subtract') return `PRO ${days}일 차감`;
  return 'PRO 회수';
}

function manageDaysHint(kind: ManageKind): string {
  if (kind === 'grant') return '기존 proUntil이 미래면 그 시각부터 연장되고, 만료 상태면 지금부터 부여됩니다.';
  if (kind === 'extend') return '현재 proUntil에서 입력한 일수만큼 이어 연장합니다.';
  return '현재 proUntil에서 입력한 일수만큼 차감합니다. 결과가 현재 시각 이하이면 만료 처리됩니다.';
}

export function AdminSubscriptionsPage() {
  const qc = useQueryClient();
  const [tierFilter, setTierFilter] = useState<SubscriptionTier | ''>('');
  const [uidInput, setUidInput] = useState('');
  const [lookupUid, setLookupUid] = useState('');
  const [manageUid, setManageUid] = useState<string | null>(null);

  const list = useQuery({
    queryKey: ['subscriptions', 'list', tierFilter],
    queryFn: () => subscriptionApi.list({ tier: tierFilter || undefined }),
  });

  const lookup = useQuery({
    queryKey: ['subscriptions', 'uid', lookupUid],
    queryFn: () => subscriptionApi.getByUid(lookupUid),
    enabled: lookupUid.length > 0,
  });

  const columns: Column<Subscription>[] = [
    { key: 'uid', header: 'UID', render: (r) => <CopyableId value={r.uid} /> },
    { key: 'user', header: '사용자', render: (r) => <span className="text-xs text-zinc-300">{r.displayName ?? r.email ?? '-'}</span> },
    { key: 'tier', header: '등급', render: (r) => <StatusBadge label={SUBSCRIPTION_TIER_LABELS[r.tier] ?? r.tier} tone={subscriptionTierTone(r.tier)} /> },
    { key: 'storage', header: 'DB', render: (r) => <StorageBadge row={r} /> },
    { key: 'proUntil', header: 'proUntil', render: (r) => <span className="text-xs text-zinc-400">{formatDate(r.proUntil)}</span> },
    {
      key: 'remaining',
      header: '남은 기간',
      render: (r) => <span className={r.remainingDays > 0 ? 'text-xs text-emerald-400' : 'text-xs text-zinc-600'}>{r.remainingDays > 0 ? `${r.remainingDays}일` : '-'}</span>,
    },
    { key: 'lastOrder', header: '마지막 주문', render: (r) => <CopyableId value={r.lastOrderId} /> },
    {
      key: 'actions',
      header: '',
      render: (r) => (
        <button
          onClick={() => setManageUid(r.uid)}
          className="rounded border border-violet-700/50 px-2 py-0.5 text-xs text-violet-400 hover:bg-violet-500/10 hover:text-violet-300"
        >
          관리
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageSection title="UID로 구독 조회">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="UID 입력 후 조회"
            value={uidInput}
            onChange={(e) => setUidInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setLookupUid(uidInput.trim())}
            className="w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={!uidInput.trim()}
            onClick={() => setLookupUid(uidInput.trim())}
            className="rounded bg-violet-600 px-4 py-1.5 text-sm text-white hover:bg-violet-700 disabled:opacity-50"
          >
            조회
          </button>
        </div>
        {lookupUid && (
          <div className="mt-3">
            <QueryState isLoading={lookup.isLoading} error={lookup.error}>
              {lookup.data && (
                <div className="flex flex-wrap items-center gap-5 rounded border border-zinc-700/60 bg-zinc-900 p-3">
                  <CopyableId value={lookup.data.uid} full sensitive />
                  <StatusBadge label={SUBSCRIPTION_TIER_LABELS[lookup.data.tier]} tone={subscriptionTierTone(lookup.data.tier)} />
                  <StorageBadge row={lookup.data} />
                  <span className="text-xs text-zinc-400">proUntil {formatDate(lookup.data.proUntil)} / 남은 {lookup.data.remainingDays}일</span>
                  <button
                    onClick={() => setManageUid(lookup.data!.uid)}
                    className="ml-auto rounded bg-violet-600 px-3 py-1 text-xs text-white hover:bg-violet-700"
                  >
                    관리
                  </button>
                </div>
              )}
            </QueryState>
          </div>
        )}
      </PageSection>

      <PageSection
        title="구독자 목록"
        right={
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as SubscriptionTier | '')}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
          >
            <option value="">전체 등급</option>
            {SUBSCRIPTION_TIERS.map((tier) => (
              <option key={tier} value={tier}>
                {SUBSCRIPTION_TIER_LABELS[tier]}
              </option>
            ))}
          </select>
        }
      >
        <QueryState isLoading={list.isLoading} error={list.error}>
          <DataTable columns={columns} data={list.data ?? []} rowKey={(r) => r.uid} emptyMessage="구독 레코드가 없습니다" />
        </QueryState>
      </PageSection>

      {manageUid && (
        <ManageSubscriptionModal
          uid={manageUid}
          onClose={() => setManageUid(null)}
          onDone={() => {
            void qc.invalidateQueries({ queryKey: ['subscriptions'] });
          }}
        />
      )}
    </div>
  );
}

function ManageSubscriptionModal({ uid, onClose, onDone }: { uid: string; onClose: () => void; onDone: () => void }) {
  const qc = useQueryClient();
  const sub = useQuery({ queryKey: ['subscriptions', 'uid', uid], queryFn: () => subscriptionApi.getByUid(uid) });
  const [kind, setKind] = useState<ManageKind>('grant');
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      const reasonTrim = reason.trim();
      if (kind === 'revoke') return subscriptionApi.revoke(uid, { reason: reasonTrim });
      const body = { days, reason: reasonTrim };
      if (kind === 'grant') return subscriptionApi.grant(uid, body);
      if (kind === 'extend') return subscriptionApi.extend(uid, body);
      return subscriptionApi.subtract(uid, body);
    },
    onSuccess: (updated) => {
      qc.setQueryData(['subscriptions', 'uid', uid], updated);
      onDone();
      setReason('');
    },
  });

  const needDays = kind !== 'revoke';
  const canSubmit = reason.trim().length > 0 && (!needDays || (Number.isInteger(days) && days > 0 && days <= 3650)) && !mutation.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title={`구독 관리 - ${shortId(uid)}`}
      size="md"
      headerRight={sub.data ? <StatusBadge label={SUBSCRIPTION_TIER_LABELS[sub.data.tier]} tone={subscriptionTierTone(sub.data.tier)} /> : undefined}
    >
      <QueryState isLoading={sub.isLoading} error={sub.error}>
        {sub.data && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex flex-col">
                <dt className="text-[11px] uppercase tracking-wide text-zinc-600">사용자</dt>
                <dd className="text-zinc-200">{sub.data.displayName ?? sub.data.email ?? '-'}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[11px] uppercase tracking-wide text-zinc-600">현재 proUntil</dt>
                <dd className="text-zinc-200">
                  {formatDateTime(sub.data.proUntil)}
                  {sub.data.remainingDays > 0 && ` (남은 ${sub.data.remainingDays}일)`}
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[11px] uppercase tracking-wide text-zinc-600">저장된 plan</dt>
                <dd className="text-zinc-200">{sub.data.basePlan} / {sub.data.role}</dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[11px] uppercase tracking-wide text-zinc-600">마지막 주문</dt>
                <dd><CopyableId value={sub.data.lastOrderId} /></dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[11px] uppercase tracking-wide text-zinc-600">storage</dt>
                <dd><StorageBadge row={sub.data} /></dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-[11px] uppercase tracking-wide text-zinc-600">mirror</dt>
                <dd className="text-zinc-200">{sub.data.serverDbSource ?? '-'} / {sub.data.serverDbMirrorStatus ?? '-'}</dd>
              </div>
            </dl>

            {sub.data.tier === 'ADMIN' && (
              <div className="rounded border border-violet-500/30 bg-violet-500/5 p-2.5 text-xs text-violet-300/90">
                이 사용자는 운영자 권한 또는 pro_max 등급입니다. PRO 기간 조정은 user_access에만 영향을 주며, ADMIN 등급 자체는 유저/권한 관리에서 변경됩니다.
              </div>
            )}

            <div className="flex flex-wrap gap-1">
              {(['grant', 'extend', 'subtract', 'revoke'] as ManageKind[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setKind(item)}
                  className={
                    kind === item
                      ? 'rounded border border-violet-500/50 bg-violet-600/20 px-2.5 py-1 text-xs text-violet-300'
                      : 'rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-300'
                  }
                >
                  {manageKindLabel(item)}
                </button>
              ))}
            </div>

            {needDays && (
              <label className="text-xs text-zinc-400">
                일수
                <div className="mt-1 flex items-center gap-2">
                  {[7, 30, 90].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setDays(preset)}
                      className={
                        days === preset
                          ? 'rounded bg-violet-600 px-2 py-1 text-xs text-white'
                          : 'rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200'
                      }
                    >
                      {preset}일
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Math.min(3650, Number(e.target.value) || 0)))}
                    className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-200"
                  />
                </div>
                <p className="mt-1 text-[11px] text-zinc-600">{manageDaysHint(kind)}</p>
              </label>
            )}

            <label className="text-xs text-zinc-400">
              사유 <span className="text-red-400">*</span>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="처리 사유 (필수, 1~300자)"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none"
              />
            </label>

            <div className="flex items-center gap-3">
              <ConfirmButton
                tone={kind === 'revoke' || kind === 'subtract' ? 'danger' : 'primary'}
                confirmLabel={manageConfirmLabel(kind)}
                disabled={!canSubmit}
                onConfirm={() => mutation.mutate()}
              >
                {manageButtonLabel(kind, days)}
              </ConfirmButton>
              {mutation.isSuccess && <InlineMessage kind="success">처리했습니다.</InlineMessage>}
              {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
            </div>
          </div>
        )}
      </QueryState>
    </Modal>
  );
}

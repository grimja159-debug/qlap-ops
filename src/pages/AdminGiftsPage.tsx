import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { CopyableId } from '../components/CopyableId';
import { StatusBadge } from '../components/StatusBadge';
import { InlineMessage } from '../components/InlineMessage';
import { ConfirmButton } from '../components/ConfirmButton';
import { TextAreaField, TextField, NumberField, SelectField } from '../components/Field';
import { errorToMessage } from '../lib/apiError';
import { formatDateTime, formatNumber } from '../lib/format';
import { subscriptionTierTone } from '../lib/statusTone';
import { SUBSCRIPTION_TIER_LABELS } from '../lib/constants';
import { subscriptionApi } from '../services/subscriptionApi';
import { economyApi } from '../services/economyApi';
import type { Subscription } from '../types/billing';

type GiftKind = 'pro' | 'qlcoin';
type ProMode = 'grant' | 'extend';

interface GiftResult {
  kind: GiftKind;
  subscription?: Subscription;
  balance?: {
    qlCoinBalance: number;
  };
}

const GIFT_KIND_OPTIONS: { value: GiftKind; label: string }[] = [
  { value: 'pro', label: 'PRO 기간' },
  { value: 'qlcoin', label: 'QL 코인' },
];

const PRO_DAY_PRESETS = [7, 30, 90, 365];
const COIN_PRESETS = [1000, 5000, 10000, 50000];

export function AdminGiftsPage() {
  const qc = useQueryClient();
  const [uid, setUid] = useState('');
  const [lookupUid, setLookupUid] = useState('');
  const [kind, setKind] = useState<GiftKind>('pro');
  const [proMode, setProMode] = useState<ProMode>('grant');
  const [days, setDays] = useState(30);
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState('관리자 선물 지급');
  const [lastResult, setLastResult] = useState<GiftResult | null>(null);

  const targetUid = uid.trim();
  const effectiveAmount = kind === 'pro' ? days : amount;
  const reasonText = reason.trim();

  const sub = useQuery({
    queryKey: ['subscriptions', 'uid', lookupUid],
    queryFn: () => subscriptionApi.getByUid(lookupUid),
    enabled: lookupUid.length > 0,
  });

  const presets = useMemo(() => {
    if (kind === 'pro') return PRO_DAY_PRESETS;
    return COIN_PRESETS;
  }, [kind]);

  const mutation = useMutation({
    mutationFn: async (): Promise<GiftResult> => {
      if (kind === 'pro') {
        const body = { days, reason: reasonText };
        const subscription =
          proMode === 'grant'
            ? await subscriptionApi.grant(targetUid, body)
            : await subscriptionApi.extend(targetUid, body);
        return { kind, subscription };
      }

      const result = await economyApi.change({
        uid: targetUid,
        currency: 'qlcoin',
        direction: 'grant',
        amount,
        reason: reasonText,
      });
      return {
        kind,
        balance: {
          qlCoinBalance: result.user.qlCoinBalance,
        },
      };
    },
    onSuccess: (result) => {
      setLastResult(result);
      void qc.invalidateQueries({ queryKey: ['subscriptions'] });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['logs'] });
      if (targetUid) {
        void qc.invalidateQueries({ queryKey: ['user', targetUid] });
      }
    },
  });

  const valid =
    targetUid.length > 0 &&
    reasonText.length > 0 &&
    Number.isInteger(effectiveAmount) &&
    effectiveAmount > 0 &&
    (kind !== 'pro' || days <= 3650) &&
    (kind === 'pro' || amount <= 100_000_000);

  const applyPreset = (value: number) => {
    if (kind === 'pro') setDays(value);
    else setAmount(value);
  };

  return (
    <div className="flex max-w-6xl flex-col gap-5">
      <PageSection
        title="관리자 선물"
        description="관리자 권한으로 유저에게 PRO 기간 또는 QL 코인을 지급합니다. 모든 지급은 기존 관리자 API를 통해 감사 로그에 기록됩니다."
        accent
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
              <TextField
                label="대상 UID"
                value={uid}
                onChange={setUid}
                placeholder="Firebase UID"
                required
              />
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!targetUid}
                  onClick={() => setLookupUid(targetUid)}
                  className="w-full rounded bg-zinc-700 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-600 disabled:opacity-40"
                >
                  구독 조회
                </button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <SelectField
                label="선물 종류"
                value={kind}
                onChange={(value) => {
                  const next = value as GiftKind;
                  setKind(next);
                  setAmount(1000);
                  setDays(30);
                  setLastResult(null);
                }}
                options={GIFT_KIND_OPTIONS}
              />
              {kind === 'pro' ? (
                <SelectField
                  label="PRO 처리 방식"
                  value={proMode}
                  onChange={(value) => setProMode(value as ProMode)}
                  options={[
                    { value: 'grant', label: '지급/재지급' },
                    { value: 'extend', label: '연장' },
                  ]}
                />
              ) : (
                <div className="rounded-md border border-zinc-700/60 bg-zinc-900/40 px-3 py-2">
                  <p className="text-xs text-zinc-500">처리 방식</p>
                  <p className="mt-1 text-sm font-medium text-zinc-200">지급</p>
                </div>
              )}
              <NumberField
                label={kind === 'pro' ? '기간(일)' : '수량'}
                value={kind === 'pro' ? days : amount}
                min={1}
                max={kind === 'pro' ? 3650 : 100_000_000}
                step={1}
                onChange={(value) => (kind === 'pro' ? setDays(value) : setAmount(value))}
                required
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  {kind === 'pro' ? `${preset}일` : formatNumber(preset)}
                </button>
              ))}
            </div>

            <TextAreaField
              label="지급 사유"
              value={reason}
              onChange={setReason}
              rows={3}
              placeholder="감사 로그에 남길 사유를 입력하세요"
              required
            />

            <div className="flex flex-wrap items-center gap-3">
              <ConfirmButton
                tone="primary"
                confirmLabel="선물 지급"
                disabled={!valid || mutation.isPending}
                onConfirm={() => mutation.mutate()}
              >
                {mutation.isPending ? '지급 중...' : '선물 지급'}
              </ConfirmButton>
              {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
              {lastResult && (
                <InlineMessage kind="success">
                  {lastResult.kind === 'pro'
                    ? `PRO 적용 완료 · proUntil ${formatDateTime(lastResult.subscription?.proUntil ?? null)}`
                    : `지급 완료 · QL ${formatNumber(lastResult.balance?.qlCoinBalance ?? 0)}`}
                </InlineMessage>
              )}
            </div>
          </div>

          <div className="rounded-md border border-zinc-700/60 bg-zinc-950/40 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">PRO 권한 기준</h3>
            <div className="mt-3 space-y-2 text-xs text-zinc-400">
              <p>PRO는 `user_access.proUntil`이 현재 시각보다 미래일 때만 유효합니다.</p>
              <p>`users.plan = pro`만 바꿔서는 만료 시간이 없으면 FREE로 취급됩니다.</p>
              <p>`pro_max`는 운영자/관리자용 상위 등급이라 별도 예외로 인정됩니다.</p>
            </div>
          </div>
        </div>
      </PageSection>

      {lookupUid && (
        <PageSection title="대상 구독 상태">
          <QueryState isLoading={sub.isLoading} error={sub.error}>
            {sub.data && (
              <div className="grid gap-3 md:grid-cols-4">
                <InfoBlock label="UID">
                  <CopyableId value={sub.data.uid} full />
                </InfoBlock>
                <InfoBlock label="유저">
                  {sub.data.displayName ?? sub.data.email ?? '-'}
                </InfoBlock>
                <InfoBlock label="등급">
                  <StatusBadge
                    label={SUBSCRIPTION_TIER_LABELS[sub.data.tier] ?? sub.data.tier}
                    tone={subscriptionTierTone(sub.data.tier)}
                  />
                </InfoBlock>
                <InfoBlock label="proUntil">
                  {formatDateTime(sub.data.proUntil)}
                  <span className="ml-1 text-zinc-500">({sub.data.remainingDays}일)</span>
                </InfoBlock>
              </div>
            )}
          </QueryState>
        </PageSection>
      )}
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-700/60 bg-zinc-900/50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <div className="mt-1 text-sm text-zinc-200">{children}</div>
    </div>
  );
}

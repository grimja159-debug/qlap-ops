import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { economyApi } from '../services/economyApi';
import type { CurrencyType, EconomyDirection, EconomyChangeRequest, EconomyChangeResult } from '../types/economy';
import { TextField, NumberField, SelectField } from './Field';
import { InlineMessage } from './InlineMessage';
import { ConfirmButton } from './ConfirmButton';
import { StatusBadge } from './StatusBadge';
import { errorToMessage } from '../lib/apiError';
import { formatNumber } from '../lib/format';

interface EconomyChangeFormProps {
  presetUid?: string;
  lockUid?: boolean;
  onChanged?: (result: EconomyChangeResult) => void;
}

const CURRENCY_OPTIONS: Array<{ value: CurrencyType; label: string }> = [
  { value: 'qlcoin', label: 'QL 코인' },
];

const DIRECTION_OPTIONS: Array<{ value: EconomyDirection; label: string }> = [
  { value: 'grant', label: '지급 (+)' },
  { value: 'revoke', label: '차감 (-)' },
];

const MAX_MANUAL_AMOUNT = 1_000_000;

function currencyLabel(currency: CurrencyType): string {
  return currency === 'qlcoin' ? 'QL 코인' : currency;
}

function directionLabel(direction: EconomyDirection): string {
  return direction === 'grant' ? '지급' : '차감';
}

export function EconomyChangeForm({ presetUid, lockUid, onChanged }: EconomyChangeFormProps) {
  const qc = useQueryClient();
  const [uid, setUid] = useState(presetUid ?? '');
  const [currency, setCurrency] = useState<CurrencyType>('qlcoin');
  const [direction, setDirection] = useState<EconomyDirection>('grant');
  const [amount, setAmount] = useState<number>(NaN);
  const [reason, setReason] = useState('');

  const normalizedUid = uid.trim();
  const normalizedReason = reason.trim();
  const validationMessage = useMemo(() => {
    if (!normalizedUid) return 'UID를 입력하세요.';
    if (!Number.isFinite(amount) || amount < 1) return '수량은 1 이상이어야 합니다.';
    if (amount > MAX_MANUAL_AMOUNT) return `수량은 1회 최대 ${formatNumber(MAX_MANUAL_AMOUNT)}까지 허용합니다.`;
    if (normalizedReason.length < 2) return '사유는 2자 이상 입력하세요.';
    if (normalizedReason.length > 300) return '사유는 300자 이하로 입력하세요.';
    return null;
  }, [amount, normalizedReason, normalizedUid]);

  const mutation = useMutation({
    mutationFn: (request: EconomyChangeRequest) => economyApi.change(request),
    onSuccess: (result, variables) => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['user', variables.uid] });
      void qc.invalidateQueries({ queryKey: ['logs'] });
      setAmount(NaN);
      setReason('');
      onChanged?.(result);
    },
  });

  const submit = () => {
    if (validationMessage) return;
    mutation.mutate({
      uid: normalizedUid,
      currency,
      direction,
      amount: Math.floor(amount),
      reason: normalizedReason,
    });
  };

  const newBalance = mutation.data?.user.qlCoinBalance;

  return (
    <div className="flex flex-col gap-3">
      {!lockUid && (
        <TextField
          label="대상 UID"
          required
          value={uid}
          onChange={setUid}
          placeholder="Firebase UID"
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          label="재화"
          value={currency}
          onChange={(value) => setCurrency(value as CurrencyType)}
          options={CURRENCY_OPTIONS}
        />
        <SelectField
          label="처리"
          value={direction}
          onChange={(value) => setDirection(value as EconomyDirection)}
          options={DIRECTION_OPTIONS}
        />
      </div>
      <NumberField label="수량" required min={1} max={MAX_MANUAL_AMOUNT} value={amount} onChange={setAmount} />
      <TextField
        label="사유"
        required
        value={reason}
        onChange={setReason}
        placeholder="예: 이벤트 보상, 오류 보정"
        hint="재화 로그와 관리자 감사 로그에 남습니다. 개인정보/토큰은 적지 마세요."
      />

      <div className="rounded border border-zinc-700/60 bg-zinc-900/70 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-500">실행 예정</p>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={currencyLabel(currency)} tone="info" />
          <StatusBadge label={directionLabel(direction)} tone={direction === 'grant' ? 'success' : 'danger'} />
          <StatusBadge label={`${formatNumber(Number.isFinite(amount) ? Math.floor(amount) : 0)}개`} tone="neutral" />
        </div>
        <p className="mt-2 break-all text-xs text-zinc-500">대상 UID: {normalizedUid || '-'}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <ConfirmButton
          tone={direction === 'revoke' ? 'danger' : 'primary'}
          confirmLabel="실행 확정"
          disabled={mutation.isPending || validationMessage !== null}
          onConfirm={submit}
        >
          {direction === 'grant' ? '지급 실행' : '차감 실행'}
        </ConfirmButton>
        {validationMessage && <InlineMessage kind="warning">{validationMessage}</InlineMessage>}
        {mutation.isSuccess && (
          <InlineMessage kind="success">
            완료 · 변경 후 잔액 {formatNumber(newBalance)}
          </InlineMessage>
        )}
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
      </div>
    </div>
  );
}

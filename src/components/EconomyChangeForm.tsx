import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { economyApi } from '../services/economyApi';
import { CURRENCY_TYPES, CURRENCY_LABELS } from '../lib/constants';
import type { CurrencyType, EconomyDirection, EconomyChangeResult } from '../types/economy';
import { TextField, NumberField, SelectField } from './Field';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { formatNumber } from '../lib/format';

/**
 * 재화(QL 코인 / GM 티켓) 지급·차감 공용 폼.
 *
 * [재사용] 재화 관리 페이지와 유저 상세 모달이 동일 폼을 쓴다.
 *  - presetUid + lockUid: 유저 상세에서는 대상 UID 가 고정된다.
 *  - 성공 시 user/users/logs 쿼리를 무효화해 잔액·로그가 즉시 갱신되게 한다.
 *
 * amount 는 항상 양수, 방향(direction)으로 지급/차감을 구분한다(서비스가 라우트로 매핑).
 */
interface EconomyChangeFormProps {
  presetUid?: string;
  lockUid?: boolean;
  onChanged?: (result: EconomyChangeResult) => void;
}

const DIRECTION_OPTIONS = [
  { value: 'grant', label: '지급 (+)' },
  { value: 'revoke', label: '차감 (−)' },
] as const;

const CURRENCY_OPTIONS = CURRENCY_TYPES.map((c) => ({ value: c, label: CURRENCY_LABELS[c] }));

export function EconomyChangeForm({ presetUid, lockUid, onChanged }: EconomyChangeFormProps) {
  const qc = useQueryClient();
  const [uid, setUid] = useState(presetUid ?? '');
  const [currency, setCurrency] = useState<CurrencyType>('qlcoin');
  const [direction, setDirection] = useState<EconomyDirection>('grant');
  const [amount, setAmount] = useState<number>(NaN);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: economyApi.change,
    onSuccess: (result) => {
      // 잔액과 로그가 화면 곳곳에 흩어져 있으므로 관련 쿼리를 폭넓게 무효화한다.
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['user', uid] });
      void qc.invalidateQueries({ queryKey: ['logs'] });
      setAmount(NaN);
      setReason('');
      onChanged?.(result);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !Number.isFinite(amount) || amount < 1 || reason.trim().length < 1) return;
    mutation.mutate({ uid, currency, direction, amount, reason: reason.trim() });
  };

  const newBalance =
    mutation.data && currency === 'qlcoin'
      ? mutation.data.user.qlCoinBalance
      : mutation.data?.user.gmTiketBalance;

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!lockUid && (
        <TextField
          label="대상 UID"
          required
          value={uid}
          onChange={setUid}
          placeholder="사용자 UID"
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="재화"
          value={currency}
          onChange={(v) => setCurrency(v as CurrencyType)}
          options={CURRENCY_OPTIONS}
        />
        <SelectField
          label="처리"
          value={direction}
          onChange={(v) => setDirection(v as EconomyDirection)}
          options={DIRECTION_OPTIONS}
        />
      </div>
      <NumberField label="수량" required min={1} value={amount} onChange={setAmount} />
      <TextField
        label="사유"
        required
        value={reason}
        onChange={setReason}
        placeholder="예: 이벤트 보상, 오류 보상"
        hint="감사 로그(createdBy)에 함께 기록됩니다. (1~300자)"
      />
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
        >
          {mutation.isPending ? '처리 중...' : direction === 'grant' ? '지급' : '차감'}
        </button>
        {mutation.isSuccess && (
          <InlineMessage kind="success">
            완료 · 변경 후 잔액 {formatNumber(newBalance)}
          </InlineMessage>
        )}
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
      </div>
    </form>
  );
}

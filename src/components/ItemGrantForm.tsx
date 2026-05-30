import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemApi } from '../services/itemApi';
import type { Item } from '../types/item';
import { TextField, NumberField } from './Field';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';

/**
 * 아이템 지급 공용 폼 (POST /api/admin/items/grant).
 *
 * 활성 아이템 목록을 받아 itemId 입력에 datalist 자동완성을 제공한다.
 * 유저 상세 모달에서는 presetUid + lockUid 로 대상이 고정된다.
 *
 * 주의: 백엔드에 "아이템 회수" API 가 없어 차감은 제공하지 않는다(지급만 가능).
 */
interface ItemGrantFormProps {
  presetUid?: string;
  lockUid?: boolean;
}

export function ItemGrantForm({ presetUid, lockUid }: ItemGrantFormProps) {
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ['items'], queryFn: itemApi.listActive });

  const [uid, setUid] = useState(presetUid ?? '');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: itemApi.grant,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logs'] });
      setItemId('');
      setQuantity(1);
      setReason('');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !itemId || !Number.isFinite(quantity) || quantity < 1 || reason.trim().length < 1) return;
    mutation.mutate({ uid, itemId, quantity, reason: reason.trim() });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {!lockUid && (
        <TextField label="대상 UID" required value={uid} onChange={setUid} placeholder="사용자 UID" />
      )}
      <TextField
        label="아이템 ID"
        required
        value={itemId}
        onChange={setItemId}
        placeholder="item-..."
        list="item-grant-list"
        hint="활성 아이템 목록에서 선택하거나 직접 입력"
      />
      <datalist id="item-grant-list">
        {items?.map((item: Item) => (
          <option key={item.id} value={item.id} label={item.name ?? item.id} />
        ))}
      </datalist>
      <NumberField label="수량" required min={1} value={quantity} onChange={setQuantity} />
      <TextField
        label="사유"
        required
        value={reason}
        onChange={setReason}
        placeholder="예: GM 보상"
        hint="item_logs 에 사유와 처리자(actorUid)가 기록됩니다."
      />
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
        >
          {mutation.isPending ? '지급 중...' : '아이템 지급'}
        </button>
        {mutation.isSuccess && (
          <InlineMessage kind="success">
            지급 완료 · 보유 {mutation.data.userItem.quantity}개
          </InlineMessage>
        )}
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
      </div>
    </form>
  );
}

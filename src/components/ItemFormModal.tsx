import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from './Modal';
import { TextField, NumberField, SelectField, TextAreaField } from './Field';
import { ToggleSwitch } from './ToggleSwitch';
import { InlineMessage } from './InlineMessage';
import { errorToMessage } from '../lib/apiError';
import { itemApi } from '../services/itemApi';
import { ITEM_CURRENCIES, ITEM_CURRENCY_LABELS, type ItemCurrency } from '../lib/constants';
import type { EntryTicketTarget, Item, ItemUpsertRequest } from '../types/item';

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  editing?: Item | null;
}

const CURRENCY_OPTIONS = ITEM_CURRENCIES.map((c) => ({ value: c, label: ITEM_CURRENCY_LABELS[c] }));
const ITEM_TYPE_OPTIONS = [
  { value: '', label: '기본 아이템' },
  { value: 'entry_ticket', label: '입장권' },
] as const;
const ENTRY_TICKET_TARGET_OPTIONS: { value: EntryTicketTarget; label: string }[] = [
  { value: 'guild_create', label: '길드 생성' },
  { value: 'guild_join', label: '길드 가입' },
  { value: 'live_cw_create', label: '실시간 내전 방 만들기' },
  { value: 'live_cw_join', label: '실시간 내전 참가' },
  { value: 'tournament_join', label: '토너먼트 참가' },
];

export function ItemFormModal({ open, onClose, editing }: ItemFormModalProps) {
  const qc = useQueryClient();
  const [itemId, setItemId] = useState(editing?.id ?? '');
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState(editing?.category ?? '');
  const [price, setPrice] = useState<number>(typeof editing?.price === 'number' ? editing.price : 0);
  const [currency, setCurrency] = useState<ItemCurrency>((editing?.currency as ItemCurrency) ?? 'none');
  const [description, setDescription] = useState((editing?.description as string) ?? '');
  const [imageUrl, setImageUrl] = useState((editing?.imageUrl as string) ?? '');
  const [maxPerUser, setMaxPerUser] = useState<number>(
    typeof editing?.maxPerUser === 'number' ? editing.maxPerUser : 0,
  );
  const [active, setActive] = useState(editing?.active ?? true);
  const [itemType, setItemType] = useState<'' | 'entry_ticket'>(
    editing?.itemType === 'entry_ticket' ? 'entry_ticket' : '',
  );
  const [ticketCode, setTicketCode] = useState((editing?.ticketCode as string) ?? editing?.id ?? '');
  const [targetFeature, setTargetFeature] = useState<EntryTicketTarget>(
    (editing?.targetFeature as EntryTicketTarget) ?? 'live_cw_join',
  );
  const [maxUses, setMaxUses] = useState<number>(typeof editing?.maxUses === 'number' ? editing.maxUses : 1);
  const [expiresAt, setExpiresAt] = useState((editing?.expiresAt as string) ?? '');
  const [consumeReason, setConsumeReason] = useState((editing?.consumeReason as string) ?? '');

  const isEntryTicket = itemType === 'entry_ticket';

  const mutation = useMutation({
    mutationFn: () => {
      const payload: ItemUpsertRequest = {
        name: name.trim(),
        category: category.trim() || undefined,
        price: Number.isFinite(price) ? price : undefined,
        currency,
        maxPerUser: Number.isFinite(maxPerUser) ? maxPerUser : undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        active,
      };

      if (isEntryTicket) {
        payload.itemType = 'entry_ticket';
        payload.ticketCode = ticketCode.trim() || itemId.trim() || editing?.id;
        payload.targetFeature = targetFeature;
        payload.maxUses = Number.isFinite(maxUses) ? maxUses : 1;
        payload.expiresAt = expiresAt.trim();
        payload.consumeReason = consumeReason.trim() || `entry_ticket:${targetFeature}`;
      } else if (editing?.itemType === 'entry_ticket') {
        payload.itemType = '';
        payload.ticketCode = '';
        payload.targetFeature = '';
        payload.maxUses = 0;
        payload.expiresAt = '';
        payload.consumeReason = '';
      }

      return editing ? itemApi.update(editing.id, payload) : itemApi.create({ ...payload, itemId: itemId.trim() });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items-all'] });
      void qc.invalidateQueries({ queryKey: ['items'] });
      onClose();
    },
  });

  const canSubmit =
    name.trim().length >= 1 &&
    (editing ? true : itemId.trim().length >= 1) &&
    (!isEntryTicket || (ticketCode.trim().length >= 1 && targetFeature.length >= 1));

  return (
    <Modal open={open} onClose={onClose} size="lg" title={editing ? `아이템 수정 · ${editing.id}` : '새 아이템'}>
      <div className="flex flex-col gap-3">
        {!editing && (
          <TextField
            label="아이템 ID"
            required
            value={itemId}
            onChange={setItemId}
            placeholder="item-..."
            hint="영문/숫자/-/_ 권장. 생성 후에는 변경할 수 없습니다."
          />
        )}
        <TextField label="이름" required value={name} onChange={setName} placeholder="아이템 이름" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="분류" value={category} onChange={setCategory} placeholder="ticket, boost..." />
          <SelectField label="통화" value={currency} onChange={(v) => setCurrency(v as ItemCurrency)} options={CURRENCY_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="가격" min={0} value={price} onChange={setPrice} />
          <NumberField label="1인 보유 제한" min={0} value={maxPerUser} onChange={setMaxPerUser} hint="0이면 제한 없음" />
        </div>
        <div className="flex items-end">
          <ToggleSwitch checked={active} onChange={setActive} label="활성(상점 노출)" />
        </div>
        <SelectField label="아이템 종류" value={itemType} onChange={(v) => setItemType(v as '' | 'entry_ticket')} options={ITEM_TYPE_OPTIONS} />
        {isEntryTicket && (
          <div className="rounded border border-violet-500/30 bg-violet-500/5 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <TextField
                label="입장권 코드"
                required
                value={ticketCode}
                onChange={setTicketCode}
                placeholder="live-cw-join-ticket"
                hint="서버 로그와 사용 기록에 남는 코드입니다."
              />
              <SelectField
                label="사용 대상"
                value={targetFeature}
                onChange={(v) => setTargetFeature(v as EntryTicketTarget)}
                options={ENTRY_TICKET_TARGET_OPTIONS}
              />
              <NumberField label="최대 사용 횟수" min={0} value={maxUses} onChange={setMaxUses} hint="0이면 제한 없음, 입장권은 1 권장" />
              <TextField
                label="만료 시각 ISO"
                value={expiresAt}
                onChange={setExpiresAt}
                placeholder="2026-06-21T23:59:59.000Z"
                hint="비워두면 만료 없음. 서버에서 만료 티켓 사용을 차단합니다."
              />
            </div>
            <TextField
              label="사용 사유"
              value={consumeReason}
              onChange={setConsumeReason}
              placeholder={`entry_ticket:${targetFeature}`}
              hint="비워두면 사용 대상 기준으로 자동 저장됩니다."
              className="mt-3"
            />
          </div>
        )}
        <TextField label="이미지 URL" value={imageUrl} onChange={setImageUrl} placeholder="https://..." />
        <TextAreaField label="설명" value={description} onChange={setDescription} rows={3} />

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded"
          >
            {mutation.isPending ? '저장 중...' : editing ? '수정 저장' : '아이템 생성'}
          </button>
          {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
        </div>
      </div>
    </Modal>
  );
}

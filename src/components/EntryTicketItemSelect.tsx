import { SelectField } from './Field';
import { errorToMessage } from '../lib/apiError';
import type { EntryTicketTarget, Item } from '../types/item';

export function EntryTicketItemSelect({
  label,
  value,
  enabled,
  targetFeature,
  items,
  loading,
  error,
  onChange,
}: {
  label: string;
  value: string | null;
  enabled: boolean;
  targetFeature: EntryTicketTarget;
  items: Item[];
  loading: boolean;
  error: unknown;
  onChange: (value: string | null) => void;
}) {
  const normalizedValue = value ?? '';
  const targetItems = items.filter((item) => item.itemType === 'entry_ticket' && item.targetFeature === targetFeature);
  const selectedItem = normalizedValue ? items.find((item) => item.id === normalizedValue) : undefined;
  const selectedMismatch =
    !!selectedItem && (selectedItem.itemType !== 'entry_ticket' || selectedItem.targetFeature !== targetFeature);
  const selectedMissing = !!normalizedValue && items.length > 0 && !selectedItem;
  const selectedInactive = selectedItem?.active === false;
  const options = [
    {
      value: '',
      label: loading ? '입장권 목록 불러오는 중' : targetItems.length > 0 ? '입장권 선택 안 함' : '사용 가능한 입장권 없음',
    },
    ...targetItems.map((item) => ({
      value: item.id,
      label: entryTicketItemLabel(item),
    })),
  ];

  if (normalizedValue && !options.some((option) => option.value === normalizedValue)) {
    options.push({
      value: normalizedValue,
      label: selectedItem
        ? `현재 저장값: ${entryTicketItemLabel(selectedItem)}`
        : `현재 저장값: ${normalizedValue} (목록 확인 필요)`,
    });
  }

  return (
    <div className="space-y-1">
      <SelectField
        label={label}
        value={normalizedValue}
        disabled={!enabled || loading}
        options={options}
        onChange={(next) => onChange(next.trim() || null)}
        hint={`${targetFeature} 대상 entry_ticket 아이템만 표시됩니다.`}
      />
      {Boolean(error) && (
        <p className="text-xs text-amber-300">
          아이템 목록을 불러오지 못했습니다. 현재 저장된 itemId는 유지됩니다: {String(errorToMessage(error))}
        </p>
      )}
      {selectedMissing && (
        <p className="text-xs text-amber-300">
          현재 저장된 itemId가 아이템 목록에 없습니다. 삭제/비활성/권한 문제를 확인하세요.
        </p>
      )}
      {selectedMismatch && (
        <p className="text-xs text-red-300">현재 저장된 아이템의 targetFeature가 {targetFeature}와 다릅니다.</p>
      )}
      {selectedInactive && (
        <p className="text-xs text-amber-300">현재 저장된 입장권은 비활성 상태입니다. 사용 전에 활성화 상태를 확인하세요.</p>
      )}
    </div>
  );
}

function entryTicketItemLabel(item: Item): string {
  const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : item.id;
  const code = typeof item.ticketCode === 'string' && item.ticketCode.trim() ? ` · ${item.ticketCode.trim()}` : '';
  const state = item.active === false ? ' · 비활성' : '';
  return `${name} · ${item.id}${code}${state}`;
}

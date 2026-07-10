import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { ConfirmButton } from '../components/ConfirmButton';
import { InlineMessage } from '../components/InlineMessage';
import { ItemGrantForm } from '../components/ItemGrantForm';
import { ItemFormModal } from '../components/ItemFormModal';
import { TextField, NumberField } from '../components/Field';
import { itemApi } from '../services/itemApi';
import { formatNumber } from '../lib/format';
import { errorToMessage } from '../lib/apiError';
import { ITEM_CURRENCY_LABELS, type ItemCurrency } from '../lib/constants';
import type { Item } from '../types/item';

const ENTRY_TICKET_TARGET_LABELS: Record<string, string> = {
  guild_create: '길드 생성',
  guild_join: '길드 가입',
  live_cw_create: 'Live CW 방 만들기',
  live_cw_join: 'Live CW 참가',
  tournament_join: '대회 참가',
};

function entryTicketSummary(item: Item): string {
  if (item.itemType !== 'entry_ticket') return '일반 아이템';
  const target = item.targetFeature ? (ENTRY_TICKET_TARGET_LABELS[String(item.targetFeature)] ?? String(item.targetFeature)) : '대상 미설정';
  const maxUses = typeof item.maxUses === 'number' && item.maxUses > 0 ? `${item.maxUses}회` : '무제한';
  const expiresAt = typeof item.expiresAt === 'string' && item.expiresAt ? item.expiresAt.slice(0, 10) : null;
  return `${target} · ${maxUses}${expiresAt ? ` · 만료 ${expiresAt}` : ''}`;
}

/**
 * 상점 / 아이템 페이지(super_admin 전용).
 *
 * 지원: 전체(비활성 포함) 목록 + 아이템 생성/수정/활성토글/삭제 + 지급/회수.
 *   GET    /api/admin/items            전체 목록
 *   POST   /api/admin/items            생성
 *   PATCH  /api/admin/items/:id        수정 / active 토글
 *   DELETE /api/admin/items/:id        삭제
 *   POST   /api/admin/items/grant      지급
 *   POST   /api/admin/items/revoke     회수
 */
export function AdminItemsPage() {
  const qc = useQueryClient();
  const { data: items, isLoading, error } = useQuery({ queryKey: ['items-all'], queryFn: itemApi.listAll });

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const toggleMut = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => itemApi.update(id, { active }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items-all'] });
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => itemApi.remove(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['items-all'] });
      void qc.invalidateQueries({ queryKey: ['items'] });
    },
  });

  const columns: Column<Item>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs text-zinc-500">{r.id}</span> },
    { key: 'name', header: '이름', render: (r) => <span className="font-medium text-zinc-200">{r.name ?? '–'}</span> },
    { key: 'category', header: '분류', render: (r) => <span className="text-zinc-400 text-xs">{r.category ?? '–'}</span> },
    {
      key: 'itemType',
      header: '종류/대상',
      render: (r) => (
        <div className="flex flex-col gap-1">
          {r.itemType === 'entry_ticket' ? (
            <StatusBadge label="입장권" tone="info" />
          ) : (
            <StatusBadge label="일반" tone="neutral" />
          )}
          <span className="max-w-[220px] truncate text-[11px] text-zinc-500" title={entryTicketSummary(r)}>
            {entryTicketSummary(r)}
          </span>
          {r.itemType === 'entry_ticket' && r.ticketCode && (
            <span className="max-w-[220px] truncate font-mono text-[10px] text-zinc-600" title={r.ticketCode}>
              {r.ticketCode}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: '가격',
      render: (r) =>
        typeof r.price === 'number' ? (
          <span className="text-xs font-mono text-zinc-300">
            {formatNumber(r.price)} {ITEM_CURRENCY_LABELS[(r.currency as ItemCurrency) ?? 'none'] ?? r.currency ?? ''}
          </span>
        ) : (
          <span className="text-zinc-600">–</span>
        ),
    },
    {
      key: 'active',
      header: '상태',
      render: (r) =>
        r.active === false ? <StatusBadge label="비활성" tone="neutral" /> : <StatusBadge label="활성" tone="success" />,
    },
    {
      key: 'actions',
      header: '관리',
      render: (r) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => setEditing(r)} className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100">
            수정
          </button>
          <button
            type="button"
            disabled={toggleMut.isPending}
            onClick={() => toggleMut.mutate({ id: r.id, active: r.active === false })}
            className="px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-100 disabled:opacity-50"
          >
            {r.active === false ? '활성화' : '비활성화'}
          </button>
          <ConfirmButton tone="danger" confirmLabel="삭제 확정" className="text-xs px-2 py-1" disabled={removeMut.isPending} onConfirm={() => removeMut.mutate(r.id)}>
            삭제
          </ConfirmButton>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageSection
        title="아이템 목록"
        description="비활성 포함 전체 아이템입니다. 생성/수정/활성토글/삭제가 가능합니다."
        right={
          <button onClick={() => setShowCreate(true)} className="bg-violet-600 hover:bg-violet-700 text-white text-sm px-4 py-1.5 rounded">
            + 새 아이템
          </button>
        }
      >
        {(toggleMut.isError || removeMut.isError) && (
          <div className="mb-2">
            <InlineMessage kind="error">{errorToMessage(toggleMut.error ?? removeMut.error)}</InlineMessage>
          </div>
        )}
        <QueryState isLoading={isLoading} error={error}>
          <DataTable columns={columns} data={items ?? []} rowKey={(r) => r.id} emptyMessage="아이템이 없습니다" />
        </QueryState>
      </PageSection>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <PageSection title="아이템 지급">
          <ItemGrantForm />
        </PageSection>
        <PageSection title="아이템 회수">
          <ItemRevokeForm />
        </PageSection>
      </div>

      {showCreate && <ItemFormModal open={showCreate} onClose={() => setShowCreate(false)} />}
      {editing && <ItemFormModal open={editing !== null} editing={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** 아이템 회수 폼 (POST /api/admin/items/revoke). */
function ItemRevokeForm() {
  const qc = useQueryClient();
  const [uid, setUid] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: itemApi.revoke,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['logs'] });
      setQuantity(1);
      setReason('');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !itemId || !Number.isFinite(quantity) || quantity < 1 || reason.trim().length < 1) return;
    mutation.mutate({ uid: uid.trim(), itemId: itemId.trim(), quantity, reason: reason.trim() });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextField label="대상 UID" required value={uid} onChange={setUid} placeholder="사용자 UID" />
      <TextField label="아이템 ID" required value={itemId} onChange={setItemId} placeholder="item-..." />
      <NumberField label="수량" required min={1} value={quantity} onChange={setQuantity} />
      <TextField label="사유" required value={reason} onChange={setReason} placeholder="예: 오지급 회수" hint="item_logs 에 회수 기록(ADMIN_REVOKE)이 남습니다." />
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={mutation.isPending} className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded">
          {mutation.isPending ? '회수 중...' : '아이템 회수'}
        </button>
        {mutation.isSuccess && <InlineMessage kind="success">회수 완료 · 보유 {mutation.data.userItem.quantity}개</InlineMessage>}
        {mutation.isError && <InlineMessage kind="error">{errorToMessage(mutation.error)}</InlineMessage>}
      </div>
    </form>
  );
}

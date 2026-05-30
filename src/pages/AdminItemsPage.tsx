import { useQuery } from '@tanstack/react-query';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { PageSection } from '../components/PageSection';
import { QueryState } from '../components/QueryState';
import { ItemGrantForm } from '../components/ItemGrantForm';
import { NotImplementedNotice } from '../components/NotImplementedNotice';
import { itemApi } from '../services/itemApi';
import { formatNumber } from '../lib/format';
import type { Item } from '../types/item';

/**
 * 상점 / 아이템 페이지.
 *
 * 지원: 활성 아이템 목록 조회(GET /api/items) + 아이템 지급(POST /api/admin/items/grant).
 * 미지원(백엔드 없음): 아이템 추가/수정/비활성/삭제/가격변경, 아이템 회수.
 *   → 가짜로 만들지 않고 "필요한 추가 API"로 명세만 노출한다.
 */
export function AdminItemsPage() {
  const { data: items, isLoading, error } = useQuery({ queryKey: ['items'], queryFn: itemApi.listActive });

  const columns: Column<Item>[] = [
    { key: 'id', header: 'ID', render: (r) => <span className="font-mono text-xs text-zinc-500">{r.id}</span> },
    { key: 'name', header: '이름', render: (r) => <span className="font-medium text-zinc-200">{r.name ?? '–'}</span> },
    { key: 'category', header: '분류', render: (r) => <span className="text-zinc-400 text-xs">{r.category ?? '–'}</span> },
    {
      key: 'price',
      header: '가격',
      render: (r) =>
        typeof r.price === 'number' ? (
          <span className="text-xs font-mono text-zinc-300">
            {formatNumber(r.price)} {r.currency ?? ''}
          </span>
        ) : (
          <span className="text-zinc-600">–</span>
        ),
    },
    {
      key: 'active',
      header: '상태',
      render: (r) =>
        r.active === false ? (
          <StatusBadge label="비활성" tone="neutral" />
        ) : (
          <StatusBadge label="활성" tone="success" />
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <PageSection title="활성 아이템 목록" description="GET /api/items — active=true 인 상점 노출 아이템만 표시됩니다.">
        <QueryState isLoading={isLoading} error={error}>
          <DataTable columns={columns} data={items ?? []} rowKey={(r) => r.id} emptyMessage="활성 아이템이 없습니다" />
        </QueryState>
      </PageSection>

      <PageSection title="아이템 지급" className="max-w-md">
        <ItemGrantForm />
      </PageSection>

      <NotImplementedNotice
        title="상점 아이템 관리 (추가 / 수정 / 비활성 / 삭제 / 가격변경 / 회수)"
        reason="현재 QLapServices Admin API 는 아이템 '조회'와 '지급'만 제공합니다. 아이템 자체의 CRUD 와 회수 기능은 백엔드 엔드포인트가 없어 콘솔에서 처리할 수 없습니다."
        endpoints={[
          { method: 'POST', path: '/api/admin/items', note: '아이템 추가 (name, category, price, currency, active 등)' },
          { method: 'PATCH', path: '/api/admin/items/:itemId', note: '아이템 수정 / 가격 변경 / active 토글(비활성)' },
          { method: 'DELETE', path: '/api/admin/items/:itemId', note: '아이템 삭제' },
          { method: 'POST', path: '/api/admin/items/revoke', note: '아이템 회수 { uid, itemId, quantity, reason }' },
          { method: 'GET', path: '/api/admin/items', note: '비활성 포함 전체 아이템 목록(관리용)' },
        ]}
      />
    </div>
  );
}

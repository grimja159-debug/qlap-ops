/**
 * 아이템 / 상점 API.
 *
 * 엔드포인트:
 *   GET    /api/items                  활성 아이템 목록(상점 노출)   → { items }
 *   GET    /api/admin/items            전체(비활성 포함) 목록         → { items }   (super_admin)
 *   GET    /api/admin/items/:id        단건                          → { item }    (super_admin)
 *   POST   /api/admin/items            생성                          → { item }    (super_admin)
 *   PATCH  /api/admin/items/:id        수정                          → { item }    (super_admin)
 *   DELETE /api/admin/items/:id        삭제                          → { deleted } (super_admin)
 *   POST   /api/admin/items/grant      지급                          → { userItem, logId }
 *   POST   /api/admin/items/revoke     회수                          → { userItem, logId } (super_admin)
 */
import { api } from './api';
import type {
  Item,
  ItemGrantRequest,
  ItemGrantResult,
  ItemRevokeRequest,
  ItemUpsertRequest,
} from '../types/item';

export const itemApi = {
  /** active=true 인 아이템만 내려온다(상점 노출 대상). */
  listActive: () => api.get<{ items: Item[] }>('/api/items').then((r) => r.items),

  /** 비활성 포함 전체 아이템(관리용). */
  listAll: () => api.get<{ items: Item[] }>('/api/admin/items').then((r) => r.items),

  get: (id: string) =>
    api.get<{ item: Item }>(`/api/admin/items/${encodeURIComponent(id)}`).then((r) => r.item),

  create: (input: ItemUpsertRequest) =>
    api.post<{ item: Item }>('/api/admin/items', input).then((r) => r.item),

  update: (id: string, patch: ItemUpsertRequest) =>
    api.patch<{ item: Item }>(`/api/admin/items/${encodeURIComponent(id)}`, patch).then((r) => r.item),

  remove: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/api/admin/items/${encodeURIComponent(id)}`),

  grant: (data: ItemGrantRequest) =>
    api.post<{ userItem: ItemGrantResult['userItem']; logId: string }>('/api/admin/items/grant', data),

  revoke: (data: ItemRevokeRequest) =>
    api.post<{ userItem: ItemGrantResult['userItem']; logId: string }>('/api/admin/items/revoke', data),
};

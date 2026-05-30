/**
 * 아이템 / 상점 API.
 *
 * 엔드포인트:
 *   GET  /api/items                활성 아이템 목록   → { items }
 *   POST /api/admin/items/grant    아이템 지급        → { userItem, logId }
 *
 * 미구현(백엔드 없음): 아이템 추가/수정/비활성/삭제/가격변경, 아이템 회수.
 *   화면(AdminItemsPage)에서 "필요한 추가 API"로 안내한다.
 */
import { api } from './api';
import type { Item, ItemGrantRequest, ItemGrantResult } from '../types/item';

export const itemApi = {
  /** active=true 인 아이템만 내려온다(상점 노출 대상). */
  listActive: () => api.get<{ items: Item[] }>('/api/items').then((r) => r.items),

  grant: (data: ItemGrantRequest) =>
    api.post<{ userItem: ItemGrantResult['userItem']; logId: string }>(
      '/api/admin/items/grant',
      data,
    ),
};

/**
 * 아이템 / 상점 타입.
 *
 * 엔드포인트:
 *   GET  /api/items                → { ok, items: Item[] }   (active=true 인 것만)
 *   POST /api/admin/items/grant    → { ok, userItem, logId } 본문 { uid, itemId, quantity, reason }
 *
 * 주의: items 문서의 스키마는 앱이 자유롭게 정의한다. 백엔드는 { id, ...data } 를 그대로 내려준다.
 *       그래서 화면에서 꼭 쓰는 필드만 optional 로 선언하고, 나머지는 [key]로 받아 원본을 보존한다.
 *
 * 미구현(백엔드 API 없음): 아이템 추가/수정/비활성화/삭제/가격변경, 아이템 회수.
 *   → ADMIN_GUIDE.md 의 "필요한 추가 API" 참고.
 */
import type { IsoDate } from './common';

export interface Item {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
  active?: boolean;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
  /** 위에 명시하지 않은 임의 필드도 보존(아이템 스키마가 앱마다 다르므로). */
  [key: string]: unknown;
}

export interface ItemGrantRequest {
  uid: string;
  itemId: string;
  quantity: number;
  reason: string;
}

/** 지급 결과로 돌아오는 사용자 보유 아이템(user_items). */
export interface UserItem {
  id: string;
  uid: string;
  itemId: string;
  quantity: number;
  active: boolean;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
}

export interface ItemGrantResult {
  userItem: UserItem;
  logId: string;
}

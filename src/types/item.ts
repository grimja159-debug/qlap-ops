import type { IsoDate } from './common';

/**
 * Item and shop admin types.
 *
 * qlap-ops already connects item create/update/deactivate/delete/grant/revoke through
 * itemApi/AdminItemsPage. Item documents may carry extra backend-defined fields, so this type
 * preserves unknown keys.
 */
export interface Item {
  id: string;
  name?: string;
  description?: string;
  category?: string;
  itemType?: 'entry_ticket' | string;
  ticketCode?: string;
  targetFeature?: EntryTicketTarget | string;
  maxUses?: number;
  expiresAt?: IsoDate | string;
  consumeReason?: string;
  price?: number;
  currency?: string;
  /** Per-user ownership limit. 0/undefined means no fixed limit. */
  maxPerUser?: number;
  active?: boolean;
  createdAt?: IsoDate;
  updatedAt?: IsoDate;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface ItemGrantRequest {
  uid: string;
  itemId: string;
  quantity: number;
  reason: string;
}

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

export interface ItemUpsertRequest {
  itemId?: string;
  name?: string;
  description?: string;
  category?: string;
  itemType?: 'entry_ticket' | '';
  ticketCode?: string;
  targetFeature?: EntryTicketTarget | '';
  maxUses?: number;
  expiresAt?: string;
  consumeReason?: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  maxPerUser?: number;
  active?: boolean;
}

export type ItemRevokeRequest = ItemGrantRequest;

export type EntryTicketTarget =
  | 'guild_create'
  | 'guild_join'
  | 'live_cw_create'
  | 'live_cw_join'
  | 'tournament_join';

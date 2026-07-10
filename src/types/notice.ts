/**
 * 운영 공지/배너 타입.
 *
 * 엔드포인트(QLapServices Admin API, super_admin 전용):
 *   GET    /api/admin/notices?type=&active=&limit=   → { ok, notices }
 *   POST   /api/admin/notices                         → { ok, notice }
 *   GET    /api/admin/notices/:id                     → { ok, notice }
 *   PATCH  /api/admin/notices/:id                     → { ok, notice }
 *   DELETE /api/admin/notices/:id                     → { ok, deleted, id }
 */
import type { IsoDate } from './common';
import type { NoticeType } from '../lib/constants';

export interface Notice {
  id: string;
  title: string;
  body: string;
  type: NoticeType;
  active: boolean;
  pinned: boolean;
  startAt?: IsoDate | null;
  endAt?: IsoDate | null;
  createdAt: IsoDate;
  updatedAt: IsoDate;
  createdBy?: string;
  updatedBy?: string;
}

export interface NoticeInput {
  title: string;
  body: string;
  type: NoticeType;
  active?: boolean;
  pinned?: boolean;
  startAt?: string | null;
  endAt?: string | null;
}

export type NoticeUpdate = Partial<NoticeInput>;

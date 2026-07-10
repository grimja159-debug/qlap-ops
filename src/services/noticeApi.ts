/**
 * 운영 공지/배너 API (super_admin 전용).
 *
 * 엔드포인트:
 *   GET    /api/admin/notices?type=&active=&limit=   → { notices }
 *   POST   /api/admin/notices                         → { notice }
 *   PATCH  /api/admin/notices/:id                     → { notice }
 *   DELETE /api/admin/notices/:id                     → { deleted, id }
 */
import { api, buildQuery } from './api';
import type { Notice, NoticeInput, NoticeUpdate } from '../types/notice';

export interface NoticeListParams {
  type?: string;
  active?: boolean;
  limit?: number;
}

export const noticeApi = {
  list: (params: NoticeListParams = {}) =>
    api.get<{ notices: Notice[] }>(`/api/admin/notices${buildQuery({ ...params })}`).then((r) => r.notices),

  get: (id: string) =>
    api.get<{ notice: Notice }>(`/api/admin/notices/${encodeURIComponent(id)}`).then((r) => r.notice),

  create: (input: NoticeInput) =>
    api.post<{ notice: Notice }>('/api/admin/notices', input).then((r) => r.notice),

  update: (id: string, patch: NoticeUpdate) =>
    api.patch<{ notice: Notice }>(`/api/admin/notices/${encodeURIComponent(id)}`, patch).then((r) => r.notice),

  remove: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/api/admin/notices/${encodeURIComponent(id)}`),
};

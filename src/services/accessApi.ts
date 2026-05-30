/**
 * 접근 권한 플래그 API (user_access: guildCreate / guildManage / aiReport).
 *
 * 엔드포인트:
 *   GET  /api/me/access            본인 플래그            → { access }
 *   GET  /api/admin/access          전체 목록(필터 가능)   → { accessList, count }
 *   GET  /api/admin/access/:uid      단건                  → { access }
 *   POST /api/admin/access/update    수정                  → { access }
 *
 * 모든 응답이 { ok, ... } 봉투이므로 각 함수에서 실제 키만 꺼내 반환한다
 * (이전 버전은 봉투를 그대로 반환해 화면에서 access.guildCreate 가 항상 undefined 였던 버그가 있었다).
 */
import { api, buildQuery } from './api';
import type { UserAccess, AccessUpdateRequest, AccessFlagKey } from '../types/access';

export const accessApi = {
  getMyAccess: () => api.get<{ access: UserAccess }>('/api/me/access').then((r) => r.access),

  /** 전체 접근 권한 목록. 특정 플래그로 필터링 가능(예: guildManage=true). */
  list: (filters: Partial<Record<AccessFlagKey, boolean>> = {}, limit = 100) =>
    api
      .get<{ accessList: UserAccess[]; count: number }>(
        `/api/admin/access${buildQuery({ ...filters, limit })}`,
      )
      .then((r) => r.accessList),

  getByUid: (uid: string) =>
    api
      .get<{ access: UserAccess }>(`/api/admin/access/${encodeURIComponent(uid)}`)
      .then((r) => r.access),

  update: (data: AccessUpdateRequest) =>
    api.post<{ access: UserAccess }>('/api/admin/access/update', data).then((r) => r.access),
};

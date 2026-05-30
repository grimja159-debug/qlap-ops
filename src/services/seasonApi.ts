/**
 * 시즌 관리 API.
 *
 * 엔드포인트 (QLapServices Admin API):
 *   GET   /api/admin/seasons        목록     → { seasons }
 *   GET   /api/admin/seasons/:id     단건     → { season }
 *   POST  /api/admin/seasons         생성     → { season }
 *   PATCH /api/admin/seasons/:id      수정     → { season }
 *
 * '시즌 종료'는 전용 API가 없으므로 update(id, { status: 'ended' }) 로 처리한다.
 * '현재 시즌'도 전용 API가 없어, 목록에서 진행중 상태(ACTIVE_SEASON_STATUSES)를 골라낸다.
 */
import { api } from './api';
import type { Season, SeasonCreateRequest, SeasonUpdateRequest } from '../types/season';

export const seasonApi = {
  list: () => api.get<{ seasons: Season[] }>('/api/admin/seasons').then((r) => r.seasons),

  get: (id: string) =>
    api.get<{ season: Season }>(`/api/admin/seasons/${encodeURIComponent(id)}`).then((r) => r.season),

  create: (data: SeasonCreateRequest) =>
    api.post<{ season: Season }>('/api/admin/seasons', data).then((r) => r.season),

  update: (id: string, patch: SeasonUpdateRequest) =>
    api
      .patch<{ season: Season }>(`/api/admin/seasons/${encodeURIComponent(id)}`, patch)
      .then((r) => r.season),

  /** 시즌 종료 = status 를 'ended' 로 변경. */
  end: (id: string) =>
    api
      .patch<{ season: Season }>(`/api/admin/seasons/${encodeURIComponent(id)}`, { status: 'ended' })
      .then((r) => r.season),
};

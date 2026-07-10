import { api } from './api';
import type { Season, SeasonCreateRequest, SeasonRolloverReport, SeasonUpdateRequest } from '../types/season';

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

  end: (id: string) =>
    api
      .patch<{ season: Season }>(`/api/admin/seasons/${encodeURIComponent(id)}`, { status: 'ended' })
      .then((r) => r.season),

  setCurrent: (id: string) =>
    api
      .post<{ season: Season }>(`/api/admin/seasons/${encodeURIComponent(id)}/set-current`, {})
      .then((r) => r.season),

  rollover: (id: string, input: { apply: boolean }) =>
    api
      .post<{ rollover: SeasonRolloverReport }>(`/api/admin/seasons/${encodeURIComponent(id)}/rollover`, {
        apply: input.apply,
        confirm: input.apply,
      })
      .then((r) => r.rollover),
};

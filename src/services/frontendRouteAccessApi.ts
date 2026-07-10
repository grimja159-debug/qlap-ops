import { api } from './api';
import type { FrontendRouteAccessPatch, FrontendRouteAccessSettings } from '../types/frontendRouteAccess';

export const frontendRouteAccessApi = {
  getSettings: () =>
    api
      .get<{ settings: FrontendRouteAccessSettings }>('/api/admin/frontend/route-access')
      .then((r) => r.settings),

  updateSettings: (input: FrontendRouteAccessPatch) =>
    api
      .patch<{ settings: FrontendRouteAccessSettings }>('/api/admin/frontend/route-access', input)
      .then((r) => r.settings),
};

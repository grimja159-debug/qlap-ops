import { api } from './api';
import type { ExpeditionSettings, ExpeditionUpdate } from '../types/guildExpedition';

export const guildExpeditionApi = {
  get: () =>
    api.get<{ settings: ExpeditionSettings }>('/api/admin/expedition-settings').then((r) => r.settings),

  update: (patch: ExpeditionUpdate) =>
    api.patch<{ settings: ExpeditionSettings }>('/api/admin/expedition-settings', patch).then((r) => r.settings),
};

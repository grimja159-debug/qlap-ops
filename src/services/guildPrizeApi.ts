import { api } from './api';
import type { GuildPrizeSettings, GuildPrizeUpdate } from '../types/guildPrize';

export const guildPrizeApi = {
  get: () =>
    api.get<{ settings: GuildPrizeSettings }>('/api/admin/guild-prize-settings').then((r) => r.settings),

  update: (patch: GuildPrizeUpdate) =>
    api.patch<{ settings: GuildPrizeSettings }>('/api/admin/guild-prize-settings', patch).then((r) => r.settings),
};

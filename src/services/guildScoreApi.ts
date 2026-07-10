/**
 * 길드 스코어 설정 API (QLapServices Admin).
 * 조회/저장/미리보기. 저장은 super_admin(백엔드 게이트). 미리보기는 저장하지 않고 테스트 계산만.
 */
import { api } from './api';
import type { GuildScoreSettings, RankInput, ScorePreview } from '../types/guildScore';

export interface ScorePreviewInput {
  settings?: GuildScoreSettings;
  solo?: RankInput | null;
  flex?: RankInput | null;
}

export const guildScoreApi = {
  getSettings: () =>
    api.get<{ settings: GuildScoreSettings }>('/api/admin/guild-score-settings').then((r) => r.settings),

  updateSettings: (settings: GuildScoreSettings) =>
    api
      .put<{ settings: GuildScoreSettings }>('/api/admin/guild-score-settings', settings)
      .then((r) => r.settings),

  preview: (input: ScorePreviewInput) =>
    api
      .post<{ preview: ScorePreview }>('/api/admin/guild-score-settings/preview', input)
      .then((r) => r.preview),
};

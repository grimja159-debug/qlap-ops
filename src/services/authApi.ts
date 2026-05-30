import { api } from './api';
import type { MeResponse } from '../types/auth';

interface MeApiResponse {
  ok: boolean;
  user: MeResponse;
}

export const authApi = {
  getMe: () => api.get<MeApiResponse>('/api/me').then((res) => res.user),
  initMe: () => api.post<MeApiResponse>('/api/me/init', {}).then((res) => res.user),
};

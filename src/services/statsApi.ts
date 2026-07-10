/**
 * 대시보드 실지표 집계 API (super_admin 전용).
 *
 * 엔드포인트: GET /api/admin/stats/overview  → { ...OverviewStats }
 * Server DB 집계를 우선 사용한다. Server DB가 비어 있거나 장애인 경우에만 백엔드가 명시적으로 Firestore fallback을 표시한다.
 */
import { api } from './api';
import type { OverviewStats } from '../types/stats';

export const statsApi = {
  overview: () => api.get<OverviewStats>('/api/admin/stats/overview'),
};

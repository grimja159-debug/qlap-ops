/**
 * 대시보드 실지표 집계 타입.
 *
 * 엔드포인트(QLapServices Admin API, super_admin 전용):
 *   GET /api/admin/stats/overview  → { ok, ...OverviewStats }
 *
 * "≤100 로드분" 추정이 아니라 Server DB 우선 집계로 낸 실제 전수 수치다.
 * source가 firestore_fallback이면 백엔드가 명시적으로 fallback과 read 수를 함께 표시한다.
 */
export interface OverviewStats {
  totalUsers: number;
  totalGuilds: number;
  totalSeasons: number;
  activeGuilds: number;
  newUsers7d: number;
  newUsers30d: number;
  planCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  generatedAt: string;
  source?: 'server_db' | 'server_db_empty' | 'firestore_fallback' | string;
  firestoreReads?: number;
  warning?: string | null;
}

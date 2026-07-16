import { api } from './api';
import type {
  AssignGuildMembersRequest,
  AssignGuildMembersResult,
  BulkGuildPointsRequest,
  BulkGuildPointsResult,
  BulkWalletRequest,
  BulkWalletResult,
  CleanupRequest,
  CleanupResult,
  ScenarioRequest,
  ScenarioResult,
  SeedGuildsRequest,
  SeedGuildsResult,
  SeedUsersRequest,
  SeedUsersResult,
  TestLabEndpointSpec,
  TestLabSummary,
} from '../types/testLab';

/**
 * 테스트랩 API 레지스트리 + 호출 함수.
 *
 * 7개 mutation(seed-users/seed-guilds/assign-guild-members/bulk-wallet/bulk-guild-points/
 * scenario/cleanup)은 QLapServices 백엔드에 구현되어 실제로 호출한다. 이들은 백엔드에서
 * super_admin 전용(SUPER_ADMIN_REQUIRED)이며 모든 변경은 testLabAuditLogs 에 기록된다.
 *
 * 시즌 상태 변경은 시즌 관리 페이지의 PATCH /api/admin/seasons/:id 를 사용한다.
 * 랭킹 재계산은 QLapGuild API의 rebuild-snapshot 엔드포인트에 연결했다.
 * 시즌 복제만 아직 별도 정책이 필요해 'planned' 로 남긴다.
 */
export const TEST_LAB_ENDPOINTS: TestLabEndpointSpec[] = [
  {
    key: 'summary',
    method: 'GET',
    path: '/api/admin/test-lab/summary',
    note: '테스트 유저/길드 수, 최근 seedBatchId, 현재 시즌, 최근 생성 시각을 반환합니다.',
    state: 'implemented',
  },
  {
    key: 'seed-users',
    method: 'POST',
    path: '/api/admin/test-lab/seed-users',
    note: 'isTestUser=true, seedBatchId, createdBy, reason, source=test-lab 를 포함한 테스트 유저와 초기 지갑을 생성합니다.',
    state: 'implemented',
  },
  {
    key: 'seed-guilds',
    method: 'POST',
    path: '/api/admin/test-lab/seed-guilds',
    note: 'isTestGuild=true 메타데이터가 붙은 테스트 길드와 선택적 테스트 길드장을 생성합니다.',
    state: 'implemented',
  },
  {
    key: 'assign-guild-members',
    method: 'POST',
    path: '/api/admin/test-lab/assign-guild-members',
    note: '테스트 유저를 테스트 길드에 역할 비율대로 자동 배치합니다.',
    state: 'implemented',
  },
  {
    key: 'bulk-guild-points',
    method: 'POST',
    path: '/api/admin/test-lab/bulk-guild-points',
    note: '테스트 길드 포인트와 guildPointLogs(testLab=true)를 함께 생성하고 대상 길드끼리 순위를 매깁니다.',
    state: 'implemented',
  },
  {
    key: 'bulk-wallet',
    method: 'POST',
    path: '/api/admin/test-lab/bulk-wallet',
    note: '테스트 대상 유저들의 qlCoin 잔액을 일괄 grant/revoke/set 처리하고 로그를 남깁니다. (테스트 유저만 대상)',
    state: 'implemented',
  },
  {
    key: 'scenario',
    method: 'POST',
    path: '/api/admin/test-lab/scenario',
    note: '초기 스피드 데모, 길드 경쟁, 토너먼트 진출, 재화/상점 테스트 시나리오를 한 번에 구성합니다.',
    state: 'implemented',
  },
  {
    key: 'cleanup',
    method: 'POST',
    path: '/api/admin/test-lab/cleanup',
    note: 'dryRun 결과를 먼저 반환하고, 실제 삭제는 isTestUser/isTestGuild/seedBatchId 가 있는 데이터만 허용합니다.',
    state: 'implemented',
  },
  {
    key: 'season-status',
    method: 'PATCH',
    path: '/api/admin/seasons/:id',
    note: '시즌 상태 변경은 시즌 관리 페이지에서 부분 수정 API로 처리합니다.',
    state: 'implemented',
  },
  {
    key: 'season-clone',
    method: 'POST',
    path: '/api/admin/seasons/:id/clone',
    note: '(미구현) 기존 시즌 설정을 복제해 테스트용 시즌을 생성합니다. 시즌 라우트 변경 필요(이번 범위 밖).',
    state: 'planned',
  },
  {
    key: 'season-recalculate-rankings',
    method: 'POST',
    path: '/api/admin/seasons/:id/rankings/rebuild-snapshot',
    note: 'QLapGuild API의 랭킹 스냅샷 재생성 경로에 연결됩니다. 기본은 dry-run 미리보기입니다.',
    state: 'implemented',
  },
];

export const TEST_LAB_INVALIDATE_QUERY_KEYS = [
  'admin-users',
  'admin-guilds',
  'seasons',
  'logs',
  'test-lab-summary',
] as const;

export const testLabApi = {
  endpoints: TEST_LAB_ENDPOINTS,
  invalidateQueryKeys: TEST_LAB_INVALIDATE_QUERY_KEYS,
  summary: () => api.get<TestLabSummary>('/api/admin/test-lab/summary'),
  seedUsers: (body: SeedUsersRequest) =>
    api.post<SeedUsersResult>('/api/admin/test-lab/seed-users', body),
  seedGuilds: (body: SeedGuildsRequest) =>
    api.post<SeedGuildsResult>('/api/admin/test-lab/seed-guilds', body),
  assignGuildMembers: (body: AssignGuildMembersRequest) =>
    api.post<AssignGuildMembersResult>('/api/admin/test-lab/assign-guild-members', body),
  bulkWallet: (body: BulkWalletRequest) =>
    api.post<BulkWalletResult>('/api/admin/test-lab/bulk-wallet', body),
  bulkGuildPoints: (body: BulkGuildPointsRequest) =>
    api.post<BulkGuildPointsResult>('/api/admin/test-lab/bulk-guild-points', body),
  scenario: (body: ScenarioRequest) =>
    api.post<ScenarioResult>('/api/admin/test-lab/scenario', body),
  cleanup: (body: CleanupRequest) =>
    api.post<CleanupResult>('/api/admin/test-lab/cleanup', body),
};

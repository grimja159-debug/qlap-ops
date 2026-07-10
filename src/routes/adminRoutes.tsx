import type { RouteObject } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { lazyPage } from './lazyPage';

/**
 * 페이지는 모두 React.lazy 로 코드 스플리팅한다(routes/lazyPage.ts).
 * 레이아웃 셸(AdminLayout)만 즉시 로드하고, 각 페이지 본문은 진입 시 지연 로드한다.
 * 경로/메뉴 라벨은 routes/navItems.ts 와 짝을 이룬다.
 * (Tournament/AI 페이지는 대응 백엔드 API가 없어 제거했다.)
 */
const AdminDashboardPage = lazyPage(() => import('../pages/AdminDashboardPage'), 'AdminDashboardPage');
const AdminUsersPage = lazyPage(() => import('../pages/AdminUsersPage'), 'AdminUsersPage');
const AdminAccessPage = lazyPage(() => import('../pages/AdminAccessPage'), 'AdminAccessPage');
const AdminEconomyPage = lazyPage(() => import('../pages/AdminEconomyPage'), 'AdminEconomyPage');
const AdminItemsPage = lazyPage(() => import('../pages/AdminItemsPage'), 'AdminItemsPage');
const AdminGuildsPage = lazyPage(() => import('../pages/AdminGuildsPage'), 'AdminGuildsPage');
const AdminGuildScorePage = lazyPage(() => import('../pages/AdminGuildScorePage'), 'AdminGuildScorePage');
const AdminPersonalScorePage = lazyPage(() => import('../pages/AdminPersonalScorePage'), 'AdminPersonalScorePage');
const AdminSeasonsPage = lazyPage(() => import('../pages/AdminSeasonsPage'), 'AdminSeasonsPage');
const AdminNoticePage = lazyPage(() => import('../pages/AdminNoticePage'), 'AdminNoticePage');
const AdminGuildPrizePage = lazyPage(() => import('../pages/AdminGuildPrizePage'), 'AdminGuildPrizePage');
const AdminGuildExpeditionSettingsPage = lazyPage(
  () => import('../pages/AdminGuildExpeditionSettingsPage'),
  'AdminGuildExpeditionSettingsPage',
);
const AdminLogsPage = lazyPage(() => import('../pages/AdminLogsPage'), 'AdminLogsPage');
const AdminAuditPage = lazyPage(() => import('../pages/AdminAuditPage'), 'AdminAuditPage');
const AdminSystemPage = lazyPage(() => import('../pages/AdminSystemPage'), 'AdminSystemPage');
const AdminRedisCachePage = lazyPage(() => import('../pages/AdminRedisCachePage'), 'AdminRedisCachePage');
const AdminFirestoreHotPathPage = lazyPage(() => import('../pages/AdminFirestoreHotPathPage'), 'AdminFirestoreHotPathPage');
const AdminR2ArtifactsPage = lazyPage(() => import('../pages/AdminR2ArtifactsPage'), 'AdminR2ArtifactsPage');
const AdminDbInspectorPage = lazyPage(() => import('../pages/AdminDbInspectorPage'), 'AdminDbInspectorPage');
const AdminServerMaintenancePage = lazyPage(() => import('../pages/AdminServerMaintenancePage'), 'AdminServerMaintenancePage');
const AdminFrontendRouteAccessPage = lazyPage(() => import('../pages/AdminFrontendRouteAccessPage'), 'AdminFrontendRouteAccessPage');
const AdminTestLabPage = lazyPage(() => import('../pages/AdminTestLabPage'), 'AdminTestLabPage');
const AdminQlapGGTestPage = lazyPage(() => import('../pages/AdminQlapGGTestPage'), 'AdminQlapGGTestPage');
const AdminTournamentPage = lazyPage(() => import('../pages/AdminTournamentPage'), 'AdminTournamentPage');
const AdminBillingPage = lazyPage(() => import('../pages/AdminBillingPage'), 'AdminBillingPage');
const AdminSubscriptionsPage = lazyPage(() => import('../pages/AdminSubscriptionsPage'), 'AdminSubscriptionsPage');
const AdminGiftsPage = lazyPage(() => import('../pages/AdminGiftsPage'), 'AdminGiftsPage');
const AdminRoflJobsPage = lazyPage(() => import('../pages/AdminRoflJobsPage'), 'AdminRoflJobsPage');
const AdminLiveCwPage = lazyPage(() => import('../pages/AdminLiveCwPage'), 'AdminLiveCwPage');
const AdminQStargramPage = lazyPage(() => import('../pages/AdminQStargramPage'), 'AdminQStargramPage');
const Qlapgginquiry = lazyPage(() => import('../pages/Qlapgginquiry'), 'Qlapgginquiry');
const QlapGGdeclaration = lazyPage(() => import('../pages/QlapGGdeclaration'), 'QlapGGdeclaration');

const ENABLE_FRONTEND_MOCK_TEST =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_FRONTEND_MOCK_TEST === 'true';

const adminChildren: RouteObject[] = [
  { index: true, element: <AdminDashboardPage /> },
  { path: 'users', element: <AdminUsersPage /> },
  { path: 'access', element: <AdminAccessPage /> },
  { path: 'economy', element: <AdminEconomyPage /> },
  { path: 'guilds', element: <AdminGuildsPage /> },
  { path: 'guild-score', element: <AdminGuildScorePage /> },
  { path: 'guild-expedition', element: <AdminGuildExpeditionSettingsPage /> },
  { path: 'tournaments', element: <AdminTournamentPage /> },
  { path: 'live-cw', element: <AdminLiveCwPage /> },
  { path: 'rofl-jobs', element: <AdminRoflJobsPage /> },
  { path: 'user-score', element: <AdminPersonalScorePage /> },
  { path: 'personal-score', element: <AdminPersonalScorePage /> },
  { path: 'seasons', element: <AdminSeasonsPage /> },
  { path: 'test-lab', element: <AdminTestLabPage /> },
  { path: 'qlapgg-test', element: <AdminQlapGGTestPage /> },
  { path: 'items', element: <AdminItemsPage /> },
  { path: 'billing', element: <AdminBillingPage /> },
  { path: 'subscriptions', element: <AdminSubscriptionsPage /> },
  { path: 'gifts', element: <AdminGiftsPage /> },
  { path: 'notice', element: <AdminNoticePage /> },
  { path: 'guild-prize', element: <AdminGuildPrizePage /> },
  { path: 'qstargram', element: <AdminQStargramPage /> },
  { path: 'logs', element: <AdminLogsPage /> },
  { path: 'audit', element: <AdminAuditPage /> },
  { path: 'system', element: <AdminSystemPage /> },
  { path: 'maintenance', element: <AdminServerMaintenancePage /> },
  { path: 'frontend-route-access', element: <AdminFrontendRouteAccessPage /> },
  { path: 'redis-cache', element: <AdminRedisCachePage /> },
  { path: 'firestore-hot-path', element: <AdminFirestoreHotPathPage /> },
  { path: 'r2-artifacts', element: <AdminR2ArtifactsPage /> },
  { path: 'db-inspector', element: <AdminDbInspectorPage /> },
  { path: 'inquiry', element: <Qlapgginquiry /> },
  { path: 'declaration', element: <QlapGGdeclaration /> },
];

if (ENABLE_FRONTEND_MOCK_TEST) {
  adminChildren.splice(15, 0, {
    path: 'frontend-test',
    lazy: async () => {
      const module = await import('../pages/AdminFrontendTestPage');
      return { element: <module.AdminFrontendTestPage /> };
    },
  });
}

export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: adminChildren,
  },
];

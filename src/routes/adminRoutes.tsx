import type { RouteObject } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminUsersPage } from '../pages/AdminUsersPage';
import { AdminAccessPage } from '../pages/AdminAccessPage';
import { AdminEconomyPage } from '../pages/AdminEconomyPage';
import { AdminItemsPage } from '../pages/AdminItemsPage';
import { AdminGuildsPage } from '../pages/AdminGuildsPage';
import { AdminSeasonsPage } from '../pages/AdminSeasonsPage';
import { AdminNoticePage } from '../pages/AdminNoticePage';
import { AdminLogsPage } from '../pages/AdminLogsPage';
import { AdminSystemPage } from '../pages/AdminSystemPage';

/**
 * 어드민 라우트. 경로/메뉴 라벨은 routes/navItems.ts 와 짝을 이룬다.
 * (Tournament/AI 페이지는 대응 백엔드 API가 없어 제거했다.)
 */
export const adminRoutes: RouteObject[] = [
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'access', element: <AdminAccessPage /> },
      { path: 'economy', element: <AdminEconomyPage /> },
      { path: 'guilds', element: <AdminGuildsPage /> },
      { path: 'seasons', element: <AdminSeasonsPage /> },
      { path: 'items', element: <AdminItemsPage /> },
      { path: 'notice', element: <AdminNoticePage /> },
      { path: 'logs', element: <AdminLogsPage /> },
      { path: 'system', element: <AdminSystemPage /> },
    ],
  },
];

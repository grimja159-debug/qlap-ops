import { Suspense } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PageFallback } from '../components/PageFallback';
import { useAuth } from '../contexts/auth';
import { ForbiddenPage } from '../pages/ForbiddenPage';

export function AdminLayout() {
  const { isAuthenticated, isFullAdmin, isLoading, authError } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-500 text-sm">
        인증 확인 중...
      </div>
    );
  }

  if (!isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-3">
        <p className="text-red-400 text-sm">{authError}</p>
        <p className="text-zinc-600 text-xs">신원을 확인하지 못했습니다. 다시 시도해 주세요.</p>
      </div>
    );
  }

  // 완전 관리자(super_admin) 가 아니면 진입 차단.
  if (!isFullAdmin) {
    return <ForbiddenPage />;
  }

  return (
    <div className="relative min-h-screen bg-zinc-950 text-zinc-200">
      {/* 장식용 배경 — 보라/인디고 글로우 + 미세 도트 그리드 */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-48 -left-32 h-[28rem] w-[28rem] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute top-1/3 -right-24 h-[26rem] w-[26rem] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.025)_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative z-10 flex min-h-screen">
        <AdminSidebar />
        <div className="flex-1 ml-60">
          <AdminHeader />
          <main className="mt-14 p-6 min-h-[calc(100vh-3.5rem)]">
            {/* 경로를 key 로 주어, 메뉴 이동 시 에러 경계가 새로 마운트되며 자동 초기화된다. */}
            <ErrorBoundary key={location.pathname}>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}

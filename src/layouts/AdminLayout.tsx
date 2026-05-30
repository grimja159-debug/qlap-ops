import { Navigate, Outlet } from 'react-router-dom';
import { AdminSidebar } from '../components/AdminSidebar';
import { AdminHeader } from '../components/AdminHeader';
import { useAuth } from '../contexts/auth';
import { ForbiddenPage } from '../pages/ForbiddenPage';

export function AdminLayout() {
  const { isAuthenticated, isOperator, isLoading, authError } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-950 text-zinc-500 text-sm">
        인증 확인 중...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (authError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-3">
        <p className="text-red-400 text-sm">{authError}</p>
        <p className="text-zinc-600 text-xs">신원을 확인하지 못했습니다. 다시 시도해 주세요.</p>
      </div>
    );
  }

  // 운영자(operator/admin/super_admin) 권한이 없으면 진입 차단.
  if (!isOperator) {
    return <ForbiddenPage />;
  }

  return (
    <div className="flex bg-zinc-950 min-h-screen">
      <AdminSidebar />
      <div className="flex-1 ml-56">
        <AdminHeader />
        <main className="mt-12 p-6 min-h-[calc(100vh-3rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

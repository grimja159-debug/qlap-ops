import { useAuth } from '../contexts/auth';
import { USER_ROLE_LABELS } from '../lib/constants';

/**
 * 권한 부족 화면.
 * 로그인은 됐지만 운영자(operator/admin/super_admin) 권한이 없을 때 표시된다.
 */
export function ForbiddenPage() {
  const { me, signOut } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-4">
      <div className="text-6xl font-bold text-zinc-700">403</div>
      <div className="text-zinc-400 text-lg font-medium">접근 권한이 없습니다</div>
      <p className="text-zinc-600 text-sm">운영자 이상 권한(operator / admin / super_admin)이 필요합니다.</p>
      {me && (
        <p className="text-zinc-700 text-xs">
          로그인 계정: <span className="text-zinc-500">{me.email}</span> (
          {USER_ROLE_LABELS[me.role] ?? me.role})
        </p>
      )}
      <button
        onClick={() => void signOut()}
        className="mt-2 text-sm text-zinc-500 hover:text-red-400 border border-zinc-700 hover:border-red-500/40 px-4 py-1.5 rounded transition-colors"
      >
        로그아웃
      </button>
    </div>
  );
}

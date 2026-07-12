import { useAuth } from '../contexts/auth';
import { USER_ROLE_LABELS } from '../lib/constants';

function maskEmail(email: string | null | undefined): string {
  if (!email) return '알 수 없음';
  const [name, domain] = email.split('@');
  if (!domain) return '마스킹된 계정';
  const safeName = name.length <= 2 ? `${name.slice(0, 1)}*` : `${name.slice(0, 2)}***`;
  const [domainName, ...rest] = domain.split('.');
  const safeDomain = domainName.length <= 2 ? `${domainName.slice(0, 1)}*` : `${domainName.slice(0, 2)}***`;
  return `${safeName}@${safeDomain}${rest.length > 0 ? `.${rest.join('.')}` : ''}`;
}

/**
 * 권한 부족 화면.
 * 로그인은 됐지만 완전 관리자(super_admin) 권한이 없을 때 표시된다.
 */
export function ForbiddenPage() {
  const { me, signOut } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 gap-4">
      <div className="text-6xl font-bold text-zinc-700">403</div>
      <div className="text-zinc-400 text-lg font-medium">접근 권한이 없습니다</div>
      <p className="text-zinc-600 text-sm">완전 관리자(super_admin) 권한이 필요합니다.</p>
      {me && (
        <p className="text-zinc-700 text-xs">
          로그인 계정: <span className="text-zinc-500">{maskEmail(me.email)}</span> (
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

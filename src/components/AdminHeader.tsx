import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { USER_ROLE_LABELS } from '../lib/constants';
import { PAGE_TITLES } from '../routes/navItems';

/**
 * 상단 헤더. 현재 경로의 제목(navItems 의 라벨)과 로그인한 운영자 정보를 보여준다.
 */
export function AdminHeader() {
  const location = useLocation();
  const { me } = useAuth();
  const title = PAGE_TITLES[location.pathname] ?? '운영자 콘솔';

  return (
    <header className="fixed top-0 left-56 right-0 h-12 bg-zinc-900/95 border-b border-zinc-700/60 flex items-center justify-between px-6 z-10 backdrop-blur-sm">
      <h1 className="text-sm font-semibold text-zinc-200">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500 font-mono">{new Date().toLocaleDateString('ko-KR')}</span>
        {me && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center text-xs text-white font-bold">
              {(me.displayName ?? me.email ?? 'A')[0]?.toUpperCase() ?? 'A'}
            </div>
            <span className="text-xs text-zinc-300">{me.displayName ?? me.email ?? '–'}</span>
            <span className="text-xs bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded">
              {USER_ROLE_LABELS[me.role]}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

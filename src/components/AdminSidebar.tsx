import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/auth';
import { USER_ROLE_LABELS } from '../lib/constants';
import { NAV_ITEMS, NAV_GROUP_ORDER } from '../routes/navItems';

/**
 * 좌측 네비게이션.
 * 메뉴 정의는 routes/navItems.ts 한 곳에 모아두고(헤더 제목도 같은 소스를 쓴다),
 * 여기서는 그룹별로 렌더링만 한다.
 */
export function AdminSidebar() {
  const { me, signOut } = useAuth();

  return (
    <aside className="fixed top-0 left-0 h-screen w-56 bg-zinc-900 border-r border-zinc-700/60 flex flex-col z-20">
      <div className="px-4 py-4 border-b border-zinc-700/60">
        <div className="flex items-center gap-2">
          <span className="text-violet-400 font-bold text-lg">QLap</span>
          <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded font-medium">OPS</span>
        </div>
        <p className="text-zinc-500 text-xs mt-0.5">운영자 콘솔</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV_GROUP_ORDER.map((group) => (
          <div key={group} className="mb-2">
            <p className="px-4 py-1 text-xs font-medium text-zinc-600 uppercase tracking-wider">
              {group}
            </p>
            {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-violet-600/20 text-violet-300 border-r-2 border-violet-500'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800',
                  )
                }
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-700/60">
        {me && (
          <div className="px-4 py-3 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs text-white font-bold shrink-0">
              {(me.displayName ?? me.email ?? 'A')[0]?.toUpperCase() ?? 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-300 truncate">
                {me.displayName ?? me.email ?? '–'}
              </p>
              <p className="text-xs text-zinc-600 truncate">{USER_ROLE_LABELS[me.role]}</p>
            </div>
          </div>
        )}
        <div className="px-3 pb-3">
          <button
            onClick={() => void signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-zinc-400 hover:text-red-400 hover:bg-red-500/10 border border-zinc-700/60 hover:border-red-500/30 transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            로그아웃
          </button>
        </div>
        <p className="px-4 pb-3 text-xs text-zinc-700">qlap-ops v0.1</p>
      </div>
    </aside>
  );
}

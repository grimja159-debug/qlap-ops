import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/auth';
import { USER_ROLE_LABELS } from '../lib/constants';
import { NAV_ITEMS, NAV_GROUP_ORDER, BOTTOM_NAV_ITEMS } from '../routes/navItems';

/**
 * 좌측 네비게이션.
 * 메뉴 정의는 routes/navItems.ts 한 곳에 모아두고(헤더 제목도 같은 소스를 쓴다),
 * 여기서는 그룹별로 렌더링만 한다.
 */
export function AdminSidebar() {
  const { me, signOut } = useAuth();
  const initial = (me?.displayName ?? me?.email ?? 'A')[0]?.toUpperCase() ?? 'A';

  return (
    <aside className="fixed top-0 left-0 z-20 flex h-screen w-60 flex-col border-r border-zinc-800/80 bg-zinc-900/70 backdrop-blur-xl">
      {/* 브랜드 */}
      <div className="flex h-14 items-center gap-2.5 border-b border-zinc-800/80 px-4">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-violet-900/40">
          Q
        </div>
        <div className="leading-tight">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-tight text-zinc-100">QLap</span>
            <span className="rounded bg-violet-600/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-white">
              OPS
            </span>
          </div>
          <p className="-mt-0.5 text-[10px] text-zinc-500">운영자 콘솔</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
        {NAV_GROUP_ORDER.map((group) => (
          <div key={group}>
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
              {group}
            </p>
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/admin'}
                  className={({ isActive }) =>
                    clsx(
                      'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all',
                      isActive
                        ? 'bg-gradient-to-r from-violet-600/25 to-violet-600/[0.04] text-violet-100 shadow-sm shadow-violet-950/40'
                        : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={clsx(
                          'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-violet-400 transition-opacity',
                          isActive ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span
                        className={clsx(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-md text-base leading-none transition-colors',
                          isActive
                            ? 'bg-violet-500/20 ring-1 ring-violet-500/30'
                            : 'bg-zinc-800/60 group-hover:bg-zinc-700/60',
                        )}
                      >
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-800/80">
        <div className="space-y-0.5 px-2.5 py-2">
          {BOTTOM_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all',
                  isActive
                    ? 'bg-gradient-to-r from-violet-600/25 to-violet-600/[0.04] text-violet-100 shadow-sm shadow-violet-950/40'
                    : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx(
                      'absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-violet-400 transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span
                    className={clsx(
                      'grid h-7 w-7 shrink-0 place-items-center rounded-md text-base leading-none transition-colors',
                      isActive
                        ? 'bg-violet-500/20 ring-1 ring-violet-500/30'
                        : 'bg-zinc-800/60 group-hover:bg-zinc-700/60',
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
        {me && (
          <div className="flex items-center gap-2.5 px-4 py-3">
            <div className="relative shrink-0">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white ring-2 ring-violet-500/20">
                {initial}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-emerald-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-200">
                {me.displayName ?? me.email ?? '–'}
              </p>
              <p className="truncate text-[11px] text-violet-300/80">{USER_ROLE_LABELS[me.role]}</p>
            </div>
          </div>
        )}
        <div className="px-3 pb-3">
          <button
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
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
        <p className="px-4 pb-3 text-[10px] text-zinc-700">qlap-ops v0.1</p>
      </div>
    </aside>
  );
}

import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth';
import { USER_ROLE_LABELS } from '../lib/constants';
import { ALL_NAV_ITEMS, PAGE_TITLES } from '../routes/navItems';

/**
 * 상단 헤더. 현재 경로의 그룹/제목(navItems)과 로그인한 운영자 정보,
 * 그리고 라이브 시계를 보여준다.
 */
export function AdminHeader() {
  const location = useLocation();
  const { me } = useAuth();
  const title = PAGE_TITLES[location.pathname] ?? '운영자 콘솔';
  const group = ALL_NAV_ITEMS.find((item) => item.path === location.pathname)?.group;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const initial = (me?.displayName ?? me?.email ?? 'A')[0]?.toUpperCase() ?? 'A';

  return (
    <header className="fixed top-0 left-60 right-0 z-10 flex h-14 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/70 px-6 backdrop-blur-xl">
      {/* 경로 + 제목 */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <span>콘솔</span>
            {group && (
              <>
                <span className="text-zinc-700">/</span>
                <span>{group}</span>
              </>
            )}
          </div>
          <h1 className="-mt-0.5 truncate text-base font-semibold tracking-tight text-zinc-100">{title}</h1>
        </div>
      </div>

      {/* 우측: 라이브 시계 + 운영자 칩 */}
      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1 sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="font-mono text-[11px] tabular-nums text-zinc-400">
            {now.toLocaleTimeString('ko-KR', { hour12: false })}
          </span>
          <span className="text-[11px] text-zinc-600">{now.toLocaleDateString('ko-KR')}</span>
        </div>

        {me && (
          <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 py-1 pl-1 pr-2.5">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-bold text-white">
              {initial}
            </div>
            <span className="max-w-[10rem] truncate text-xs text-zinc-300">{me.displayName ?? me.email ?? '–'}</span>
            <span className="rounded bg-violet-600/20 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
              {USER_ROLE_LABELS[me.role]}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

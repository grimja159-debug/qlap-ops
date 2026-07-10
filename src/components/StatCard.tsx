import { memo } from 'react';
import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  className?: string;
}

export const StatCard = memo(function StatCard({ label, value, sub, accent, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        'group relative flex flex-col gap-1 overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5',
        accent
          ? 'border-violet-500/40 bg-gradient-to-br from-violet-500/10 to-zinc-900/40 hover:border-violet-500/60'
          : 'border-zinc-700/60 bg-gradient-to-br from-zinc-800/60 to-zinc-900/30 hover:border-zinc-600',
        className,
      )}
    >
      {/* 상단 액센트 라인 */}
      <span
        className={clsx(
          'absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent transition-colors',
          accent ? 'via-violet-400/70' : 'via-zinc-600/60 group-hover:via-violet-500/50',
        )}
      />
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
      <span className={clsx('text-2xl font-semibold tabular-nums', accent ? 'text-violet-200' : 'text-zinc-100')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
});

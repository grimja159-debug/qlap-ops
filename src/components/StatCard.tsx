import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
  className?: string;
}

export function StatCard({ label, value, sub, accent, className }: StatCardProps) {
  return (
    <div
      className={clsx(
        'rounded-lg border border-zinc-700/60 bg-zinc-800/50 p-4 flex flex-col gap-1',
        accent && 'border-violet-500/40 bg-violet-500/5',
        className,
      )}
    >
      <span className="text-xs text-zinc-500 uppercase tracking-wide font-medium">{label}</span>
      <span className={clsx('text-2xl font-semibold tabular-nums', accent ? 'text-violet-300' : 'text-zinc-100')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

import { memo } from 'react';
import clsx from 'clsx';
import type { Tone } from '../lib/statusTone';

/**
 * 상태 배지. label(표시 문구) + tone(색상 의미)으로 분리해,
 * 한글 라벨을 쓰면서도 색상 의미를 일관되게 유지한다.
 * tone 매핑은 lib/statusTone.ts 의 헬퍼들을 사용한다.
 */
interface StatusBadgeProps {
  label: string;
  tone?: Tone;
  className?: string;
}

const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  accent: 'bg-violet-500/15 text-violet-300 border border-violet-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
  neutral: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600',
};

// 표 행마다 다수 렌더되는 순수 표시용 배지 — 부모 리렌더 시 동일 props면 리렌더를 건너뛴다.
export const StatusBadge = memo(function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
});

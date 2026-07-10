import clsx from 'clsx';

/**
 * 제목이 달린 카드 섹션. 페이지 안의 논리적 블록(목록/폼/상세)을 감싸는 공통 컨테이너.
 * right 슬롯에 버튼/필터 등을 배치할 수 있다.
 */
interface PageSectionProps {
  title?: string;
  description?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** accent=true 면 강조(보라) 테두리. 편집 중 영역 등에 사용. */
  accent?: boolean;
}

export function PageSection({
  title,
  description,
  right,
  children,
  className,
  accent,
}: PageSectionProps) {
  return (
    <section
      className={clsx(
        'rounded-xl border p-4 shadow-sm shadow-black/20 backdrop-blur-sm',
        accent
          ? 'border-violet-500/40 bg-gradient-to-br from-violet-500/[0.07] to-zinc-900/30'
          : 'border-zinc-700/60 bg-zinc-800/40',
        className,
      )}
    >
      {(title || right) && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <span
              className={clsx(
                'mt-0.5 h-3.5 w-1 shrink-0 rounded-full',
                accent ? 'bg-violet-400' : 'bg-zinc-600',
              )}
            />
            <div>
              {title && (
                <h2
                  className={clsx(
                    'text-xs font-semibold uppercase tracking-wide',
                    accent ? 'text-violet-300' : 'text-zinc-400',
                  )}
                >
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

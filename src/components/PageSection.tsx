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
        'rounded-lg border bg-zinc-800/40 p-4',
        accent ? 'border-violet-500/40 bg-violet-500/5' : 'border-zinc-700/60',
        className,
      )}
    >
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            {title && (
              <h2
                className={clsx(
                  'text-xs font-medium uppercase tracking-wide',
                  accent ? 'text-violet-400' : 'text-zinc-500',
                )}
              >
                {title}
              </h2>
            )}
            {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

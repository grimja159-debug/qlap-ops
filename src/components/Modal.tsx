import { useEffect } from 'react';
import clsx from 'clsx';

/**
 * 중앙 모달 다이얼로그. 유저 상세, 시즌 생성/수정 같은 집중 작업에 사용.
 * - ESC 키와 배경 클릭으로 닫힌다.
 * - 본문이 길면 내부 스크롤(max-h)로 처리한다.
 */
interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** 헤더 우측 영역(상태 배지 등). */
  headerRight?: React.ReactNode;
  size?: 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({ open, title, onClose, children, headerRight, size = 'lg' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[6vh] overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={clsx(
          'w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl',
          SIZE_CLASSES[size],
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-700/60 px-5 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <h2 className="text-sm font-semibold text-zinc-200 truncate">{title}</h2>
            {headerRight}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 text-lg leading-none px-1"
            aria-label="닫기"
          >
            ×
          </button>
        </div>
        <div className="p-5 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

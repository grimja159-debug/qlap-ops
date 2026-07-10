import { useEffect } from 'react';
import clsx from 'clsx';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[6vh]"
      onClick={onClose}
    >
      <div
        className={clsx('w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl', SIZE_CLASSES[size])}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-700/60 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate text-sm font-semibold text-zinc-200">{title}</h2>
            {headerRight}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-1 text-lg leading-none text-zinc-500 hover:text-zinc-200"
            aria-label="닫기"
          >
            x
          </button>
        </div>
        <div className="max-h-[78vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

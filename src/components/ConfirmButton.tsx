import { useState } from 'react';
import clsx from 'clsx';

interface ConfirmButtonProps {
  onConfirm: () => void;
  children: React.ReactNode;
  confirmLabel?: string;
  disabled?: boolean;
  tone?: 'danger' | 'primary' | 'neutral';
  className?: string;
}

const TONE_CLASSES: Record<NonNullable<ConfirmButtonProps['tone']>, string> = {
  primary: 'bg-violet-600 hover:bg-violet-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  neutral: 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100',
};

export function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = '확인',
  disabled,
  tone = 'primary',
  className,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setArmed(false);
            onConfirm();
          }}
          className={clsx('rounded px-3 py-1.5 text-sm disabled:opacity-50', TONE_CLASSES[tone], className)}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="px-2 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
        >
          취소
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setArmed(true)}
      className={clsx('rounded px-3 py-1.5 text-sm disabled:opacity-50', TONE_CLASSES[tone], className)}
    >
      {children}
    </button>
  );
}

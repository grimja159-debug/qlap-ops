import { useState } from 'react';
import clsx from 'clsx';

/**
 * 2단계 확인 버튼.
 *
 * [왜] 계정 정지/해제, 시즌 종료처럼 되돌리기 어렵거나 영향이 큰 작업은
 * 한 번의 클릭으로 실행되면 사고가 난다. 클릭하면 "확인/취소"로 바뀌어
 * 의도적으로 한 번 더 누르게 한다(native confirm 보다 화면 흐름이 자연스럽다).
 */
interface ConfirmButtonProps {
  onConfirm: () => void;
  children: React.ReactNode;
  /** 확인 단계에서 보여줄 문구. */
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
          className={clsx(
            'text-sm px-3 py-1.5 rounded disabled:opacity-50',
            TONE_CLASSES[tone],
            className,
          )}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="text-sm px-2 py-1.5 text-zinc-400 hover:text-zinc-200"
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
      className={clsx('text-sm px-3 py-1.5 rounded disabled:opacity-50', TONE_CLASSES[tone], className)}
    >
      {children}
    </button>
  );
}

import clsx from 'clsx';

/**
 * 폼 제출 결과(성공/실패)를 폼 옆/아래에 표시하는 작은 인라인 배너.
 * 액션 결과 메시지를 페이지마다 다른 방식으로 그리지 않도록 통일한다.
 *
 * 에러 객체 → 메시지 변환은 lib/apiError.ts 의 errorToMessage() 를 사용한다.
 */
export type MessageKind = 'success' | 'error' | 'info';

interface InlineMessageProps {
  kind: MessageKind;
  children: React.ReactNode;
  className?: string;
}

const KIND_CLASSES: Record<MessageKind, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-zinc-400',
};

export function InlineMessage({ kind, children, className }: InlineMessageProps) {
  return <span className={clsx('text-xs', KIND_CLASSES[kind], className)}>{children}</span>;
}

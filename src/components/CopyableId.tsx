import { memo, useState } from 'react';
import { shortId } from '../lib/format';

/**
 * UID/문서 ID 표시 + 클릭 복사.
 * [왜] 운영 중 UID 를 다른 화면/도구에 붙여넣는 일이 잦다. 매번 길게 드래그하지 않도록
 * 클릭 한 번으로 전체 값을 클립보드에 복사한다(표에는 축약형으로 보여줌).
 */
interface CopyableIdProps {
  value: string | null | undefined;
  /** true 면 전체값 표시, false(기본)면 축약. */
  full?: boolean;
}

export const CopyableId = memo(function CopyableId({ value, full }: CopyableIdProps) {
  const [copied, setCopied] = useState(false);

  if (!value) return <span className="text-zinc-600">–</span>;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // 클립보드 권한이 없으면 무시(표시는 그대로 유지).
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`클릭하여 복사: ${value}`}
      className="font-mono text-xs text-zinc-500 hover:text-violet-300 transition-colors"
    >
      {full ? value : shortId(value)}
      {copied && <span className="ml-1 text-emerald-400">복사됨</span>}
    </button>
  );
});
